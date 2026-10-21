import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import { api, Cycle, OPEN_FLAG } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { dbErrorKey } from '../lib/errors';
import { estimateBalances } from '../lib/estimate';
import { formatMoney } from '../lib/money';
import { useOutbox } from '../lib/outbox';
import { shiftDay, todayIn } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Chip, ChipRow, Meta, Notice, Row, Spacer } from '../ui/components';
import { AdSlot } from '../ui/AdSlot';
import { DateInput } from '../ui/DateInput';
import { Avatar } from '../ui/Avatar';
import { Icon, IconName } from '../ui/Icon';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Room'>;
type Tab = 'expenses' | 'balances' | 'settlements';

/** Long lists are drawn in pages so low-memory phones stay smooth (PRD §21). */
const PAGE = 50;

export function RoomScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const me = session?.user.id;
  const [tab, setTab] = useState<Tab>(route.params.tab ?? 'expenses');
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settleUntil, setSettleUntil] = useState<string | null>(null);
  const [page, setPage] = useState<{ cycle: string; n: number }>({ cycle: '', n: PAGE });
  const queued = useOutbox().filter((i) => i.roomId === roomId && i.userId === me);
  const queuedCount = queued.length;

  const { data, error, loading, reload } = useLoader(async () => {
    const [room, members, cycles, settlements, flags, needs] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.cycles(roomId),
      api.settlements(roomId),
      api.roomFlags(roomId),
      api.needs(roomId),
    ]);
    return { room, members, cycles, settlements, flags, needs };
  }, roomId);

  const cycles = data?.cycles ?? [];
  const selected: Cycle | undefined = cycles.find((c) => c.id === cycleId) ?? cycles[0];

  const detail = useLoader(async () => {
    if (!selected) return null;
    const [expenses, balances] = await Promise.all([
      api.cycleExpenses(selected.id),
      api.cycleBalances(selected.id),
    ]);
    return { expenses, balances };
  }, selected?.id ?? '');

  // a different cycle starts again at the first page
  const shown = page.cycle === (selected?.id ?? '') ? page.n : PAGE;

  useLayoutEffect(() => {
    if (data) navigation.setOptions({ title: data.room.name });
  }, [navigation, data]);

  // When a waiting item reaches the server, reload so the official list replaces the waiting card.
  useEffect(() => {
    void Promise.all([reload(), detail.reload()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedCount]);

  if (!data) {
    return (
      <View style={styles.bg}>
        <View style={styles.column}>
          {error ? (
            <Notice tone="error">{t(dbErrorKey(error as { message?: string }))}</Notice>
          ) : (
            <Body muted>{t('common.loading')}</Body>
          )}
        </View>
      </View>
    );
  }

  const { room, members, settlements, flags, needs } = data;
  const openFlags = flags.filter((f) => OPEN_FLAG.includes(f.status));
  const disputed = new Set(openFlags.map((f) => f.target_id));
  const openNeeds = needs.filter((n) => n.status === 'pending' || n.status === 'accepted').length;
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const photoOf = (uid: string) => members.find((m) => m.user_id === uid)?.profile?.avatar_url ?? null;
  const mine = members.find((m) => m.user_id === me && m.status === 'approved');
  const isAdmin = mine?.role === 'admin';
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const cur = selected;
  const money = (v: number) =>
    formatMoney(v, cur?.currency ?? room.currency, cur?.currency_decimals ?? room.currency_decimals);
  const range = (c: Cycle) => t('cycle.range', { from: c.starts_on, to: c.ends_on });
  const today = todayIn(room.time_zone);
  const settlementFor = (c: Cycle) => settlements.find((s) => s.cycle_id === c.id);
  const running = cur ? cur.ends_on >= today : false;

  async function refreshAll() {
    await reload();
    await detail.reload();
  }

  // last day the settlement covers: the cycle's end, or yesterday while it is still running
  const defaultUntil = cur ? (cur.ends_on < today ? cur.ends_on : shiftDay(today, -1)) : '';
  async function settle() {
    if (!cur || !settleUntil) return;
    setActionError(null);
    if (settleUntil < cur.starts_on || settleUntil > defaultUntil) {
      setActionError(t('cycle.untilInvalid', { from: cur.starts_on, to: defaultUntil }));
      return;
    }
    const msg =
      t('cycle.settleConfirm', { range: t('cycle.range', { from: cur.starts_on, to: settleUntil }) }) +
      (settleUntil < cur.ends_on ? `\n\n${t('cycle.settleUntilNote', { date: settleUntil })}` : '');
    if (!(await confirm(msg, t('common.yes'), t('common.no')))) return;
    setBusy(true);
    try {
      const sid = await api.generateSettlementUntil(cur.id, settleUntil);
      setSettleUntil(null);
      await refreshAll();
      navigation.navigate('Settlement', { roomId, settlementId: sid });
    } catch (e) {
      setActionError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  const expenses = detail.data?.expenses ?? [];
  const officialBalances = detail.data?.balances ?? [];
  const waitingCreates = queued.filter((i) => i.type === 'expense_create' && i.status === 'waiting');
  const isEstimate = waitingCreates.length > 0 && cur?.id === cycles[0]?.id;
  const waitingSum = waitingCreates.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const balances = isEstimate
    ? estimateBalances(
        officialBalances,
        waitingCreates.map((i) => ({
          userId: i.userId,
          amount: i.amount ?? 0,
          participants: (i.payload.participants as string[] | null) ?? null,
        })),
        members.filter((m) => m.status === 'approved').map((m) => m.user_id),
      )
    : officialBalances;
  const live = expenses.filter((e) => !e.deleted_at);
  const total = live.reduce((s, e) => s + (e.is_credit ? -e.amount : e.amount), 0);

  const myBal = balances.find((b) => b.user_id === me);
  const myNet = myBal?.net ?? 0;
  const approvedCount = members.filter((m) => m.status === 'approved').length;
  const chips: {
    key: string;
    icon: IconName;
    label: string;
    badge?: number;
    alert?: boolean;
    onPress: () => void;
  }[] = [
    {
      key: 'members',
      icon: 'users',
      label: t('room.members'),
      badge: isAdmin && pendingCount ? pendingCount : undefined,
      onPress: () => navigation.navigate('RoomMembers', { roomId }),
    },
    {
      key: 'needs',
      icon: 'bag',
      label: t('need.title'),
      badge: openNeeds || undefined,
      onPress: () => navigation.navigate('Needs', { roomId }),
    },
    {
      key: 'disputes',
      icon: 'flag',
      label: t('flag.list'),
      badge: openFlags.length || undefined,
      alert: openFlags.length > 0,
      onPress: () => navigation.navigate('Disputes', { roomId }),
    },
    {
      key: 'reports',
      icon: 'file',
      label: t('report.title'),
      onPress: () => navigation.navigate('Reports', { roomId, cycleId: cur?.id }),
    },
    {
      key: 'settings',
      icon: 'gear',
      label: t('room.settings'),
      onPress: () => navigation.navigate('RoomInfo', { roomId }),
    },
  ];

  return (
    <View style={styles.bg}>
      <ScrollView
        style={styles.bg}
        contentContainerStyle={styles.scrollPad}
        refreshControl={<RefreshControl refreshing={loading || detail.loading} onRefresh={refreshAll} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroInner}>
            <Text style={styles.heroMeta}>
              {cur ? localizeDigits(range(cur)) + ' · ' : ''}
              {room.currency} · {localizeDigits(t('room.memberCount', { count: approvedCount }))}
            </Text>
            <View style={[styles.stats, { flexDirection: rowDirection() }]}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('room.total')}</Text>
                <Text style={styles.statValue}>
                  {localizeDigits(money(total + (isEstimate ? waitingSum : 0)))}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>{t('room.youPaid')}</Text>
                <Text style={styles.statValue}>{localizeDigits(money(myBal?.paid ?? 0))}</Text>
              </View>
              <View style={[styles.stat, myNet < 0 ? styles.statPay : null]}>
                <Text style={[styles.statLabel, myNet < 0 ? styles.statPayText : null]}>
                  {t(myNet < 0 ? 'home.youPay' : myNet > 0 ? 'home.youReceive' : 'room.settled')}
                </Text>
                <Text style={[styles.statValue, myNet < 0 ? styles.statPayText : null]}>
                  {localizeDigits(money(Math.abs(myNet)))}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.column}>
          <View style={styles.chips}>
            {chips.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityLabel={c.badge ? `${c.label} (${c.badge})` : c.label}
                onPress={c.onPress}
                style={({ pressed }) => [
                  styles.chip,
                  { flexDirection: rowDirection() },
                  c.alert ? styles.chipAlert : null,
                  pressed && styles.dim,
                ]}
              >
                <Icon name={c.icon} size={18} color={c.alert ? colors.danger : colors.primary} />
                <Text style={[styles.chipText, c.alert ? { color: colors.danger } : null]}>{c.label}</Text>
                {c.badge ? (
                  <View style={styles.chipBadge}>
                    <Text style={styles.chipBadgeText}>{localizeDigits(String(c.badge))}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          {/* PRD §8.1/8.3: a Room settings change waiting for the next cycle is shown to everyone */}
          {room.pending_time_zone || room.pending_settlement_cycle ? (
            <Notice tone="info">
              {t('settings.pending', {
                what: [
                  room.pending_time_zone?.replace(/_/g, ' '),
                  room.pending_settlement_cycle ? t(`room.cycle_${room.pending_settlement_cycle}`) : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              })}
            </Notice>
          ) : null}
          {actionError ? <Notice tone="error">{actionError}</Notice> : null}
          {isAdmin && pendingCount > 0 ? (
            <Notice tone="info">{t('home.pendingCount', { count: pendingCount })}</Notice>
          ) : null}

          <View style={styles.tabs}>
            {(['expenses', 'balances', 'settlements'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[styles.tab, tab === k && styles.tabOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
              >
                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>
                  {t(
                    k === 'expenses'
                      ? 'room.tabExpenses'
                      : k === 'balances'
                        ? 'room.tabBalances'
                        : 'settlement.list',
                  )}
                </Text>
              </Pressable>
            ))}
          </View>

          {tab !== 'settlements' && cur ? (
            <>
              {cycles.length > 1 ? (
                <ChipRow>
                  {cycles.slice(0, 6).map((c, i) => (
                    <Chip
                      key={c.id}
                      on={c.id === cur.id}
                      onPress={() => setCycleId(c.id)}
                      label={i === 0 ? t('cycle.current') : range(c)}
                    />
                  ))}
                </ChipRow>
              ) : null}
              <Card>
                <Row>
                  <View style={styles.flex}>
                    <Text style={styles.itemTitle}>{range(cur)}</Text>
                    <Meta>{t(`cycle.kind_${cur.kind}`)}</Meta>
                  </View>
                  <Badge tone={cur.status === 'locked' ? 'good' : 'neutral'}>
                    {t(cur.status === 'locked' ? 'cycle.locked' : 'cycle.open')}
                  </Badge>
                </Row>
                {cur.status === 'locked' ? (
                  <>
                    <Meta>{t('cycle.lockedNote')}</Meta>
                    {settlementFor(cur) ? (
                      <Button
                        title={t('cycle.viewSettlement')}
                        variant="link"
                        onPress={() =>
                          navigation.navigate('Settlement', { roomId, settlementId: settlementFor(cur)!.id })
                        }
                      />
                    ) : null}
                  </>
                ) : isAdmin && cur.starts_on < today ? (
                  settleUntil === null ? (
                    <>
                      <Spacer size="sm" />
                      <Button
                        title={t('cycle.settle')}
                        variant="secondary"
                        onPress={() => setSettleUntil(defaultUntil)}
                      />
                    </>
                  ) : (
                    <>
                      <Spacer size="sm" />
                      <Body>{t('cycle.untilQuestion')}</Body>
                      <ChipRow>
                        <Chip
                          on={settleUntil === defaultUntil}
                          onPress={() => setSettleUntil(defaultUntil)}
                          label={t(running ? 'cycle.untilYesterday' : 'cycle.untilEnd')}
                        />
                      </ChipRow>
                      <DateInput label={t('cycle.untilDate')} value={settleUntil} onChange={setSettleUntil} />
                      <Meta>{t('cycle.untilHint')}</Meta>
                      <Spacer size="sm" />
                      <Button
                        title={t('cycle.settleNow')}
                        loading={busy}
                        disabled={!settleUntil}
                        onPress={settle}
                      />
                      <Button
                        title={t('common.cancel')}
                        variant="link"
                        onPress={() => setSettleUntil(null)}
                      />
                    </>
                  )
                ) : null}
              </Card>
            </>
          ) : null}

          {tab === 'expenses' ? (
            <>
              {queued.map((i) => (
                <Card key={i.id} onPress={() => navigation.navigate('Sync')}>
                  <Row>
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{i.label}</Text>
                      <Meta>{t(`sync.type_${i.type}`)}</Meta>
                      <Badge tone={i.status === 'failed' ? 'bad' : 'warn'}>
                        {t(i.status === 'failed' ? 'sync.failed' : 'sync.badge')}
                      </Badge>
                    </View>
                    {i.amountText ? <Text style={styles.amount}>{i.amountText}</Text> : null}
                  </Row>
                </Card>
              ))}
              {expenses.length === 0 && queued.length === 0 && !detail.loading ? (
                <Body muted>{t('room.noExpenses')}</Body>
              ) : null}
              {expenses.slice(0, shown).map((e) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('ExpenseDetail', { roomId, expenseId: e.id })}
                  style={({ pressed }) => [
                    styles.item,
                    { flexDirection: rowDirection() },
                    pressed && styles.dim,
                  ]}
                >
                  <Avatar name={nameOf(e.paid_by)} muted={!!e.deleted_at} photo={photoOf(e.paid_by)} />
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, e.deleted_at ? styles.struck : null]} numberOfLines={2}>
                      {e.title}
                    </Text>
                    <Meta>
                      {localizeDigits(e.expense_date)} · {nameOf(e.paid_by)}
                      {e.split_mode === 'selected' ? ` · ${t('split.selected')}` : ''}
                    </Meta>
                    {e.adjusts_expense_id ? <Badge tone="warn">{t('adjust.label')}</Badge> : null}
                    {e.late_entry_from ? (
                      <Badge tone="warn">{t('sync.lateEntry', { date: e.late_entry_from })}</Badge>
                    ) : null}
                    {disputed.has(e.id) ? <Badge tone="bad">{t('flag.badge')}</Badge> : null}
                  </View>
                  <View style={styles.end}>
                    <Text style={[styles.amount, e.deleted_at ? styles.struck : null]}>
                      {localizeDigits(money(e.is_credit ? -e.amount : e.amount))}
                    </Text>
                    {e.deleted_at ? <Text style={styles.deleted}>{t('expense.deleted')}</Text> : null}
                  </View>
                </Pressable>
              ))}
              {expenses.length > shown ? (
                <Button
                  title={localizeDigits(t('room.showMore', { count: expenses.length - shown }))}
                  variant="secondary"
                  onPress={() => setPage({ cycle: selected?.id ?? '', n: shown + PAGE })}
                />
              ) : null}
            </>
          ) : null}

          {tab === 'balances' ? (
            <>
              {isEstimate ? <Notice tone="info">{t('sync.estimated')}</Notice> : null}
              <Card>
                <Row>
                  <Text style={styles.itemTitle}>{t('room.total')}</Text>
                  <Text style={styles.amount}>{money(total + (isEstimate ? waitingSum : 0))}</Text>
                </Row>
              </Card>
              {balances.map((b) => (
                <Card key={b.user_id}>
                  <Row>
                    <Avatar name={nameOf(b.user_id)} photo={photoOf(b.user_id)} />
                    <View style={styles.flex}>
                      <Text style={styles.itemTitle}>{nameOf(b.user_id)}</Text>
                      <Meta>
                        {t('room.paid')} {money(b.paid)} · {t('room.share')} {money(b.share)}
                      </Meta>
                    </View>
                    <Text style={[styles.amount, { color: b.net < 0 ? colors.danger : colors.success }]}>
                      {b.net === 0
                        ? t('room.settled')
                        : b.net > 0
                          ? t('room.getsBack', { amount: money(b.net) })
                          : t('room.owes', { amount: money(-b.net) })}
                    </Text>
                  </Row>
                </Card>
              ))}
              <Body muted>{t('room.balancesNote')}</Body>
            </>
          ) : null}

          {tab === 'settlements' ? (
            <>
              {settlements.length === 0 ? <Body muted>{t('settlement.none')}</Body> : null}
              {settlements.map((s) => {
                const c = cycles.find((x) => x.id === s.cycle_id);
                return (
                  <Card
                    key={s.id}
                    onPress={() => navigation.navigate('Settlement', { roomId, settlementId: s.id })}
                  >
                    <Row>
                      <Text style={styles.itemTitle}>{c ? range(c) : s.generated_at.slice(0, 10)}</Text>
                      <Text style={styles.amount}>
                        {formatMoney(s.total, s.currency, s.currency_decimals)}
                      </Text>
                    </Row>
                  </Card>
                );
              })}
            </>
          ) : null}

          <Spacer size="xl" />
          <AdSlot screen="Room" />
        </View>
      </ScrollView>
      <View
        style={[styles.actionBar, { flexDirection: rowDirection(), paddingBottom: insets.bottom + space.md }]}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Needs', { roomId })}
          style={({ pressed }) => [styles.needBtn, { flexDirection: rowDirection() }, pressed && styles.dim]}
        >
          <Icon name="bag" size={20} color={colors.payText} />
          <Text style={styles.needText}>{t('room.needSomething')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('AddExpense', { roomId })}
          style={({ pressed }) => [styles.addBtn, { flexDirection: rowDirection() }, pressed && styles.dim]}
        >
          <Icon name="plus" size={20} color={colors.primaryText} />
          <Text style={styles.addText}>{t('room.addExpense')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    scrollPad: { paddingBottom: space.xxl },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: space.lg },
    flex: { flex: 1 },
    dim: { opacity: 0.7 },
    end: { alignItems: 'flex-end' },
    hero: {
      backgroundColor: colors.hero,
      paddingHorizontal: space.lg,
      paddingBottom: space.lg,
      paddingTop: space.xs,
    },
    heroInner: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.md },
    heroMeta: { fontSize: font.sm, color: colors.heroMuted },
    stats: { gap: space.sm },
    stat: { flex: 1, backgroundColor: colors.heroTile, borderRadius: radius.md, padding: space.md, gap: 2 },
    statLabel: { fontSize: 12, color: colors.heroMuted },
    statValue: { fontSize: font.md, fontWeight: '700', color: colors.heroText },
    statPay: { backgroundColor: colors.accent },
    statPayText: { color: colors.accentText },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: space.sm,
      marginTop: space.lg,
      marginBottom: space.md,
    },
    chip: {
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: space.md,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipAlert: { borderColor: colors.danger, backgroundColor: colors.dangerBg },
    chipText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
    chipBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accentText },
    code: {
      fontSize: font.xl,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.text,
      marginVertical: space.xs,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginTop: space.sm,
      marginBottom: space.lg,
    },
    tab: {
      flex: 1,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomWidth: 3,
      borderBottomColor: 'transparent',
    },
    tabOn: { borderBottomColor: colors.primary },
    tabText: { fontWeight: '600', color: colors.textMuted, fontSize: font.md },
    tabTextOn: { color: colors.primary, fontWeight: '700' },
    item: {
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.md,
      marginBottom: space.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
    amount: { fontSize: font.md, fontWeight: '700', color: colors.text },
    struck: { textDecorationLine: 'line-through', color: colors.textMuted },
    deleted: { fontSize: font.sm, color: colors.danger },
    actionBar: {
      gap: space.md,
      paddingHorizontal: space.lg,
      paddingVertical: space.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    needBtn: {
      flex: 1,
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.payBg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
    },
    needText: { fontSize: font.md, fontWeight: '700', color: colors.payText },
    addBtn: {
      flex: 1.3,
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
    },
    addText: { fontSize: font.md, fontWeight: '700', color: colors.primaryText },
  }),
);
