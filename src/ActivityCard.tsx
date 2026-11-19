import { useEffect, useState } from 'preact/hooks';
import { activityTitle, clock, estimateSteps, strideFromWalk, km, pace, replaySlice, routeXY, toPoints, type Activity, type ActivityType, type LatLng } from './activity';
import { addDays, shortDate, weekdayIndex } from './dates';
import { getStore, updateSettings, type Store } from './store';
import { fmt } from './components';

export const ACTIVITY_ICONS: Record<ActivityType, preact.JSX.Element> = {
  walk: (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="act-icon">
      <circle cx="13" cy="4" r="2" />
      <path d="M12.5 8 10 14.5l3 3V22M10 14.5 7.5 22M12.5 8l2.5 3.5 3 1M12.5 8 9 10l-1.5 3.5" />
    </svg>
  ),
  run: (
    <svg viewBox="0 0 24 24" aria-hidden="true" class="act-icon">
      <circle cx="15.5" cy="4" r="2" />
      <path d="M14 8l-3.5 5 4 3-1.5 6M10.5 13 5 15M14 8l2.5 4H21M14 8 9 8.5 6.5 11.5" />
    </svg>
  ),
};

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-MY', { hour: 'numeric', minute: '2-digit' });

const REPLAY_MS = 9000;

// Draws a route, and with an activity, a play button that replays it as a moving dot.
export function Route({ route, big, activity }: { route: LatLng[]; big?: boolean; activity?: Activity }) {
  const w = 320;
  const h = big ? 170 : 150;
  const xy = routeXY(route, w, h, 18);
  const [progress, setProgress] = useState<number | null>(null);
  const playing = progress !== null;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let doneTimer = 0;
    const begin = performance.now() - (progress ?? 0) * REPLAY_MS;
    const step = (now: number) => {
      const p = Math.min(1, (now - begin) / REPLAY_MS);
      setProgress(p);
      if (p < 1) frame = requestAnimationFrame(step);
      else doneTimer = window.setTimeout(() => setProgress(null), 1800);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(doneTimer);
    };
  }, [playing]);

  if (xy.length < 2) return null;
  const all = toPoints(xy);
  const [sx, sy] = xy[0];
  const [ex, ey] = xy[xy.length - 1];
  const slice = playing ? replaySlice(xy, progress!) : null;

  return (
    <div class={big ? 'route-wrap route-big' : 'route-wrap'}>
      <svg class="route" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={playing ? 'Route replay' : 'Route map'} onClick={() => playing && setProgress(null)}>
        {slice ? (
          <>
            <polyline class="route-ghost" points={all} />
            <polyline class="route-under" points={toPoints(slice.path)} />
            <polyline class="route-line" points={toPoints(slice.path)} />
            <circle class="route-start" cx={sx} cy={sy} r="5" />
            {slice.head && (
              <>
                <circle class="route-pulse" cx={slice.head[0]} cy={slice.head[1]} r="12" />
                <circle class="route-head" cx={slice.head[0]} cy={slice.head[1]} r="6.5" />
              </>
            )}
          </>
        ) : (
          <>
            <polyline class="route-under" points={all} />
            <polyline class="route-line" points={all} />
            <circle class="route-start" cx={sx} cy={sy} r="5" />
            <circle class="route-end" cx={ex} cy={ey} r="5" />
          </>
        )}
      </svg>
      {activity && playing && (
        <div class="replay-stats num" aria-live="off">
          <span>
            <b>{km(activity.meters * progress!)}</b> km
          </span>
          <span>
            <b>{clock(activity.seconds * progress!)}</b>
          </span>
        </div>
      )}
      {activity && !playing && (
        <button type="button" class="replay-btn" onClick={() => setProgress(0)} aria-label="Replay this activity">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13l10.5-6.5z" />
          </svg>
          Replay
        </button>
      )}
    </div>
  );
}

export function StatRow({ items }: { items: { label: string; value: string; unit?: string }[] }) {
  return (
    <div class="feed-stats">
      {items.map((s) => (
        <span key={s.label}>
          <small>{s.label}</small>
          <b class="num">
            {s.value}
            {s.unit && <i>{s.unit}</i>}
          </b>
        </span>
      ))}
    </div>
  );
}

interface CardProps {
  date: string;
  activity: Activity;
  onRemove?: () => void;
}

