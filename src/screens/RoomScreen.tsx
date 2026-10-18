import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import { getCountry, LanguageCode } from '../lib/countries';
import { dbErrorKey } from '../lib/errors';
import { formatMoney } from '../lib/money';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Notice, Row, Spacer } from '../ui/components';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, radius, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Room'>;

export function RoomScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [tab, setTab] = useState<'expenses' | 'balances'>('expenses');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, reload } = useLoader(async () => {
    const [room, members, expenses, balances] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.expenses(roomId),
      api.balances(roomId),
    ]);
    return { room, members, expenses, balances };
  }, roomId);

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

  const { room, members, expenses, balances } = data;
  const lang = (i18n.language as LanguageCode) ?? 'en';
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const mine = members.find((m) => m.user_id === me && m.status === 'approved');
  const isAdmin = mine?.role === 'admin';
  const pendingCount = members.filter((m) => m.status === 'pending').length;
  const money = (v: number) => formatMoney(v, room.currency, room.currency_decimals);
  const live = expenses.filter((e) => !e.deleted_at);
  const total = live.reduce((s, e) => s + e.amount, 0);

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

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        <Card>
          <Text style={styles.cardTitle}>{t('room.settings')}</Text>
          <Text style={styles.meta}>
            {getCountry(room.country_code)?.names[lang] ?? room.country_code} · {room.currency} ·{' '}
            {room.time_zone.replace(/_/g, ' ')} · {t(`room.cycle_${room.settlement_cycle}`)}
          </Text>
          <Spacer size="sm" />
          <Text style={styles.meta}>{t('room.joinCode')}</Text>
          <Text selectable style={styles.code}>
            {room.join_code}
          </Text>
          <Text style={styles.meta}>{t('room.joinCodeHint')}</Text>
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

        <View style={styles.tabs}>
          {(['expenses', 'balances'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[styles.tab, tab === k && styles.tabOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
            >
              <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>
                {t(k === 'expenses' ? 'room.tabExpenses' : 'room.tabBalances')}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'expenses' ? (
          <>
            {expenses.length === 0 ? <Body muted>{t('room.noExpenses')}</Body> : null}
            {expenses.map((e) => (
              <Card
                key={e.id}
                onPress={() => navigation.navigate('ExpenseDetail', { roomId, expenseId: e.id })}
              >
                <Row>
                  <View style={styles.flex}>
                    <Text style={[styles.itemTitle, e.deleted_at ? styles.struck : null]}>{e.title}</Text>
                    <Text style={styles.meta}>
                      {e.expense_date} · {nameOf(e.paid_by)}
                    </Text>
                  </View>
                  <View style={styles.end}>
                    <Text style={[styles.amount, e.deleted_at ? styles.struck : null]}>
                      {money(e.amount)}
                    </Text>
                    {e.deleted_at ? <Text style={styles.deleted}>{t('expense.deleted')}</Text> : null}
                  </View>
                </Row>
              </Card>
            ))}
          </>
        ) : (
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
                    <Text style={styles.meta}>
                      {t('room.paid')} {money(b.paid)} · {t('room.share')} {money(b.share)}
                    </Text>
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
        )}

        <Spacer size="xxl" />
        <Button title={t('room.leave')} variant="link" onPress={leave} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg, paddingBottom: space.xxl },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  flex: { flex: 1 },
  end: { alignItems: 'flex-end' },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: space.xs },
  meta: { fontSize: font.sm, color: colors.textMuted },
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
  tabText: { fontWeight: '600', color: colors.text },
  tabTextOn: { color: colors.primaryText },
  itemTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  amount: { fontSize: font.md, fontWeight: '700', color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  deleted: { fontSize: font.sm, color: colors.danger },
});
