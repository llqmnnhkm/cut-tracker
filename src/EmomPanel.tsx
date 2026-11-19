import { useEffect, useRef, useState } from 'preact/hooks';
import { clock } from './activity';
import { NumberField, Tick, fmt } from './components';
import {
  discardEmom,
  emomPosition,
  finishEmom,
  pauseEmom,
  removeEmom,
  resumeEmom,
  roundsIn,
  savedSetup,
  startEmom,
  toggleRound,
  type EmomLog,
  type EmomRun,
  type EmomSetup,
} from './emom';
import { beep, holdScreen, unlockSound } from './sound';

const summary = (s: EmomSetup) => `${s.reps} ${s.exercise.toLowerCase()} every ${s.everyMin} min for ${s.totalMin} min`;

function useNow(ms = 500) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Kept mounted by the app while a session runs: sounds the rounds on any tab, and shows a bar off the Workout tab.
export function EmomRunner({ run, showBar }: { run: EmomRun; showBar: boolean }) {
  const now = useNow(250);
  const pos = emomPosition(run, now);
  const lastRound = useRef(pos.round);
  const lastEnded = useRef(pos.ended);
  const paused = run.pausedAt !== null;

  useEffect(() => (paused || pos.ended ? undefined : holdScreen()), [paused, pos.ended]);

  useEffect(() => {
    if (pos.round !== lastRound.current && !pos.ended) {
      beep(3, 990);
      navigator.vibrate?.([200, 100, 200]);
    }
    lastRound.current = pos.round;
  }, [pos.round]);

  useEffect(() => {
    if (pos.ended && !lastEnded.current) {
      beep(4, 990);
      navigator.vibrate?.([300, 100, 300]);
    }
    lastEnded.current = pos.ended;
  }, [pos.ended]);

  useEffect(() => {
    if (!paused && !pos.ended && pos.left > 0 && pos.left <= 3) beep(1, 620, 0.08);
  }, [pos.left]);

  if (!showBar) return null;
  const doneNow = run.done.includes(pos.round);
  return (
    <a class="recbar" href="#workout">
      <i class={paused || pos.ended ? 'recdot recdot-paused' : 'recdot'} />
      <span>
        {pos.ended ? 'Session over, tap to save' : paused ? 'Paused' : doneNow ? `Rest · round ${pos.round} of ${pos.total}` : `${run.reps} ${run.exercise.toLowerCase()} now`}
      </span>
      {!pos.ended && <b class="num">{clock(pos.left)}</b>}
    </a>
  );
}

function Live({ run }: { run: EmomRun }) {
  const now = useNow();
  const pos = emomPosition(run, now);
  const paused = run.pausedAt !== null;
  const doneNow = run.done.includes(pos.round);
  const block = run.everyMin * 60;

  const finish = () => {
    if (pos.ended || confirm(`Finish now and save ${run.done.length} of ${pos.total} rounds?`)) finishEmom();
  };

  return (
    <section class={!pos.ended && !paused && !doneNow ? 'emom emom-go' : 'emom'}>
      <div class="emom-bar" aria-hidden="true">
        <i style={{ width: `${(pos.elapsed / (pos.total * block)) * 100}%` }} />
      </div>
      <p class="emom-round">
        {pos.ended ? 'Session over' : `Round ${pos.round} of ${pos.total}`}
        {paused && ' · paused'}
      </p>
      {pos.ended ? (
        <p class="emom-big">
          {fmt(run.done.length * run.reps)} <span>{run.exercise.toLowerCase()}</span>
        </p>
      ) : doneNow ? (
        <>
          <p class="emom-label">Rest. Next round in</p>
          <p class="emom-time num">{clock(pos.left)}</p>
        </>
      ) : (
        <>
          <p class="emom-big">
            {run.reps} <span>{run.exercise.toLowerCase()}</span>
          </p>
          <button type="button" class="emom-done" onClick={() => toggleRound(pos.round)}>
            <Tick /> Done
          </button>
          <p class="emom-label num">{clock(pos.left)} left in this round</p>
        </>
      )}

      <div class="emom-dots" aria-label={`${run.done.length} of ${pos.total} rounds done`}>
        {Array.from({ length: pos.total }, (_, i) => {
          const r = i + 1;
          const done = run.done.includes(r);
          const missed = !done && (r < pos.round || pos.ended);
          const cls = ['emom-dot', done && 'is-done', missed && 'is-missed', r === pos.round && !pos.ended && 'is-now'].filter(Boolean).join(' ');
          return (
            <button key={r} type="button" class={cls} disabled={r > pos.round} aria-label={`Round ${r}${done ? ', done' : ''}`} onClick={() => toggleRound(r)}>
              {done ? <Tick /> : r}
            </button>
          );
        })}
      </div>

      <div class="emom-actions">
        {!pos.ended && (
          <button type="button" class="btn btn-quiet" onClick={paused ? resumeEmom : pauseEmom}>
            {paused ? 'Resume' : 'Pause'}
          </button>
        )}
        <button type="button" class="btn" onClick={finish}>
          {pos.ended ? 'Save session' : 'Finish'}
        </button>
      </div>
      {(paused || pos.ended) && (
        <button type="button" class="textlink textlink-quiet emom-discard" onClick={() => confirm('Discard this session without saving?') && discardEmom()}>
          Discard
        </button>
      )}
      {!pos.ended && <p class="muted-text emom-tip">Keep the app open on screen so it can beep each round. Missed a tap? Tap a past round to tick it.</p>}
    </section>
  );
}

function LogCard({ date, log }: { date: string; log: EmomLog }) {
  return (
    <li class="emom-log">
      <span class={log.rounds === log.of ? 'coin coin-sm is-full' : 'coin coin-sm'}>{log.rounds === log.of ? <Tick /> : log.rounds}</span>
      <span class="feed-who">
        <b>
          {fmt(log.rounds * log.reps)} {log.exercise.toLowerCase()}
        </b>
        <small>
          {log.rounds} of {log.of} rounds · {log.reps} every {log.everyMin} min
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

  const rounds = roundsIn(setup);
  const valid = setup.exercise.trim() !== '' && setup.reps > 0 && setup.everyMin > 0 && setup.totalMin >= setup.everyMin;
  const start = () => {
    if (!valid) return;
    unlockSound();
    setEditing(false);
    startEmom(today, { ...setup, exercise: setup.exercise.trim() });
  };
  const num = (key: 'reps' | 'everyMin' | 'totalMin') => (v: number | undefined) => setSetup((s) => ({ ...s, [key]: v ?? 0 }));

  return (
    <section class="panel">
      <h3>Every {setup.everyMin} minutes</h3>
      <p class="muted-text">
        {summary(setup)}: {rounds} rounds, {fmt(rounds * setup.reps)} {setup.exercise.toLowerCase()} in total. It beeps at the start of each round; do the set, tap Done, rest until the next beep.
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
            <NumberField label="Every" unit="min" min={1} max={60} value={setup.everyMin || undefined} onCommit={num('everyMin')} />
            <NumberField label="For" unit="min" min={1} max={240} value={setup.totalMin || undefined} onCommit={num('totalMin')} />
          </div>
          {!valid && <p class="field-error">Fill in each box. The session must be at least one round long.</p>}
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
