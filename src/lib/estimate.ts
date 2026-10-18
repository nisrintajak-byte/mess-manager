import type { BalanceRow } from './api';
import { splitEqual } from './money';

export interface QueuedExpense {
  userId: string;
  amount: number;
  /** null = everyone active */
  participants: string[] | null;
}

/**
 * "Estimated — not yet synced" balances (PRD §17.2): the last official numbers plus the expenses
 * still waiting on this phone. The server's totals are the only official ones.
 */
export function estimateBalances(
  official: BalanceRow[],
  queued: QueuedExpense[],
  activeMemberIds: string[],
): BalanceRow[] {
  const rows = new Map(official.map((r) => [r.user_id, { ...r }]));
  const row = (id: string) => {
    let r = rows.get(id);
    if (!r) {
      r = { user_id: id, paid: 0, share: 0, net: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const q of queued) {
    const who = q.participants && q.participants.length > 0 ? q.participants : activeMemberIds;
    if (who.length === 0 || q.amount <= 0) continue;
    row(q.userId).paid += q.amount;
    for (const [id, part] of splitEqual(q.amount, who, q.userId)) row(id).share += part;
  }
  return [...rows.values()].map((r) => ({ ...r, net: r.paid - r.share }));
}
