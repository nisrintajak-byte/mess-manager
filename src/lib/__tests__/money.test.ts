import { computeBalances, formatMinor, MoneyError, parseAmount, splitEqual } from '../money';

describe('parseAmount', () => {
  it('parses per currency precision', () => {
    expect(parseAmount('12.5', 3)).toBe(12500); // KWD
    expect(parseAmount('12.50', 2)).toBe(1250); // USD
    expect(parseAmount('1250', 0)).toBe(1250); // JPY
    expect(parseAmount('1,250.75', 2)).toBe(125075);
    expect(parseAmount('0.001', 3)).toBe(1);
  });

  it('rejects invalid or over-precise input', () => {
    expect(parseAmount('12.505', 2)).toBeNull();
    expect(parseAmount('12.5', 0)).toBeNull();
    expect(parseAmount('-5', 2)).toBeNull();
    expect(parseAmount('abc', 2)).toBeNull();
    expect(parseAmount('', 2)).toBeNull();
  });
});

describe('formatMinor', () => {
  it('formats 0, 2 and 3 decimals', () => {
    expect(formatMinor(12500, 3)).toBe('12.500');
    expect(formatMinor(5, 2)).toBe('0.05');
    expect(formatMinor(1250, 0)).toBe('1250');
    expect(formatMinor(-1001, 3)).toBe('-1.001');
  });
});

describe('splitEqual', () => {
  const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

  it.each([
    ['KWD (3)', 10000, 3],
    ['USD (2)', 1000, 3],
    ['JPY (0)', 100, 3],
    ['odd', 7, 4],
    ['zero', 0, 5],
  ])('totals match exactly: %s', (_label, total, n) => {
    const ids = Array.from({ length: n }, (_, i) => `u${i}`);
    const shares = splitEqual(total, ids, 'u1');
    expect(sum(shares)).toBe(total);
  });

  it('gives the leftover to the payer', () => {
    const shares = splitEqual(100, ['a', 'b', 'c'], 'b');
    expect(shares.get('a')).toBe(33);
    expect(shares.get('b')).toBe(34);
    expect(shares.get('c')).toBe(33);
  });

  it('gives leftover to first sorted participant when payer not sharing', () => {
    const shares = splitEqual(100, ['c', 'a', 'b'], 'z');
    expect(shares.get('a')).toBe(34);
    expect(shares.has('z')).toBe(false);
  });

  it('rejects bad input', () => {
    expect(() => splitEqual(10, [], 'a')).toThrow(MoneyError);
    expect(() => splitEqual(-1, ['a'], 'a')).toThrow(MoneyError);
    expect(() => splitEqual(1.5, ['a'], 'a')).toThrow(MoneyError);
  });
});

describe('computeBalances', () => {
  it('nets sum to zero and match paid minus share', () => {
    const s1 = splitEqual(10000, ['a', 'b', 'c'], 'a');
    const s2 = splitEqual(2501, ['a', 'b', 'c'], 'b');
    const toShares = (m: Map<string, number>) => [...m].map(([userId, amount]) => ({ userId, amount }));
    const rows = computeBalances(
      ['a', 'b', 'c'],
      [
        { paidBy: 'a', amount: 10000, shares: toShares(s1) },
        { paidBy: 'b', amount: 2501, shares: toShares(s2) },
      ],
    );
    expect(rows.reduce((t, r) => t + r.net, 0)).toBe(0);
    const a = rows.find((r) => r.userId === 'a')!;
    expect(a.paid).toBe(10000);
    expect(a.net).toBe(a.paid - a.share);
  });

  it('rejects expenses whose shares do not add up', () => {
    expect(() =>
      computeBalances(['a'], [{ paidBy: 'a', amount: 10, shares: [{ userId: 'a', amount: 9 }] }]),
    ).toThrow(MoneyError);
  });
});
