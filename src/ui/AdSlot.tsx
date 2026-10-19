import type { AdScreen } from '../lib/adsConfig';

/** Browser version: no ads. The phone app uses AdSlot.native.tsx. */
export function AdSlot(_props: { screen: AdScreen }) {
  return null;
}
