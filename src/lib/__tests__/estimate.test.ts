import { estimateBalances } from '../estimate';

const base = [
  { user_id: 'a', paid: 3000, share: 2000, net: 1000 },
  { user_id: 'b', paid: 0, share: 1000, net: -1000 },
];

describe('estimateBalances', () => {
  test('adds a queued expense split equally and keeps the total balanced', () => {
    const out = estimateBalances(base, [{ userId: 'b', amount: 1001, participants: null }], ['a', 'b']);
    const a = out.find((r) => r.user_id === 'a')!;
    const b = out.find((r) => r.user_id === 'b')!;
    expect(b.paid).toBe(1001);
    expect(a.share + b.share).toBe(3000 + 1001);
    expect(a.net + b.net).toBe(0);
  });

  test('selected participants only', () => {
    const out = estimateBalances(base, [{ userId: 'a', amount: 900, participants: ['b'] }], ['a', 'b']);
    expect(out.find((r) => r.user_id === 'b')!.share).toBe(1900);
    expect(out.find((r) => r.user_id === 'a')!.paid).toBe(3900);
  });

  test('does not mutate the official rows and ignores empty queue', () => {
    const out = estimateBalances(base, [], ['a', 'b']);
    expect(out).toEqual(base);
    expect(out[0]).not.toBe(base[0]);
  });
});
