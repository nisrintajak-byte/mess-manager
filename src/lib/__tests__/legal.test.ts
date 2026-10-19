import ar from '../../legal/ar.json';
import en from '../../legal/en.json';
import hi from '../../legal/hi.json';
import ur from '../../legal/ur.json';
import { LEGAL_VERSION } from '../../legal';

const shape = (t: typeof en) =>
  (['privacy', 'terms'] as const).map((d) => t[d].sections.map((s) => s.p.length));

describe('legal texts', () => {
  test('every language has the same sections and paragraphs', () => {
    for (const t of [ar, ur, hi]) expect(shape(t)).toEqual(shape(en));
  });
  test('version format matches the server check', () => {
    expect(LEGAL_VERSION).toMatch(/^[0-9]{4}-[0-9]{2}-v[0-9]{1,3}$/);
  });
});
