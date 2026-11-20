import { describe, expect, it } from 'vitest';
import { alertsFor, emomPhase } from './emom';

const run = { exercise: 'Push ups', reps: 20, rounds: 12, done: 0, restUntil: null as number | null, pausedLeft: null as number | null };

describe('sets with timed rest', () => {
  it('waits on a set until Done is tapped', () => {
    expect(emomPhase(run, 999_999)).toEqual({ phase: 'set', set: 1, left: 0 });
  });

  it('counts down rest, then moves to the next set', () => {
    const resting = { ...run, done: 3, restUntil: 300_000 };
    expect(emomPhase(resting, 0)).toEqual({ phase: 'rest', set: 4, left: 300 });
    expect(emomPhase(resting, 299_500)).toEqual({ phase: 'rest', set: 4, left: 1 });
    expect(emomPhase(resting, 300_000)).toEqual({ phase: 'set', set: 4, left: 0 });
  });

  it('holds rest while paused, and ends after the last set', () => {
    expect(emomPhase({ ...run, done: 2, pausedLeft: 90_000 }, 5_000_000)).toEqual({ phase: 'paused', set: 3, left: 90 });
    expect(emomPhase({ ...run, done: 12 }, 0)).toMatchObject({ phase: 'finished' });
  });

  it('alerts when rest ends, and nudges two minutes later', () => {
    const alerts = alertsFor({ ...run, done: 3 }, 300_000);
    expect(alerts).toEqual([
      { at: 300_000, title: 'Rest over · set 4 of 12', body: 'Time for 20 push ups.' },
      { at: 420_000, title: 'Set 4 of 12 is waiting', body: '20 push ups, then tap Done.' },
    ]);
  });
});
