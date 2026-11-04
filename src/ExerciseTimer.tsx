import { useEffect, useRef, useState } from 'preact/hooks';
import { beep, holdScreen } from './sound';
import type { Phase } from './workout';

export interface ExerciseRun {
  id: number;
  date: string;
  itemId: string;
  phases: Phase[];
  start: number; // moves forward by the paused time on resume
  pausedAt: number | null;
}

interface Props {
  run: ExerciseRun;
  onBox: (n: number) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onFinish: () => void;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Where a run is after some elapsed milliseconds: the phase and the seconds left in it.
export function position(phases: Phase[], elapsedMs: number) {
  let t = elapsedMs / 1000;
  for (let i = 0; i < phases.length; i++) {
    if (t < phases[i].seconds) return { index: i, left: Math.ceil(phases[i].seconds - t) };
    t -= phases[i].seconds;
  }
  return { index: phases.length, left: 0 };
}

// Works from timestamps, so it catches up correctly if iOS pauses the page.
export function ExerciseTimer({ run, onBox, onPause, onResume, onStop, onFinish }: Props) {
  const [now, setNow] = useState(Date.now());
  const handled = useRef(0);
  const paused = run.pausedAt !== null;
  const elapsed = (run.pausedAt ?? now) - run.start;
  const { index, left } = position(run.phases, elapsed);
  const total = run.phases.reduce((sum, p) => sum + p.seconds, 0);
  const totalLeft = Math.max(0, Math.ceil(total - elapsed / 1000));
  const done = index >= run.phases.length;
  const phase = run.phases[Math.min(index, run.phases.length - 1)];

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(holdScreen, []);

  // Ticks every box whose phase has ended, then sounds once for the change.
  useEffect(() => {
    if (index <= handled.current) return;
    for (let i = handled.current; i < index; i++) {
      const box = run.phases[i].box;
      if (box !== undefined) onBox(box);
    }
    handled.current = index;
    if (done) {
      beep(3, 990);
      navigator.vibrate?.([200, 100, 200]);
    } else {
      beep(2, 880);
      navigator.vibrate?.(200);
    }
  }, [index]);

  useEffect(() => {
    if (!paused && !done && left > 0 && left <= 3 && phase.seconds > 5) beep(1, 620, 0.08);
  }, [left]);

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(onFinish, 3000);
    return () => clearTimeout(id);
  }, [done]);

  const sub = done ? 'All done' : [phase.round && `Round ${phase.round}`, `${clock(totalLeft)} total`].filter(Boolean).join(' · ');

  return (
    <div class={!done && phase.work ? 'timer timer-ex timer-work' : 'timer timer-ex'} role="timer" aria-label="Exercise timer">
      <div class="timer-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(1, elapsed / 1000 / total) * 100}%` }} />
      </div>
      <div class="timer-count">
        <span class="timer-label">{done ? 'Done' : paused ? `${phase.label}, paused` : phase.label}</span>
        <span class="timer-time">{clock(left)}</span>
        <span class="timer-sub">{sub}</span>
      </div>
      {!done && (
        <div class="timer-actions">
          <button type="button" class="chip chip-wide" onClick={paused ? onResume : onPause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" class="chip chip-wide" onClick={onStop}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
