import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { supportsEasternDigits } from '../lib/digits';
import { setDigits, setTheme, useSettings } from '../lib/settings';
import type { AppStackParamList } from '../navigation/types';
import { AccountDataCard } from '../ui/AccountCards';
import { AdsCard } from '../ui/AdsCard';
import { Body, Card, Chip, ChipRow, Label, Screen } from '../ui/components';
import { LanguagePicker } from '../ui/LanguagePicker';
import { LegalCard } from '../ui/LegalCard';
import { ProfileCard } from '../ui/ProfileCard';
import { RemoveAdsCard } from '../ui/RemoveAdsCard';
import { AppLockCard, ChangePasswordCard } from '../ui/SecurityCards';
import { THEME_NAMES } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Settings'>;
export type SettingsPage = AppStackParamList['Settings']['page'];

/** The pages behind the rows of Me (founder 2026-10-23: Me as clear sections, not one long list). */
export function SettingsPageScreen({ route }: Props) {
  const { page } = route.params;
  return (
    <Screen>
      {page === 'profile' ? <ProfileCard /> : null}
      {page === 'security' ? (
        <>
          <AppLockCard />
          <ChangePasswordCard />
        </>
      ) : null}
      {page === 'appearance' ? <Appearance /> : null}
      {page === 'ads' ? (
        <>
          <RemoveAdsCard />
          <AdsCard />
        </>
      ) : null}
      {page === 'data' ? (
        <>
          <AccountDataCard />
          <LegalCard />
        </>
      ) : null}
    </Screen>
  );
}

function Appearance() {
  const { t } = useTranslation();
  const { language, theme, digits } = useSettings();
  return (
    <>
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
    </>
  );
}
