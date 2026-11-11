import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { useAdFreeUntil } from '../lib/adFree';
import { useAdsPersonalised } from '../lib/adPrefs';
import { AD_SCREENS, ADS_ENABLED, type AdScreen, BANNER_UNIT_ID } from '../lib/adsConfig';
import { colors, font, space, themedStyles } from './theme';

/**
 * A small banner at the end of a list, separated from buttons by space and an "Ad" label
 * (PRD §19.1). Renders nothing on screens that are not allowed or when no ad is available.
 */
export function AdSlot({ screen }: { screen: AdScreen }) {
  const { t } = useTranslation();
  const personalised = useAdsPersonalised();
  const [failed, setFailed] = useState(false);
  const adFree = useAdFreeUntil();
  if (!ADS_ENABLED || adFree || failed || !AD_SCREENS.includes(screen)) return null;
  return (
    <View style={styles.wrap} accessibilityLabel={t('ads.label')}>
      <Text style={styles.label}>{t('ads.label')}</Text>
      <BannerAd
        unitId={Platform.OS === 'ios' ? BANNER_UNIT_ID.ios : BANNER_UNIT_ID.android}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: !personalised }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: {
      marginTop: space.xxl,
      paddingTop: space.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      alignItems: 'center',
    },
    label: { fontSize: font.sm, color: colors.textMuted, marginBottom: space.xs },
  }),
);
