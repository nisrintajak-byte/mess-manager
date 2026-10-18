import type { TFunction } from 'i18next';

import type { AppNotification } from './api';
import { currencyDecimals } from './countries';
import { formatMoney } from './money';

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** Render a notification in the reader's language from its kind + payload (PRD §14). */
export function notificationText(n: AppNotification, t: TFunction): string {
  const p = n.payload;
  const cur = str(p.currency);
  const dec = typeof p.decimals === 'number' ? p.decimals : currencyDecimals(cur);
  const money = (v: unknown) => (cur ? formatMoney(Number(v) * (p.credit ? -1 : 1), cur, dec) : str(v));
  const vars: Record<string, string> = {
    name: str(p.name),
    room: str(p.room),
    by: str(p.by),
    title: str(p.title),
    from: str(p.from),
    to: str(p.to),
    due: str(p.due),
    reason: str(p.reason),
    date: str(p.original_date),
    amount: p.amount !== undefined ? money(p.amount) : '',
  };
  if (n.kind === 'settlement_generated') {
    const net = Number(p.net ?? 0);
    vars.result =
      net === 0
        ? t('settlement.even')
        : net < 0
          ? t('settlement.toPay', { amount: formatMoney(-net, cur, dec) })
          : t('settlement.toReceive', { amount: formatMoney(net, cur, dec) });
  }
  if (n.kind === 'dispute_resolved') vars.outcome = t(`flag.s_${str(p.outcome)}`).toLowerCase();
  if (n.kind === 'dispute_raised') vars.reason = t(`flag.r_${str(p.reason)}`);
  return t(`inbox.k_${n.kind}`, { ...vars, defaultValue: t('inbox.k_other') });
}
