// "Every X minutes": do a set at the start of each block, rest for the rest of it.
// The running session is saved as it goes, so a reload carries on.

import { useEffect, useState } from 'preact/hooks';
import { getStore, updateDay, updateSettings } from './store';

export interface EmomSetup {
  exercise: string;
  reps: number;
  everyMin: number;
  totalMin: number;
}

export interface EmomLog extends EmomSetup {
  id: string;
  start: number;
  rounds: number; // rounds ticked done
  of: number;
}

export interface EmomRun extends EmomSetup {
  date: string;
  start: number; // moves forward by paused time on resume
  pausedAt: number | null;
  done: number[];
}

export const DEFAULT_EMOM: EmomSetup = { exercise: 'Push ups', reps: 20, everyMin: 5, totalMin: 60 };

export const roundsIn = (s: Pick<EmomSetup, 'everyMin' | 'totalMin'>) => Math.max(1, Math.floor(s.totalMin / s.everyMin));

// Where a run is: the round (1 based), seconds left in it, and whether it has ended.
export function emomPosition(run: EmomSetup & { start: number; pausedAt: number | null }, now: number) {
  const total = roundsIn(run);
  const block = run.everyMin * 60;
  const elapsed = Math.max(0, ((run.pausedAt ?? now) - run.start) / 1000);
  const index = Math.floor(elapsed / block);
  if (index >= total) return { round: total, left: 0, elapsed: total * block, total, ended: true };
  return { round: index + 1, left: Math.ceil(block - (elapsed - index * block)), elapsed, total, ended: false };
}

const KEY = 'cut-tracker-emom';

function load(): EmomRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EmomRun) : null;
  } catch {
    return null;
  }
}

let current: EmomRun | null = load();
const listeners = new Set<() => void>();

function set(next: EmomRun | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Keeps running in memory.
  }
  listeners.forEach((l) => l());
}

export function startEmom(date: string, setup: EmomSetup) {
  updateSettings({ emom: setup });
  set({ ...setup, date, start: Date.now(), pausedAt: null, done: [] });
}

export function pauseEmom() {
  if (current && current.pausedAt === null) set({ ...current, pausedAt: Date.now() });
}

export function resumeEmom() {
  if (current && current.pausedAt !== null) set({ ...current, start: current.start + Date.now() - current.pausedAt, pausedAt: null });
}

export function toggleRound(round: number) {
  if (!current) return;
  const done = current.done.includes(round) ? current.done.filter((r) => r !== round) : [...current.done, round];
  set({ ...current, done });
}

// Saves what was done to the day it started on. Nothing is saved if no round was ticked.
export function finishEmom() {
  if (!current) return;
  const r = current;
  if (r.done.length > 0) {
    const log: EmomLog = {
      id: `${r.start}`,
      exercise: r.exercise,
      reps: r.reps,
      everyMin: r.everyMin,
      totalMin: r.totalMin,
      start: r.start,
      rounds: r.done.length,
      of: roundsIn(r),
    };
    updateDay(r.date, (d) => ({ ...d, emoms: [...(d.emoms ?? []), log] }));
  }
  set(null);
}

export const discardEmom = () => set(null);

export function removeEmom(date: string, id: string) {
  updateDay(date, (d) => ({ ...d, emoms: (d.emoms ?? []).filter((e) => e.id !== id) }));
}

export const savedSetup = (): EmomSetup => getStore().settings.emom ?? DEFAULT_EMOM;

export function useEmom(): EmomRun | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return current;
}
