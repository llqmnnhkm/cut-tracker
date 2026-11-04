import { DateBar, Note, SafetyBanners, SetBox, fmt, type DateNav } from '../components';
import { JOG_NOTE } from '../plan';
import { dayPlan } from '../rules';
import type { Store } from '../store';
import { setCheck } from '../checks';
import { buildChecklist, sessionLabel, timerRun, type CheckItem } from '../workout';
import { SessionCoin } from './TodayView';

interface Props extends DateNav {
  store: Store;
  onSetDone: () => void;
  onSessionOver: () => void;
  onStartTimer: (itemId: string) => void;
  running: string | null;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function WorkoutView({ store, date, today, setDate, onSetDone, onSessionOver, onStartTimer, running }: Props) {
  const log = store.days[date];
  const day = dayPlan(store, date);
  const list = buildChecklist(day);
  const checks = log?.checks ?? {};

  const toggle = (item: CheckItem, n: number, on: boolean) => {
    const result = setCheck(date, item, n, on);
    if (result === 'finished') onSessionOver();
    else if (result === 'rest') onSetDone();
  };

  const timerButton = (item: CheckItem) => {
    if (!item.timer) return null;
    const run = timerRun(item, checks);
    if (run.length === 0) return null;
    const isRunning = running === item.id;
    const seconds = run.slice(1).reduce((sum, p) => sum + p.seconds, 0);
    return (
      <button type="button" class={isRunning ? 'timerbtn timerbtn-on' : 'timerbtn'} disabled={isRunning} onClick={() => onStartTimer(item.id)}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5.5v13l10.5-6.5z" />
        </svg>
        {isRunning ? 'Running' : item.timer.once ? `Time a set · ${clock(seconds)}` : `Start timer · ${clock(seconds)}`}
      </button>
    );
  };

  return (
    <>
      <DateBar date={date} today={today} setDate={setDate} />
      <SafetyBanners day={day} />

      {day.emergency ? null : (
        <>
          <div class="tile">
            <SessionCoin session={day.session} done={log?.workoutDone} />
            <span class="tile-text">
              <span class="label">Session</span>
              <span class="session-name">{sessionLabel(day)}</span>
              <span class="tile-sub">{day.steps !== null ? `${fmt(day.steps)} steps today` : 'No step target today'}</span>
            </span>
          </div>

          {list.message && <Note>{list.message}</Note>}
          {list.finisherSkipped && <Note>Skip the finisher today.</Note>}

          {list.groups.map((group) => (
            <section class="panel" key={group.title}>
              <h3>{group.title}</h3>
              {group.note && <p class="muted-text">{group.note}</p>}
              <ul>
                {group.items.map((item) => (
                  <li class={item.boxes === 1 ? 'exercise exercise-single' : 'exercise'} key={item.id}>
                    <div>
                      <span class="exercise-name">{item.name}</span>
                      <span class="exercise-detail num">{item.detail}</span>
                      {timerButton(item)}
                    </div>
                    <div class="exercise-boxes">
                      {Array.from({ length: item.boxes }, (_, n) => (
                        <SetBox
                          key={n}
                          n={n + 1}
                          checked={!!checks[`${item.id}:${n}`]}
                          label={item.boxes > 1 ? `${item.name}, ${n + 1} of ${item.boxes}` : item.name}
                          onChange={(on) => toggle(item, n, on)}
                        />
                      ))}
                    </div>
                    {item.easier && <p class="easier">{item.easier}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {list.footnote && <Note>{list.footnote}</Note>}
          {day.jog && (
            <section class="panel">
              <h3>Optional jog</h3>
              <p>{JOG_NOTE}</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
