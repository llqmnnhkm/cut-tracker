import { useEffect, useState } from 'preact/hooks';
import { updateSettings } from './store';

let audio: AudioContext | null = null;

// iOS only allows sound from a context first started during a tap.
export function unlockSound() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    audio = null;
  }
}

function beep() {
  if (!audio) return;
  [0, 0.25].forEach((delay) => {
    const osc = audio!.createOscillator();
    const gain = audio!.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(audio!.destination);
    osc.start(audio!.currentTime + delay);
    osc.stop(audio!.currentTime + delay + 0.15);
  });
}

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

  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => void lock?.release();
  }, []);

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
        <span class="label">{left > 0 ? 'Rest' : 'Next set'}</span>
        <span class="num timer-time">
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      </div>
      <div class="timer-actions">
        {CHOICES.map((s) => (
          <button key={s} type="button" class={s === seconds ? 'chip is-on' : 'chip'} onClick={() => choose(s)}>
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
