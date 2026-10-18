import { minimalTransfers } from '../transfers';

describe('minimalTransfers', () => {
  it('settles everyone exactly with few transfers', () => {
    const balances = [
      { userId: 'a', net: 5001 },
      { userId: 'b', net: -3000 },
      { userId: 'c', net: -2001 },
      { userId: 'd', net: 0 },
    ];
    const t = minimalTransfers(balances);
    expect(t).toEqual([
      { from: 'b', to: 'a', amount: 3000 },
      { from: 'c', to: 'a', amount: 2001 },
    ]);
  });

  it('never needs more than n-1 transfers and nets to zero for everyone', () => {
    const balances = [
      { userId: 'a', net: 700 },
      { userId: 'b', net: 300 },
      { userId: 'c', net: -400 },
      { userId: 'd', net: -350 },
      { userId: 'e', net: -250 },
    ];
    const t = minimalTransfers(balances);
    expect(t.length).toBeLessThanOrEqual(4);
    const after = new Map(balances.map((b) => [b.userId, b.net]));
    for (const x of t) {
      after.set(x.from, after.get(x.from)! + x.amount);
      after.set(x.to, after.get(x.to)! - x.amount);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
  });

  it('handles nothing to settle and rejects unbalanced input', () => {
    expect(minimalTransfers([{ userId: 'a', net: 0 }])).toEqual([]);
    expect(() => minimalTransfers([{ userId: 'a', net: 1 }])).toThrow();
  });
});
