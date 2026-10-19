/**
 * Phone notifications for the browser version (Web Push). Lets members hear about Need Requests,
 * expenses, settlements… with the site closed — Chrome on Android, desktop browsers; on iPhone
 * only after "Add to Home Screen". The installable app uses Expo push instead (push.ts).
 */
import Constants from 'expo-constants';

import { api } from './api';

export const VAPID_PUBLIC_KEY =
  'BNRRwCWd99HH-Wg5i9vDtXrn9lGUmBxelxp2fVdDKeA0VBfcY3z5ditTurTLpyesdnuwMcp3jGQZ-3QghQWa7FQ';

export type WebPushState = 'on' | 'ask' | 'denied' | 'unsupported';

let currentEndpoint: string | null = null;

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function basePath(): string {
  const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
  return base.replace(/\/$/, '');
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function webPushState(): WebPushState {
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'on';
  if (Notification.permission === 'denied') return 'denied';
  return 'ask';
}

async function subscribe(): Promise<WebPushState> {
  const base = basePath();
  const reg = await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY),
    }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return 'unsupported';
  await api.registerWebPush(json.endpoint, json.keys.p256dh, json.keys.auth);
  currentEndpoint = json.endpoint;
  return 'on';
}

/** Called after sign-in: if the user already allowed notifications, (re)link this browser silently. */
export async function refreshWebPush(): Promise<WebPushState> {
  const state = webPushState();
  if (state !== 'on') return state;
  try {
    return await subscribe();
  } catch {
    return 'unsupported';
  }
}

/** Must be called from a button tap (browsers only ask for permission after a user action). */
export async function enableWebPush(): Promise<WebPushState> {
  if (!supported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'ask';
  try {
    return await subscribe();
  } catch {
    return 'unsupported';
  }
}

/** Sign-out: stop this browser getting the previous user's notifications. */
export async function disableWebPush(): Promise<void> {
  if (!currentEndpoint) return;
  try {
    await api.unregisterWebPush(currentEndpoint);
  } catch {
    // replaced on the next sign-in anyway
  }
  currentEndpoint = null;
}
