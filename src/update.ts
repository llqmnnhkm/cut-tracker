// Finds new versions and waits for a tap to restart, so an update never
// reloads the page in the middle of a timer.

import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

let ready = false;
const listeners = new Set<() => void>();

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    ready = true;
    listeners.forEach((l) => l());
  },
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => void registration.update().catch(() => {});
    // iOS keeps Home Screen apps alive, so check on every return, not just on launch.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
    setInterval(check, 30 * 60 * 1000);
  },
});

export const restartForUpdate = () => void updateSW(true);

export function useUpdateReady(): boolean {
  const [, tick] = useState(0);
  useEffect(() => {
    const listener = () => tick((n) => n + 1);
    listeners.add(listener);
    return () => void listeners.delete(listener);
  }, []);
  return ready;
}
