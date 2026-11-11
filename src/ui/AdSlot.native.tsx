import { useIsFocused } from '@react-navigation/native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

import { useAdFreeUntil } from '../lib/adFree';
import { useAdsPersonalised } from '../lib/adPrefs';
import { AD_SCREENS, ADS_ENABLED, type AdScreen, BANNER_UNIT_ID } from '../lib/adsConfig';
import { colors, font, space, themedStyles } from './theme';

/**
 * How long a screen must stay open before its banner is created. A banner is a Google web page
 * (WebView). Creating and loading it keeps the phone's UI thread busy: about 2.5 s on a fast
 * emulator, several times longer on low-end phones. If that happens while the screen is still
 * opening and the person taps, Android shows "app isn't responding" (founder report 2026-11-11).
 */
export const BANNER_DELAY_MS = 2500;

/**
 * A small banner at the end of a list, separated from buttons by space and an "Ad" label
 * (PRD §19.1). Renders nothing on screens that are not allowed or when no ad is available.
 *
 * Performance rules (ANR fix, 2026-11-11):
 * - only the screen on top has a banner. Screens underneath (Home under Room under Needs) drop
 *   theirs, so there is at most one live banner, and no hidden banner keeps refreshing;
 * - the banner starts only after the screen has been open for BANNER_DELAY_MS, so it never
 *   competes with the screen's own loading and drawing;
 * - memoised, with stable props, so screen re-renders do not reach the banner.
 */
export const AdSlot = memo(function AdSlot({ screen }: { screen: AdScreen }) {
  const { t } = useTranslation();
  const personalised = useAdsPersonalised();
  const [failed, setFailed] = useState(false);
  const adFree = useAdFreeUntil();
  const focused = useIsFocused();
  const [ready, setReady] = useState(false);
  const allowed = ADS_ENABLED && !adFree && !failed && AD_SCREENS.includes(screen);

  useEffect(() => {
    if (!allowed || !focused) return;
    const timer = setTimeout(() => setReady(true), BANNER_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setReady(false); // leaving the screen removes its banner
    };
  }, [allowed, focused]);

  const onAdFailedToLoad = useCallback(() => setFailed(true), []);
  const requestOptions = useMemo(() => ({ requestNonPersonalizedAdsOnly: !personalised }), [personalised]);

  if (!allowed || !focused || !ready) return null;
  return (
    <View style={styles.wrap} accessibilityLabel={t('ads.label')}>
      <Text style={styles.label}>{t('ads.label')}</Text>
      <BannerAd
        unitId={Platform.OS === 'ios' ? BANNER_UNIT_ID.ios : BANNER_UNIT_ID.android}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={requestOptions}
        onAdFailedToLoad={onAdFailedToLoad}
      />
    </View>
  );
});

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
