import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { PLAY_LISTING_LIVE, PLAY_STORE_URL, SUPPORT_EMAIL } from '../config';
import { api } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import type { AppStackParamList } from '../navigation/types';
import { Avatar } from '../ui/Avatar';
import { BottomBar } from '../ui/BottomBar';
import { confirmSignOut, useLoader } from '../ui/hooks';
import { Icon, IconName } from '../ui/Icon';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';
import type { SettingsPage } from './SettingsPageScreen';

type Nav = NativeStackNavigationProp<AppStackParamList>;
type Item = { icon: IconName; label: string; onPress: () => void; hint?: string };

const VERSION = Constants.expoConfig?.version ?? '';

/**
 * Me (founder 2026-10-23): profile on top, then short sections — account, app, help, legal —
 * then Log out and who makes the app.
 */
export function PreferencesScreen() {
  const { t } = useTranslation();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const uid = session?.user.id ?? '';
  const email = session?.user.email ?? '';
  const { data: profile } = useLoader(() => api.myProfile(uid).catch(() => null), uid);
  const name =
    profile?.display_name || ((session?.user.user_metadata?.display_name as string | undefined) ?? '');

  const page = (p: SettingsPage) => () => nav.navigate('Settings', { page: p });
  function contact() {
    const subject = encodeURIComponent(t('me.supportSubject'));
    const body = encodeURIComponent(`\n\n—\nMess Manager ${VERSION} · ${Platform.OS}`);
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => undefined);
  }

  const sections: { title: string; items: Item[] }[] = [
    {
      title: t('me.account'),
      items: [
        { icon: 'bell', label: t('notifPrefs.title'), onPress: () => nav.navigate('NotificationSettings') },
        { icon: 'lock', label: t('me.security'), hint: t('me.securityHint'), onPress: page('security') },
      ],
    },
    {
      title: t('me.app'),
      items: [
        {
          icon: 'globe',
          label: t('me.appearance'),
          hint: t('me.appearanceHint'),
          onPress: page('appearance'),
        },
        { icon: 'sparkle', label: t('me.ads'), hint: t('me.adsHint'), onPress: page('ads') },
      ],
    },
    {
      title: t('me.help'),
      items: [
        { icon: 'help', label: t('help.open'), onPress: () => nav.navigate('Help') },
        { icon: 'compass', label: t('tour.again'), onPress: () => nav.navigate('Onboarding') },
        { icon: 'mail', label: t('me.contact'), hint: SUPPORT_EMAIL, onPress: contact },
        ...(PLAY_LISTING_LIVE
          ? [
              {
                icon: 'star' as const,
                label: t('me.rate'),
                onPress: () => void Linking.openURL(PLAY_STORE_URL).catch(() => undefined),
              },
            ]
          : []),
      ],
    },
    {
      title: t('me.legal'),
      items: [
        {
          icon: 'shield',
          label: t('legalCard.privacy'),
          onPress: () => nav.navigate('Legal', { doc: 'privacy' }),
        },
        { icon: 'file', label: t('legalCard.terms'), onPress: () => nav.navigate('Legal', { doc: 'terms' }) },
        { icon: 'download', label: t('me.data'), hint: t('me.dataHint'), onPress: page('data') },
      ],
    },
  ];

  return (
    <View style={styles.bg}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('me.editProfile')}
            onPress={page('profile')}
            style={({ pressed }) => [
              styles.heroRow,
              { flexDirection: rowDirection() },
              pressed && styles.dim,
            ]}
          >
            <View style={styles.avatarRing}>
              <Avatar name={name || email} photo={profile?.avatar_url} size={64} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.name} numberOfLines={1}>
                {name || t('nav.me')}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
              <Text style={styles.edit}>{t('me.editProfile')}</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.column}>
          {sections.map((s) => (
            <View key={s.title}>
              <Text style={styles.section}>{s.title}</Text>
              <View style={styles.group}>
                {s.items.map((it, i) => (
                  <Row key={it.label} item={it} first={i === 0} />
                ))}
              </View>
            </View>
          ))}

          <View style={[styles.group, styles.logoutGroup]}>
            <Row
              item={{
                icon: 'logout',
                label: t('auth.signOut'),
                onPress: async () => {
                  if (await confirmSignOut(t)) await signOut();
                },
              }}
              first
              danger
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerName}>{t('app.name')}</Text>
            <Text style={styles.footerText}>{t('me.madeBy')}</Text>
            <Text style={styles.footerText}>{t('me.unitOf')}</Text>
            <Text style={styles.footerText}>{localizeDigits(t('me.version', { version: VERSION }))}</Text>
          </View>
        </View>
      </ScrollView>
      <BottomBar current="Preferences" />
    </View>
  );
}

function Row({ item, first, danger }: { item: Item; first?: boolean; danger?: boolean }) {
  const tint = danger ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={item.onPress}
      style={({ pressed }) => [
        styles.row,
        { flexDirection: rowDirection() },
        !first && styles.rowBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.rowIcon, danger && { backgroundColor: colors.dangerBg }]}>
        <Icon name={item.icon} size={20} color={tint} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{item.label}</Text>
        {item.hint ? (
          <Text style={styles.rowHint} numberOfLines={1}>
            {item.hint}
          </Text>
        ) : null}
      </View>
      {!danger ? (
        <View style={rowDirection() === 'row-reverse' ? styles.flip : null}>
          <Icon name="chevron" size={18} color={colors.textMuted} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: space.xxl },
    flex: { flex: 1 },
    dim: { opacity: 0.8 },
    hero: { backgroundColor: colors.hero, paddingHorizontal: space.lg, paddingBottom: space.xl },
    heroRow: { alignItems: 'center', gap: space.lg, width: '100%', maxWidth: 560, alignSelf: 'center' },
    avatarRing: { borderRadius: 40, borderWidth: 3, borderColor: colors.heroTile, padding: 2 },
    name: { fontSize: font.xl, fontWeight: '700', color: colors.heroText },
    email: { fontSize: font.sm, color: colors.heroMuted, marginTop: 2 },
    edit: { fontSize: font.sm, color: colors.accent, fontWeight: '700', marginTop: space.xs },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg },
    section: {
      fontSize: font.sm,
      fontWeight: '700',
      color: colors.textMuted,
      marginTop: space.xl,
      marginBottom: space.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    group: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    logoutGroup: { marginTop: space.xl },
    row: {
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.md,
      minHeight: 56,
      paddingVertical: space.sm,
    },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    pressed: { backgroundColor: colors.bg },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.getBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontSize: font.md, fontWeight: '600', color: colors.text },
    rowHint: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
    flip: { transform: [{ scaleX: -1 }] },
    footer: { alignItems: 'center', marginTop: space.xl, gap: 2 },
    footerName: { fontSize: font.md, fontWeight: '700', color: colors.primary, marginBottom: space.xs },
    footerText: { fontSize: font.sm, color: colors.textMuted, textAlign: 'center' },
  }),
);
