/**
 * Four themes (PRD §16.3). All colors live here. `colors` is a live object: switching theme
 * updates it in place and `themedStyles` recomputes styles, so no screen hard-codes a color.
 */
export const THEME_NAMES = ['light', 'dark', 'sand', 'ocean'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export type Palette = {
  bg: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  danger: string;
  dangerBg: string;
  success: string;
  successBg: string;
  warnBg: string;
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F6F7F4',
    surface: '#FFFFFF',
    text: '#16201C',
    textMuted: '#5B6762',
    border: '#D9DED9',
    primary: '#1F6F5C',
    primaryText: '#FFFFFF',
    danger: '#B42318',
    dangerBg: '#FDECEA',
    success: '#1F6F5C',
    successBg: '#E5F2EE',
    warnBg: '#FFF4D6',
  },
  dark: {
    bg: '#0F1714',
    surface: '#18231F',
    text: '#E8EFEA',
    textMuted: '#A3B1AA',
    border: '#2C3A35',
    primary: '#4FB89B',
    primaryText: '#06201A',
    danger: '#FF9A90',
    dangerBg: '#3A1816',
    success: '#6FD3B5',
    successBg: '#14332B',
    warnBg: '#3A3010',
  },
  sand: {
    bg: '#FAF5EC',
    surface: '#FFFFFF',
    text: '#2A2118',
    textMuted: '#6B5E4F',
    border: '#E4D9C6',
    primary: '#8A4B08',
    primaryText: '#FFFFFF',
    danger: '#B42318',
    dangerBg: '#FDECEA',
    success: '#2F6B2F',
    successBg: '#E8F3E3',
    warnBg: '#FFF1CC',
  },
  ocean: {
    bg: '#F2F6FB',
    surface: '#FFFFFF',
    text: '#12202F',
    textMuted: '#4F6074',
    border: '#D3DEEA',
    primary: '#1D5FA8',
    primaryText: '#FFFFFF',
    danger: '#B42318',
    dangerBg: '#FDECEA',
    success: '#1B6B4A',
    successBg: '#E1F2EA',
    warnBg: '#FFF4D6',
  },
};

export const colors: Palette = { ...palettes.light };

let revision = 0;
let current: ThemeName = 'light';

export function applyTheme(name: ThemeName): void {
  Object.assign(colors, palettes[name]);
  current = name;
  revision += 1;
}

export function currentTheme(): ThemeName {
  return current;
}

/**
 * Like StyleSheet.create, but re-evaluated after every theme change.
 * Usage: `const styles = themedStyles(() => StyleSheet.create({ ... }));`
 */
export function themedStyles<T extends object>(factory: () => T): T {
  let cache: T | undefined;
  let seen = -1;
  return new Proxy({} as T, {
    get(_target, prop) {
      if (!cache || seen !== revision) {
        cache = factory();
        seen = revision;
      }
      return Reflect.get(cache, prop);
    },
  });
}

/** WCAG relative luminance contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * (ch[0] ?? 0) + 0.7152 * (ch[1] ?? 0) + 0.0722 * (ch[2] ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 14 };
export const font = { sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 };
