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

export function beep(times = 2, frequency = 880, length = 0.15) {
  if (!audio) return;
  for (let i = 0; i < times; i++) {
    const delay = i * 0.25;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = frequency;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(audio.destination);
    osc.start(audio.currentTime + delay);
    osc.stop(audio.currentTime + delay + length);
  }
}

// An alarm-style ringtone: bursts of two alternating tones for a few seconds.
// Returns a function that stops it early.
export function ring(seconds = 8): () => void {
  if (!audio) return () => {};
  const ctx = audio;
  const gain = ctx.createGain();
  gain.gain.value = 0.35;
  gain.connect(ctx.destination);
  const oscs: OscillatorNode[] = [];
  const start = ctx.currentTime;
  for (let burst = 0; burst * 1.2 < seconds; burst++) {
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = i % 2 ? 1320 : 990;
      osc.connect(gain);
      const at = start + burst * 1.2 + i * 0.13;
      osc.start(at);
      osc.stop(at + 0.11);
      oscs.push(osc);
    }
  }
  return () => {
    gain.gain.setValueAtTime(0, ctx.currentTime);
    oscs.forEach((o) => {
      try {
        o.stop();
      } catch {
        // Already stopped.
      }
    });
  };
}

// Keeps the screen on while a timer is showing, where the phone allows it.
export function holdScreen(): () => void {
  let lock: WakeLockSentinel | undefined;
  let released = false;
  navigator.wakeLock
    ?.request('screen')
    .then((l) => (released ? void l.release() : (lock = l)))
    .catch(() => {});
  return () => {
    released = true;
    void lock?.release();
  };
}
