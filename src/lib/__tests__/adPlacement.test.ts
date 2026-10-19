/**
 * PRD §19.1 acceptance check: no ad can render on money/trust/account screens, and banners
 * appear only on the allowed screens with a matching screen name.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { AD_SCREENS, NO_AD_SCREENS } from '../adsConfig';

const SCREENS = join(__dirname, '../../screens');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('ad placement', () => {
  test('forbidden screens never contain an ad', () => {
    for (const name of NO_AD_SCREENS) {
      const src = readFileSync(join(SCREENS, `${name}.tsx`), 'utf8');
      expect({ name, ad: /AdSlot|BannerAd|google-mobile-ads/.test(src) }).toEqual({ name, ad: false });
    }
  });

  test('ads appear only on allowed screens, with their own screen name', () => {
    for (const file of files(SCREENS)) {
      const src = readFileSync(file, 'utf8');
      expect(/BannerAd|google-mobile-ads/.test(src)).toBe(false); // only through AdSlot
      for (const m of src.matchAll(/<AdSlot screen="(\w+)"/g)) {
        expect(AD_SCREENS as readonly string[]).toContain(m[1]);
        expect(file.endsWith(`${m[1]}Screen.tsx`)).toBe(true);
      }
    }
  });
});
