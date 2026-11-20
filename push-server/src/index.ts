// Cut Tracker push server: holds each phone's alert times and sends a web push
// notification when each one is due, so alerts arrive with the screen locked.
//
// GET  /key       the public key the app subscribes with (made on first use, then kept)
// POST /schedule  { subscription, alerts: [{ at, title, body }] } replaces that phone's alerts
// POST /cancel    { endpoint } clears them

import { DurableObject } from 'cloudflare:workers';
import { buildPushPayload, type PushSubscription } from '@block65/webcrypto-web-push';

interface Env {
  SESSIONS: DurableObjectNamespace<Sessions>;
  ALLOWED_ORIGIN: string;
  VAPID_SUBJECT: string;
}

interface Alert {
  at: number;
  title: string;
  body: string;
}

interface Keys {
  publicKey: string;
  privateKey: string;
}

const MAX_ALERTS = 120;
const MAX_AHEAD = 8 * 60 * 60 * 1000;
const STALE = 2 * 60 * 1000; // an alert this late is skipped rather than sent

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function makeKeys(): Promise<Keys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const raw = new Uint8Array([4, ...fromB64url(jwk.x!), ...fromB64url(jwk.y!)]);
  return { publicKey: b64url(raw), privateKey: jwk.d! };
}

function isSubscription(s: unknown): s is PushSubscription {
  const sub = s as PushSubscription;
  return typeof sub?.endpoint === 'string' && sub.endpoint.startsWith('https://') && typeof sub.keys?.auth === 'string' && typeof sub.keys?.p256dh === 'string';
}

function cleanAlerts(list: unknown): Alert[] | null {
  if (!Array.isArray(list) || list.length > MAX_ALERTS) return null;
  const now = Date.now();
  const out: Alert[] = [];
  for (const a of list) {
    if (typeof a?.at !== 'number' || typeof a.title !== 'string' || typeof a.body !== 'string') return null;
    if (a.at < now - STALE || a.at > now + MAX_AHEAD) continue;
    out.push({ at: a.at, title: a.title.slice(0, 100), body: a.body.slice(0, 200) });
  }
  return out.sort((x, y) => x.at - y.at);
}

export class Sessions extends DurableObject<Env> {
  // Only called on the single "keys" instance.
  async keys(): Promise<Keys> {
    let keys = await this.ctx.storage.get<Keys>('keys');
    if (!keys) {
      keys = await makeKeys();
      await this.ctx.storage.put('keys', keys);
    }
    return keys;
  }

  async schedule(subscription: PushSubscription, alerts: Alert[]) {
    await this.ctx.storage.put({ subscription, alerts });
    if (alerts.length) await this.ctx.storage.setAlarm(alerts[0].at);
    else await this.ctx.storage.deleteAlarm();
  }

  async cancel() {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async alarm() {
    const subscription = await this.ctx.storage.get<PushSubscription>('subscription');
    const alerts = (await this.ctx.storage.get<Alert[]>('alerts')) ?? [];
    if (!subscription) return;
    const now = Date.now();
    const due = alerts.filter((a) => a.at <= now + 500);
    const rest = alerts.filter((a) => a.at > now + 500);
    // If several fell due together (a late alarm), only the newest is worth showing.
    const send = due.filter((a) => now - a.at < STALE).pop();
    if (send) {
      const gone = await this.push(subscription, send);
      if (gone) return this.cancel();
    }
    await this.ctx.storage.put('alerts', rest);
    if (rest.length) await this.ctx.storage.setAlarm(rest[0].at);
  }

  // Returns true when the phone has dropped this subscription.
  private async push(subscription: PushSubscription, alert: Alert): Promise<boolean> {
    const keys = await this.env.SESSIONS.get(this.env.SESSIONS.idFromName('keys')).keys();
    const payload = await buildPushPayload(
      { data: { title: alert.title, body: alert.body }, options: { ttl: 120, urgency: 'high' } },
      subscription,
      { subject: this.env.VAPID_SUBJECT, publicKey: keys.publicKey, privateKey: keys.privateKey },
    );
    const res = await fetch(subscription.endpoint, payload);
    if (!res.ok) console.log('push failed', res.status, await res.text());
    return res.status === 404 || res.status === 410;
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('origin');
    const cors: Record<string, string> = {
      'access-control-allow-origin': env.ALLOWED_ORIGIN,
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      vary: 'origin',
    };
    const reply = (body: BodyInit | null, status = 200) => new Response(body, { status, headers: cors });

    if (req.method === 'OPTIONS') return reply(null, 204);
    if (origin && origin !== env.ALLOWED_ORIGIN) return reply('Forbidden', 403);

    const { pathname } = new URL(req.url);
    if (req.method === 'GET' && pathname === '/key') {
      const keys = await env.SESSIONS.get(env.SESSIONS.idFromName('keys')).keys();
      return reply(keys.publicKey);
    }
    if (req.method !== 'POST') return reply('Not found', 404);

    let body: { subscription?: unknown; alerts?: unknown; endpoint?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply('Bad JSON', 400);
    }

    if (pathname === '/schedule') {
      const alerts = cleanAlerts(body.alerts);
      if (!isSubscription(body.subscription) || !alerts) return reply('Bad request', 400);
      await env.SESSIONS.get(env.SESSIONS.idFromName(body.subscription.endpoint)).schedule(body.subscription, alerts);
      return reply(JSON.stringify({ scheduled: alerts.length }));
    }
    if (pathname === '/cancel') {
      if (typeof body.endpoint !== 'string') return reply('Bad request', 400);
      await env.SESSIONS.get(env.SESSIONS.idFromName(body.endpoint)).cancel();
      return reply(JSON.stringify({ cancelled: true }));
    }
    return reply('Not found', 404);
  },
} satisfies ExportedHandler<Env>;
