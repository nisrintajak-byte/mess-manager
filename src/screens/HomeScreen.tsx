import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { api, RoomOverview } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { formatMoney } from '../lib/money';
import type { AppStackParamList } from '../navigation/types';
import { AdSlot } from '../ui/AdSlot';
import { Avatar } from '../ui/Avatar';
import { BottomBar } from '../ui/BottomBar';
import { Body, Notice } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { Icon, IconName } from '../ui/Icon';
import { RoomPicker } from '../ui/RoomPicker';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';
import { WebPushCard } from '../ui/WebPushCard';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;
type Action = 'add' | 'need' | 'settle' | 'reports';

const LOGO = require('../../assets/icon.png');

/**
 * Home (founder's design A + C's four big buttons, 2026-10-20): brand band, what I pay or
 * receive this period, pinned settlements, quick actions, Rooms, and the bottom menu.
 */
export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [picking, setPicking] = useState<Action | null>(null);
  const { data, error, loading, reload } = useLoader(async () => {
    const [rooms, pending, unread, open] = await Promise.all([
      api.myRoomsOverview(),
      api.myPendingRequests(),
      api.unreadCount().catch(() => 0),
      api.myOpenSettlements().catch(() => []),
    ]);
    return { rooms, pending, unread, open };
  });
  const name = (session?.user.user_metadata?.display_name as string | undefined) ?? '';
  const rooms = data?.rooms ?? [];
  const money = (v: number, r: { currency: string; decimals: number }) =>
    localizeDigits(formatMoney(v, r.currency, r.decimals));

  // one total only when every Room uses the same currency
  const oneCurrency = rooms.length > 0 && rooms.every((r) => r.currency === rooms[0]?.currency);
  const first = rooms[0];
  const pay = rooms.reduce((s, r) => s + Math.max(r.my_share - r.my_paid, 0), 0);
  const get = rooms.reduce((s, r) => s + Math.max(r.my_paid - r.my_share, 0), 0);

  function go(action: Action, roomId: string) {
    setPicking(null);
    if (action === 'add') return navigation.navigate('AddExpense', { roomId });
    if (action === 'need') return navigation.navigate('Needs', { roomId });
    if (action === 'reports') return navigation.navigate('Reports', { roomId });
    const open = data?.open.find((o) => o.room_id === roomId);
    if (open) return navigation.navigate('Settlement', { roomId, settlementId: open.settlement_id });
    return navigation.navigate('Room', { roomId, tab: 'balances' });
  }
  function quick(action: Action) {
    if (rooms.length === 0) return navigation.navigate('CreateRoom');
    if (rooms.length === 1 && first) return go(action, first.room_id);
    setPicking(action);
  }

  const tiles: { key: Action; icon: IconName; label: string; bg: string; fg: string }[] = [
    { key: 'add', icon: 'plus', label: t('home.quickAdd'), bg: colors.getBg, fg: colors.getText },
    { key: 'need', icon: 'bag', label: t('home.quickNeed'), bg: colors.payBg, fg: colors.payText },
    { key: 'settle', icon: 'check', label: t('home.quickSettle'), bg: colors.successBg, fg: colors.success },
    { key: 'reports', icon: 'file', label: t('home.quickReports'), bg: colors.surface, fg: colors.text },
  ];

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
          </View>
          {name ? <Text style={styles.hello}>{t('home.hello', { name })}</Text> : null}
        </View>

        <View style={styles.column}>
          {oneCurrency && first ? (
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>{t('home.acrossRooms')}</Text>
              <View style={[styles.summaryRow, { flexDirection: rowDirection() }]}>
                <View style={[styles.tile, { backgroundColor: colors.payBg }]}>
                  <Text style={[styles.tileLabel, { color: colors.payText }]}>{t('home.youPay')}</Text>
                  <Text style={[styles.tileValue, { color: colors.payText }]}>{money(pay, first)}</Text>
                </View>
                <View style={[styles.tile, { backgroundColor: colors.getBg }]}>
                  <Text style={[styles.tileLabel, { color: colors.getText }]}>{t('home.youReceive')}</Text>
                  <Text style={[styles.tileValue, { color: colors.getText }]}>{money(get, first)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.summarySpacer} />
          )}

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

          <WebPushCard compact />

          <View style={styles.grid}>
            {tiles.map((x) => (
              <Pressable
                key={x.key}
                accessibilityRole="button"
                accessibilityLabel={x.label}
                onPress={() => quick(x.key)}
                style={({ pressed }) => [styles.action, { backgroundColor: x.bg }, pressed && styles.dim]}
              >
                <Icon name={x.icon} size={28} color={x.fg} />
                <Text style={[styles.actionText, { color: x.fg }]}>{x.label}</Text>
              </Pressable>
            ))}
          </View>

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
          {data && rooms.length === 0 ? <Body muted>{t('home.empty')}</Body> : null}

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
          <AdSlot screen="Home" />
        </View>
      </ScrollView>
      <BottomBar current="Home" unread={data?.unread ?? 0} />
      <RoomPicker
        rooms={rooms}
        visible={picking !== null}
        onClose={() => setPicking(null)}
        onPick={(id) => picking && go(picking, id)}
      />
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
          {localizeDigits(t('home.roomLine', { members: r.members, total: money(r.total, r) }))}
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
    hero: { backgroundColor: colors.hero, paddingHorizontal: space.lg, paddingBottom: 56, gap: space.md },
    heroRow: { alignItems: 'center', gap: space.md, width: '100%', maxWidth: 560, alignSelf: 'center' },
    logo: { width: 40, height: 40, borderRadius: 10 },
    brand: { fontSize: font.lg, fontWeight: '700', color: colors.heroText },
    hello: { fontSize: font.md, color: colors.heroMuted, width: '100%', maxWidth: 560, alignSelf: 'center' },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg },
    summary: {
      marginTop: -40,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.lg,
      marginBottom: space.lg,
      gap: space.md,
      shadowColor: '#14202B',
      shadowOpacity: 0.1,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    summarySpacer: { height: space.lg },
    summaryLabel: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
    summaryRow: { gap: space.md },
    tile: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
    tileLabel: { fontSize: font.sm },
    tileValue: { fontSize: font.xl, fontWeight: '700' },
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg },
    action: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: 100,
      borderRadius: radius.lg,
      padding: space.md,
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionText: { fontSize: font.md, fontWeight: '700' },
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
