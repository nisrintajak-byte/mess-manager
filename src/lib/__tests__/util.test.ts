import { isIsoDate, todayIn, uuid } from '../util';

describe('util', () => {
  it('uuid looks like v4 and is unique', () => {
    const a = uuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuid()).not.toBe(a);
  });

  it('todayIn respects the Room time zone', () => {
    const t = new Date('2026-10-18T22:30:00Z');
    expect(todayIn('Asia/Kuwait', t)).toBe('2026-10-19');
    expect(todayIn('America/New_York', t)).toBe('2026-10-18');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('18-10-2026')).toBe(false);
  });
});
