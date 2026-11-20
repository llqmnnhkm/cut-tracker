import { useEffect, useRef, useState } from 'preact/hooks';
import { clock } from './activity';
import { NumberField, Tick, fmt } from './components';
import {
  addRestTime,
  discardEmom,
  emomPhase,
  finishEmom,
  finishSet,
  getAlertStatus,
  pauseRest,
  removeEmom,
  resumeRest,
  savedSetup,
  skipRest,
  startEmom,
  undoSet,
  type EmomLog,
  type EmomRun,
  type EmomSetup,
} from './emom';
import { alertsPossible, alertsSetUp } from './push';
import { beep, holdScreen, ring, unlockSound } from './sound';

const ALERT_TEXT: Record<string, string> = {
  pending: 'Setting up the lock screen alert…',
  on: 'You can lock your phone. A notification comes when rest is over.',
  'off-denied': 'Notifications are off for Cut Tracker. Turn them on in iPhone Settings → Notifications → Cut.',
  'off-not-installed': 'Lock screen alerts need the Home Screen app (iOS 16.4 or later). Keep this screen open.',
  'off-not-set-up': 'Lock screen alerts are not set up yet. Keep this screen open.',
  'off-error': "Couldn't reach the alert server. Keep this screen open.",
};

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, []);
  return now;
}

let stopRing: (() => void) | null = null;
const silence = () => {
  stopRing?.();
  stopRing = null;
};

// Kept mounted by the app while a session runs: rings when rest ends on any tab,
// and shows a bar off the Workout tab.
export function EmomRunner({ run, showBar }: { run: EmomRun; showBar: boolean }) {
  const now = useNow(250);
  const { phase, set, left } = emomPhase(run, now);
  const last = useRef(phase);

  useEffect(() => (phase === 'rest' ? holdScreen() : undefined), [phase]);

  useEffect(() => {
    if (last.current === 'rest' && phase === 'set') {
      silence();
      stopRing = ring(8);
      navigator.vibrate?.([400, 200, 400, 200, 400]);
    }
    last.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase === 'rest' && left > 0 && left <= 3) beep(1, 620, 0.08);
  }, [left]);

  useEffect(() => silence, []);

  if (!showBar) return null;
  const text =
    phase === 'rest'
      ? `Rest · set ${set} of ${run.rounds} next`
      : phase === 'paused'
        ? 'Rest paused'
        : phase === 'finished'
          ? 'All sets done, tap to save'
          : `Set ${set}: ${run.reps} ${run.exercise.toLowerCase()} now`;
  return (
    <a class="recbar" href="#workout">
      <i class={phase === 'rest' ? 'recdot' : 'recdot recdot-paused'} />
      <span>{text}</span>
      {(phase === 'rest' || phase === 'paused') && <b class="num">{clock(left)}</b>}
    </a>
  );
}

function Live({ run }: { run: EmomRun }) {
  const now = useNow();
  const { phase, set, left } = emomPhase(run, now);
  const restTotal = run.restMin * 60;
  const status = getAlertStatus();

  const done = () => {
    silence();
    finishSet();
  };
  const finish = () => {
    silence();
    if (phase === 'finished' || confirm(`Finish now and save ${run.done} of ${run.rounds} sets?`)) finishEmom();
  };

  return (
    <section class={phase === 'set' ? 'emom emom-go' : 'emom'}>
      <div class="emom-bar" aria-hidden="true">
        <i style={{ width: `${(run.done / run.rounds) * 100}%` }} />
      </div>
      <p class="emom-round">{phase === 'finished' ? 'All sets done' : `Set ${set} of ${run.rounds}`}</p>

      {phase === 'set' && (
        <>
          <p class="emom-big">
            {run.reps} <span>{run.exercise.toLowerCase()}</span>
          </p>
          <button type="button" class="emom-done" onClick={done}>
            <Tick /> Done
          </button>
          <p class="emom-label">
            {set < run.rounds ? `Tap Done when the set is finished. Your ${run.restMin} min rest starts then.` : 'Last set. Tap Done when it is finished.'}
          </p>
        </>
      )}

      {(phase === 'rest' || phase === 'paused') && (
        <>
          <p class="emom-label">{phase === 'paused' ? 'Rest paused' : 'Rest'}</p>
          <p class="emom-time num">{clock(left)}</p>
          <div class="prog emom-rest-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, (1 - left / restTotal) * 100))}%` }} />
          </div>
          <div class="emom-chips">
            {phase === 'rest' ? (
              <>
                <button type="button" class="chip chip-wide" onClick={() => addRestTime(60)}>
                  +1 min
                </button>
                <button type="button" class="chip chip-wide" onClick={pauseRest}>
                  Pause
                </button>
              </>
            ) : (
              <button type="button" class="chip chip-wide chip-on" onClick={resumeRest}>
                Resume
              </button>
            )}
            <button type="button" class="chip chip-wide" onClick={skipRest}>
              Skip rest
            </button>
          </div>
          {status && phase === 'rest' && <p class={status === 'on' ? 'emom-alerts is-on' : 'emom-alerts'}>{ALERT_TEXT[status]}</p>}
        </>
      )}

      {phase === 'finished' && (
        <p class="emom-big">
          {fmt(run.done * run.reps)} <span>{run.exercise.toLowerCase()}</span>
        </p>
      )}

      <div class="emom-dots" aria-label={`${run.done} of ${run.rounds} sets done`}>
        {Array.from({ length: run.rounds }, (_, i) => {
          const n = i + 1;
          const cls = ['emom-dot', n <= run.done && 'is-done', n === set && phase !== 'finished' && 'is-now'].filter(Boolean).join(' ');
          return (
            <span key={n} class={cls}>
              {n <= run.done ? <Tick /> : n}
            </span>
          );
        })}
      </div>

      <div class="emom-actions">
        <button type="button" class={phase === 'finished' ? 'btn' : 'btn btn-quiet'} onClick={finish}>
          {phase === 'finished' ? 'Save session' : 'Finish early'}
        </button>
      </div>
      <div class="emom-links">
        {run.done > 0 && phase !== 'finished' && (
          <button type="button" class="textlink textlink-quiet" onClick={() => confirm('Undo the last Done?') && undoSet()}>
            Undo last Done
          </button>
        )}
        <button
          type="button"
          class="textlink textlink-quiet emom-discard"
          onClick={() => {
            if (!confirm('Discard this session without saving?')) return;
            silence();
            discardEmom();
          }}
        >
          Discard
        </button>
      </div>
    </section>
  );
}

