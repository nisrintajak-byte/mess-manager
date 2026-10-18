import { useTranslation } from 'react-i18next';

import { supportsEasternDigits } from '../lib/digits';
import { setDigits, setTheme, useSettings } from '../lib/settings';
import { Body, Card, Chip, ChipRow, Label, Screen, Title } from '../ui/components';
import { LanguagePicker } from '../ui/LanguagePicker';
import { AppLockCard, ChangePasswordCard } from '../ui/SecurityCards';
import { THEME_NAMES } from '../ui/theme';

export function PreferencesScreen() {
  const { t } = useTranslation();
  const { language, theme, digits } = useSettings();

  return (
    <Screen>
      <Title>{t('prefs.title')}</Title>
      <Card>
        <Label>{t('prefs.language')}</Label>
        <LanguagePicker />
        {language !== 'en' ? <Body muted>{t('prefs.draftTranslation')}</Body> : null}
      </Card>

      <Card>
        <Label>{t('prefs.theme')}</Label>
        <ChipRow>
          {THEME_NAMES.map((n) => (
            <Chip key={n} on={theme === n} label={t(`prefs.theme_${n}`)} onPress={() => void setTheme(n)} />
          ))}
        </ChipRow>
      </Card>

      {supportsEasternDigits(language) ? (
        <Card>
          <Label>{t('prefs.digits')}</Label>
          <ChipRow>
            <Chip
              on={digits === 'latin'}
              label={t('prefs.digits_latin')}
              onPress={() => void setDigits('latin')}
            />
            <Chip
              on={digits === 'arabic'}
              label={t('prefs.digits_arabic')}
              onPress={() => void setDigits('arabic')}
            />
          </ChipRow>
        </Card>
      ) : null}

      <AppLockCard />
      <ChangePasswordCard />
    </Screen>
  );
}
