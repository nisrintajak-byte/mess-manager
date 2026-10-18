/**
 * CI only: render sample statements in all 4 languages so they can be looked at as images.
 * node --experimental-strip-types sample.ts <outdir>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { compose, serverFormat } from './emails.ts';
import { buildReportPdf, fetchFonts } from './pdf.ts';
import type { ReportData } from './report.ts';

const A = 'a';
const B = 'b';
const C = 'c';
const data: ReportData = {
  ref: 'MM-20261019-SAMPLE01',
  generated_at: '2026-10-19T08:30:00Z',
  scope: 'room',
  requester: A,
  room: { name: 'Flat 12 — شقة', currency: 'KWD', decimals: 3, time_zone: 'Asia/Kuwait' },
  period: { from: '2026-10-01', to: '2026-10-31' },
  people: {
    [A]: { name: 'أحمد', deleted: false },
    [B]: { name: 'Bilal', deleted: true },
    [C]: { name: 'राजेश', deleted: false },
  },
  cycles: [
    {
      id: 'c1',
      starts_on: '2026-10-01',
      ends_on: '2026-10-31',
      status: 'locked',
      locked_at: '2026-10-31T20:00:00Z',
      currency: 'KWD',
      decimals: 3,
      delete_on: '2027-01-01',
    },
  ],
  expenses: [
    {
      id: 'e1',
      cycle_id: 'c1',
      date: '2026-10-02',
      title: 'چاول 5kg (basmati)',
      amount: 12500,
      currency: 'KWD',
      paid_by: A,
      created_by: A,
      created_at: '2026-10-02T10:00:00Z',
      notes: 'من السوق المركزي',
      deleted: false,
      adjustment: false,
      late_entry_from: null,
      has_receipt: true,
      my_share: 4167,
      participants: 3,
    },
    {
      id: 'e2',
      cycle_id: 'c1',
      date: '2026-10-05',
      title: 'दूध और सब्ज़ी',
      amount: 3000,
      currency: 'KWD',
      paid_by: C,
      created_by: C,
      created_at: '2026-10-05T10:00:00Z',
      notes: null,
      deleted: false,
      adjustment: false,
      late_entry_from: '2026-09-30',
      has_receipt: false,
      my_share: 1000,
      participants: 3,
    },
    {
      id: 'e3',
      cycle_id: 'c1',
      date: '2026-10-07',
      title: 'Gas cylinder',
      amount: 2000,
      currency: 'KWD',
      paid_by: B,
      created_by: B,
      created_at: '2026-10-07T10:00:00Z',
      notes:
        'Monthly refill — very long note to check that wrapping inside a table cell works across several lines without overflowing the column',
      deleted: true,
      adjustment: false,
      late_entry_from: null,
      has_receipt: false,
      my_share: 667,
      participants: 3,
    },
  ],
  settlements: [
    {
      id: 's1',
      cycle_id: 'c1',
      total: 15500,
      currency: 'KWD',
      decimals: 3,
      generated_at: '2026-10-31T20:00:00Z',
      lines: [
        { user_id: B, share: 5166, paid: 0, net: -5166, confirmed: 0, awaiting: 5166 },
        { user_id: C, share: 5167, paid: 3000, net: -2167, confirmed: 2167, awaiting: 0 },
        { user_id: A, share: 5167, paid: 12500, net: 7333, confirmed: 0, awaiting: 0 },
      ],
    },
  ],
  payments: [
    {
      id: 'p1',
      payer: C,
      amount: 2167,
      currency: 'KWD',
      method: 'bank',
      reference: 'UTR 4455-ABC',
      has_proof: true,
      status: 'confirmed',
      claimed_at: '2026-11-01T09:00:00Z',
      decided_by: A,
      decided_at: '2026-11-01T12:00:00Z',
      reject_reason: null,
    },
  ],
  disputes: [
    {
      id: 'f1',
      target_type: 'expense',
      target_id: 'e1',
      reason: 'wrong_amount',
      note: 'كان 10 فقط',
      status: 'open',
      raised_by: C,
      created_at: '2026-10-04T09:00:00Z',
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
    },
  ],
  audit: [
    {
      at: '2026-10-02T10:00:00Z',
      entity: 'expenses',
      action: 'create',
      actor: A,
      title: 'چاول 5kg (basmati)',
    },
    { at: '2026-10-07T11:00:00Z', entity: 'expenses', action: 'update', actor: B, title: 'Gas cylinder' },
    { at: '2026-10-31T20:00:00Z', entity: 'settlements', action: 'create', actor: A, title: null },
  ],
};

const out = process.argv[2] ?? 'out';
mkdirSync(out, { recursive: true });
const hbVersion = JSON.parse(readFileSync('node_modules/harfbuzzjs/package.json', 'utf8')).version;
console.log('harfbuzzjs', hbVersion);
const fonts = await fetchFonts(async (url) => {
  if (url.endsWith('/hb.wasm')) return new Uint8Array(readFileSync('node_modules/harfbuzzjs/hb.wasm'));
  if (url.endsWith('/hb-subset.wasm'))
    return new Uint8Array(readFileSync('node_modules/harfbuzzjs/hb-subset.wasm'));
  const r = await fetch(url);
  if (!r.ok) throw new Error(`font ${r.status} ${url}`);
  return new Uint8Array(await r.arrayBuffer());
});
for (const lang of ['en', 'ar', 'ur', 'hi']) {
  const f = serverFormat(lang);
  writeFileSync(
    `${out}/report-${lang}.pdf`,
    await buildReportPdf([data, { ...data, scope: 'mine' }], f, fonts),
  );
  const mail = await compose(
    {
      id: 'x',
      user_id: A,
      to_email: 'a@example.com',
      language: lang,
      kind: 'retention_notice',
      room_id: 'r',
      payload: { cycle_id: 'c1', from: '2026-10-01', to: '2026-10-31', delete_on: '2027-01-01' },
    },
    { fonts, deletePageUrl: 'https://example.com/delete-account/', userName: 'أحمد', load: async () => data },
  );
  writeFileSync(`${out}/email-${lang}.html`, mail.html);
  writeFileSync(
    `${out}/email-${lang}.txt`,
    `${mail.subject}\n\n${mail.text}\n\n${mail.attachments.map((a) => a.filename).join('\n')}`,
  );
  console.log(lang, 'ok', mail.subject, `${Math.round(mail.attachments[0]!.content.length / 1024)} KB`);
}
