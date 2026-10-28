import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { api, RoomOverview } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { formatMoney } from '../lib/money';
import { getPref, setPref } from '../lib/prefs';
import type { AppStackParamList } from '../navigation/types';
import { TOUR_PREF } from './OnboardingScreen';
import { AdSlot } from '../ui/AdSlot';
import { Avatar } from '../ui/Avatar';
import { BottomBar } from '../ui/BottomBar';
import { Notice } from '../ui/components';
import { EmptyState } from '../ui/EmptyState';
import { useLoader } from '../ui/hooks';
import { Icon } from '../ui/Icon';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';
import { WebPushCard } from '../ui/WebPushCard';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

const LOGO = require('../../assets/logo-small.png');

/**
 * Home (founder 2026-10-28): only the member's Rooms plus Join / Create. Adding an expense, a
 * Need Request, settling and reports happen inside a Room, so they always go to that Room.
 * Pinned settlements and the first-time checklist stay on top until done.
 */
export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  // first-time setup checklist (founder 2026-10-23) until done or closed
  const [setupHidden, setSetupHidden] = useState(true);
  const [firstExpense, setFirstExpense] = useState(false);
  useEffect(() => {
    void getPref('setupHidden').then((v) => setSetupHidden(v === '1'));
  }, []);
  async function hideSetup() {
    setSetupHidden(true);
    await setPref('setupHidden', '1');
  }
  const uid = session?.user.id ?? '';
  const { data, error, loading, reload } = useLoader(async () => {
    const [rooms, pending, unread, open, profile, expensePref] = await Promise.all([
      api.myRoomsOverview(),
      api.myPendingRequests(),
      api.unreadCount().catch(() => 0),
      api.myOpenSettlements().catch(() => []),
      api.myProfile(uid).catch(() => null),
      getPref('firstExpense'),
    ]);
    setFirstExpense(expensePref === '1');
    return { rooms, pending, unread, open, profile };
  });
  // a brand-new member (no Room, no request) sees the intro slides once on this device
  const tourChecked = useRef(false);
  useEffect(() => {
    if (!data || tourChecked.current) return;
    tourChecked.current = true;
    void getPref(TOUR_PREF).then((v) => {
      if (v === '1') return;
      if (data.rooms.length === 0 && data.pending.length === 0) navigation.navigate('Onboarding');
      else void setPref(TOUR_PREF, '1');
    });
  }, [data, navigation]);
  const name = (session?.user.user_metadata?.display_name as string | undefined) ?? '';
  const rooms = data?.rooms ?? [];
  const money = (v: number, r: { currency: string; decimals: number }) =>
    localizeDigits(formatMoney(v, r.currency, r.decimals));

  const first = rooms[0];
  const fresh = !!data && rooms.length === 0;
  const steps = [
    {
      key: 'photo',
      done: !!data?.profile?.avatar_url,
      go: () => navigation.navigate('Settings', { page: 'profile' }),
    },
    {
      key: 'room',
      done: rooms.length > 0 || (data?.pending.length ?? 0) > 0,
      go: () => navigation.navigate('CreateRoom'),
    },
    {
      key: 'expense',
      done: firstExpense || rooms.some((r) => r.my_paid > 0),
      go: () => (first ? navigation.navigate('AddExpense', { roomId: first.room_id }) : undefined),
    },
  ] as const;
  const stepsDone = steps.filter((x) => x.done).length;
  // a new member first sees the welcome card; the list follows once they have a Room
  const showSetup = !!data && !fresh && !setupHidden && stepsDone < steps.length;

  return (
    <View style={styles.bg}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <View style={[styles.heroRow, { flexDirection: rowDirection() }]}>
            <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
            <Text style={styles.brand}>{t('app.name')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('help.open')}
              onPress={() => navigation.navigate('Help')}
              style={styles.helpBtn}
            >
              <Icon name="help" size={24} color={colors.heroText} />
            </Pressable>
          </View>
          {name ? <Text style={styles.hello}>{t('home.hello', { name })}</Text> : null}
        </View>

        <View style={styles.column}>
          <View style={styles.summarySpacer} />

          {error ? <Notice tone="error">{t('common.genericError')}</Notice> : null}

          {/* a new settlement stays on top until the member checks and acknowledges it */}
          {data?.open.map((o) => (
            <Pressable
              key={o.settlement_id}
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('Settlement', { roomId: o.room_id, settlementId: o.settlement_id })
              }
              style={({ pressed }) => [
                styles.pinned,
                { flexDirection: rowDirection() },
                pressed && styles.dim,
              ]}
            >
              <View style={styles.pinnedIcon}>
                <Icon name="coins" size={20} color={colors.accentText} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.pinnedTitle}>{t('push.settlementTitle', { room: o.room })}</Text>
                <Text style={styles.meta}>
                  {o.net < 0
                    ? t('settlement.toPay', { amount: money(-o.net, o) })
                    : o.net > 0
                      ? t('settlement.toReceive', { amount: money(o.net, o) })
                      : t('settlement.even')}
                  {' · '}
                  {t('push.settlementTap')}
                </Text>
              </View>
            </Pressable>
          ))}

          {showSetup ? (
            <View style={styles.setup}>
              <View style={[styles.setupHead, { flexDirection: rowDirection() }]}>
                <Text style={[styles.pinnedTitle, styles.flex]}>{t('setup.title')}</Text>
                <Text style={styles.meta}>
                  {localizeDigits(t('setup.progress', { done: stepsDone, total: steps.length }))}
                </Text>
              </View>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${(stepsDone / steps.length) * 100}%` }]} />
              </View>
              {steps.map((x) => (
                <Pressable
                  key={x.key}
                  accessibilityRole="button"
                  accessibilityState={{ checked: x.done, disabled: x.done }}
                  onPress={x.done ? undefined : x.go}
                  style={({ pressed }) => [
                    styles.stepRow,
                    { flexDirection: rowDirection() },
                    pressed && styles.dim,
                  ]}
                >
                  <View style={[styles.stepDot, x.done && styles.stepDotDone]}>
                    {x.done ? <Icon name="check" size={14} color={colors.primaryText} /> : null}
                  </View>
                  <Text style={[styles.stepText, x.done && styles.stepTextDone]}>{t(`setup.${x.key}`)}</Text>
                  {!x.done ? (
                    <View style={rowDirection() === 'row-reverse' ? styles.flip : null}>
                      <Icon name="chevron" size={16} color={colors.textMuted} />
                    </View>
                  ) : null}
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => void hideSetup()} style={styles.link}>
                <Text style={styles.linkText}>{t('setup.hide')}</Text>
              </Pressable>
            </View>
          ) : null}
          <WebPushCard compact />

          {fresh && data.pending.length > 0 ? (
            <View style={styles.emptyCard}>
              <EmptyState
                art="waiting"
                title={t('home.waitingTitle')}
                body={t('home.waitingBody', { count: data.pending.length })}
                secondary={{ label: t('home.joinAnother'), onPress: () => navigation.navigate('JoinRoom') }}
              />
            </View>
          ) : fresh ? (
            <View style={styles.emptyCard}>
              <EmptyState
                art="welcome"
                title={name ? t('home.welcomeName', { name }) : t('home.welcomeTitle')}
                body={t('home.emptyBody')}
                action={{ label: t('home.createShort'), onPress: () => navigation.navigate('CreateRoom') }}
                secondary={{ label: t('home.joinWithCode'), onPress: () => navigation.navigate('JoinRoom') }}
              />
            </View>
          ) : null}

          {!fresh ? (
            <>
              <View style={[styles.sectionRow, { flexDirection: rowDirection() }]}>
                <Text style={styles.section}>{t('home.title')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('JoinRoom')}
                  style={styles.link}
                >
                  <Text style={styles.linkText}>{t('home.joinShort')}</Text>
                </Pressable>
              </View>

              {data && data.pending.length > 0 ? (
                <Notice tone="info">{t('home.pendingCount', { count: data.pending.length })}</Notice>
              ) : null}

              {rooms.map((r) => (
                <RoomRow
                  key={r.room_id}
                  r={r}
                  money={money}
                  onPress={() => navigation.navigate('Room', { roomId: r.room_id })}
                />
              ))}

              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('CreateRoom')}
                style={({ pressed }) => [styles.create, pressed && styles.dim]}
              >
                <Text style={styles.createText}>{t('home.createShort')}</Text>
              </Pressable>
            </>
          ) : null}
          <AdSlot screen="Home" />
        </View>
      </ScrollView>
      <BottomBar current="Home" unread={data?.unread ?? 0} />
    </View>
  );
}

function RoomRow({
  r,
  money,
  onPress,
}: {
  r: RoomOverview;
  money: (v: number, r: RoomOverview) => string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const net = r.my_paid - r.my_share;
  const extras = [
    r.pending_requests ? t('home.waitingToJoin', { count: r.pending_requests }) : null,
    r.open_needs ? t('home.openNeeds', { count: r.open_needs }) : null,
  ].filter(Boolean);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.room, { flexDirection: rowDirection() }, pressed && styles.dim]}
    >
      <Avatar name={r.name} size={44} />
      <View style={styles.flex}>
        <Text style={styles.roomName} numberOfLines={1}>
          {r.name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {localizeDigits(
            t('home.roomLine', {
              members: t('room.memberCount', { count: r.members }),
              total: money(r.total, r),
            }),
          )}
        </Text>
        {extras.length ? <Text style={styles.extra}>{localizeDigits(extras.join(' · '))}</Text> : null}
      </View>
      <Text
        style={[
          styles.net,
          { color: net < 0 ? colors.payText : net > 0 ? colors.success : colors.textMuted },
        ]}
      >
        {net === 0 ? t('room.settled') : (net > 0 ? '+' : '−') + money(Math.abs(net), r)}
      </Text>
    </Pressable>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: space.xxl },
    flex: { flex: 1 },
    dim: { opacity: 0.7 },
    hero: {
      backgroundColor: colors.hero,
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      gap: space.md,
    },
    heroRow: { alignItems: 'center', gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
    logo: { width: 40, height: 40, borderRadius: 10 },
    brand: { flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.heroText },
    helpBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    setup: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.md,
      marginBottom: space.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.xs,
    },
    setupHead: { alignItems: 'center', gap: space.md },
    bar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.getBg,
      overflow: 'hidden',
      marginVertical: space.xs,
    },
    barFill: { height: 6, borderRadius: 3, backgroundColor: colors.success },
    stepRow: { alignItems: 'center', gap: space.md, minHeight: 44 },
    stepDot: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDotDone: { backgroundColor: colors.success, borderColor: colors.success },
    stepText: { flex: 1, fontSize: font.md, color: colors.text, fontWeight: '600' },
    stepTextDone: { color: colors.textMuted, textDecorationLine: 'line-through', fontWeight: '400' },
    flip: { transform: [{ scaleX: -1 }] },
    emptyCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      paddingHorizontal: space.lg,
      marginBottom: space.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    hello: { fontSize: font.md, color: colors.heroMuted, width: '100%', maxWidth: 560, alignSelf: 'center' },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg },
    summarySpacer: { height: space.lg },
    pinned: {
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.warnBg,
      borderRadius: radius.lg,
      padding: space.md,
      marginBottom: space.md,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    pinnedIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinnedTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
    sectionRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
    section: { fontSize: font.lg, fontWeight: '700', color: colors.text },
    link: { minHeight: 44, justifyContent: 'center' },
    linkText: { fontSize: font.md, fontWeight: '700', color: colors.primary },
    room: {
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.md,
      marginBottom: space.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomName: { fontSize: font.md, fontWeight: '700', color: colors.text },
    meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    extra: { fontSize: font.sm, color: colors.payText, marginTop: 2, fontWeight: '600' },
    net: { fontSize: font.md, fontWeight: '700' },
    create: {
      minHeight: 52,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space.lg,
    },
    createText: { fontSize: font.md, fontWeight: '700', color: colors.primary },
  }),
);
