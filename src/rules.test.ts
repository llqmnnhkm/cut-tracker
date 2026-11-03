import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, localToday, shortDate, weekdayName } from './dates';
import { CHECKPOINTS, CUT_SCHEDULE, FLAGS, PHASES, REBOUND_NOTE } from './plan';
import * as plan from './plan';
import { dayPlan, isAboveDecisionLimit, parseAmount, phaseFor, sessionFor, showRebound, targetsFor, totals, weightSeries } from './rules';
import { emptyStore, parseStore, type DayLog, type Store } from './store';

const withDays = (days: Record<string, DayLog>): Store => ({ ...emptyStore(), days });

describe('dates', () => {
  it('moves across months without shifting a day', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-03', -3)).toBe('2026-10-31');
    expect(daysBetween('2026-11-03', '2026-11-13')).toBe(10);
  });

  it('names days correctly', () => {
    expect(weekdayName('2026-11-03')).toBe('Tuesday');
    expect(weekdayName('2026-11-08')).toBe('Sunday');
    expect(shortDate('2026-11-13')).toBe('13 Nov');
  });

  it('uses the local calendar day', () => {
    expect(localToday(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
    expect(localToday(new Date(2026, 10, 4, 0, 1))).toBe('2026-11-04');
  });
});

describe('nutrition targets', () => {
  it.each([
    ['2026-11-03', 1700, 170, 140, 50],
    ['2026-11-08', 1700, 170, 140, 50],
    ['2026-11-09', 1500, 170, 75, 55],
    ['2026-11-10', 1500, 170, 75, 55],
    ['2026-11-11', 1400, 160, 80, 50],
    ['2026-11-12', 1400, 160, 80, 50],
    ['2026-11-14', 1700, 170, 140, 50],
    ['2027-01-20', 1700, 170, 140, 50],
  ])('%s', (date, kcal, protein, carbs, fat) => {
    expect(targetsFor(date)).toEqual({ kcal, protein, carbs, fat });
  });

  it('has no target on the weigh-in day', () => {
    expect(phaseFor('2026-11-13')).toBeNull();
    expect(targetsFor('2026-11-13')).toBeNull();
  });

  it('uses edited targets for that phase only', () => {
    const edited = { kcal: 1800, protein: 170, carbs: 150, fat: 55 };
    expect(targetsFor('2026-11-05', { base: edited })).toEqual(edited);
    expect(targetsFor('2026-11-09', { base: edited })).toEqual(PHASES.lowCarb.targets);
  });
});

describe('schedule', () => {
  it('covers every day of the cut', () => {
    expect(Object.keys(CUT_SCHEDULE)).toHaveLength(11);
    expect(CUT_SCHEDULE['2026-11-08']).toEqual({ session: 'rest', steps: null });
    expect(CUT_SCHEDULE['2026-11-11']).toEqual({ session: 'B-light', steps: 15000 });
  });

  it('repeats the rotation after the weigh-in, skipping the rest day', () => {
    // 14 Nov is a Saturday and 15 Nov a Sunday.
    expect(sessionFor('2026-11-14', 0)).toBe('A');
    expect(sessionFor('2026-11-15', 0)).toBe('rest');
    expect(sessionFor('2026-11-16', 0)).toBe('intervals');
    expect(sessionFor('2026-11-17', 0)).toBe('B');
    expect(sessionFor('2026-11-18', 0)).toBe('cardio');
    expect(sessionFor('2026-11-19', 0)).toBe('C');
    expect(sessionFor('2026-11-20', 0)).toBe('A');
    expect(sessionFor('2026-11-22', 0)).toBe('rest');
  });

  it('follows a changed rest day after the cut but not during it', () => {
    expect(sessionFor('2026-11-14', 6)).toBe('rest');
    expect(sessionFor('2026-11-15', 6)).toBe('A');
    expect(sessionFor('2026-11-07', 6)).toBe('C');
  });

  it('has no step target after the cut', () => {
    expect(dayPlan(emptyStore(), '2026-11-20').steps).toBeNull();
  });
});

describe('safety adjustments', () => {
  it('leaves a normal day alone', () => {
    const day = dayPlan(emptyStore(), '2026-11-05');
    expect(day.steps).toBe(18000);
    expect(day.skipFinisher).toBe(false);
    expect(day.jog).toBe(true);
  });

  it('drops to 12,000 steps, no finisher and no jog on pain', () => {
    const day = dayPlan(withDays({ '2026-11-05': { flags: { pain: true } } }), '2026-11-05');
    expect(day.steps).toBe(12000);
    expect(day.skipFinisher).toBe(true);
    expect(day.jog).toBe(false);
  });

  it('does not change anything after a single tired day', () => {
    const day = dayPlan(withDays({ '2026-11-05': { flags: { fatigue: true } } }), '2026-11-05');
    expect(day.steps).toBe(18000);
    expect(day.skipFinisher).toBe(false);
  });

  it('returns to 15,000 steps with no finisher after two tired days', () => {
    const store = withDays({
      '2026-11-05': { flags: { fatigue: true } },
      '2026-11-06': { flags: { fatigue: true } },
    });
    const day = dayPlan(store, '2026-11-06');
    expect(day.steps).toBe(15000);
    expect(day.skipFinisher).toBe(true);
  });

  it('takes the lower target when pain and fatigue overlap', () => {
    const store = withDays({
      '2026-11-05': { flags: { fatigue: true } },
      '2026-11-06': { flags: { fatigue: true, pain: true } },
    });
    expect(dayPlan(store, '2026-11-06').steps).toBe(12000);
  });

  it('never invents a step target on a day without one', () => {
    const day = dayPlan(withDays({ '2026-11-08': { flags: { pain: true } } }), '2026-11-08');
    expect(day.steps).toBeNull();
  });

  it('never offers the jog on 8, 11 or 12 Nov', () => {
    for (const date of ['2026-11-08', '2026-11-11', '2026-11-12']) {
      expect(dayPlan(emptyStore(), date).jog).toBe(false);
    }
  });

  it('carries no copy that suggests cutting harder', () => {
    const banned = /sauna|sweat suit|laxative|diuretic|restrict|cut harder|skip (a )?meal|eat less|compensate/i;
    const notes = (Object.values(plan) as unknown[]).filter((v): v is string => typeof v === 'string');
    for (const text of [...notes, ...FLAGS.map((f) => f.advice)]) {
      expect(text).not.toMatch(banned);
    }
    expect(REBOUND_NOTE).toMatch(/not a setback/);
  });
});

describe('typed amounts', () => {
  it.each([
    ['1,200', 1200],
    ['800', 800],
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['', undefined],
  ])('reads %s', (raw, value) => {
    expect(parseAmount(raw)).toBe(value);
  });
});

describe('food totals', () => {
  it('sums meals using range midpoints', () => {
    const log: DayLog = {
      meals: [
        { id: '1', name: 'Dinner', kcal: 700, kcalHigh: 900, protein: 43, carbs: 90, fat: 25 },
        { id: '2', name: 'Eggs', kcal: 200, protein: 18 },
      ],
    };
    expect(totals(log)).toEqual({ kcal: 1000, kcalLow: 900, kcalHigh: 1100, protein: 61, carbs: 90, fat: 25 });
  });

  it('is zero with nothing logged', () => {
    expect(totals(undefined).kcal).toBe(0);
  });
});

describe('weight', () => {
  it('averages the trend over five days of logs', () => {
    const series = weightSeries(
      withDays({
        '2026-11-03': { weight: 82 },
        '2026-11-04': { weight: 81 },
        '2026-11-08': { weight: 80 },
      }),
    );
    expect(series.map((p) => p.trend)).toEqual([82, 81.5, 80.5]);
  });

  it('ignores days with no weight', () => {
    expect(weightSeries(withDays({ '2026-11-03': { steps: 100 } }))).toEqual([]);
  });

  it('keeps the checkpoints as planned', () => {
    expect(CHECKPOINTS.map((c) => c.target)).toEqual([80.5, 79.8, 78.8, 78]);
  });

  it('applies the 10 Nov decision only above 80.5 kg', () => {
    expect(isAboveDecisionLimit(withDays({ '2026-11-10': { weight: 80.5 } }))).toBe(false);
    expect(isAboveDecisionLimit(withDays({ '2026-11-10': { weight: 80.6 } }))).toBe(true);
    expect(isAboveDecisionLimit(emptyStore())).toBe(false);
  });

  it('shows the rebound note around the weigh-in only', () => {
    expect(showRebound('2026-11-12')).toBe(false);
    expect(showRebound('2026-11-14')).toBe(true);
    expect(showRebound('2026-11-30')).toBe(false);
  });
});

describe('backup files', () => {
  it('round-trips a store', () => {
    const store = withDays({ '2026-11-03': { weight: 82 } });
    expect(parseStore(JSON.stringify(store))?.days['2026-11-03'].weight).toBe(82);
  });

  it.each(['not json', '{}', '{"version":2,"days":{}}', '{"version":1,"days":null}'])('rejects %s', (raw) => {
    expect(parseStore(raw)).toBeNull();
  });
});
