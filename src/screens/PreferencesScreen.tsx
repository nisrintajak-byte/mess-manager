import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import type { AppStackParamList } from '../navigation/types';
import { BottomBar } from '../ui/BottomBar';
import { confirmSignOut } from '../ui/hooks';

import { supportsEasternDigits } from '../lib/digits';
import { setDigits, setTheme, useSettings } from '../lib/settings';
import { Body, Button, Card, Chip, ChipRow, Label, Screen, Title } from '../ui/components';
import { LanguagePicker } from '../ui/LanguagePicker';
import { AccountDataCard } from '../ui/AccountCards';
import { AdsCard } from '../ui/AdsCard';
import { LegalCard } from '../ui/LegalCard';
import { ProfileCard } from '../ui/ProfileCard';
import { RemoveAdsCard } from '../ui/RemoveAdsCard';
import { AppLockCard, ChangePasswordCard } from '../ui/SecurityCards';
import { THEME_NAMES } from '../ui/theme';

export function PreferencesScreen() {
  const { t } = useTranslation();
  const { language, theme, digits } = useSettings();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { session, signOut } = useAuth();

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Title>{t('prefs.title')}</Title>
        <ProfileCard />
        <Card>
          <Label>{t('home.signedInAs', { name: session?.user.email ?? '' })}</Label>
          <Button
            title={t('notifPrefs.title')}
            variant="secondary"
            onPress={() => nav.navigate('NotificationSettings')}
          />
          <Button
            title={t('auth.signOut')}
            variant="secondary"
            onPress={async () => {
              if (await confirmSignOut(t)) await signOut();
            }}
          />
        </Card>
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
        <RemoveAdsCard />
        <AdsCard />
        <LegalCard />
        <AccountDataCard />
      </Screen>
      <BottomBar current="Preferences" />
    </View>
  );
}
