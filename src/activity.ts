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

// Fixes worse than this are too loose to measure a walk with.
export const MAX_ACCURACY = 30;
// Moves shorter than this are usually GPS drift while standing still.
const MIN_STEP = 4;
// Faster than this between two fixes is a bad fix, not a sprint.
const MAX_SPEED = 12;

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

export interface Track {
  meters: number;
  route: LatLng[];
  last: Fix | null;
}

export const emptyTrack = (): Track => ({ meters: 0, route: [], last: null });

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

// Adds one GPS fix to a track, skipping loose fixes, drift, and jumps.
export function addFix(track: Track, fix: Fix): Track {
  if (!(fix.accuracy <= MAX_ACCURACY)) return track;
  const point: LatLng = [round5(fix.at[0]), round5(fix.at[1])];
  if (!track.last) return { meters: track.meters, route: [...track.route, point], last: fix };
  const step = distance(track.last.at, fix.at);
  if (step < Math.max(MIN_STEP, fix.accuracy / 2)) return track;
  const secs = (fix.time - track.last.time) / 1000;
  if (secs > 0 && step / secs > MAX_SPEED) return track;
  return { meters: track.meters + step, route: [...track.route, point], last: fix };
}

// After a pause, the next fix starts a fresh leg instead of counting the gap.
export const breakTrack = (track: Track): Track => ({ ...track, last: null });

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

// Fits a route into a box, keeping its shape, for drawing as an SVG polyline.
export function routePoints(route: LatLng[], width: number, height: number, pad = 12): string {
  if (route.length < 2) return '';
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
  return xs.map((x, i) => `${(offX + (x - minX) * scale).toFixed(1)},${(offY + (ys[i] - minY) * scale).toFixed(1)}`).join(' ');
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
