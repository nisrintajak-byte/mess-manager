/**
 * verify-purchase — checks a Google Play ad-free subscription with Google and records the result
 * (save_ad_free). Called by the app after a purchase/restore (user's sign-in token), and daily
 * by the database scheduler to pick up renewals, cancellations and refunds (x-worker-secret).
 * Setting (Edge Function secret): GOOGLE_PLAY_SERVICE_ACCOUNT = the service-account JSON with
 * access to the Play Console. Without it purchases are not confirmed (and Google refunds them).
 */
import { createClient } from '@supabase/supabase-js';

const PACKAGE = 'com.uyoontech.messmanager';
const PRODUCTS = new Set(['mm_adfree_monthly', 'mm_adfree_yearly']);

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type ServiceAccount = { client_email: string; private_key: string };

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let cachedToken: { value: string; until: number } | null = null;
async function googleToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)),
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`google auth ${res.status}`);
  cachedToken = { value: json.access_token, until: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

const STATES: Record<string, string> = {
  SUBSCRIPTION_STATE_ACTIVE: 'active',
  SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'grace',
  SUBSCRIPTION_STATE_CANCELED: 'canceled',
  SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
  SUBSCRIPTION_STATE_PAUSED: 'paused',
  SUBSCRIPTION_STATE_EXPIRED: 'expired',
  SUBSCRIPTION_STATE_PENDING: 'pending',
  SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'expired',
};

/** Ask Google about one purchase token and store the answer. */
async function check(sa: ServiceAccount, user: string | null, token: string) {
  const access = await googleToken(sa);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}/purchases`;
  const res = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (res.status === 404 || res.status === 410) {
    await db.rpc('save_ad_free', {
      p_user: user,
      p_token: token,
      p_product: 'unknown',
      p_platform: 'android',
      p_status: 'expired',
      p_expires: new Date().toISOString(),
      p_auto: false,
    });
    return { ok: false, status: 'expired' };
  }
  if (!res.ok) throw new Error(`google ${res.status}`);
  const sub = await res.json();
  const items = (sub.lineItems ?? []) as {
    productId: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }[];
  const item = items.find((i) => PRODUCTS.has(i.productId));
  if (!item) return { ok: false, status: 'unknown_product' };
  const expires =
    items
      .map((i) => i.expiryTime ?? '')
      .sort()
      .pop() || null;
  const status = STATES[sub.subscriptionState] ?? 'unknown';
  const { data: saved } = await db.rpc('save_ad_free', {
    p_user: user,
    p_token: token,
    p_product: item.productId,
    p_platform: 'android',
    p_status: status,
    p_expires: expires,
    p_auto: item.autoRenewingPlan?.autoRenewEnabled ?? false,
  });
  if (saved === false) return { ok: false, status: 'other_account' };
  if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && ['active', 'grace'].includes(status)) {
    await fetch(`${base}/subscriptions/${item.productId}/tokens/${encodeURIComponent(token)}:acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => undefined);
  }
  return {
    ok: ['active', 'grace', 'canceled'].includes(status) && !!expires && expires > new Date().toISOString(),
    status,
    expires,
  };
}

Deno.serve(async (req) => {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  const body = await req.json().catch(() => ({}));
  const secret = req.headers.get('x-worker-secret');

  if (secret) {
    const { data: ok } = await db.rpc('worker_check', { p_secret: secret });
    if (ok !== true) return new Response('forbidden', { status: 403 });
    if (!raw) return Response.json({ rechecked: 0, error: 'not_configured' });
    const sa = JSON.parse(raw) as ServiceAccount;
    const { data: rows } = await db.rpc('ad_free_to_recheck');
    let n = 0;
    for (const r of (rows ?? []) as { purchase_token: string }[]) {
      await check(sa, null, r.purchase_token).catch(() => undefined);
      n++;
    }
    return Response.json({ rechecked: n });
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: u } = await db.auth.getUser(jwt);
  if (!u?.user) return new Response('unauthorized', { status: 401 });
  if (!raw) return Response.json({ ok: false, error: 'not_configured' });
  const token = String(body?.purchaseToken ?? '');
  if (!token || token.length > 2000) return Response.json({ ok: false, error: 'invalid_token' });
  try {
    return Response.json(await check(JSON.parse(raw) as ServiceAccount, u.user.id, token));
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message ?? e) });
  }
});
