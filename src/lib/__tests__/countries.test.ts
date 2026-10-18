import { COUNTRIES, countriesSorted, defaultTimeZone, getCountry } from '../countries';

describe('countries', () => {
  it('maps country to ISO 4217 currency and decimals', () => {
    expect(getCountry('KW')).toMatchObject({ currency: 'KWD', decimals: 3 });
    expect(getCountry('US')).toMatchObject({ currency: 'USD', decimals: 2 });
    expect(getCountry('JP')).toMatchObject({ currency: 'JPY', decimals: 0 });
    expect(getCountry('IN')).toMatchObject({ currency: 'INR', decimals: 2 });
  });

  it('has names in all 4 launch languages and at least one zone', () => {
    for (const c of COUNTRIES) {
      expect(c.names.en && c.names.ar && c.names.ur && c.names.hi).toBeTruthy();
      expect(c.timeZones.length).toBeGreaterThan(0);
    }
  });

  it('auto-selects a single zone, requires a choice for multi-zone countries', () => {
    expect(defaultTimeZone(getCountry('KW')!)).toBe('Asia/Kuwait');
    expect(defaultTimeZone(getCountry('US')!)).toBeNull();
  });

  it('contains no flag emoji anywhere', () => {
    const flag = /[\u{1F1E6}-\u{1F1FF}]/u;
    expect(flag.test(JSON.stringify(COUNTRIES))).toBe(false);
  });

  it('sorts alphabetically', () => {
    const names = countriesSorted('en').map((c) => c.names.en);
    expect(names[0] < names[names.length - 1]).toBe(true);
  });
});
