// Lock screen alerts through the push server in push-server/. The server's address
// comes in at build time; without it, or on a phone that can't take web push, this does nothing.

const SERVER = (import.meta.env.VITE_PUSH_URL as string | undefined)?.replace(/\/$/, '');

export interface PushAlert {
  at: number;
  title: string;
  body: string;
}

export type AlertStatus = 'on' | 'off-denied' | 'off-not-installed' | 'off-not-set-up' | 'off-error';

const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

function supportCheck(): AlertStatus | null {
  if (!SERVER) return 'off-not-set-up';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'off-not-installed';
  return null;
}

export const alertsPossible = () => supportCheck() === null;
export const alertsSetUp = () => !!SERVER;

async function subscription(): Promise<PushSubscriptionJSON | AlertStatus> {
  const blocked = supportCheck();
  if (blocked) return blocked;
  // Must be the first await, so iOS still sees it as part of the tap.
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return 'off-denied';
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = await (await fetch(`${SERVER}/key`)).text();
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64url(key) });
  }
  return sub.toJSON();
}

// Replaces any alerts this phone already has with these.
export async function scheduleAlerts(alerts: PushAlert[]): Promise<AlertStatus> {
  try {
    const sub = await subscription();
    if (typeof sub === 'string') return sub;
    const res = await fetch(`${SERVER}/schedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub, alerts }),
    });
    return res.ok ? 'on' : 'off-error';
  } catch {
    return 'off-error';
  }
}

export async function cancelAlerts() {
  if (supportCheck()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await fetch(`${SERVER}/cancel`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  } catch {
    // The server drops stale alerts on its own.
  }
}
