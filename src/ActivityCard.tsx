import { activityTitle, clock, km, pace, routePoints, type Activity, type ActivityType, type LatLng } from './activity';
import { addDays, shortDate, weekdayIndex } from './dates';
import type { Store } from './store';

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

export function Route({ route, big }: { route: LatLng[]; big?: boolean }) {
  const w = 320;
  const h = big ? 170 : 150;
  const points = routePoints(route, w, h, 18);
  if (!points) return null;
  const ends = points.split(' ');
  const [sx, sy] = ends[0].split(',');
  const [ex, ey] = ends[ends.length - 1].split(',');
  return (
    <svg class={big ? 'route route-big' : 'route'} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Route map">
      <polyline class="route-under" points={points} />
      <polyline class="route-line" points={points} />
      <circle class="route-start" cx={sx} cy={sy} r="5" />
      <circle class="route-end" cx={ex} cy={ey} r="5" />
    </svg>
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
      {a.route && <Route route={a.route} />}
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
