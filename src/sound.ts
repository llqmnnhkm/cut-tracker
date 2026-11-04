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
