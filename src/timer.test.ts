import { describe, expect, it } from 'vitest';
import { position } from './ExerciseTimer';
import { dayPlan } from './rules';
import { emptyStore } from './store';
import { buildChecklist, timerRun, type CheckItem } from './workout';

const items = (date: string) => buildChecklist(dayPlan(emptyStore(), date)).groups.flatMap((g) => g.items);
const item = (date: string, id: string) => items(date).find((i) => i.id === id) as CheckItem;
const work = (phases: { seconds: number }[]) => phases.slice(1).reduce((s, p) => s + p.seconds, 0);

describe('exercise timer runs', () => {
  it('runs 10 interval rounds of 30 s hard and 60 s rest, ticking each round', () => {
    const run = timerRun(item('2026-11-04', 'rounds'), {});
    expect(run[0].label).toBe('Get ready');
    expect(run.slice(1).map((p) => p.label)).toEqual(Array(10).fill(['Hard', 'Rest']).flat());
    expect(run.filter((p) => p.box !== undefined).map((p) => p.box)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(work(run)).toBe(15 * 60);
  });

  it('only runs the rounds still open', () => {
    const run = timerRun(item('2026-11-04', 'rounds'), { 'rounds:0': true, 'rounds:1': true, 'rounds:5': true });
    expect(run.filter((p) => p.box !== undefined).map((p) => p.box)).toEqual([2, 3, 4, 6, 7, 8, 9]);
    expect(run[1].round).toBe('3 of 10');
  });

  it('rests between finisher rounds but not after the last', () => {
    const run = timerRun(item('2026-11-03', 'finisher'), {});
    expect(run.filter((p) => p.label === 'Rest')).toHaveLength(4);
    expect(run.at(-1)?.label).toBe('Jumping jacks');
    expect(run.at(-1)?.box).toBe(4);
  });

  it('times one plank set at a time', () => {
    const run = timerRun(item('2026-11-03', 'plank'), { 'plank:0': true });
    expect(run.slice(1)).toEqual([{ label: 'Plank', seconds: 40, work: true, round: '2 of 3', box: 1 }]);
  });

  it('times both sides of a side plank, ticking after the second', () => {
    const run = timerRun(item('2026-11-07', 'side-plank'), {});
    expect(run.slice(1).map((p) => [p.label, p.box])).toEqual([
      ['Side plank, left', undefined],
      ['Side plank, right', 0],
    ]);
  });

  it('gives the walk, stretching, warm up and cool down their minutes', () => {
    expect(work(timerRun(item('2026-11-06', 'walk'), {}))).toBe(40 * 60);
    expect(work(timerRun(item('2026-11-06', 'stretch'), {}))).toBe(10 * 60);
    expect(work(timerRun(item('2026-11-04', 'warm-up'), {}))).toBe(5 * 60);
    expect(work(timerRun(item('2026-11-04', 'cool-down'), {}))).toBe(5 * 60);
  });

  it('has nothing to run once every box is ticked, and no timer for rep sets', () => {
    expect(timerRun(item('2026-11-04', 'warm-up'), { 'warm-up:0': true })).toEqual([]);
    expect(item('2026-11-03', 'push-ups').timer).toBeUndefined();
  });
});

describe('timer position', () => {
  const phases = [
    { label: 'a', seconds: 5 },
    { label: 'b', seconds: 30 },
  ];
  it('counts down within a phase and moves on at the boundary', () => {
    expect(position(phases, 0)).toEqual({ index: 0, left: 5 });
    expect(position(phases, 4_200)).toEqual({ index: 0, left: 1 });
    expect(position(phases, 5_000)).toEqual({ index: 1, left: 30 });
    expect(position(phases, 35_000)).toEqual({ index: 2, left: 0 });
  });
});
