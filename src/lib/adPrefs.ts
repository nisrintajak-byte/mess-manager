import { useSyncExternalStore } from 'react';

import { getPref, setPref } from './prefs';

/** User choice (PRD §18.5, §19.3): personalised ads allowed? Off = non-personalised only. */
let personalised = true;
const listeners = new Set<() => void>();

export async function loadAdPrefs(): Promise<void> {
  personalised = (await getPref('ads.personalised')) !== 'off';
  listeners.forEach((l) => l());
}

export async function setAdsPersonalised(on: boolean): Promise<void> {
  personalised = on;
  listeners.forEach((l) => l());
  await setPref('ads.personalised', on ? 'on' : 'off');
}

export function useAdsPersonalised(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => personalised,
  );
}
