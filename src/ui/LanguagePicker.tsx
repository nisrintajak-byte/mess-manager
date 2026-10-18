import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '../i18n';
import { setLanguage, useSettings } from '../lib/settings';
import { Chip, ChipRow } from './components';

/** Language names in their own script, no flags (PRD §16.1). Usable before login. */
export function LanguagePicker() {
  const { language } = useSettings();
  return (
    <ChipRow>
      {SUPPORTED_LANGUAGES.map((l) => (
        <Chip key={l} on={language === l} label={LANGUAGE_NAMES[l]} onPress={() => void setLanguage(l)} />
      ))}
    </ChipRow>
  );
}
