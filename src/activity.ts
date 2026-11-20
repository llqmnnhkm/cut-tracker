// Walks and runs: the maths behind recording, with no browser APIs, so it can be tested.

export type ActivityType = 'walk' | 'run';

export type LatLng = [number, number];

export interface Activity {
  id: string;
  type: ActivityType;
  start: number; // epoch ms
  seconds: number; // moving time, pauses left out
  meters: number;
  route?: LatLng[];
  manual?: boolean;
}

export const ACTIVITY_NAMES: Record<ActivityType, string> = { walk: 'Walk', run: 'Run' };

// Readings looser than this are dropped. iPhone often reports ±30 to 65 m between tall
// buildings; dropping those made the route cut corners and read short, so they are kept and smoothed.
export const MAX_ACCURACY = 65;
// Smoothed moves shorter than this wait to add up, so standing still doesn't count as distance.
const MIN_STEP = 3;
// Faster than this between readings is a bad reading, not a sprint.
const MAX_SPEED = 12;
// How freely the smoother lets the position move, in metres per second. Tuned on simulated
// noisy walks and runs to read within a few percent; runs need more freedom to keep up.
export const SMOOTHING: Record<ActivityType, number> = { walk: 2, run: 4 };

const EARTH = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distance([lat1, lng1]: LatLng, [lat2, lng2]: LatLng): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface Fix {
  at: LatLng;
  accuracy: number;
  time: number;
}

interface Smoothed {
  lat: number;
  lng: number;
  variance: number; // square metres
  time: number;
}

export interface Track {
  meters: number;
  route: LatLng[];
  last: Fix | null; // the last point counted into distance
  smooth?: Smoothed | null;
  seen?: number; // readings received
  used?: number; // readings kept
}

export const emptyTrack = (): Track => ({ meters: 0, route: [], last: null, smooth: null, seen: 0, used: 0 });

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// A simple Kalman filter: each reading pulls the position in proportion to how much it's trusted.
function smoothFix(prev: Smoothed | null | undefined, fix: Fix, freedom: number): Smoothed {
  const own = fix.accuracy * fix.accuracy;
  if (!prev) return { lat: fix.at[0], lng: fix.at[1], variance: own, time: fix.time };
  const secs = Math.max(0, (fix.time - prev.time) / 1000);
  const variance = prev.variance + secs * freedom * freedom;
  const gain = variance / (variance + own);
  return {
    lat: prev.lat + gain * (fix.at[0] - prev.lat),
    lng: prev.lng + gain * (fix.at[1] - prev.lng),
    variance: (1 - gain) * variance,
    time: fix.time,
  };
}

// Adds one GPS reading to a track: drops loose readings and impossible jumps, smooths the
// rest, and counts distance once the smoothed position has moved a few metres.
export function addFix(track: Track, fix: Fix, type: ActivityType = 'walk'): Track {
  const seen = (track.seen ?? 0) + 1;
  if (!(fix.accuracy <= MAX_ACCURACY)) return { ...track, seen };
  const prev = track.smooth;
  if (prev) {
    const secs = (fix.time - prev.time) / 1000;
    const jump = distance([prev.lat, prev.lng], fix.at) - fix.accuracy;
    if (secs > 0 && jump / secs > MAX_SPEED) return { ...track, seen };
  }
  const smooth = smoothFix(prev, fix, SMOOTHING[type]);
  const used = (track.used ?? 0) + 1;
  const here: Fix = { at: [smooth.lat, smooth.lng], accuracy: fix.accuracy, time: fix.time };
  const point: LatLng = [round5(smooth.lat), round5(smooth.lng)];
  if (!track.last) return { ...track, route: [...track.route, point], last: here, smooth, seen, used };
  const step = distance(track.last.at, here.at);
  if (step < MIN_STEP) return { ...track, smooth, seen, used };
  return { meters: track.meters + step, route: [...track.route, point], last: here, smooth, seen, used };
}

// After a pause, the next reading starts a fresh leg instead of counting the gap.
export const breakTrack = (track: Track): Track => ({ ...track, last: null, smooth: null });

