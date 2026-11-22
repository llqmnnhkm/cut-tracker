import { describe, expect, it } from 'vitest';
import { dayHistory, historyTotals } from './History';
import { emptyStore } from './store';

describe('workout history', () => {
  const store = emptyStore();
  store.days['2026-11-20'] = {
    workoutDone: true,
    emoms: [{ id: '1', start: 0, exercise: 'Push ups', reps: 20, rounds: 12, of: 12, restMin: 5 }],
    activities: [{ id: 'a', type: 'walk', start: new Date(2026, 10, 20, 18).getTime(), seconds: 1500, meters: 2100 }],
  };
  store.days['2026-11-21'] = { emoms: [{ id: '2', start: 0, exercise: 'Push ups', reps: 20, rounds: 5, of: 12, restMin: 5 }] };
  store.days['2026-11-22'] = { weight: 80.9 };

  it('lists what was done on a day', () => {
    const items = dayHistory(store, '2026-11-20');
    expect(items.map((i) => i.kind)).toEqual(['session', 'sets', 'walk']);
    expect(items[1]).toMatchObject({ title: '240 push ups', detail: '12 of 12 sets of 20 · 5 min rest', done: true });
    expect(items[2]).toMatchObject({ title: 'Evening Walk', detail: '2.10 km · 25:00' });
    expect(dayHistory(store, '2026-11-22')).toEqual([]);
  });

  it('totals a month', () => {
    expect(historyTotals(store, '2026-11-01', '2026-11-30')).toEqual({ activeDays: 2, meters: 2100, top: { exercise: 'push ups', reps: 340 } });
  });
});
