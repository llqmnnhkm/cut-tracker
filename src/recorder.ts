// Records a walk or run with the phone's GPS. The recording is saved as it goes,
// so closing or reloading the app mid-walk picks it back up.

import { useEffect, useState } from 'preact/hooks';
import { addFix, breakTrack, emptyTrack, thinRoute, type Activity, type ActivityType, type Track } from './activity';
import { localToday } from './dates';
import { addActivity } from './store';

export type GpsState = 'waiting' | 'ok' | 'fair' | 'weak' | 'denied' | 'unavailable';

export interface Recording {
  type: ActivityType;
  start: number;
  movingMs: number; // time banked from earlier legs
  legStart: number | null; // null while paused
  track: Track;
  gps: GpsState;
  accuracy?: number;
}

const KEY = 'cut-tracker-recording';

function load(): Recording | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Recording) : null;
  } catch {
    return null;
  }
}

let current: Recording | null = load();
let watchId: number | null = null;
// Recent distance samples for the current pace; not worth saving.
let recent: { time: number; meters: number }[] = [];
const listeners = new Set<() => void>();

function set(next: Recording | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // The recording still runs in memory.
  }
  listeners.forEach((l) => l());
}

export const getRecording = () => current;

export const movingSeconds = (r: Recording, now = Date.now()) =>
  (r.movingMs + (r.legStart !== null ? now - r.legStart : 0)) / 1000;

// Pace over roughly the last 30 seconds, in seconds per km.
export function currentPace(now = Date.now()): number | null {
  recent = recent.filter((s) => now - s.time <= 30_000);
  if (recent.length < 2) return null;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const meters = last.meters - first.meters;
  if (meters < 15) return null;
  return (last.time - first.time) / 1000 / (meters / 1000);
}

function watch() {
  if (watchId !== null) return;
  if (!('geolocation' in navigator)) {
    if (current) set({ ...current, gps: 'unavailable' });
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (!current || current.legStart === null) return;
      const track = addFix(current.track, {
        at: [pos.coords.latitude, pos.coords.longitude],
        accuracy: pos.coords.accuracy,
        time: pos.timestamp,
      }, current.type);
      if (track.meters !== current.track.meters) recent.push({ time: pos.timestamp, meters: track.meters });
      set({ ...current, track, accuracy: pos.coords.accuracy, gps: pos.coords.accuracy <= 30 ? 'ok' : pos.coords.accuracy <= 65 ? 'fair' : 'weak' });
    },
    (err) => {
      if (!current) return;
      set({ ...current, gps: err.code === err.PERMISSION_DENIED ? 'denied' : 'weak' });
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
  );
}

function unwatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  recent = [];
}

export function startRecording(type: ActivityType) {
  const now = Date.now();
  set({ type, start: now, movingMs: 0, legStart: now, track: emptyTrack(), gps: 'waiting' });
  watch();
}

export function pauseRecording() {
  if (!current || current.legStart === null) return;
  unwatch();
  set({ ...current, movingMs: current.movingMs + Date.now() - current.legStart, legStart: null, track: breakTrack(current.track) });
}

export function resumeRecording() {
  if (!current || current.legStart !== null) return;
  set({ ...current, legStart: Date.now(), gps: 'waiting' });
  watch();
}

export function setRecordingType(type: ActivityType) {
  if (current) set({ ...current, type });
}

// Saves the recording to the day it started on and returns it.
export function finishRecording(): Activity | null {
  if (!current) return null;
  unwatch();
  const r = current;
  const activity: Activity = {
    id: `${r.start}`,
    type: r.type,
    start: r.start,
    seconds: Math.round(movingSeconds(r)),
    meters: Math.round(r.track.meters),
    ...(r.track.route.length > 1 ? { route: thinRoute(r.track.route) } : {}),
  };
  addActivity(localToday(new Date(r.start)), activity);
  set(null);
  return activity;
}

export function discardRecording() {
  unwatch();
  set(null);
}

export function useRecording(): Recording | null {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return current;
}

// A reload during a walk carries on where it was.
if (current && current.legStart !== null) watch();