export const clock = (total: number) => {
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

export const km = (meters: number) => (meters / 1000).toFixed(2);

// Minutes per kilometre, or a dash until there's enough distance to mean anything.
export function pace(seconds: number, meters: number) {
  if (meters < 50 || seconds <= 0) return '–:––';
  const perKm = seconds / (meters / 1000);
  if (perKm >= 60 * 60) return '–:––';
  return clock(perKm);
}

export function activityTitle(a: Pick<Activity, 'type' | 'start'>) {
  const hour = new Date(a.start).getHours();
  const part = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 14 ? 'Lunch' : hour < 18 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  return `${part} ${ACTIVITY_NAMES[a.type]}`;
}

// Fits a route into a box, keeping its shape, as x,y points for an SVG.
export function routeXY(route: LatLng[], width: number, height: number, pad = 12): [number, number][] {
  if (route.length < 2) return [];
  const lat0 = rad(route.reduce((s, p) => s + p[0], 0) / route.length);
  const xs = route.map((p) => p[1] * Math.cos(lat0));
  const ys = route.map((p) => -p[0]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return xs.map((x, i) => [+(offX + (x - minX) * scale).toFixed(1), +(offY + (ys[i] - minY) * scale).toFixed(1)]);
}

export const toPoints = (xy: [number, number][]) => xy.map(([x, y]) => `${x},${y}`).join(' ');

export function routePoints(route: LatLng[], width: number, height: number, pad = 12): string {
  return toPoints(routeXY(route, width, height, pad));
}

// The part of a drawn route covered after a fraction of its length, ending at the moving dot.
// Routes keep no timestamps, so a replay assumes an even pace from start to finish.
export function replaySlice(xy: [number, number][], fraction: number) {
  if (xy.length === 0) return { path: [] as [number, number][], head: null };
  const f = Math.min(1, Math.max(0, fraction));
  const lengths = xy.slice(1).map((p, i) => Math.hypot(p[0] - xy[i][0], p[1] - xy[i][1]));
  let left = lengths.reduce((a, b) => a + b, 0) * f;
  const path: [number, number][] = [xy[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (left >= lengths[i]) {
      left -= lengths[i];
      path.push(xy[i + 1]);
      continue;
    }
    const t = lengths[i] ? left / lengths[i] : 0;
    const head: [number, number] = [xy[i][0] + (xy[i + 1][0] - xy[i][0]) * t, xy[i][1] + (xy[i + 1][1] - xy[i][1]) * t];
    path.push(head);
    return { path, head };
  }
  return { path, head: xy[xy.length - 1] };
}

// Keeps long routes small in storage by dropping points closer than a few metres apart.
export function thinRoute(route: LatLng[], minGap = 8): LatLng[] {
  if (route.length <= 2) return route;
  const out: LatLng[] = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    if (distance(out[out.length - 1], route[i]) >= minGap) out.push(route[i]);
  }
  out.push(route[route.length - 1]);
  return out;
}

// Step estimates. Walking uses a step length of about 41% of height unless one has been
// measured; running uses a cadence that rises with speed. Both are estimates only.
export const STRIDE_FROM_HEIGHT = 0.414;

export function walkStepCm(heightCm?: number, strideCm?: number): number | null {
  if (strideCm) return strideCm;
  if (heightCm) return heightCm * STRIDE_FROM_HEIGHT;
  return null;
}

export function estimateSteps(a: Pick<Activity, 'type' | 'meters' | 'seconds'>, heightCm?: number, strideCm?: number): number | null {
  if (a.meters <= 0 || a.seconds <= 0) return null;
  if (a.type === 'walk') {
    const step = walkStepCm(heightCm, strideCm);
    return step ? Math.round(a.meters / (step / 100)) : null;
  }
  if (!heightCm) return null;
  const speed = a.meters / a.seconds;
  const cadence = Math.min(190, Math.max(150, 140 + 10 * speed)) * Math.sqrt(170 / heightCm);
  return Math.round((cadence * a.seconds) / 60);
}

// Step length from a walk and the steps the phone counted for it, or null if it looks wrong.
export function strideFromWalk(meters: number, steps: number): number | null {
  if (meters < 300 || steps <= 0) return null;
  const cm = (meters / steps) * 100;
  return cm >= 40 && cm <= 110 ? Math.round(cm) : null;
}
