/**
 * v1.1 Personal expenses: small pure helpers (month ranges, totals, default currency).
 * Kept apart from the Room money code on purpose.
 */
import type { PersonalCategory } from './api';
import { COUNTRIES, currencyDecimals } from './countries';
import { todayIn } from './util';

/** Today's date on this phone (YYYY-MM-DD). Personal entries have no Room time zone. */
export function deviceToday(now = new Date()): string {
  let zone = 'UTC';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // keep UTC
  }
  return todayIn(zone, now);
}

/** First and last day of a month given as YYYY-MM. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** YYYY-MM plus/minus whole months. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface MonthTotal {
  currency: string;
  decimals: number;
  amount: number;
  /** biggest first; entries without a category count as "other" */
  byCategory: { category: PersonalCategory; amount: number }[];
}

/**
 * Totals per currency (amounts in different currencies are never added together), largest
 * total first, each with its category breakdown.
 */
export function monthTotals(
  rows: { amount: number; currency: string; currency_decimals: number; category: PersonalCategory | null }[],
): MonthTotal[] {
  const map = new Map<string, { decimals: number; amount: number; cats: Map<PersonalCategory, number> }>();
  for (const r of rows) {
    const t = map.get(r.currency) ?? { decimals: r.currency_decimals, amount: 0, cats: new Map() };
    t.amount += r.amount;
    const c = r.category ?? 'other';
    t.cats.set(c, (t.cats.get(c) ?? 0) + r.amount);
    map.set(r.currency, t);
  }
  return [...map.entries()]
    .map(([currency, t]) => ({
      currency,
      decimals: t.decimals,
      amount: t.amount,
      byCategory: [...t.cats.entries()]
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount);
}

const KNOWN = new Set(COUNTRIES.map((c) => c.currency));

/** A real ISO 4217 code from our country list (upper-cased), or null. */
export function cleanCurrency(input: string): string | null {
  const code = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) && KNOWN.has(code) ? code : null;
}

/**
 * Currency for a new entry: the one used last on this phone, else the member's first Room's,
 * else the phone's region, else USD.
 */
export function defaultCurrency(
  lastUsed: string | null,
  roomCurrency: string | null,
  locale?: string,
): string {
  const last = lastUsed ? cleanCurrency(lastUsed) : null;
  if (last) return last;
  if (roomCurrency && cleanCurrency(roomCurrency)) return roomCurrency;
  try {
    const region = new Intl.Locale(locale ?? Intl.DateTimeFormat().resolvedOptions().locale).maximize()
      .region;
    const c = COUNTRIES.find((x) => x.code === region);
    if (c) return c.currency;
  } catch {
    // fall through
  }
  return 'USD';
}

export { currencyDecimals };
