// Ticking a box, shared by a tap on the Workout tab and the exercise timer.

import { dayPlan } from './rules';
import { getStore, updateDay } from './store';
import { buildChecklist, checkKeys, hasOpenRestBoxes, type CheckItem } from './workout';

export type CheckResult = 'finished' | 'rest' | null;

export function setCheck(date: string, item: CheckItem, n: number, on: boolean): CheckResult {
  const list = buildChecklist(dayPlan(getStore(), date));
  const checks = { ...(getStore().days[date]?.checks ?? {}), [`${item.id}:${n}`]: on };
  const allKeys = checkKeys(list);
  const finished = allKeys.length > 0 && allKeys.every((k) => checks[k]);
  updateDay(date, (d) => ({ ...d, checks, workoutDone: finished || d.workoutDone }));
  if (!on) return null;
  if (finished) return 'finished';
  return item.rest && hasOpenRestBoxes(list, checks) ? 'rest' : null;
}

export function findItem(date: string, id: string): CheckItem | undefined {
  const list = buildChecklist(dayPlan(getStore(), date));
  return list.groups.flatMap((g) => g.items).find((i) => i.id === id);
}
