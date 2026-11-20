// Sets with timed rest: do the reps, tap Done, rest for a set time, then it rings for
// the next set. The running session is saved as it goes, so a reload carries on.

import { useEffect, useState } from 'preact/hooks';
import { getStore, updateDay, updateSettings } from './store';
import { cancelAlerts, scheduleAlerts, type AlertStatus, type PushAlert } from './push';

export interface EmomSetup {
  exercise: string;
  reps: number;
  restMin: number;
  rounds: number;
}

export interface EmomLog {
  id: string;
  start: number;
  exercise: string;
  reps: number;
  rounds: number; // sets done
  of: number;
  restMin?: number;
  everyMin?: number; // logs saved by the first version, which ran on a fixed clock
}

export interface EmomRun extends EmomSetup {
  date: string;
  start: number;
  done: number; // sets finished
  restUntil: number | null; // while resting
  pausedLeft: number | null; // ms of rest left, while paused
}

export const DEFAULT_EMOM: EmomSetup = { exercise: 'Push ups', reps: 20, restMin: 5, rounds: 12 };

// Reads the saved setup, including the first version's "every X min for Y min" shape.
export function savedSetup(): EmomSetup {
  const s = getStore().settings.emom as (Partial<EmomSetup> & { everyMin?: number; totalMin?: number }) | undefined;
  if (!s) return DEFAULT_EMOM;
  const restMin = s.restMin ?? s.everyMin ?? DEFAULT_EMOM.restMin;
  const rounds = s.rounds ?? (s.totalMin && s.everyMin ? Math.max(1, Math.floor(s.totalMin / s.everyMin)) : DEFAULT_EMOM.rounds);
  return { exercise: s.exercise ?? DEFAULT_EMOM.exercise, reps: s.reps ?? DEFAULT_EMOM.reps, restMin, rounds };
}

export type EmomPhase = 'set' | 'rest' | 'paused' | 'finished';

// Where a run is now. Rest that has run out turns into the next set.
export function emomPhase(run: Pick<EmomRun, 'done' | 'rounds' | 'restUntil' | 'pausedLeft'>, now: number) {
  if (run.done >= run.rounds) return { phase: 'finished' as EmomPhase, set: run.rounds, left: 0 };
  if (run.pausedLeft !== null) return { phase: 'paused' as EmomPhase, set: run.done + 1, left: Math.ceil(run.pausedLeft / 1000) };
  if (run.restUntil !== null && run.restUntil > now) return { phase: 'rest' as EmomPhase, set: run.done + 1, left: Math.ceil((run.restUntil - now) / 1000) };
  return { phase: 'set' as EmomPhase, set: run.done + 1, left: 0 };
}

// The alert for the end of a rest, and a nudge two minutes later in case it was missed.
export function alertsFor(run: Pick<EmomRun, 'done' | 'rounds' | 'reps' | 'exercise'>, restUntil: number): PushAlert[] {
  const set = run.done + 1;
  const what = `${run.reps} ${run.exercise.toLowerCase()}`;
  return [
    { at: restUntil, title: `Rest over · set ${set} of ${run.rounds}`, body: `Time for ${what}.` },
    { at: restUntil + 2 * 60_000, title: `Set ${set} of ${run.rounds} is waiting`, body: `${what}, then tap Done.` },
  ];
}

const KEY = 'cut-tracker-emom';

function load(): EmomRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    const run = raw ? (JSON.parse(raw) as EmomRun) : null;
    // A session from the first version can't carry on in this one.
    return run && typeof run.done === 'number' ? run : null;
  } catch {
    return null;
  }
}

let current: EmomRun | null = load();
let alertStatus: AlertStatus | 'pending' | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function set(next: EmomRun | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Keeps running in memory.
  }
  notify();
}

export const getAlertStatus = () => alertStatus;

function setAlerts(alerts: PushAlert[]) {
  alertStatus = 'pending';
  notify();
  void scheduleAlerts(alerts).then((status) => {
    alertStatus = status;
    notify();
  });
}

function clearAlerts() {
  void cancelAlerts();
}

export function startEmom(date: string, setup: EmomSetup) {
  updateSettings({ emom: setup });
  alertStatus = null;
  set({ ...setup, date, start: Date.now(), done: 0, restUntil: null, pausedLeft: null });
}

// Call straight from the tap: iOS only asks for notification permission inside one.
export function finishSet() {
  if (!current) return;
  const done = current.done + 1;
  if (done >= current.rounds) {
    set({ ...current, done, restUntil: null, pausedLeft: null });
    clearAlerts();
    return;
  }
  const restUntil = Date.now() + current.restMin * 60_000;
  const run = { ...current, done, restUntil, pausedLeft: null };
  set(run);
  setAlerts(alertsFor(run, restUntil));
}

// Takes back the last Done, for a mis-tap.
export function undoSet() {
  if (!current || current.done === 0) return;
  set({ ...current, done: current.done - 1, restUntil: null, pausedLeft: null });
  clearAlerts();
}

export function skipRest() {
  if (!current) return;
  set({ ...current, restUntil: null, pausedLeft: null });
  clearAlerts();
}

export function pauseRest() {
  if (!current || current.restUntil === null || current.pausedLeft !== null) return;
  set({ ...current, pausedLeft: Math.max(0, current.restUntil - Date.now()), restUntil: null });
  clearAlerts();
}

export function resumeRest() {
  if (!current || current.pausedLeft === null) return;
  const restUntil = Date.now() + current.pausedLeft;
  const run = { ...current, restUntil, pausedLeft: null };
  set(run);
  setAlerts(alertsFor(run, restUntil));
}

export function addRestTime(seconds: number) {
  if (!current || current.restUntil === null) return;
  const restUntil = current.restUntil + seconds * 1000;
  const run = { ...current, restUntil };
  set(run);
  setAlerts(alertsFor(run, restUntil));
}

// Saves what was done to the day it started on. Nothing is saved if no set was done.
export function finishEmom() {
  if (!current) return;
  const r = current;
  if (r.done > 0) {
    const log: EmomLog = { id: `${r.start}`, start: r.start, exercise: r.exercise, reps: r.reps, restMin: r.restMin, rounds: r.done, of: r.rounds };
    updateDay(r.date, (d) => ({ ...d, emoms: [...(d.emoms ?? []), log] }));
  }
  set(null);
  clearAlerts();
}

export function discardEmom() {
  set(null);
  clearAlerts();
}

export function removeEmom(date: string, id: string) {
  updateDay(date, (d) => ({ ...d, emoms: (d.emoms ?? []).filter((e) => e.id !== id) }));
}

export function useEmom(): EmomRun | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return current;
}
