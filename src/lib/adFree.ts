/** Is this account ad-free right now? (Ad-free subscription, verified on the server.) */
import { useSyncExternalStore } from 'react';

import { api } from './api';

let until: string | null = null;
const listeners = new Set<() => void>();

export function adFreeUntil(): string | null {
  return until && until > new Date().toISOString() ? until : null;
}

export async function refreshAdFree(): Promise<string | null> {
  try {
    until = await api.myAdFree();
  } catch {
    // keep what we knew (offline)
  }
  listeners.forEach((l) => l());
  return adFreeUntil();
}

export function useAdFreeUntil(): string | null {
  return useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, adFreeUntil);
}