function LogCard({ date, log }: { date: string; log: EmomLog }) {
  const rest = log.restMin ?? log.everyMin;
  return (
    <li class="emom-log">
      <span class={log.rounds === log.of ? 'coin coin-sm is-full' : 'coin coin-sm'}>{log.rounds === log.of ? <Tick /> : log.rounds}</span>
      <span class="feed-who">
        <b>
          {fmt(log.rounds * log.reps)} {log.exercise.toLowerCase()}
        </b>
        <small>
          {log.rounds} of {log.of} sets of {log.reps}
          {rest ? ` · ${rest} min rest` : ''}
        </small>
      </span>
      <button type="button" class="textlink textlink-quiet" onClick={() => confirm('Delete this session?') && removeEmom(date, log.id)}>
        Delete
      </button>
    </li>
  );
}

export function EmomPanel({ date, today, run, logs }: { date: string; today: string; run: EmomRun | null; logs: EmomLog[] }) {
  const [editing, setEditing] = useState(false);
  const [setup, setSetup] = useState<EmomSetup>(savedSetup);

  if (run) return <Live run={run} />;

  const valid = setup.exercise.trim() !== '' && setup.reps > 0 && setup.restMin > 0 && setup.rounds > 0;
  const start = () => {
    if (!valid) return;
    unlockSound();
    setEditing(false);
    startEmom(today, { ...setup, exercise: setup.exercise.trim() });
  };
  const num = (key: 'reps' | 'restMin' | 'rounds') => (v: number | undefined) => setSetup((s) => ({ ...s, [key]: v ?? 0 }));

  return (
    <section class="panel">
      <h3>Sets with {setup.restMin} min rest</h3>
      <p class="muted-text">
        {setup.rounds} sets of {setup.reps} {setup.exercise.toLowerCase()}, {fmt(setup.rounds * setup.reps)} in total. Do a set, tap Done, rest{' '}
        {setup.restMin} min, and it rings for the next one.
      </p>
      {editing && (
        <div class="meal-form">
          <label class="field">
            <span class="field-label">Exercise</span>
            <span class="inp">
              <input type="text" autocomplete="off" value={setup.exercise} onInput={(e) => setSetup({ ...setup, exercise: e.currentTarget.value })} />
            </span>
          </label>
          <div class="grid-3">
            <NumberField label="Reps" min={1} max={500} value={setup.reps || undefined} onCommit={num('reps')} />
            <NumberField label="Rest" unit="min" decimal min={0.5} max={60} value={setup.restMin || undefined} onCommit={num('restMin')} />
            <NumberField label="Sets" min={1} max={100} value={setup.rounds || undefined} onCommit={num('rounds')} />
          </div>
          {!valid && <p class="field-error">Fill in each box.</p>}
        </div>
      )}
      <div class="button-row">
        <button class="btn" type="button" disabled={!valid || date !== today} onClick={start}>
          Start
        </button>
        <button class="btn btn-quiet" type="button" onClick={() => setEditing(!editing)}>
          {editing ? 'Done editing' : 'Change'}
        </button>
      </div>
      {date !== today && <p class="muted-text">Go back to today to start a session.</p>}
      {date === today && (
        <p class="muted-text">
          {alertsPossible()
            ? 'When rest is over you get a notification, even with the phone locked. Allow notifications when asked.'
            : alertsSetUp()
              ? 'Open Cut Tracker from your Home Screen to get lock screen alerts.'
              : 'Keep the app open on screen while you rest; it rings when rest is over.'}
        </p>
      )}
      {logs.length > 0 && (
        <ul class="emom-logs">
          {logs.map((l) => (
            <LogCard key={l.id} date={date} log={l} />
          ))}
        </ul>
      )}
    </section>
  );
}
