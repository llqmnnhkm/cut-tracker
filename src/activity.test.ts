import { describe, expect, it } from 'vitest';
import { activityTitle, replaySlice, addFix, breakTrack, clock, distance, emptyTrack, km, pace, routePoints, thinRoute, type LatLng } from './activity';

// About 11.1 m per 0.0001 degree of latitude.
const north = (n: number): LatLng => [3.1 + n * 0.0001, 101.6];

describe('distance', () => {
  it('measures short hops in metres', () => {
    expect(distance(north(0), north(10))).toBeCloseTo(111.2, 0);
    expect(distance(north(0), north(0))).toBe(0);
  });
});

describe('addFix', () => {
  const fix = (n: number, time: number, accuracy = 5) => ({ at: north(n), accuracy, time });

  it('adds distance along a walk', () => {
    let t = emptyTrack();
    for (let i = 0; i <= 10; i++) t = addFix(t, fix(i, i * 10_000));
    expect(t.meters).toBeCloseTo(111.2, 0);
    expect(t.route).toHaveLength(11);
  });

  it('skips loose fixes, drift and impossible jumps', () => {
    let t = addFix(emptyTrack(), fix(0, 0));
    t = addFix(t, fix(5, 10_000, 80)); // too loose
    t = addFix(t, fix(0.2, 20_000)); // 2 m of drift
    t = addFix(t, fix(100, 21_000)); // 1.1 km in a second
    expect(t.meters).toBe(0);
    expect(t.route).toHaveLength(1);
  });

  it('does not count the gap across a pause', () => {
    let t = addFix(emptyTrack(), fix(0, 0));
    t = addFix(t, fix(10, 60_000));
    t = breakTrack(t);
    t = addFix(t, fix(50, 600_000));
    t = addFix(t, fix(60, 660_000));
    expect(t.meters).toBeCloseTo(222.4, 0);
  });
});

describe('formatting', () => {
  it('shows clock, km and pace', () => {
    expect(clock(65)).toBe('1:05');
    expect(clock(3725)).toBe('1:02:05');
    expect(km(5234)).toBe('5.23');
    expect(pace(1800, 5000)).toBe('6:00');
    expect(pace(10, 20)).toBe('–:––');
  });

  it('names activities by time of day', () => {
    expect(activityTitle({ type: 'run', start: new Date(2026, 10, 19, 7).getTime() })).toBe('Morning Run');
    expect(activityTitle({ type: 'walk', start: new Date(2026, 10, 19, 19).getTime() })).toBe('Evening Walk');
  });
});

describe('routes', () => {
  it('fits a route inside the box', () => {
    const pts = routePoints([north(0), north(10), [3.1005, 101.601]], 320, 150, 10)
      .split(' ')
      .map((p) => p.split(',').map(Number));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(310);
      expect(y).toBeGreaterThanOrEqual(10);
      expect(y).toBeLessThanOrEqual(140);
    }
  });

  it('replays along the route by length', () => {
    const xy: [number, number][] = [[0, 0], [10, 0], [10, 30]];
    expect(replaySlice(xy, 0).head).toEqual([0, 0]);
    expect(replaySlice(xy, 0.5).head).toEqual([10, 10]);
    expect(replaySlice(xy, 0.5).path).toEqual([[0, 0], [10, 0], [10, 10]]);
    expect(replaySlice(xy, 1).head).toEqual([10, 30]);
  });

  it('thins close points but keeps both ends', () => {
    const route = Array.from({ length: 101 }, (_, i) => north(i * 0.1)); // 1.1 m apart
    const thin = thinRoute(route);
    expect(thin[0]).toEqual(route[0]);
    expect(thin[thin.length - 1]).toEqual(route[100]);
    expect(thin.length).toBeLessThan(20);
  });
});