function StepsLine({ a }: { a: Activity }) {
  const { heightCm, strideCm } = getStore().settings;
  const steps = estimateSteps(a, heightCm, strideCm);
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [error, setError] = useState('');
  const canCalibrate = a.type === 'walk' && a.meters >= 300;

  if (steps === null && !canCalibrate) {
    return a.type === 'run' ? <p class="steps-line muted-text">Add your height in Settings to estimate steps.</p> : null;
  }

  const save = (e: Event) => {
    e.preventDefault();
    const stride = strideFromWalk(a.meters, Number(counted.replace(/[,\s]/g, '')));
    if (!stride) return setError('That gives an unlikely step length. Check the number from Health.');
    updateSettings({ strideCm: stride });
    setOpen(false);
    setCounted('');
    setError('');
  };

  return (
    <div class="steps-line">
      <p>
        {steps !== null ? (
          <>
            <b class="num">≈ {fmt(steps)}</b> steps <span class="muted">{a.type === 'walk' && strideCm ? '(your measured step)' : '(estimate)'}</span>
          </>
        ) : (
          <span class="muted">Add your height in Settings, or measure your step with this walk.</span>
        )}
        {canCalibrate && !open && (
          <button type="button" class="textlink" onClick={() => setOpen(true)}>
            Measure my step
          </button>
        )}
      </p>
      {open && (
        <form class="calibrate" onSubmit={save}>
          <p class="muted-text">In the iPhone Health app, open Steps, find this walk's time, and enter how many steps it counted.</p>
          <div class="calibrate-row">
            <span class="inp">
              <input class="num" inputmode="numeric" autocomplete="off" aria-label="Steps counted by iPhone" value={counted} onInput={(e) => setCounted(e.currentTarget.value)} />
              <span class="field-unit">steps</span>
            </span>
            <button class="btn" type="submit">Save</button>
          </div>
          {error && <p class="field-error">{error}</p>}
        </form>
      )}
    </div>
  );
}

export function ActivityCard({ date, activity: a, onRemove }: CardProps) {
  return (
    <article class="feed">
      <header class="feed-head">
        <span class="coin coin-sm">{ACTIVITY_ICONS[a.type]}</span>
        <span class="feed-who">
          <b>{activityTitle(a)}</b>
          <small>
            {shortDate(date)} at {time(a.start)}
            {a.manual && ' · Added by hand'}
          </small>
        </span>
        {onRemove && (
          <button type="button" class="textlink textlink-quiet" onClick={onRemove}>
            Delete
          </button>
        )}
      </header>
      <StatRow
        items={[
          { label: 'Distance', value: km(a.meters), unit: 'km' },
          { label: 'Pace', value: pace(a.seconds, a.meters), unit: '/km' },
          { label: 'Time', value: clock(a.seconds) },
        ]}
      />
      <StepsLine a={a} />
      {a.route && <Route route={a.route} activity={a} />}
    </article>
  );
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Monday to Sunday around the given day, with a filled dot for any day you moved.
export function WeekStrip({ store, date, setDate, minDate }: { store: Store; date: string; setDate: (d: string) => void; minDate: string }) {
  const monday = addDays(date, -((weekdayIndex(date) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  let meters = 0;
  let seconds = 0;
  let count = 0;
  for (const d of days) {
    for (const a of store.days[d]?.activities ?? []) {
      meters += a.meters;
      seconds += a.seconds;
      count++;
    }
    if (store.days[d]?.workoutDone) count++;
  }

  return (
    <section class="feed week">
      <header class="week-head">
        <b>This week</b>
        <small>
          {shortDate(days[0])} – {shortDate(days[6])}
        </small>
      </header>
      <StatRow
        items={[
          { label: 'Activities', value: String(count) },
          { label: 'Distance', value: km(meters), unit: 'km' },
          { label: 'Time', value: clock(seconds) },
        ]}
      />
      <div class="week-days">
        {days.map((d) => {
          const log = store.days[d];
          const moved = !!log?.workoutDone || (log?.activities?.length ?? 0) > 0;
          const cls = ['week-day', moved && 'is-moved', d === date && 'is-sel'].filter(Boolean).join(' ');
          return (
            <button key={d} type="button" class={cls} disabled={d < minDate} aria-label={`${shortDate(d)}${moved ? ', active' : ''}`} onClick={() => setDate(d)}>
              <span>{LETTERS[weekdayIndex(d)]}</span>
              <i />
            </button>
          );
        })}
      </div>
    </section>
  );
}
