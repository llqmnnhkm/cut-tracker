import { describe, expect, it } from 'vitest';
import { dayPlan } from './rules';
import { emptyStore } from './store';
import { buildChecklist, checkKeys, sessionLabel } from './workout';

const plain = (date: string) => dayPlan(emptyStore(), date);

const painStore = (date: string) => ({ ...emptyStore(), days: { [date]: { flags: { pain: true } } } });

describe('checklists', () => {
  it('builds workout A with its finisher', () => {
    const list = buildChecklist(plain('2026-11-03'));
    expect(list.groups.map((g) => g.title)).toEqual(['Workout A', 'Finisher']);
    expect(list.groups[0].items.map((i) => i.boxes)).toEqual([1, 3, 3, 4, 3, 3]);
    expect(list.groups[1].items[0].boxes).toBe(5);
  });

  it('removes the finisher when pain is flagged', () => {
    const day = dayPlan(painStore('2026-11-05'), '2026-11-05');
    const list = buildChecklist(day);
    expect(list.groups.map((g) => g.title)).toEqual(['Workout B']);
    expect(list.finisherSkipped).toBe(true);
    expect(sessionLabel(day)).toBe('Workout B, no finisher');
  });

  it('builds the reduced 11 Nov session: 2 sets, no burpees, no finisher', () => {
    const list = buildChecklist(plain('2026-11-11'));
    const [warmUp, ...exercises] = list.groups[0].items;
    expect(list.groups).toHaveLength(1);
    expect(warmUp.name).toBe('Warm up');
    expect(exercises.map((i) => i.name)).not.toContain('Burpees');
    expect(exercises).toHaveLength(4);
    expect(exercises.every((i) => i.boxes === 2)).toBe(true);
  });

  it('builds 10 rounds of intervals', () => {
    const list = buildChecklist(plain('2026-11-04'));
    expect(list.groups[0].items.map((i) => i.boxes)).toEqual([1, 10, 1]);
  });

  it('builds a 40 minute walk and 10 minutes of stretching', () => {
    const items = buildChecklist(plain('2026-11-06')).groups[0].items;
    expect(items.map((i) => i.detail)).toEqual(['40 min', '10 min']);
  });

  it.each(['2026-11-08', '2026-11-12', '2026-11-13'])('has nothing to tick on %s', (date) => {
    const list = buildChecklist(plain(date));
    expect(checkKeys(list)).toEqual([]);
    expect(list.message).toBeTruthy();
  });
});
