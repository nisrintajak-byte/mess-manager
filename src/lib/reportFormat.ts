import i18n, { isRtlLanguage } from '../i18n';
import { localizeDigits } from './digits';
import { formatMoney } from './money';
import type { ReportFormat } from './report';

/** Report formatting in the app's current language, direction and digit style. */
export function appReportFormat(): ReportFormat {
  const lang = i18n.language || 'en';
  return {
    t: (key, vars) => i18n.t(key, vars ?? {}),
    lang,
    rtl: isRtlLanguage(lang),
    money: (minor, currency, decimals) => localizeDigits(formatMoney(minor, currency, decimals)),
    digits: (text) => localizeDigits(text),
  };
}
