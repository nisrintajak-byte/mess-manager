import { cleanCurrency, defaultCurrency, monthBounds, monthTotals, shiftMonth } from '../personal';

describe('personal expenses helpers', () => {
  test('month bounds include the last day, also in February of a leap year', () => {
    expect(monthBounds('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthBounds('2026-12')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  test('shiftMonth crosses years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  test('totals never add different currencies and group categories', () => {
    const totals = monthTotals([
      { amount: 1500, currency: 'INR', currency_decimals: 2, category: 'food' },
      { amount: 500, currency: 'INR', currency_decimals: 2, category: null },
      { amount: 2500, currency: 'INR', currency_decimals: 2, category: 'food' },
      { amount: 300, currency: 'KWD', currency_decimals: 3, category: 'transport' },
    ]);
    expect(totals).toEqual([
      {
        currency: 'INR',
        decimals: 2,
        amount: 4500,
        byCategory: [
          { category: 'food', amount: 4000 },
          { category: 'other', amount: 500 },
        ],
      },
      { currency: 'KWD', decimals: 3, amount: 300, byCategory: [{ category: 'transport', amount: 300 }] },
    ]);
    expect(monthTotals([])).toEqual([]);
  });

  test('currency codes are checked against the country list', () => {
    expect(cleanCurrency(' inr ')).toBe('INR');
    expect(cleanCurrency('ABC')).toBeNull();
    expect(cleanCurrency('RUPEE')).toBeNull();
  });

  test('default currency: last used, then Room, then phone region', () => {
    expect(defaultCurrency('KWD', 'INR')).toBe('KWD');
    expect(defaultCurrency(null, 'INR')).toBe('INR');
    expect(defaultCurrency('zzz', null, 'en-IN')).toBe('INR');
    expect(defaultCurrency(null, null, 'ar-SA')).toBe('SAR');
  });
});
