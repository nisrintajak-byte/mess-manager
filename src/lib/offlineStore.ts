import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { isNetworkError } from './net';

/**
 * Offline reading (PRD §17.1): every successful read is saved on the phone; when the network is
 * down the last saved copy is shown instead. Cached data is per signed-in user.
 */
const PREFIX = 'mm.cache.';
let cacheUser = '';

export function setCacheUser(userId: string | null): void {
  cacheUser = userId ?? '';
}

/** Remove all saved copies (sign-out on a shared phone). */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // nothing to clear
  }
}

function encode(v: unknown): string {
  return JSON.stringify(v, (_k, val: unknown) =>
    val instanceof Map ? { __map: Array.from(val.entries()) } : val,
  );
}
function decode(s: string): unknown {
  return JSON.parse(s, (_k, val: unknown) =>
    val && typeof val === 'object' && '__map' in val
      ? new Map((val as { __map: [unknown, unknown][] }).__map)
      : val,
  );
}

// ---- connection state shown in the banner ----
type NetState = { offline: boolean; staleSince: number | null };
let net: NetState = { offline: false, staleSince: null };
const listeners = new Set<() => void>();
function setNet(next: NetState) {
  if (next.offline === net.offline && next.staleSince === net.staleSince) return;
  net = next;
  listeners.forEach((l) => l());
}
export function markOnline(): void {
  setNet({ offline: false, staleSince: null });
}
export function markOffline(): void {
  setNet({ offline: true, staleSince: net.staleSince ?? Date.now() });
}
export function useNetState(): NetState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => net,
    () => net,
  );
}

/** Run a read; remember the result; on network failure fall back to the remembered copy. */
export async function cachedRead<T>(name: string, args: unknown[], read: () => Promise<T>): Promise<T> {
  const key = `${PREFIX}${cacheUser}.${name}.${encode(args)}`;
  try {
    const value = await read();
    markOnline();
    void AsyncStorage.setItem(key, encode(value)).catch(() => undefined);
    return value;
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    markOffline();
    try {
      const saved = await AsyncStorage.getItem(key);
      if (saved !== null) return decode(saved) as T;
    } catch {
      // fall through
    }
    throw e;
  }
}
