import type { ComponentChildren } from 'preact';
import { Bar, CheckRow, DateBar, Note, SafetyBanners, Tick, fmt, litres, type DateNav } from '../components';
import { shortDate } from '../dates';
import {
  ABOVE_CHECKPOINT_NOTE,
  CHECKPOINTS,
  DECISION_DATE,
  DECISION_NOTE,
  FLAGS,
  JOG_NOTE,
  OVER_TARGET_NOTE,
  PHASES,
  REBOUND_NOTE,
  WATER_TARGET_NOTE,
  WATER_THIRST_NOTE,
  WATER_WEIGH_IN_NOTE,
  WEIGH_IN,
  WEIGH_IN_FOCUS,
  type FlagId,
  type SessionId,
} from '../plan';
import { dayPlan, isAboveDecisionLimit, nextCheckpoint, phaseFor, showRebound, targetsFor, totals } from '../rules';
import { updateDay, type Store } from '../store';
import { sessionLabel } from '../workout';

const COINS: Record<SessionId, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  'B-light': 'B',
  intervals: 'I',
  cardio: 'W',
  rest: 'R',
  steps: 'S',
  'weigh-in': 'KG',
};

export function SessionCoin({ session, done }: { session: SessionId; done?: boolean }) {
  return (
    <span class={done ? 'coin coin-done' : 'coin'} aria-hidden="true">
      {done ? <Tick /> : COINS[session]}
    </span>
  );
}

interface StatProps {
  index: number;
  label: string;
  value: string;
  unit?: string;
  of?: string;
  ratio?: number;
  food?: boolean;
  done?: boolean;
  children?: ComponentChildren;
}

function Stat({ index, label, value, unit, of, ratio, food, done, children }: StatProps) {
  return (
    <a class="stat" href="#log" style={{ '--i': index }}>
      <span class="stat-label">
        {label}
        {done && <Tick />}
      </span>
      <b>
        {value}
        {unit && <span class="unit">{unit}</span>}
      </b>
      {of && <small>{of}</small>}
      {ratio !== undefined && <Bar ratio={ratio} tone={food ? 'food' : done ? 'done' : undefined} />}
      {children && <small class="stat-note">{children}</small>}
    </a>
  );
}

export const waterNote = (date: string) => {
  if (date < '2026-11-12') return WATER_TARGET_NOTE;
  if (date === '2026-11-12') return WATER_THIRST_NOTE;
  if (date === WEIGH_IN) return WATER_WEIGH_IN_NOTE;
  return null;
};

export function TodayView({ store, date, today, setDate }: DateNav & { store: Store }) {
  const log = store.days[date];
  const day = dayPlan(store, date);
  const sum = totals(log);
  const targets = targetsFor(date, store.settings.targets);
  const phase = phaseFor(date);
  const water = log?.waterMl ?? 0;
  const hasWaterTarget = date <= '2026-11-12';
  const steps = log?.steps ?? 0;
  const hasRange = sum.kcalLow !== sum.kcalHigh;
  const checkpointToday = CHECKPOINTS.find((c) => c.date === date);
  const next = nextCheckpoint(date);

  const setFlag = (id: FlagId, on: boolean) =>
    updateDay(date, (d) => ({ ...d, flags: { ...d.flags, [id]: on } }));

  return (
    <>
      <DateBar date={date} today={today} setDate={setDate} />
      <SafetyBanners day={day} />

      <a class="tile" href="#workout">
        <SessionCoin session={day.session} done={log?.workoutDone} />
        <span class="tile-text">
          <span class="label">Session</span>
          <span class="session-name">{sessionLabel(day)}</span>
          <span class="tile-sub">{log?.workoutDone ? 'Done' : 'Open checklist'}</span>
        </span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </a>

      <section class="ledger" aria-label="Today's progress">
        <div class="stats">
          <Stat
            index={0}
            label="Steps"
            value={fmt(steps)}
            of={day.steps !== null ? `of ${fmt(day.steps)}` : undefined}
            ratio={day.steps !== null ? steps / day.steps : undefined}
            done={day.steps !== null && steps >= day.steps}
          >
            {day.steps === null && 'No step target today.'}
            {day.steps !== null && day.plannedSteps !== day.steps && `Lowered from ${fmt(day.plannedSteps!)} today.`}
          </Stat>
          <Stat
            index={1}
            label="Calories"
            value={fmt(sum.kcal)}
            of={targets ? `of ${fmt(targets.kcal)} kcal` : undefined}
            ratio={targets ? sum.kcal / targets.kcal : undefined}
            food
          >
            {!targets && 'No target today.'}
            {hasRange && `Estimate: ${fmt(sum.kcalLow)}–${fmt(sum.kcalHigh)} kcal. `}
            {targets && sum.kcal > targets.kcal && OVER_TARGET_NOTE}
          </Stat>
        </div>

        {targets && (
          <div class="stats stats-3">
            <Stat index={2} label="Protein" value={fmt(sum.protein)} unit="g" of={`of ${targets.protein} g`} ratio={sum.protein / targets.protein} food />
            <Stat index={3} label="Carbs" value={fmt(sum.carbs)} unit="g" of={`of ${targets.carbs} g`} ratio={sum.carbs / targets.carbs} food />
            <Stat index={4} label="Fat" value={fmt(sum.fat)} unit="g" of={`of ${targets.fat} g`} ratio={sum.fat / targets.fat} food />
          </div>
        )}

        <div class="stats">
          <Stat
            index={5}
            label="Water"
            value={litres(water)}
            unit="L"
            of={hasWaterTarget ? 'of 3–4 L' : undefined}
            ratio={hasWaterTarget ? water / 3000 : undefined}
            done={hasWaterTarget && water >= 3000}
          >
            {date >= '2026-11-12' && waterNote(date)}
          </Stat>
          <Stat index={6} label="Weight" value={log?.weight !== undefined ? `${log.weight}` : '–'} unit={log?.weight !== undefined ? 'kg' : undefined}>
            {checkpointToday
              ? `Checkpoint today: ≤ ${checkpointToday.target.toFixed(1)} kg.`
              : next && `Next: ≤ ${next.target.toFixed(1)} kg on ${shortDate(next.date)}.`}
            {checkpointToday && date !== WEIGH_IN && log?.weight !== undefined && log.weight > checkpointToday.target && ` ${ABOVE_CHECKPOINT_NOTE}`}
          </Stat>
        </div>
      </section>

      {date >= DECISION_DATE && date <= WEIGH_IN && isAboveDecisionLimit(store) && <Note>{DECISION_NOTE}</Note>}
      {showRebound(date) && <Note>{REBOUND_NOTE}</Note>}

      <section class="panel">
        <h3>Food focus</h3>
        <p>{phase ? PHASES[phase].focus : WEIGH_IN_FOCUS}</p>
      </section>

      <section class="panel">
        <h3>How are you today?</h3>
        <p class="muted-text">Tick anything that applies. The plan adjusts for you.</p>
        <ul class="flags">
          {FLAGS.map((f) => {
            const on = !!log?.flags?.[f.id];
            return (
              <li key={f.id}>
                <CheckRow checked={on} label={f.label} onChange={(c) => setFlag(f.id, c)} />
                {on && <p class="flag-advice">{f.id === 'fatigue' && day.fatigueAdjusted ? 'Second day in a row: 15,000 steps and no finisher today.' : f.advice}</p>}
              </li>
            );
          })}
        </ul>
      </section>

      {day.jog && (
        <section class="panel">
          <h3>Optional jog</h3>
          <p>{JOG_NOTE}</p>
        </section>
      )}
    </>
  );
}
