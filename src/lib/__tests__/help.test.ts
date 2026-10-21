import { HELP_LANGS, helpTexts } from '../../help';

describe('user guide', () => {
  const en = helpTexts('en');
  test('every language has the same topics and number of steps', () => {
    for (const lang of HELP_LANGS) {
      const h = helpTexts(lang);
      expect(h.topics.map((x) => x.id)).toEqual(en.topics.map((x) => x.id));
      h.topics.forEach((x, i) => {
        expect(x.steps.length).toBe(en.topics[i]?.steps.length);
        expect(x.admin).toBe(en.topics[i]?.admin);
        expect(x.title.length).toBeGreaterThan(0);
      });
    }
  });
});
