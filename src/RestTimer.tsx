import { useEffect, useState } from 'preact/hooks';
import { updateSettings } from './store';
import { beep, holdScreen } from './sound';

export { unlockSound } from './sound';

const CHOICES = [60, 75, 90];

interface Props {
  end: number;
  seconds: number;
  onRestart: (seconds: number) => void;
  onClose: () => void;
}

// Counts down from a timestamp, so it stays correct if iOS pauses the page.
export function RestTimer({ end, seconds, onRestart, onClose }: Props) {
  const [now, setNow] = useState(Date.now());
  const left = Math.max(0, Math.ceil((end - now) / 1000));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(holdScreen, []);

  useEffect(() => {
    if (left > 0) return;
    beep();
    navigator.vibrate?.(300);
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [left === 0]);

  const choose = (s: number) => {
    updateSettings({ restSeconds: s });
    onRestart(s);
  };

  return (
    <div class="timer" role="timer" aria-label="Rest timer">
      <div class="timer-count">
        <span class="timer-label">{left > 0 ? 'Rest' : 'Next set'}</span>
        <span class="timer-time">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      </div>
      <div class="timer-actions">
        {CHOICES.map((s) => (
          <button key={s} type="button" class={s === seconds ? 'chip chip-on' : 'chip'} onClick={() => choose(s)}>
            {s}
          </button>
        ))}
        <button type="button" class="chip" onClick={onClose}>
          Skip
        </button>
      </div>
    </div>
  );
}
