import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Switch } from 'react-native';

import { privacyOptionsRequired, showPrivacyOptions } from '../lib/ads';
import { setAdsPersonalised, useAdsPersonalised } from '../lib/adPrefs';
import { ADS_ENABLED } from '../lib/adsConfig';
import { Body, Button, Card, Label, Row } from './components';
import { colors } from './theme';

/** PRD §18.5 / §19.3: switch to non-personalised ads at any time; Google privacy options where required. */
export function AdsCard() {
  const { t } = useTranslation();
  const personalised = useAdsPersonalised();
  const [needsForm, setNeedsForm] = useState(false);
  useEffect(() => {
    void privacyOptionsRequired().then(setNeedsForm);
  }, []);
  if (Platform.OS === 'web' || !ADS_ENABLED) return null;
  return (
    <Card>
      <Label>{t('ads.title')}</Label>
      <Body muted>{t('ads.explain')}</Body>
      <Row>
        <Body>{t('ads.personalised')}</Body>
        <Switch
          value={personalised}
          onValueChange={(v) => void setAdsPersonalised(v)}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={t('ads.personalised')}
        />
      </Row>
      {needsForm ? (
        <Button title={t('ads.privacyOptions')} variant="link" onPress={() => void showPrivacyOptions()} />
      ) : null}
    </Card>
  );
}
