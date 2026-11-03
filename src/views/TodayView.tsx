import type { ComponentChildren } from 'preact';
import { Bar, CheckRow, DateBar, Note, SafetyBanners, Tick, fmt, isStandalone, litres, type DateNav } from '../components';
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
} from '../plan';
import { dayPlan, isAboveDecisionLimit, nextCheckpoint, phaseFor, showRebound, targetsFor, totals } from '../rules';
import { updateDay, type Store } from '../store';
import { sessionLabel } from '../workout';

interface RowProps {
  label: string;
  value: string;
  target?: string;
  ratio?: number;
  done?: boolean;
  children?: ComponentChildren;
}

function Row({ label, value, target, ratio, done, children }: RowProps) {
  return (
    <a class="row" href="#log">
      <div class="row-line">
        <span class="row-label">{label}</span>
        <span class="num row-value">
          {done && <Tick />}
          <strong>{value}</strong>
          {target && <span class="muted"> / {target}</span>}
        </span>
      </div>
      {ratio !== undefined && <Bar ratio={ratio} />}
      {children && <div class="row-note">{children}</div>}
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

      {!isStandalone() && (
        <p class="alert">
          Add this to your Home Screen before logging anything: Share, then Add to Home Screen. Logs made in Safari stay
          in Safari, and iOS can clear them after 7 days without use.
        </p>
      )}

      <a class="session" href="#workout">
        <span class="label">Session</span>
        <span class="session-name">
          {sessionLabel(day)}
          {log?.workoutDone && <Tick />}
        </span>
      </a>

      <section class="ledger" aria-label="Today's progress">
        <Row
          label="Steps"
          value={fmt(steps)}
          target={day.steps !== null ? fmt(day.steps) : undefined}
          ratio={day.steps !== null ? steps / day.steps : undefined}
          done={day.steps !== null && steps >= day.steps}
        >
          {day.steps === null && 'No step target today.'}
          {day.steps !== null && day.plannedSteps !== day.steps && `Lowered from ${fmt(day.plannedSteps!)} today.`}
        </Row>
        {targets ? (
          <>
            <Row label="Calories" value={fmt(sum.kcal)} target={fmt(targets.kcal)} ratio={sum.kcal / targets.kcal}>
              {hasRange && `Estimate: ${fmt(sum.kcalLow)}–${fmt(sum.kcalHigh)} kcal. `}
              {sum.kcal > targets.kcal && OVER_TARGET_NOTE}
            </Row>
            <Row label="Protein" value={`${fmt(sum.protein)} g`} target={`${targets.protein} g`} ratio={sum.protein / targets.protein} />
            <Row label="Carbs" value={`${fmt(sum.carbs)} g`} target={`${targets.carbs} g`} ratio={sum.carbs / targets.carbs} />
            <Row label="Fat" value={`${fmt(sum.fat)} g`} target={`${targets.fat} g`} ratio={sum.fat / targets.fat} />
          </>
        ) : (
          <Row label="Calories" value={fmt(sum.kcal)}>
            No target today.
          </Row>
        )}
        <Row
          label="Water"
          value={`${litres(water)} L`}
          target={hasWaterTarget ? '3–4 L' : undefined}
          ratio={hasWaterTarget ? water / 3000 : undefined}
          done={hasWaterTarget && water >= 3000}
        >
          {date >= '2026-11-12' && waterNote(date)}
        </Row>
        <Row label="Weight" value={log?.weight !== undefined ? `${log.weight} kg` : '–'}>
          {checkpointToday
            ? `Checkpoint today: ≤ ${checkpointToday.target.toFixed(1)} kg.`
            : next && `Next checkpoint: ≤ ${next.target.toFixed(1)} kg on ${shortDate(next.date)}.`}
          {checkpointToday && date !== WEIGH_IN && log?.weight !== undefined && log.weight > checkpointToday.target && ` ${ABOVE_CHECKPOINT_NOTE}`}
        </Row>
      </section>

      {date >= DECISION_DATE && date <= WEIGH_IN && isAboveDecisionLimit(store) && <Note>{DECISION_NOTE}</Note>}
      {showRebound(date) && <Note>{REBOUND_NOTE}</Note>}

      <section class="block">
        <h2>Food focus</h2>
        <p>{phase ? PHASES[phase].focus : WEIGH_IN_FOCUS}</p>
      </section>

      {day.jog && (
        <section class="block">
          <h2>Optional jog</h2>
          <p>{JOG_NOTE}</p>
        </section>
      )}

      <section class="block">
        <h2>How are you today?</h2>
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
    </>
  );
}
