import { CheckBox, DateBar, Note, SafetyBanners, fmt, type DateNav } from '../components';
import { JOG_NOTE } from '../plan';
import { dayPlan } from '../rules';
import { updateDay, type Store } from '../store';
import { buildChecklist, checkKeys, hasOpenRestBoxes, sessionLabel, type CheckItem } from '../workout';

interface Props extends DateNav {
  store: Store;
  onSetDone: () => void;
  onSessionOver: () => void;
}

export function WorkoutView({ store, date, today, setDate, onSetDone, onSessionOver }: Props) {
  const log = store.days[date];
  const day = dayPlan(store, date);
  const list = buildChecklist(day);
  const checks = log?.checks ?? {};
  const allKeys = checkKeys(list);

  const toggle = (item: CheckItem, n: number, on: boolean) => {
    const next = { ...checks, [`${item.id}:${n}`]: on };
    const finished = allKeys.length > 0 && allKeys.every((k) => next[k]);
    updateDay(date, (d) => ({ ...d, checks: next, workoutDone: finished || d.workoutDone }));
    if (!on) return;
    if (finished) onSessionOver();
    else if (item.rest && hasOpenRestBoxes(list, next)) onSetDone();
  };

  return (
    <>
      <DateBar date={date} today={today} setDate={setDate} />
      <SafetyBanners day={day} />

      <div class="session session-static">
        <span class="label">Session</span>
        <span class="session-name">{sessionLabel(day)}</span>
        {day.steps !== null && <span class="num meta">{fmt(day.steps)} steps</span>}
      </div>

      {day.emergency ? null : (
        <>
          {list.message && <Note>{list.message}</Note>}
          {list.finisherSkipped && <Note>Skip the finisher today.</Note>}

          {list.groups.map((group) => (
            <section class="block" key={group.title}>
              <h2>{group.title}</h2>
              {group.note && <p class="muted-text">{group.note}</p>}
              <ul class="exercises">
                {group.items.map((item) => (
                  <li class={item.boxes === 1 ? 'exercise exercise-single' : 'exercise'} key={item.id}>
                    <div class="exercise-head">
                      <span class="exercise-name">{item.name}</span>
                      <span class="num exercise-detail">{item.detail}</span>
                    </div>
                    <div class="exercise-boxes">
                      {Array.from({ length: item.boxes }, (_, n) => (
                        <CheckBox
                          key={n}
                          checked={!!checks[`${item.id}:${n}`]}
                          label={item.boxes > 1 ? `${item.name}, ${n + 1} of ${item.boxes}` : item.name}
                          onChange={(on) => toggle(item, n, on)}
                        />
                      ))}
                    </div>
                    {item.easier && <p class="muted-text">{item.easier}</p>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {list.footnote && <Note>{list.footnote}</Note>}
          {day.jog && (
            <section class="block">
              <h2>Optional jog</h2>
              <p>{JOG_NOTE}</p>
            </section>
          )}
        </>
      )}
    </>
  );
}
