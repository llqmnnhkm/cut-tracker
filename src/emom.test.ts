import { describe, expect, it } from 'vitest';
import { emomPosition, roundsIn } from './emom';

const run = { exercise: 'Push ups', reps: 20, everyMin: 5, totalMin: 60, start: 0, pausedAt: null };

describe('every X minutes', () => {
  it('counts rounds in a session', () => {
    expect(roundsIn(run)).toBe(12);
    expect(roundsIn({ everyMin: 5, totalMin: 62 })).toBe(12);
    expect(roundsIn({ everyMin: 5, totalMin: 3 })).toBe(1);
  });

  it('finds the round and time left', () => {
    expect(emomPosition(run, 0)).toMatchObject({ round: 1, left: 300, ended: false });
    expect(emomPosition(run, 299_500)).toMatchObject({ round: 1, left: 1 });
    expect(emomPosition(run, 300_000)).toMatchObject({ round: 2, left: 300 });
    expect(emomPosition(run, 11 * 300_000 + 60_000)).toMatchObject({ round: 12, left: 240, ended: false });
    expect(emomPosition(run, 3_600_000)).toMatchObject({ round: 12, ended: true });
  });

  it('stands still while paused', () => {
    const paused = { ...run, pausedAt: 90_000 };
    expect(emomPosition(paused, 999_999)).toMatchObject({ round: 1, left: 210 });
  });
});
