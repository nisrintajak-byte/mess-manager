/** Server-side translations: the app's own locale files, English as fallback. */
import ar from './locales/ar.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import hi from './locales/hi.json' with { type: 'json' };
import ur from './locales/ur.json' with { type: 'json' };
import type { Translate } from './report.ts';

const DICTS: Record<string, unknown> = { en, ar, ur, hi };
export const RTL_LANGS = new Set(['ar', 'ur']);

function lookup(dict: unknown, key: string): string | undefined {
  const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
  return typeof v === 'string' ? v : undefined;
}

export function translator(lang: string): Translate {
  const dict = DICTS[lang] ?? en;
  return (key, vars) => {
    const raw = lookup(dict, key) ?? lookup(en, key) ?? key;
    return raw.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars?.[k] ?? ''));
  };
}
