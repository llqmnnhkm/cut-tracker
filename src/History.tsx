import { useState } from 'preact/hooks';
import { activityTitle, clock, km } from './activity';
import { ACTIVITY_ICONS, StatRow } from './ActivityCard';
import { Tick, fmt } from './components';
import { addDays, localToday, shortDate, weekdayName } from './dates';
import { dayPlan } from './rules';
import type { Store } from './store';
import { buildChecklist, checkKeys, sessionLabel } from './workout';

export interface HistoryItem {
  kind: 'session' | 'sets' | 'walk' | 'run';
  title: string;
  detail: string;
  done: boolean;
}

// Everything trained on one day: the plan's session, sets with rest, walks and runs.
export function dayHistory(store: Store, date: string): HistoryItem[] {
  const log = store.days[date];
  if (!log) return [];
  const items: HistoryItem[] = [];
  const ticked = Object.values(log.checks ?? {}).filter(Boolean).length;
  if (log.workoutDone || ticked > 0) {
    const day = dayPlan(store, date);
    const total = checkKeys(buildChecklist(day)).length;
    items.push({
      kind: 'session',
      title: sessionLabel(day),
      detail: log.workoutDone ? 'Completed' : `${ticked} of ${total} ticked`,
      done: !!log.workoutDone,
    });
  }
  for (const e of log.emoms ?? []) {
    const rest = e.restMin ?? e.everyMin;
    items.push({
      kind: 'sets',
      title: `${fmt(e.rounds * e.reps)} ${e.exercise.toLowerCase()}`,
      detail: `${e.rounds} of ${e.of} sets of ${e.reps}${rest ? ` · ${rest} min rest` : ''}`,
      done: e.rounds === e.of,
    });
  }
  for (const a of log.activities ?? []) {
    items.push({ kind: a.type, title: activityTitle(a), detail: `${km(a.meters)} km · ${clock(a.seconds)}`, done: true });
  }
  return items;
}

// Totals over a run of days: active days, reps by exercise, and distance.
export function historyTotals(store: Store, from: string, to: string) {
  let activeDays = 0;
  let meters = 0;
  const reps: Record<string, number> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const log = store.days[d];
    if (!log) continue;
    if (dayHistory(store, d).length > 0) activeDays++;
    for (const a of log.activities ?? []) meters += a.meters;
    for (const e of log.emoms ?? []) {
      const name = e.exercise.toLowerCase();
      reps[name] = (reps[name] ?? 0) + e.rounds * e.reps;
    }
  }
  const top = Object.entries(reps).sort((a, b) => b[1] - a[1])[0];
  return { activeDays, meters, top: top ? { exercise: top[0], reps: top[1] } : null };
}

const ICON_SESSION = (
  <svg viewBox="0 0 24 24" aria-hidden="true" class="act-icon">
    <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />
  </svg>
);
const ICON_SETS = (
  <svg viewBox="0 0 24 24" aria-hidden="true" class="act-icon">
    <circle cx="12" cy="13" r="7.5" />
    <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
  </svg>
);

const PAGE = 14;

export function WorkoutHistory({ store }: { store: Store }) {
  const [shown, setShown] = useState(PAGE);
  const today = localToday();
  const monthStart = `${today.slice(0, 8)}01`;
  const month = historyTotals(store, monthStart, today);
  const days = Object.keys(store.days)
    .filter((d) => d <= today && dayHistory(store, d).length > 0)
    .sort()
    .reverse();

  return (
    <section class="panel history">
      <h3>History</h3>
      <p class="muted-text">Everything you've done, saved on each day.</p>
      <div class="history-month">
        <small>This month</small>
        <StatRow
          items={[
            { label: 'Active days', value: String(month.activeDays) },
            month.top ? { label: month.top.exercise, value: fmt(month.top.reps) } : { label: 'Sets', value: '0' },
            { label: 'Distance', value: km(month.meters), unit: 'km' },
          ]}
        />
      </div>
      {days.length === 0 ? (
        <p class="muted-text">Nothing yet. Finish a workout, a set session or a walk and it shows here.</p>
      ) : (
        <ol class="history-days">
          {days.slice(0, shown).map((d) => (
            <li key={d}>
              <p class="history-date">
                {d === today ? 'Today' : weekdayName(d)}, {shortDate(d)}
              </p>
              <ul>
                {dayHistory(store, d).map((item, i) => (
                  <li key={i} class="history-item">
                    <span class={item.done ? 'coin coin-sm is-full' : 'coin coin-sm'}>
                      {item.kind === 'walk' || item.kind === 'run' ? ACTIVITY_ICONS[item.kind] : item.kind === 'sets' ? ICON_SETS : item.done ? <Tick /> : ICON_SESSION}
                    </span>
                    <span class="feed-who">
                      <b>{item.title}</b>
                      <small>{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {days.length > shown && (
        <button type="button" class="btn btn-quiet" onClick={() => setShown(shown + PAGE)}>
          Show older days
        </button>
      )}
    </section>
  );
}
