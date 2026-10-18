import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, AuditEntry } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { formatMoney } from '../lib/money';
import { EDIT_WINDOW_MS, formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Notice, Row, Spacer } from '../ui/components';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ExpenseDetail'>;

const TRACKED = ['title', 'amount', 'category', 'expense_date', 'paid_by', 'notes'] as const;

export function ExpenseDetailScreen({ navigation, route }: Props) {
  const { roomId, expenseId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useLoader(async () => {
    const [room, members, detail] = await Promise.all([api.room(roomId), api.members(roomId), api.expense(expenseId)]);
    return { room, members, ...detail, loadedAt: Date.now() };
  }, expenseId);

  if (!data) return <View style={styles.bg} />;
  const { room, members, expense, splits, history, loadedAt } = data;
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const money = (v: number) => formatMoney(v, room.currency, room.currency_decimals);
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');
  // UI hint only; the server re-checks with its own clock.
  const withinWindow = loadedAt - new Date(expense.created_at).getTime() < EDIT_WINDOW_MS;
  const canModify = !expense.deleted_at && (isAdmin || (expense.created_by === me && withinWindow));

  function describe(h: AuditEntry): string[] {
    if (h.action !== 'update' || !h.old_value || !h.new_value) return [];
    const out: string[] = [];
    for (const f of TRACKED) {
      const a = h.old_value[f];
      const b = h.new_value[f];
      if (String(a ?? '') === String(b ?? '')) continue;
      const fmt = (v: unknown) =>
        f === 'amount' ? money(Number(v)) : f === 'paid_by' ? nameOf(String(v)) : String(v ?? '—');
      out.push(t('expense.changed', { field: f.replace('_', ' '), from: fmt(a), to: fmt(b) }));
    }
    return out;
  }

  async function remove() {
    setError(null);
    if (!(await confirm(t('expense.deleteConfirm'), t('common.yes'), t('common.no')))) return;
    try {
      await api.deleteExpense(expenseId);
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    }
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {expense.deleted_at ? <Notice tone="error">{t('expense.deleted')}</Notice> : null}
        <Card>
          <Text style={styles.title}>{expense.title}</Text>
          <Text style={styles.big}>{money(expense.amount)}</Text>
          <Text style={styles.meta}>
            {expense.expense_date} · {t(`expense.categories.${expense.category}`, { defaultValue: expense.category })}
          </Text>
          <Text style={styles.meta}>
            {t('expense.paidBy')}: {nameOf(expense.paid_by)}
          </Text>
          {expense.notes ? <Body>{expense.notes}</Body> : null}
        </Card>

        <Text style={styles.section}>{t('expense.shares')}</Text>
        <Card>
          {splits.filter((s) => s.amount > 0).map((s) => (
            <Row key={s.user_id}>
              <Text style={styles.line}>{nameOf(s.user_id)}</Text>
              <Text style={styles.line}>{money(s.amount)}</Text>
            </Row>
          ))}
        </Card>

        {canModify ? (
          <>
            <Button title={t('expense.edit')} onPress={() => navigation.navigate('AddExpense', { roomId, expenseId })} />
            <Button title={t('expense.delete')} variant="secondary" onPress={remove} />
          </>
        ) : null}

        <Spacer />
        <Text style={styles.section}>{t('expense.history')}</Text>
        {history.map((h) => (
          <Card key={h.id}>
            <Text style={styles.line}>
              {t(`expense.action_${h.action}`, { defaultValue: h.action })} {t('expense.by', { name: nameOf(h.actor_id) })}
            </Text>
            <Text style={styles.meta}>{formatDateTime(h.created_at, room.time_zone)}</Text>
            {describe(h).map((d) => (
              <Text key={d} style={styles.meta}>
                {d}
              </Text>
            ))}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg, paddingBottom: space.xxl },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  big: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginVertical: space.sm },
  meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  section: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginVertical: space.md },
  line: { fontSize: font.md, color: colors.text, paddingVertical: 4 },
});
