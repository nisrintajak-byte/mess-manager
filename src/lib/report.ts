/**
 * Reports (PRD §15): one JSON document from the server (`report_data`) is turned into a printable
 * HTML page (→ PDF) and a CSV file, in the reader's language and direction.
 *
 * This file has no React Native imports on purpose: the same code renders the emailed statements
 * in the `send-emails` server function.
 */

export type ReportScope = 'mine' | 'room' | 'export';

export interface ReportPerson {
  name: string;
  deleted: boolean;
}

export interface ReportData {
  ref: string;
  generated_at: string;
  scope: ReportScope;
  requester: string | null;
  room: { name: string; currency: string; decimals: number; time_zone: string };
  period: { from: string | null; to: string | null };
  people: Record<string, ReportPerson>;
  cycles: {
    id: string;
    starts_on: string;
    ends_on: string;
    status: 'open' | 'locked';
    locked_at: string | null;
    currency: string;
    decimals: number;
    delete_on: string | null;
  }[];
  expenses: {
    id: string;
    cycle_id: string;
    date: string;
    title: string;
    amount: number;
    currency: string;
    paid_by: string;
    created_by: string;
    created_at: string;
    notes: string | null;
    deleted: boolean;
    adjustment: boolean;
    late_entry_from: string | null;
    has_receipt: boolean;
    my_share: number | null;
    participants: number;
  }[];
  settlements: {
    id: string;
    cycle_id: string;
    total: number;
    currency: string;
    decimals: number;
    generated_at: string;
    lines: {
      user_id: string;
      share: number;
      paid: number;
      net: number;
      confirmed: number;
      awaiting: number;
    }[];
  }[];
  payments: {
    id: string;
    payer: string;
    amount: number;
    currency: string;
    method: string;
    reference: string | null;
    has_proof: boolean;
    status: 'awaiting' | 'confirmed' | 'rejected';
    claimed_at: string;
    decided_by: string | null;
    decided_at: string | null;
    reject_reason: string | null;
  }[];
  disputes: {
    id: string;
    target_type: string;
    target_id: string;
    reason: string;
    note: string | null;
    status: string;
    raised_by: string;
    created_at: string;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
  }[];
  audit: { at: string; entity: string; action: string; actor: string | null; title: string | null }[];
}

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface ReportFormat {
  t: Translate;
  lang: string;
  rtl: boolean;
  /** amount in minor units → "KWD 1.250" (already with the reader's digits) */
  money: (minor: number, currency: string, decimals: number) => string;
  /** apply the reader's digit style to any text (dates, references) */
  digits: (text: string) => string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function personName(data: ReportData, uid: string | null, t: Translate): string {
  if (!uid) return '—';
  const p = data.people[uid];
  if (!p) return '—';
  return p.deleted ? t('account.deletedName', { name: p.name }) : p.name;
}

/** Totals in the Room's currency for the summary box. */
export function reportTotals(data: ReportData) {
  let total = 0;
  let myPaid = 0;
  let myShare = 0;
  for (const e of data.expenses) {
    if (e.deleted) continue;
    total += e.amount;
    if (e.paid_by === data.requester) myPaid += e.amount;
    myShare += e.my_share ?? 0;
  }
  return { total, myPaid, myShare, net: myPaid - myShare };
}

function dateOnly(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '—';
}
function dateTime(iso: string | null): string {
  return iso ? iso.slice(0, 16).replace('T', ' ') : '—';
}

export function reportTitle(data: ReportData, t: Translate): string {
  return data.scope === 'room' ? t('report.titleRoom') : t('report.titleMine');
}

function expenseTags(e: ReportData['expenses'][number], f: ReportFormat): string[] {
  const tags: string[] = [];
  if (e.deleted) tags.push(f.t('report.tagDeleted'));
  if (e.adjustment) tags.push(f.t('report.tagAdjustment'));
  if (e.late_entry_from) tags.push(f.t('report.tagLate', { date: f.digits(e.late_entry_from) }));
  if (e.has_receipt) tags.push(f.t('report.tagReceipt'));
  return tags;
}

/** Printable HTML (A4) — becomes the PDF on the phone and the body of emailed statements. */
export function buildReportHtml(data: ReportData, f: ReportFormat): string {
  const { t } = f;
  return wrapHtml(`${reportTitle(data, t)} · ${data.room.name} · ${data.ref}`, buildReportBody(data, f), f);
}

const REPORT_CSS = `
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: __FONT__; color: #16201C; font-size: 11pt; line-height: 1.45; margin: 0; padding: 16px; }
h1 { font-size: 18pt; margin: 0 0 4px; }
h2 { font-size: 13pt; margin: 22px 0 8px; border-bottom: 2px solid #1F6F5C; padding-bottom: 4px; }
h3 { font-size: 11pt; margin: 14px 0 6px; }
.muted { color: #5B6762; font-size: 9.5pt; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 18px; margin: 8px 0 12px; }
.box { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.box > div { flex: 1 1 140px; border: 1px solid #D9DED9; border-radius: 8px; padding: 8px 10px; }
.box span { display: block; color: #5B6762; font-size: 9.5pt; }
.box b { font-size: 12pt; }
table { width: 100%; border-collapse: collapse; margin: 4px 0 8px; page-break-inside: auto; }
tr { page-break-inside: avoid; }
th, td { border-bottom: 1px solid #E3E7E3; padding: 5px 6px; text-align: start; vertical-align: top; }
th { background: #F1F4F1; font-size: 9.5pt; }
.num { text-align: end; white-space: nowrap; unicode-bidi: plaintext; }
.struck td { color: #8A948F; text-decoration: line-through; }
.tags span { display: inline-block; font-size: 8.5pt; background: #FFF4D6; border-radius: 4px; padding: 0 5px; margin: 2px 4px 0 0; }
.ref { font-family: monospace; unicode-bidi: plaintext; }
footer { margin-top: 24px; border-top: 1px solid #D9DED9; padding-top: 8px; }
.report + .report, .report.break { page-break-before: always; }
.kv td:first-child { color: #5B6762; width: 40%; }
`;

/** A complete printable page around report bodies (one or several). */
export function wrapHtml(title: string, body: string, f: ReportFormat): string {
  return `<!doctype html>
<html lang="${esc(f.lang)}" dir="${f.rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${REPORT_CSS.replace('__FONT__', fontStack(f.lang))}</style></head><body>
${body}
</body></html>`;
}

/** The inside of one report (no <html> wrapper), so several can share one PDF. */
export function buildReportBody(data: ReportData, f: ReportFormat): string {
  const { t } = f;
  const cur = data.room.currency;
  const dec = data.room.decimals;
  const m = (v: number, c = cur, d = dec) => esc(f.money(v, c, d));
  const d = (s: string | null) => esc(f.digits(dateOnly(s)));
  const dt = (s: string | null) => esc(f.digits(dateTime(s)));
  const who = (uid: string | null) => esc(personName(data, uid, t));
  const totals = reportTotals(data);
  const cycleById = new Map(data.cycles.map((c) => [c.id, c]));
  const range = (from: string | null, to: string | null) =>
    esc(t('cycle.range', { from: f.digits(dateOnly(from)), to: f.digits(dateOnly(to)) }));
  const section = (title: string, body: string, empty: boolean) =>
    `<h2>${esc(title)}</h2>` + (empty ? `<p class="muted">${esc(t('report.none'))}</p>` : body);

  const expenseRows = data.expenses
    .map((e) => {
      const tags = expenseTags(e, f);
      return `<tr class="${e.deleted ? 'struck' : ''}">
<td>${d(e.date)}</td><td>${esc(e.title)}${e.notes ? `<div class="muted">${esc(e.notes)}</div>` : ''}${
        tags.length ? `<div class="tags">${tags.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''
      }</td><td>${who(e.paid_by)}</td><td class="num">${m(e.amount, e.currency)}</td><td class="num">${
        e.my_share == null ? '—' : m(e.my_share, e.currency)
      }</td></tr>`;
    })
    .join('');

  const settlementBlocks = data.settlements
    .map((s) => {
      const c = cycleById.get(s.cycle_id);
      const rows = s.lines
        .map((l) => {
          const owed = l.net < 0 ? -l.net : 0;
          const status =
            l.net === 0
              ? t('settlement.status_settled')
              : l.net > 0
                ? t('report.receives')
                : l.confirmed >= owed
                  ? t('settlement.status_paid')
                  : l.awaiting > 0
                    ? t('settlement.status_awaiting')
                    : l.confirmed > 0
                      ? t('settlement.status_partial')
                      : t('settlement.status_pending');
          return `<tr><td>${who(l.user_id)}</td><td class="num">${m(l.share, s.currency, s.decimals)}</td><td class="num">${m(
            l.paid,
            s.currency,
            s.decimals,
          )}</td><td class="num">${m(l.net, s.currency, s.decimals)}</td><td>${esc(status)}</td></tr>`;
        })
        .join('');
      return `<h3>${c ? range(c.starts_on, c.ends_on) : ''} · ${esc(t('report.total'))} ${m(
        s.total,
        s.currency,
        s.decimals,
      )}</h3>
<table><thead><tr><th>${esc(t('report.colMember'))}</th><th>${esc(t('report.colShare'))}</th><th>${esc(
        t('report.colPaid'),
      )}</th><th>${esc(t('report.colNet'))}</th><th>${esc(t('report.colStatus'))}</th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');

  const paymentRows = data.payments
    .map(
      (p) =>
        `<tr><td>${dt(p.claimed_at)}</td><td>${who(p.payer)}</td><td class="num">${m(p.amount, p.currency)}</td><td>${esc(
          t(`payment.method_${p.method}`),
        )}${p.reference ? `<div class="muted">${esc(t('report.reference'))}: ${esc(p.reference)}</div>` : ''}${
          p.has_proof ? `<div class="muted">${esc(t('report.proofAttached'))}</div>` : ''
        }</td><td>${esc(t(`payment.status_${p.status}`))}${
          p.decided_by ? `<div class="muted">${who(p.decided_by)} · ${dt(p.decided_at)}</div>` : ''
        }${p.reject_reason ? `<div class="muted">${esc(p.reject_reason)}</div>` : ''}</td></tr>`,
    )
    .join('');

  const disputeRows = data.disputes
    .map(
      (x) =>
        `<tr><td>${dt(x.created_at)}</td><td>${who(x.raised_by)}</td><td>${esc(t(`flag.on_${x.target_type}`))}</td><td>${esc(
          t(`flag.r_${x.reason}`),
        )}${x.note ? `<div class="muted">${esc(x.note)}</div>` : ''}</td><td>${esc(t(`flag.s_${x.status}`))}${
          x.resolution_note ? `<div class="muted">${esc(x.resolution_note)}</div>` : ''
        }</td></tr>`,
    )
    .join('');

  const auditRows = data.audit
    .map(
      (a) =>
        `<tr><td>${dt(a.at)}</td><td>${who(a.actor)}</td><td>${esc(t(`report.a_${a.entity}`))} · ${esc(
          t(`report.act_${a.action}`),
        )}</td><td>${a.title ? esc(a.title) : ''}</td></tr>`,
    )
    .join('');

  const summary =
    data.scope === 'room'
      ? `<div class="box"><div><span>${esc(t('report.totalExpenses'))}</span><b>${m(totals.total)}</b></div></div>`
      : `<div class="box"><div><span>${esc(t('report.totalExpenses'))}</span><b>${m(totals.total)}</b></div>
<div><span>${esc(t('report.youPaid'))}</span><b>${m(totals.myPaid)}</b></div>
<div><span>${esc(t('report.yourShare'))}</span><b>${m(totals.myShare)}</b></div>
<div><span>${esc(t('report.difference'))}</span><b>${m(totals.net)}</b></div></div>`;

  const deleteOn = data.cycles
    .map((c) => c.delete_on)
    .filter((x): x is string => !!x)
    .sort()[0];

  return `<section class="report">
<h1>${esc(reportTitle(data, t))}</h1>
<div><b>${esc(data.room.name)}</b> · ${esc(data.room.currency)}</div>
<div class="meta muted">
<span>${esc(t('report.period'))}: ${range(data.period.from, data.period.to)}</span>
<span>${esc(t('report.generated'))}: ${dt(data.generated_at)} UTC</span>
<span>${esc(t('report.refLabel'))}: <span class="ref">${esc(data.ref)}</span></span>
${data.scope !== 'room' && data.requester ? `<span>${esc(t('report.for'))}: ${who(data.requester)}</span>` : ''}
</div>
${summary}
${section(t('report.expenses'), `<table><thead><tr><th>${esc(t('report.colDate'))}</th><th>${esc(t('report.colItem'))}</th><th>${esc(t('report.colPaidBy'))}</th><th>${esc(t('report.colAmount'))}</th><th>${esc(t('report.colMyShare'))}</th></tr></thead><tbody>${expenseRows}</tbody></table>`, data.expenses.length === 0)}
${section(t('report.settlements'), settlementBlocks, data.settlements.length === 0)}
${section(t('report.payments'), `<table><thead><tr><th>${esc(t('report.colDate'))}</th><th>${esc(t('report.colMember'))}</th><th>${esc(t('report.colAmount'))}</th><th>${esc(t('report.colMethod'))}</th><th>${esc(t('report.colStatus'))}</th></tr></thead><tbody>${paymentRows}</tbody></table>`, data.payments.length === 0)}
${section(t('report.disputes'), `<table><thead><tr><th>${esc(t('report.colDate'))}</th><th>${esc(t('report.colBy'))}</th><th>${esc(t('report.colItem'))}</th><th>${esc(t('report.colReason'))}</th><th>${esc(t('report.colStatus'))}</th></tr></thead><tbody>${disputeRows}</tbody></table>`, data.disputes.length === 0)}
${section(t('report.audit'), `<table><thead><tr><th>${esc(t('report.colTime'))}</th><th>${esc(t('report.colBy'))}</th><th>${esc(t('report.colAction'))}</th><th>${esc(t('report.colItem'))}</th></tr></thead><tbody>${auditRows}</tbody></table>`, data.audit.length === 0)}
<footer class="muted">
<p>${esc(t('report.retentionNote'))}${deleteOn ? ' ' + esc(t('report.deleteOn', { date: f.digits(deleteOn) })) : ''}</p>
<p>${esc(t('report.verifyNote', { ref: data.ref }))}</p>
<p>Mess Manager · Uyoon Tech Solutions</p>
</footer>
</section>`;
}

function fontStack(lang: string): string {
  switch (lang) {
    case 'ar':
      return "'Noto Naskh Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
    case 'ur':
      return "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', 'Jameel Noori Nastaleeq', Tahoma, sans-serif";
    case 'hi':
      return "'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', sans-serif";
    default:
      return "'Noto Sans', 'Segoe UI', Roboto, Arial, sans-serif";
  }
}

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s)
    ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`
    : s;
};

/** Amount without currency symbol, plain digits — spreadsheets need numbers. */
export function minorToDecimal(minor: number, decimals: number): string {
  if (decimals === 0) return String(minor);
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const p = 10 ** decimals;
  const whole = Math.floor(abs / p);
  const frac = String(abs % p).padStart(decimals, '0');
  return `${neg ? '-' : ''}${whole}.${frac}`;
}

/** CSV with one block per section. UTF-8 with BOM so Excel shows Arabic/Urdu/Hindi correctly. */
export function buildReportCsv(data: ReportData, t: Translate): string {
  const rows: (string | number | null)[][] = [];
  const who = (uid: string | null) => personName(data, uid, t);
  const dec = data.room.decimals;
  rows.push([reportTitle(data, t), data.room.name]);
  rows.push([t('report.refLabel'), data.ref]);
  rows.push([t('report.generated'), dateTime(data.generated_at) + ' UTC']);
  rows.push([t('report.period'), dateOnly(data.period.from), dateOnly(data.period.to)]);
  rows.push([t('report.currency'), data.room.currency]);
  rows.push([]);

  rows.push([t('report.expenses')]);
  rows.push([
    t('report.colDate'),
    t('report.colItem'),
    t('report.colPaidBy'),
    t('report.colAmount'),
    t('report.colMyShare'),
    t('report.colNotes'),
    t('report.colStatus'),
  ]);
  for (const e of data.expenses) {
    const status = [
      e.deleted ? t('report.tagDeleted') : '',
      e.adjustment ? t('report.tagAdjustment') : '',
      e.late_entry_from ? t('report.tagLate', { date: e.late_entry_from }) : '',
      e.has_receipt ? t('report.tagReceipt') : '',
    ]
      .filter(Boolean)
      .join('; ');
    rows.push([
      e.date,
      e.title,
      who(e.paid_by),
      minorToDecimal(e.amount, dec),
      e.my_share == null ? '' : minorToDecimal(e.my_share, dec),
      e.notes,
      status,
    ]);
  }
  rows.push([]);

  rows.push([t('report.settlements')]);
  rows.push([
    t('report.colCycle'),
    t('report.colMember'),
    t('report.colShare'),
    t('report.colPaid'),
    t('report.colNet'),
    t('report.colConfirmed'),
  ]);
  const cycleById = new Map(data.cycles.map((c) => [c.id, c]));
  for (const s of data.settlements) {
    const c = cycleById.get(s.cycle_id);
    for (const l of s.lines) {
      rows.push([
        c ? `${c.starts_on} – ${c.ends_on}` : '',
        who(l.user_id),
        minorToDecimal(l.share, s.decimals),
        minorToDecimal(l.paid, s.decimals),
        minorToDecimal(l.net, s.decimals),
        minorToDecimal(l.confirmed, s.decimals),
      ]);
    }
  }
  rows.push([]);

  rows.push([t('report.payments')]);
  rows.push([
    t('report.colDate'),
    t('report.colMember'),
    t('report.colAmount'),
    t('report.colMethod'),
    t('report.reference'),
    t('report.proofAttached'),
    t('report.colStatus'),
    t('report.colReason'),
  ]);
  for (const p of data.payments) {
    rows.push([
      dateTime(p.claimed_at),
      who(p.payer),
      minorToDecimal(p.amount, dec),
      t(`payment.method_${p.method}`),
      p.reference,
      p.has_proof ? t('common.yes') : t('common.no'),
      t(`payment.status_${p.status}`),
      p.reject_reason,
    ]);
  }
  rows.push([]);

  rows.push([t('report.disputes')]);
  rows.push([
    t('report.colDate'),
    t('report.colBy'),
    t('report.colItem'),
    t('report.colReason'),
    t('report.colStatus'),
  ]);
  for (const x of data.disputes) {
    rows.push([
      dateTime(x.created_at),
      who(x.raised_by),
      t(`flag.on_${x.target_type}`),
      t(`flag.r_${x.reason}`) + (x.note ? ` — ${x.note}` : ''),
      t(`flag.s_${x.status}`),
    ]);
  }
  rows.push([]);

  rows.push([t('report.audit')]);
  rows.push([t('report.colTime'), t('report.colBy'), t('report.colAction'), t('report.colItem')]);
  for (const a of data.audit) {
    rows.push([
      dateTime(a.at),
      who(a.actor),
      `${t(`report.a_${a.entity}`)} · ${t(`report.act_${a.action}`)}`,
      a.title,
    ]);
  }

  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export interface DataExport {
  ref: string;
  generated_at: string;
  profile: {
    display_name: string;
    email: string | null;
    date_of_birth: string | null;
    language: string;
    consent_version: string;
    consent_at: string;
    created_at: string;
  };
  memberships: {
    room: string;
    role: string;
    status: string;
    requested_at: string;
    joined_on: string | null;
    left_on: string | null;
  }[];
  rooms: ReportData[];
}

/** PRD §18.5 "download all my data" as one printable document. */
export function buildExportHtml(x: DataExport, f: ReportFormat): string {
  const { t } = f;
  const dt = (s: string | null) => esc(f.digits(dateTime(s)));
  const row = (k: string, v: string) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`;
  const profile = `<section class="report"><h1>${esc(t('account.exportTitle'))}</h1>
<div class="meta muted"><span>${esc(t('report.generated'))}: ${dt(x.generated_at)} UTC</span>
<span>${esc(t('report.refLabel'))}: <span class="ref">${esc(x.ref)}</span></span></div>
<h2>${esc(t('account.profile'))}</h2><table class="kv"><tbody>
${row(t('account.name'), esc(x.profile.display_name))}
${row(t('account.email'), esc(x.profile.email ?? '—'))}
${row(t('account.dob'), esc(f.digits(x.profile.date_of_birth ?? '—')))}
${row(t('account.language'), esc(x.profile.language))}
${row(t('account.consent'), `${esc(x.profile.consent_version)} · ${dt(x.profile.consent_at)}`)}
${row(t('account.since'), dt(x.profile.created_at))}
</tbody></table>
<h2>${esc(t('account.memberships'))}</h2>
<table><thead><tr><th>${esc(t('report.colRoom'))}</th><th>${esc(t('report.colRole'))}</th><th>${esc(
    t('report.colStatus'),
  )}</th><th>${esc(t('report.colFrom'))}</th><th>${esc(t('report.colTo'))}</th></tr></thead><tbody>
${x.memberships
  .map(
    (m) =>
      `<tr><td>${esc(m.room)}</td><td>${esc(t(`report.role_${m.role}`))}</td><td>${esc(
        t(`report.mstatus_${m.status}`),
      )}</td><td>${esc(f.digits(m.joined_on ?? '—'))}</td><td>${esc(f.digits(m.left_on ?? '—'))}</td></tr>`,
  )
  .join('')}
</tbody></table></section>`;
  return wrapHtml(t('account.exportTitle'), profile + x.rooms.map((r) => buildReportBody(r, f)).join(''), f);
}

export function reportFileName(data: ReportData, ext: 'pdf' | 'csv' | 'json'): string {
  const safe = data.room.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'room';
  return `MessManager-${safe}-${data.ref}.${ext}`;
}
