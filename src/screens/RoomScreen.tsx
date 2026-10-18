import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, Cycle, OPEN_FLAG } from '../lib/api';
import { getCountry, LanguageCode } from '../lib/countries';
import { dbErrorKey } from '../lib/errors';
import { formatMoney } from '../lib/money';
import { todayIn } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Chip, ChipRow, Meta, Notice, Row, Spacer } from '../ui/components';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, radius, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Room'>;
type Tab = 'expenses' | 'balances' | 'settlements';

export function RoomScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [tab, setTab] = useState<Tab>('expenses');
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  useLayoutEffect(() => {
    if (data) navigation.setOptions({ title: data.room.name });
  }, [navigation, data]);

  if (!data) {
    return (
      <View style={styles.bg}>
        <View style={styles.pad}>
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
  const lang = (i18n.language as LanguageCode) ?? 'en';
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
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

  async function settle() {
    if (!cur) return;
    setActionError(null);
    const msg =
      t('cycle.settleConfirm', { range: range(cur) }) + (running ? `\n\n${t('cycle.settleEarlyNote')}` : '');
    if (!(await confirm(msg, t('common.yes'), t('common.no')))) return;
    setBusy(true);
    try {
      const sid = await api.generateSettlement(cur.id);
      await refreshAll();
      navigation.navigate('Settlement', { roomId, settlementId: sid });
    } catch (e) {
      setActionError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setActionError(null);
    if (!(await confirm(t('room.leaveConfirm'), t('common.yes'), t('common.no')))) return;
    try {
      await api.leaveRoom(roomId);
      navigation.popToTop();
    } catch (e) {
      setActionError(t(dbErrorKey(e as { message?: string })));
    }
  }

  const expenses = detail.data?.expenses ?? [];
  const balances = detail.data?.balances ?? [];
  const live = expenses.filter((e) => !e.deleted_at);
  const total = live.reduce((s, e) => s + (e.is_credit ? -e.amount : e.amount), 0);

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading || detail.loading} onRefresh={refreshAll} />}
    >
      <View style={styles.column}>
        <Card>
          <Row>
            <Text style={styles.cardTitle}>{t('room.settings')}</Text>
            {isAdmin ? (
              <Button
                title={t('settings.open')}
                variant="link"
                onPress={() => navigation.navigate('RoomSettings', { roomId })}
              />
            ) : null}
          </Row>
          <Meta>
            {getCountry(room.country_code)?.names[lang] ?? room.country_code} · {room.currency} ·{' '}
            {room.time_zone.replace(/_/g, ' ')} · {t(`room.cycle_${room.settlement_cycle}`)}
          </Meta>
          {room.pending_time_zone || room.pending_settlement_cycle ? (
            <Meta>
              {t('settings.pending', {
                what: [
                  room.pending_time_zone?.replace(/_/g, ' '),
                  room.pending_settlement_cycle ? t(`room.cycle_${room.pending_settlement_cycle}`) : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              })}
            </Meta>
          ) : null}
          <Spacer size="sm" />
          <Meta>{t('room.joinCode')}</Meta>
          <Text selectable style={styles.code}>
            {room.join_code}
          </Text>
          <Meta>{t('room.joinCodeHint')}</Meta>
        </Card>

        {actionError ? <Notice tone="error">{actionError}</Notice> : null}
        {isAdmin && pendingCount > 0 ? (
          <Notice tone="info">{t('home.pendingCount', { count: pendingCount })}</Notice>
        ) : null}

        <Button title={t('room.addExpense')} onPress={() => navigation.navigate('AddExpense', { roomId })} />
        <Button
          title={`${t('room.members')} (${members.filter((m) => m.status === 'approved').length})`}
          variant="secondary"
          onPress={() => navigation.navigate('RoomMembers', { roomId })}
        />

        <Row>
          <View style={styles.flex}>
            <Button
              title={`${t('need.title')}${openNeeds ? ` (${openNeeds})` : ''}`}
              variant="secondary"
              onPress={() => navigation.navigate('Needs', { roomId })}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title={`${t('flag.list')}${openFlags.length ? ` (${openFlags.length})` : ''}`}
              variant={openFlags.length ? 'danger' : 'secondary'}
              onPress={() => navigation.navigate('Disputes', { roomId })}
            />
          </View>
        </Row>

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
                <>
                  <Spacer size="sm" />
                  <Button
                    title={t(running ? 'cycle.settleEarly' : 'cycle.settle')}
                    variant="secondary"
                    loading={busy}
                    onPress={settle}
                  />
                </>
              ) : null}
            </Card>
          </>
        ) : null}

        {tab === 'expenses' ? (
          <>
            {expenses.length === 0 && !detail.loading ? <Body muted>{t('room.noExpenses')}</Body> : null}
            {expenses.map((e) => (
              <Card
                key={e.id}
                onPress={() => navigation.navigate('ExpenseDetail', { roomId, expenseId: e.id })}
              >
                <Row>
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, e.deleted_at ? styles.struck : null]}>{e.title}</Text>
                    <Meta>
                      {e.expense_date} · {nameOf(e.paid_by)}
                      {e.split_mode === 'selected' ? ` · ${t('split.selected')}` : ''}
                    </Meta>
                    {e.adjusts_expense_id ? <Badge tone="warn">{t('adjust.label')}</Badge> : null}
                    {disputed.has(e.id) ? <Badge tone="bad">{t('flag.badge')}</Badge> : null}
                  </View>
                  <View style={styles.end}>
                    <Text style={[styles.amount, e.deleted_at ? styles.struck : null]}>
                      {money(e.is_credit ? -e.amount : e.amount)}
                    </Text>
                    {e.deleted_at ? <Text style={styles.deleted}>{t('expense.deleted')}</Text> : null}
                  </View>
                </Row>
              </Card>
            ))}
          </>
        ) : null}

        {tab === 'balances' ? (
          <>
            <Card>
              <Row>
                <Text style={styles.itemTitle}>{t('room.total')}</Text>
                <Text style={styles.amount}>{money(total)}</Text>
              </Row>
            </Card>
            {balances.map((b) => (
              <Card key={b.user_id}>
                <Row>
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
                    <Text style={styles.amount}>{formatMoney(s.total, s.currency, s.currency_decimals)}</Text>
                  </Row>
                </Card>
              );
            })}
          </>
        ) : null}

        <Spacer size="xxl" />
        <Button title={t('room.leave')} variant="link" onPress={leave} />
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    pad: { padding: space.lg, paddingBottom: space.xxl },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    flex: { flex: 1 },
    end: { alignItems: 'flex-end' },
    cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
    code: {
      fontSize: font.xl,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.text,
      marginVertical: space.xs,
    },
    tabs: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 3,
      marginVertical: space.lg,
    },
    tab: { flex: 1, paddingVertical: space.sm, borderRadius: radius.sm, alignItems: 'center' },
    tabOn: { backgroundColor: colors.primary },
    tabText: { fontWeight: '600', color: colors.text, fontSize: font.sm },
    tabTextOn: { color: colors.primaryText },
    itemTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
    amount: { fontSize: font.md, fontWeight: '700', color: colors.text },
    struck: { textDecorationLine: 'line-through', color: colors.textMuted },
    deleted: { fontSize: font.sm, color: colors.danger },
  }),
);
