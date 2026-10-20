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
  /** top band of Home / Room (brand navy in light themes) */
  hero: string;
  heroText: string;
  heroMuted: string;
  heroTile: string;
  /** "you pay" (amber) and "you receive" (blue) tiles */
  accent: string;
  accentText: string;
  payBg: string;
  payText: string;
  getBg: string;
  getText: string;
};

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: '#F3F5F8',
    surface: '#FFFFFF',
    text: '#14202B',
    textMuted: '#55667A',
    border: '#DDE3EA',
    primary: '#184670',
    primaryText: '#FFFFFF',
    danger: '#B42318',
    dangerBg: '#FDECEA',
    success: '#1B6B44',
    successBg: '#E6F4EC',
    warnBg: '#FFF4E0',
    hero: '#184670',
    heroText: '#FFFFFF',
    heroMuted: '#C9D6E3',
    heroTile: '#23527D',
    accent: '#F2A33A',
    accentText: '#14202B',
    payBg: '#FDF1E3',
    payText: '#7A4A12',
    getBg: '#E6F0F8',
    getText: '#184670',
  },
  dark: {
    bg: '#0C1E33',
    surface: '#12283F',
    text: '#E9EEF3',
    textMuted: '#A9B8C7',
    border: '#24405C',
    primary: '#9CC3EA',
    primaryText: '#0C1E33',
    danger: '#FF9A90',
    dangerBg: '#3A1816',
    success: '#7FD3A8',
    successBg: '#123526',
    warnBg: '#3A3010',
    hero: '#16304B',
    heroText: '#FFFFFF',
    heroMuted: '#A9B8C7',
    heroTile: '#1F3D5C',
    accent: '#E9B44C',
    accentText: '#0C1E33',
    payBg: '#3A2A12',
    payText: '#F3C77A',
    getBg: '#16304B',
    getText: '#9CC3EA',
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
    hero: '#6E3B06',
    heroText: '#FFFFFF',
    heroMuted: '#F0DCC0',
    heroTile: '#8A4B08',
    accent: '#F2C94C',
    accentText: '#2A2118',
    payBg: '#FCEBD3',
    payText: '#7A3E06',
    getBg: '#EEF3E3',
    getText: '#2F5A1F',
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
    hero: '#1D5FA8',
    heroText: '#FFFFFF',
    heroMuted: '#D3E3F5',
    heroTile: '#2A6CB5',
    accent: '#F2A33A',
    accentText: '#12202F',
    payBg: '#FDF1E3',
    payText: '#7A4A12',
    getBg: '#E3EEFA',
    getText: '#1D5FA8',
  },
};

export const colors: Palette = { ...palettes.light };

let revision = 0;
let current: ThemeName = 'light';
let fontFamilies: { regular?: string; bold?: string } = {};

/** Per-language font (Urdu Nastaliq, Hindi Devanagari). Empty = the phone's own font. */
export function applyFonts(f: { regular?: string; bold?: string }): void {
  fontFamilies = f;
  revision += 1;
}

/**
 * Right-to-left on the phone is done in JavaScript (not by Android's own mirroring) so that
 * changing language applies instantly, with no app restart. When on, rows run reversed, left/right
 * margins and paddings swap and text aligns to the right. On the web the browser mirrors
 * everything itself (`dir="rtl"`), so this stays off there.
 */
let jsRtl = false;
export function applyRtl(on: boolean): void {
  jsRtl = on;
  revision += 1;
}
export function rowDirection(): 'row' | 'row-reverse' {
  return jsRtl ? 'row-reverse' : 'row';
}

const FLIP: Record<string, string> = {
  marginLeft: 'marginRight',
  marginRight: 'marginLeft',
  paddingLeft: 'paddingRight',
  paddingRight: 'paddingLeft',
  left: 'right',
  right: 'left',
  borderLeftWidth: 'borderRightWidth',
  borderRightWidth: 'borderLeftWidth',
  borderLeftColor: 'borderRightColor',
  borderRightColor: 'borderLeftColor',
};

function flipRtl(st: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(st)) out[FLIP[k] ?? k] = v;
  if (out.flexDirection === 'row') out.flexDirection = 'row-reverse';
  else if (out.flexDirection === 'row-reverse') out.flexDirection = 'row';
  if (out.textAlign === 'left') out.textAlign = 'right';
  else if (out.textAlign === 'right') out.textAlign = 'left';
  else if (out.textAlign === undefined && 'fontSize' in out) out.textAlign = 'right';
  return out;
}

function withFont(style: unknown): unknown {
  if (!style || typeof style !== 'object') return style;
  let st = style as Record<string, unknown>;
  if (jsRtl) st = flipRtl(st);
  if (!fontFamilies.regular || (!('fontSize' in st) && !('fontWeight' in st))) return st;
  const w = String(st.fontWeight ?? '400');
  const bold = w === 'bold' || Number(w) >= 600;
  // custom fonts do not synthesise weights: drop fontWeight and pick the bold file instead
  const rest = { ...st };
  delete rest.fontWeight;
  return { ...rest, fontFamily: bold ? fontFamilies.bold : fontFamilies.regular };
}

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
        const raw = factory() as Record<string, unknown>;
        cache = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, withFont(v)])) as T;
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
export const radius = { sm: 6, md: 12, lg: 16 };
export const font = { sm: 13, md: 15, lg: 17, xl: 22, xxl: 28 };
