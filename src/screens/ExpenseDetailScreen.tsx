import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, AuditEntry, OPEN_FLAG } from '../lib/api';
import { submitOrQueue } from '../lib/outbox';
import { dbErrorKey } from '../lib/errors';
import { formatMoney } from '../lib/money';
import { EDIT_WINDOW_MS, formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Meta, Notice, Row, Section, Spacer } from '../ui/components';
import { ViewFileButton } from '../ui/FilePicker';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'ExpenseDetail'>;

const TRACKED = ['title', 'amount', 'expense_date', 'paid_by', 'notes', 'split_mode'] as const;

export function ExpenseDetailScreen({ navigation, route }: Props) {
  const { roomId, expenseId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useLoader(async () => {
    const [room, members, detail] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.expense(expenseId),
    ]);
    const original = detail.expense.adjusts_expense_id
      ? (await api.expense(detail.expense.adjusts_expense_id)).expense
      : null;
    const flags = await api.targetFlags('expense', [expenseId]);
    return { room, members, ...detail, original, flags, loadedAt: Date.now() };
  }, expenseId);

  if (!data) return <View style={styles.bg} />;
  const { room, members, expense, splits, history, cycle, original, flags, loadedAt } = data;
  const underDispute = flags.some((f) => OPEN_FLAG.includes(f.status));
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const currency = cycle?.currency ?? room.currency;
  const decimals = cycle?.currency_decimals ?? room.currency_decimals;
  const money = (v: number) => formatMoney(v, currency, decimals);
  const sign = expense.is_credit ? -1 : 1;
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');
  const locked = cycle?.status === 'locked';
  // UI hint only; the server re-checks with its own clock and the cycle lock.
  const withinWindow = loadedAt - new Date(expense.created_at).getTime() < EDIT_WINDOW_MS;
  const canModify =
    !locked &&
    !expense.deleted_at &&
    !expense.adjusts_expense_id &&
    (isAdmin || (expense.created_by === me && withinWindow));

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
      const r = await submitOrQueue({
        type: 'expense_delete',
        userId: me ?? '',
        roomId,
        label: expense.title,
        amount: expense.amount,
        amountText: money(expense.amount),
        payload: { expenseId, baseUpdated: expense.updated_at },
      });
      if (r.queued) navigation.goBack();
      else await reload();
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
        {locked ? <Notice tone="info">{t('cycle.lockedNote')}</Notice> : null}
        {underDispute ? (
          <Notice tone="error">
            {t('flag.badge')} · {t('flag.list')}
          </Notice>
        ) : null}
        <Card>
          <Text style={styles.title}>{expense.title}</Text>
          <Text style={styles.big}>{money(sign * expense.amount)}</Text>
          <Meta>{expense.expense_date}</Meta>
          <Meta>
            {t('expense.paidBy')}: {nameOf(expense.paid_by)}
          </Meta>
          {expense.split_mode === 'selected' ? <Badge tone="neutral">{t('split.selected')}</Badge> : null}
          {original ? (
            <>
              <Badge tone="warn">{t('adjust.label')}</Badge>
              <Button
                title={t('adjust.of', { title: original.title })}
                variant="link"
                onPress={() => navigation.push('ExpenseDetail', { roomId, expenseId: original.id })}
              />
            </>
          ) : null}
          {expense.notes ? <Body>{expense.notes}</Body> : null}
          {expense.receipt_path ? <ViewFileButton path={expense.receipt_path} /> : null}
        </Card>

        <Section>{t('expense.shares')}</Section>
        <Card>
          {splits
            .filter((s) => s.amount > 0)
            .map((s) => (
              <Row key={s.user_id}>
                <Text style={styles.line}>{nameOf(s.user_id)}</Text>
                <Text style={styles.line}>{money(sign * s.amount)}</Text>
              </Row>
            ))}
        </Card>

        {canModify ? (
          <>
            <Button
              title={t('expense.edit')}
              onPress={() => navigation.navigate('AddExpense', { roomId, expenseId })}
            />
            <Button title={t('expense.delete')} variant="secondary" onPress={remove} />
          </>
        ) : null}
        {locked && isAdmin && !expense.deleted_at ? (
          <Button
            title={t('adjust.title')}
            variant="secondary"
            onPress={() => navigation.navigate('Adjust', { roomId, expenseId })}
          />
        ) : null}

        {!expense.deleted_at ? (
          <Button
            title={t('flag.raise')}
            variant="link"
            onPress={() => navigation.navigate('Flag', { roomId, type: 'expense', targetId: expenseId })}
          />
        ) : null}
        {underDispute ? (
          <Button
            title={t('flag.list')}
            variant="link"
            onPress={() => navigation.navigate('Disputes', { roomId })}
          />
        ) : null}
        <Spacer />
        <Section>{t('expense.history')}</Section>
        {history.map((h) => (
          <Card key={h.id}>
            <Text style={styles.line}>
              {t(`expense.action_${h.action}`, { defaultValue: h.action })}{' '}
              {t('expense.by', { name: nameOf(h.actor_id) })}
            </Text>
            <Meta>{formatDateTime(h.created_at, room.time_zone)}</Meta>
            {describe(h).map((d) => (
              <Meta key={d}>{d}</Meta>
            ))}
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    pad: { padding: space.lg, paddingBottom: space.xxl },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
    big: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginVertical: space.sm },
    line: { fontSize: font.md, color: colors.text, paddingVertical: 4 },
  }),
);
