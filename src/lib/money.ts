/**
 * Money helpers. All amounts are integers in the currency's minor unit
 * (fils, cents, paise) — never floating point (PRD §10.2, §21 Accuracy).
 */

export type Minor = number;

export class MoneyError extends Error {}

function assertMinor(value: Minor, label = 'amount'): void {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`${label} must be a safe integer in minor units`);
  }
}

/**
 * Parse user input like "12.5" or "1,250.750" into minor units.
 * Rejects more fraction digits than the currency allows (no silent rounding).
 */
export function parseAmount(input: string, decimals: number): Minor | null {
  const cleaned = input.trim().replace(/[,\s]/g, '');
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{0,${decimals}})?$`) : /^\d+$/;
  if (!pattern.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const minor = Number(whole) * 10 ** decimals + Number(frac.padEnd(decimals, '0') || '0');
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Format minor units as a plain decimal string, e.g. 12500 (KWD, 3) -> "12.500". */
export function formatMinor(amount: Minor, decimals: number): string {
  assertMinor(amount);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  if (decimals === 0) return `${negative ? '-' : ''}${abs}`;
  const base = 10 ** decimals;
  const whole = Math.floor(abs / base);
  const frac = String(abs % base).padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

/** Format with the ISO code, e.g. "KWD 12.500". Codes only, no symbols tied to flags. */
export function formatMoney(amount: Minor, currency: string, decimals: number): string {
  return `${currency} ${formatMinor(amount, decimals)}`;
}

/**
 * Split `total` equally among `participantIds`.
 * Leftover minor units go to the payer so the parts always sum to `total` exactly.
 * If the payer is not a participant, leftovers go to the first participant (sorted id)
 * so the result stays deterministic.
 */
export function splitEqual(total: Minor, participantIds: string[], payerId: string): Map<string, Minor> {
  assertMinor(total, 'total');
  if (total < 0) throw new MoneyError('total must not be negative');
  const ids = [...new Set(participantIds)].sort();
  if (ids.length === 0) throw new MoneyError('at least one participant is required');

  const base = Math.floor(total / ids.length);
  const remainder = total - base * ids.length;
  const shares = new Map<string, Minor>(ids.map((id) => [id, base]));
  const remainderTo = shares.has(payerId) ? payerId : ids[0]!;
  shares.set(remainderTo, base + remainder);
  return shares;
}

export interface ExpenseForBalance {
  paidBy: string;
  amount: Minor;
  shares: { userId: string; amount: Minor }[];
}

export interface Balance {
  userId: string;
  paid: Minor;
  share: Minor;
  /** positive = should receive, negative = should pay */
  net: Minor;
}

/** Sum what each member paid and owes. Nets always sum to zero. */
export function computeBalances(memberIds: string[], expenses: ExpenseForBalance[]): Balance[] {
  const rows = new Map<string, Balance>();
  const row = (id: string): Balance => {
    let r = rows.get(id);
    if (!r) {
      r = { userId: id, paid: 0, share: 0, net: 0 };
      rows.set(id, r);
    }
    return r;
  };
  memberIds.forEach(row);

  for (const e of expenses) {
    assertMinor(e.amount);
    const shareSum = e.shares.reduce((s, x) => s + x.amount, 0);
    if (shareSum !== e.amount) {
      throw new MoneyError('expense shares must sum to the expense amount');
    }
    row(e.paidBy).paid += e.amount;
    for (const s of e.shares) row(s.userId).share += s.amount;
  }
  for (const r of rows.values()) r.net = r.paid - r.share;
  return [...rows.values()];
}
