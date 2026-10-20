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
      // the new top band and money tiles
      expect(contrastRatio(p.heroText, p.hero)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.heroMuted, p.hero)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.heroText, p.heroTile)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.heroMuted, p.heroTile)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p.accentText, p.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.payText, p.payBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.getText, p.getBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
