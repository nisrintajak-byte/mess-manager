import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppStackParamList } from '../navigation/types';
import { Icon, IconName } from './Icon';
import { colors, rowDirection, themedStyles } from './theme';

type Tab = 'Home' | 'Inbox' | 'Preferences';
const TABS: { key: Tab; icon: IconName; label: string }[] = [
  { key: 'Home', icon: 'home', label: 'nav.home' },
  { key: 'Inbox', icon: 'bell', label: 'nav.inbox' },
  { key: 'Preferences', icon: 'user', label: 'nav.me' },
];

/** The fixed menu at the bottom of the main screens (founder 2026-10-20: less scattered). */
export function BottomBar({ current, unread = 0 }: { current: Tab; unread?: number }) {
  const { t } = useTranslation();
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 6), flexDirection: rowDirection() }]}
    >
      {TABS.map((tab) => {
        const on = tab.key === current;
        const color = on ? colors.primary : colors.textMuted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(tab.label)}
            onPress={() => (on ? undefined : nav.navigate(tab.key))}
            style={styles.item}
          >
            <View>
              <Icon name={tab.icon} color={color} />
              {tab.key === 'Inbox' && unread > 0 ? (
                <View style={styles.dot}>
                  <Text style={styles.dotText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color }, on ? styles.labelOn : null]}>{t(tab.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 6,
    },
    item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, gap: 2 },
    label: { fontSize: 12 },
    labelOn: { fontWeight: '700' },
    dot: {
      position: 'absolute',
      top: -6,
      right: -12,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dotText: { fontSize: 11, fontWeight: '700', color: colors.accentText },
  }),
);
