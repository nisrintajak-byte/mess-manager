/**
 * web-push — sends one in-app notification to the user's browsers as a phone notification
 * (works with the site closed: Chrome on Android, desktop browsers; iPhone only for a site added
 * to the Home Screen). Called by the database for each new notification (x-worker-secret).
 * Text is written in the user's language from the same translations the app uses.
 * The VAPID private key is read from the database vault (web_push_vapid_key).
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

import { RTL_LANGS, translator } from '../send-emails/i18n.ts';
import { minorToDecimal } from '../send-emails/report.ts';

export const VAPID_PUBLIC_KEY =
  'BNRRwCWd99HH-Wg5i9vDtXrn9lGUmBxelxp2fVdDKeA0VBfcY3z5ditTurTLpyesdnuwMcp3jGQZ-3QghQWa7FQ';
const VAPID_SUBJECT = 'https://nisrintajak-byte.github.io/mess-manager/';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

let vapidPrivate: string | null = null;
async function privateKey(): Promise<string> {
  if (!vapidPrivate) {
    const { data } = await db.rpc('web_push_vapid_key');
    vapidPrivate = (data as string | null) ?? '';
  }
  return vapidPrivate;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function decimalsOf(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ??
      2
    );
  } catch {
    return 2;
  }
}

/** Same wording as the in-app inbox (src/lib/notifText.ts). */
export function pushText(kind: string, p: Record<string, unknown>, lang: string) {
  const t = translator(lang);
  const cur = str(p.currency);
  const dec = typeof p.decimals === 'number' ? p.decimals : decimalsOf(cur);
  const money = (v: unknown) =>
    cur ? `${cur} ${minorToDecimal(Number(v) * (p.credit ? -1 : 1), dec)}` : str(v);
  const vars: Record<string, string> = {
    name: str(p.name),
    room: str(p.room),
    by: str(p.by),
    title: str(p.title),
    from: str(p.from),
    to: str(p.to),
    due: str(p.due),
    reason: str(p.reason),
    date: str(p.original_date),
    deleteOn: str(p.delete_on),
    count: str(p.count),
    amount: p.amount !== undefined ? money(p.amount) : '',
  };
  if (kind === 'settlement_generated') {
    const net = Number(p.net ?? 0);
    vars.result =
      net === 0
        ? t('settlement.even')
        : net < 0
          ? t('settlement.toPay', { amount: `${cur} ${minorToDecimal(-net, dec)}` })
          : t('settlement.toReceive', { amount: `${cur} ${minorToDecimal(net, dec)}` });
  }
  if (kind === 'dispute_resolved') vars.outcome = t(`flag.s_${str(p.outcome)}`).toLowerCase();
  if (kind === 'dispute_raised') vars.reason = t(`flag.r_${str(p.reason)}`);
  let body = t(`inbox.k_${kind}`, vars);
  if (body === `inbox.k_${kind}`) body = t('inbox.k_other');
  return { title: vars.room || t('app.name'), body, dir: RTL_LANGS.has(lang) ? 'rtl' : 'ltr', lang };
}

async function send(notificationId: string) {
  const { data: job, error } = await db.rpc('web_push_job', { p_notification: notificationId });
  if (error || !job) return { sent: 0 };
  const msg = pushText(job.kind, job.payload ?? {}, job.language ?? 'en');
  const payload = JSON.stringify({
    ...msg,
    tag: notificationId,
    kind: job.kind,
    room_id: job.room_id,
    loud: job.loud === true,
    sticky: job.sticky === true,
  });
  const vapidDetails = {
    subject: VAPID_SUBJECT,
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: await privateKey(),
  };
  let sent = 0;
  for (const sub of job.subscriptions as { endpoint: string; keys: { p256dh: string; auth: string } }[]) {
    try {
      const req = webpush.generateRequestDetails(sub, payload, { vapidDetails, TTL: 86400, urgency: 'high' });
      const res = await fetch(req.endpoint, { method: req.method, headers: req.headers, body: req.body });
      if (res.status === 404 || res.status === 410)
        await db.rpc('web_push_gone', { p_endpoint: sub.endpoint });
      else if (res.ok) sent++;
    } catch {
      // one broken browser must not stop the others
    }
  }
  const app = await sendToApp(notificationId, job, msg);
  return { sent, app };
}

/**
 * The phone app (Expo push → Firebase on Android). A settlement that is not acknowledged yet
 * goes as data only: the app posts it itself as a pinned notification (background task).
 */
// deno-lint-ignore no-explicit-any
async function sendToApp(notificationId: string, job: any, msg: { title: string; body: string }) {
  const tokens = (job.expo_tokens ?? []) as string[];
  if (!tokens.length) return 0;
  const p = (job.payload ?? {}) as Record<string, unknown>;
  const data: Record<string, string> = { notification_id: notificationId, kind: str(job.kind) };
  for (const k of ['room_id', 'settlement_id', 'expense_id', 'need_id'])
    if (k === 'room_id' ? job.room_id : p[k]) data[k] = str(k === 'room_id' ? job.room_id : p[k]);
  const messages = tokens.map((to) =>
    job.sticky === true
      ? { to, data, priority: 'high', _contentAvailable: true }
      : {
          to,
          title: msg.title,
          body: msg.body,
          data,
          priority: 'high',
          sound: job.loud === true ? 'need_alert.wav' : 'default',
          channelId:
            job.loud === true
              ? 'need_alert'
              : String(job.kind).startsWith('settlement') || String(job.kind).includes('payment')
                ? 'settlement'
                : 'default',
        },
  );
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const out = (await res.json().catch(() => ({}))) as {
      data?: { status?: string; details?: { error?: string } }[];
    };
    let ok = 0;
    for (const [i, ticket] of (out.data ?? []).entries()) {
      if (ticket.status === 'ok') ok++;
      else if (ticket.details?.error === 'DeviceNotRegistered')
        await db.rpc('push_token_gone', { p_token: tokens[i] });
    }
    return ok;
  } catch {
    return 0;
  }
}

Deno.serve(async (req) => {
  const { data: ok } = await db.rpc('worker_check', { p_secret: req.headers.get('x-worker-secret') ?? '' });
  if (ok !== true) return new Response('forbidden', { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body?.selftest) {
    // encryption + signing work with a made-up browser key
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
    const b64 = (u: Uint8Array) =>
      btoa(String.fromCharCode(...u))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    const req2 = webpush.generateRequestDetails(
      {
        endpoint: 'https://example.com/push/x',
        keys: { p256dh: b64(raw), auth: b64(crypto.getRandomValues(new Uint8Array(16))) },
      },
      JSON.stringify(pushText('need_created', { name: 'Asha', title: 'Milk', room: 'Flat' }, 'hi')),
      {
        vapidDetails: {
          subject: VAPID_SUBJECT,
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: await privateKey(),
        },
      },
    );
    return Response.json({
      ok: true,
      headers: Object.keys(req2.headers),
      text: pushText('need_created', { name: 'Asha', title: 'Milk', room: 'Flat' }, 'hi'),
    });
  }
  return Response.json(await send(String(body?.notification_id ?? '')));
});
