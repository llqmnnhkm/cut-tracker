// Turns the plan and the log into what a given day should show.

import { addDays, daysBetween, weekdayIndex } from './dates';
import {
  CHECKPOINTS,
  CUT_SCHEDULE,
  DECISION_DATE,
  DECISION_LIMIT,
  JOG_DAYS,
  PHASES,
  ROTATION,
  WEIGH_IN,
  type Macros,
  type PhaseId,
  type SessionId,
} from './plan';
import type { DayLog, Meal, Store } from './store';

export function parseAmount(raw: string): number | undefined {
  const clean = raw.trim();
  if (clean === '') return undefined;
  return Number(/^\d{1,3}(,\d{3})+$/.test(clean) ? clean.replace(/,/g, '') : clean.replace(',', '.'));
}

export function phaseFor(date: string): PhaseId | null {
  if (date === WEIGH_IN) return null;
  if (date > WEIGH_IN) return 'after';
  if (date >= '2026-11-11') return 'lowFibre';
  if (date >= '2026-11-09') return 'lowCarb';
  return 'base';
}

export function targetsFor(date: string, overrides: Partial<Record<PhaseId, Macros>> = {}): Macros | null {
  const id = phaseFor(date);
  if (!id) return null;
  return overrides[id] ?? PHASES[id].targets;
}

// After the weigh-in the rotation runs through every non-rest day in order.
export function sessionFor(date: string, restDay: number): SessionId {
  const planned = CUT_SCHEDULE[date];
  if (planned) return planned.session;
  if (weekdayIndex(date) === restDay) return 'rest';
  let trainingDays = 0;
  for (let d = addDays(WEIGH_IN, 1); d < date; d = addDays(d, 1)) {
    if (weekdayIndex(d) !== restDay) trainingDays += 1;
  }
  return ROTATION[trainingDays % ROTATION.length];
}

export const hasFinisher = (session: SessionId) => session === 'A' || session === 'B' || session === 'C';

export interface DayPlan {
  session: SessionId;
  steps: number | null;
  plannedSteps: number | null;
  skipFinisher: boolean;
  jog: boolean;
  pain: boolean;
  fatigueToday: boolean;
  fatigueAdjusted: boolean;
  dizzy: boolean;
  emergency: boolean;
}

// Safety adjustments only ever lower the load for the day.
export function dayPlan(store: Store, date: string): DayPlan {
  const session = sessionFor(date, store.settings.restDay);
  const plannedSteps = CUT_SCHEDULE[date]?.steps ?? null;
  const flags = store.days[date]?.flags ?? {};
  const pain = !!flags.pain;
  const fatigueToday = !!flags.fatigue;
  const fatigueAdjusted = fatigueToday && !!store.days[addDays(date, -1)]?.flags?.fatigue;

  let steps = plannedSteps;
  if (steps !== null) {
    if (fatigueAdjusted) steps = Math.min(steps, 15000);
    if (pain) steps = Math.min(steps, 12000);
  }

  return {
    session,
    steps,
    plannedSteps,
    skipFinisher: pain || fatigueAdjusted,
    jog: JOG_DAYS.includes(date) && !pain && !fatigueAdjusted && !flags.dizzy && !flags.emergency,
    pain,
    fatigueToday,
    fatigueAdjusted,
    dizzy: !!flags.dizzy,
    emergency: !!flags.emergency,
  };
}

const mealKcal = (m: Meal) => (m.kcalHigh !== undefined ? (m.kcal + m.kcalHigh) / 2 : m.kcal);

export interface DayTotals {
  kcal: number;
  kcalLow: number;
  kcalHigh: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function totals(log: DayLog | undefined): DayTotals {
  const out: DayTotals = { kcal: 0, kcalLow: 0, kcalHigh: 0, protein: 0, carbs: 0, fat: 0 };
  for (const m of log?.meals ?? []) {
    out.kcal += mealKcal(m);
    out.kcalLow += m.kcal;
    out.kcalHigh += m.kcalHigh ?? m.kcal;
    out.protein += m.protein ?? 0;
    out.carbs += m.carbs ?? 0;
    out.fat += m.fat ?? 0;
  }
  return out;
}

export interface WeightPoint {
  date: string;
  weight: number;
  trend: number;
}

// The trend is the average of everything logged in the five days up to each date.
export function weightSeries(store: Store): WeightPoint[] {
  const logged = Object.keys(store.days)
    .filter((d) => store.days[d].weight !== undefined)
    .sort();
  return logged.map((date) => {
    const windowed = logged.filter((d) => d <= date && daysBetween(d, date) < 5);
    const sum = windowed.reduce((acc, d) => acc + store.days[d].weight!, 0);
    return { date, weight: store.days[date].weight!, trend: sum / windowed.length };
  });
}

export const nextCheckpoint = (date: string) => CHECKPOINTS.find((c) => c.date >= date) ?? null;

export const isAboveDecisionLimit = (store: Store) => (store.days[DECISION_DATE]?.weight ?? 0) > DECISION_LIMIT;

export const showRebound = (date: string) => date >= WEIGH_IN && date <= addDays(WEIGH_IN, 5);
