/**
 * "Who pays whom" (PRD §11.3): settle all balances with as few transfers as possible.
 * Greedy largest-debtor → largest-creditor matching. Exact in integer minor units;
 * produces at most n-1 transfers for n people with a non-zero balance.
 */
import type { Minor } from './money';

export interface Transfer {
  from: string;
  to: string;
  amount: Minor;
}

export function minimalTransfers(balances: { userId: string; net: Minor }[]): Transfer[] {
  const total = balances.reduce((s, b) => s + b.net, 0);
  if (total !== 0) throw new Error('balances must sum to zero');

  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.userId, left: -b.net }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.userId, left: b.net }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));

  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const amount = Math.min(d.left, c.left);
    out.push({ from: d.id, to: c.id, amount });
    d.left -= amount;
    c.left -= amount;
    if (d.left === 0) i++;
    if (c.left === 0) j++;
  }
  return out;
}
