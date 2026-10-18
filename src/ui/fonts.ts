import * as Font from 'expo-font';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import {
  NotoSansDevanagari_400Regular,
  NotoSansDevanagari_700Bold,
} from '@expo-google-fonts/noto-sans-devanagari';

import type { AppLanguage } from '../i18n';
import { applyFonts } from './theme';

/**
 * Urdu uses a Nastaliq font and Hindi a Devanagari font (PRD §16.2). Fonts are loaded on demand
 * for the selected language only. English and Arabic use the phone's own fonts. If loading
 * fails the app simply keeps the system font.
 */
export async function loadFontsFor(lang: AppLanguage): Promise<void> {
  try {
    if (lang === 'ur') {
      await Font.loadAsync({ NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold });
      applyFonts({ regular: 'NotoNastaliqUrdu_400Regular', bold: 'NotoNastaliqUrdu_700Bold' });
    } else if (lang === 'hi') {
      await Font.loadAsync({ NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold });
      applyFonts({ regular: 'NotoSansDevanagari_400Regular', bold: 'NotoSansDevanagari_700Bold' });
    } else {
      applyFonts({});
    }
  } catch {
    applyFonts({});
  }
}
