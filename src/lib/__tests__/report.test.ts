import en from '../../i18n/locales/en.json';
import ar from '../../i18n/locales/ar.json';
import { buildExportHtml, buildReportCsv, buildReportHtml, minorToDecimal, type ReportData, type Translate } from '../report';

function translator(dict: Record<string, unknown>, missing: string[]): Translate {
  return (key, vars) => {
    const v = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
    if (typeof v !== 'string') {
      missing.push(key);
      return key;
    }
    return v.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars?.[k] ?? ''));
  };
}

const A = 'a-user';
const B = 'b-user';
const sample: ReportData = {
  ref: 'MM-20261019-ABCD1234',
  generated_at: '2026-10-19T08:30:00Z',
  scope: 'room',
  requester: A,
  room: { name: 'Flat <7>', currency: 'KWD', decimals: 3, time_zone: 'Asia/Kuwait' },
  period: { from: '2026-10-01', to: '2026-10-31' },
  people: { [A]: { name: 'Asha', deleted: false }, [B]: { name: 'Bilal', deleted: true } },
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
      title: '=HYPERLINK("x")',
      amount: 8000,
      currency: 'KWD',
      paid_by: A,
      created_by: A,
      created_at: '2026-10-02T10:00:00Z',
      notes: 'rice, oil',
      deleted: false,
      adjustment: false,
      late_entry_from: null,
      has_receipt: true,
      my_share: 4000,
      participants: 2,
    },
    {
      id: 'e2',
      cycle_id: 'c1',
      date: '2026-10-03',
      title: 'Tea',
      amount: -500,
      currency: 'KWD',
      paid_by: B,
      created_by: B,
      created_at: '2026-10-03T10:00:00Z',
      notes: null,
      deleted: false,
      adjustment: true,
      late_entry_from: '2026-09-30',
      has_receipt: false,
      my_share: -250,
      participants: 2,
    },
  ],
  settlements: [
    {
      id: 's1',
      cycle_id: 'c1',
      total: 7500,
      currency: 'KWD',
      decimals: 3,
      generated_at: '2026-10-31T20:00:00Z',
      lines: [
        { user_id: B, share: 3750, paid: -500, net: -4250, confirmed: 0, awaiting: 4250 },
        { user_id: A, share: 3750, paid: 8000, net: 4250, confirmed: 0, awaiting: 0 },
      ],
    },
  ],
  payments: [
    {
      id: 'p1',
      payer: B,
      amount: 4250,
      currency: 'KWD',
      method: 'bank',
      reference: 'TXN-1',
      has_proof: true,
      status: 'awaiting',
      claimed_at: '2026-11-01T09:00:00Z',
      decided_by: null,
      decided_at: null,
      reject_reason: null,
    },
  ],
  disputes: [
    {
      id: 'f1',
      target_type: 'expense',
      target_id: 'e1',
      reason: 'wrong_amount',
      note: 'was 7',
      status: 'open',
      raised_by: B,
      created_at: '2026-10-04T09:00:00Z',
      resolved_by: null,
      resolved_at: null,
      resolution_note: null,
    },
  ],
  audit: [{ at: '2026-10-02T10:00:00Z', entity: 'expenses', action: 'create', actor: A, title: 'Rice' }],
};

const fmt = (t: Translate, rtl: boolean, lang: string) => ({
  t,
  lang,
  rtl,
  money: (v: number, c: string, d: number) => `${c} ${minorToDecimal(v, d)}`,
  digits: (s: string) => s,
});

describe('reports', () => {
  test('minor units to plain decimals', () => {
    expect(minorToDecimal(8000, 3)).toBe('8.000');
    expect(minorToDecimal(-250, 3)).toBe('-0.250');
    expect(minorToDecimal(5, 2)).toBe('0.05');
    expect(minorToDecimal(1200, 0)).toBe('1200');
  });

  test('HTML uses every label from the translations and escapes user text', () => {
    const missing: string[] = [];
    const html = buildReportHtml(sample, fmt(translator(en, missing), false, 'en'));
    expect(missing).toEqual([]);
    expect(html).toContain('dir="ltr"');
    expect(html).toContain('Flat &lt;7&gt;');
    expect(html).not.toContain('Flat <7>');
    expect(html).toContain('MM-20261019-ABCD1234');
    expect(html).toContain('Bilal (account deleted)');
    expect(html).toContain('KWD 8.000');
    expect(html).toContain('Late entry (from 2026-09-30)');
  });

  test('Arabic report is right-to-left with no missing labels', () => {
    const missing: string[] = [];
    const html = buildReportHtml(sample, fmt(translator(ar, missing), true, 'ar'));
    expect(missing).toEqual([]);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar"');
  });

  test('CSV has a BOM, plain numbers and blocks spreadsheet formulas', () => {
    const missing: string[] = [];
    const csv = buildReportCsv(sample, translator(en, missing));
    expect(missing).toEqual([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain(',8.000,4.000,');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"rice, oil"');
  });

  test('data export renders profile, memberships and each Room', () => {
    const missing: string[] = [];
    const html = buildExportHtml(
      {
        ref: 'MM-20261019-EXPORT01',
        generated_at: '2026-10-19T08:30:00Z',
        profile: {
          display_name: 'Asha',
          email: 'a@t.dev',
          date_of_birth: '1990-01-01',
          language: 'en',
          consent_version: 'v1',
          consent_at: '2026-10-01T00:00:00Z',
          created_at: '2026-10-01T00:00:00Z',
        },
        memberships: [
          { room: 'Flat', role: 'admin', status: 'approved', requested_at: '', joined_on: '2026-10-01', left_on: null },
        ],
        rooms: [sample, { ...sample, scope: 'mine' }],
      },
      fmt(translator(en, missing), false, 'en'),
    );
    expect(missing).toEqual([]);
    expect(html.match(/<section class="report">/g)?.length).toBe(3);
    expect(html).toContain('a@t.dev');
  });
});
