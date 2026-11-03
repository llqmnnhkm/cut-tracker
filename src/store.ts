// All data lives in this device's localStorage. Nothing leaves the phone
// except a backup file the user chooses to export.

import { useEffect, useState } from 'preact/hooks';
import type { FlagId, Macros, PhaseId } from './plan';
import type { Theme } from './theme';

export interface Meal {
  id: string;
  name: string;
  kcal: number; // the exact figure, or the low end when kcalHigh is set
  kcalHigh?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface DayLog {
  weight?: number;
  steps?: number;
  waterMl?: number;
  meals?: Meal[];
  checks?: Record<string, boolean>;
  workoutDone?: boolean;
  flags?: Partial<Record<FlagId, boolean>>;
}

export interface Settings {
  restDay: number; // 0 is Sunday
  targets: Partial<Record<PhaseId, Macros>>;
  restSeconds: number;
  lastBackup?: string;
  theme?: Theme;
}

export interface Store {
  version: 1;
  days: Record<string, DayLog>;
  settings: Settings;
}

const KEY = 'cut-tracker';

export const emptyStore = (): Store => ({
  version: 1,
  days: {},
  settings: { restDay: 0, targets: {}, restSeconds: 90 },
});

export function parseStore(raw: string): Store | null {
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || typeof data.days !== 'object' || data.days === null) return null;
    return { ...emptyStore(), ...data, settings: { ...emptyStore().settings, ...data.settings } };
  } catch {
    return null;
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return (raw && parseStore(raw)) || emptyStore();
  } catch {
    return emptyStore();
  }
}

let current = load();
let saveFailed = false;
const listeners = new Set<() => void>();

function commit(next: Store) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    saveFailed = false;
  } catch {
    saveFailed = true;
  }
  listeners.forEach((l) => l());
}

export const getStore = () => current;
export const didSaveFail = () => saveFailed;
export const replaceStore = (next: Store) => commit(next);

export function updateDay(date: string, change: (day: DayLog) => DayLog) {
  commit({ ...current, days: { ...current.days, [date]: change(current.days[date] ?? {}) } });
}

export function updateSettings(change: Partial<Settings>) {
  commit({ ...current, settings: { ...current.settings, ...change } });
}

export function useStore(): Store {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return current;
}
