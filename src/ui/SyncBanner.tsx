import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetState } from '../lib/offlineStore';
import { useOutbox } from '../lib/outbox';
import { navigationRef } from '../navigation/navigationRef';
import { colors, font, space, themedStyles } from './theme';

/** Slim bar at the bottom: "offline" and/or "N waiting to sync" (PRD §17.2). Tap opens the list. */
export function SyncBanner() {
  const { t } = useTranslation();
  const { offline } = useNetState();
  const items = useOutbox();
  const insets = useSafeAreaInsets();
  if (!offline && items.length === 0) return null;
  const failed = items.some((i) => i.status === 'failed');
  const text = [
    offline ? t('sync.offlineBanner') : null,
    items.length > 0 ? t('sync.waitingCount', { count: items.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (navigationRef.isReady()) navigationRef.navigate('Sync');
      }}
      style={[styles.bar, failed && styles.barBad, { paddingBottom: space.sm + insets.bottom }]}
    >
      <Text style={styles.text}>{text}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bar: { backgroundColor: colors.warnBg, paddingHorizontal: space.lg, paddingTop: space.sm },
    barBad: { backgroundColor: colors.dangerBg },
    text: { color: colors.text, fontSize: font.sm, fontWeight: '600' },
  }),
);
