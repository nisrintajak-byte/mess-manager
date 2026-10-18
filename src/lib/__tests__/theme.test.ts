import { THEME_NAMES, contrastRatio, palettes } from '../../ui/theme';

describe('themes meet WCAG AA contrast', () => {
  for (const name of THEME_NAMES) {
    const p = palettes[name];
    test(`${name}: text, muted text, primary button, status colors`, () => {
      expect(contrastRatio(p.text, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.text, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.textMuted, p.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.primaryText, p.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.primary, p.bg)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.danger, p.dangerBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.success, p.successBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.text, p.warnBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
