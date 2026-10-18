/**
 * Number display (PRD §16.2): Western digits by default, optional Eastern Arabic digits for
 * Arabic (٠١٢) and Urdu (۰۱۲). Display only — stored values never change.
 */
let style: 'latin' | 'arabic' = 'latin';
let lang = 'en';

const ARABIC = '٠١٢٣٤٥٦٧٨٩';
const URDU = '۰۱۲۳۴۵۶۷۸۹';

export function configureDigits(language: string, digits: 'latin' | 'arabic'): void {
  lang = language;
  style = digits;
}

/** Eastern digits only make sense for Arabic and Urdu. */
export function supportsEasternDigits(language: string): boolean {
  return language === 'ar' || language === 'ur';
}

export function localizeDigits(text: string): string {
  if (style !== 'arabic' || !supportsEasternDigits(lang)) return text;
  const table = lang === 'ur' ? URDU : ARABIC;
  return text.replace(/[0-9]/g, (d) => table[Number(d)] ?? d);
}

/** BCP-47 locale for Intl date formatting in the current language and digit style. */
export function dateLocale(): string {
  const eastern = style === 'arabic' && supportsEasternDigits(lang);
  return `${lang}-u-nu-${eastern ? (lang === 'ur' ? 'arabext' : 'arab') : 'latn'}`;
}
