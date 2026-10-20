import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, LineStatus, OPEN_FLAG, Payment } from '../lib/api';
import { unpinSettlement } from '../lib/pinned';
import { dbErrorKey } from '../lib/errors';
import { formatMoney } from '../lib/money';
import { minimalTransfers } from '../lib/transfers';
import { formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Meta, Notice, Row, Section, Spacer } from '../ui/components';
import { ViewFileButton } from '../ui/FilePicker';
import { useLoader } from '../ui/hooks';
import { colors, font, radius, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Settlement'>;

const TONE: Record<LineStatus, 'neutral' | 'good' | 'warn' | 'bad'> = {
  settled: 'neutral',
  pending: 'bad',
  awaiting: 'warn',
  partial: 'warn',
  paid: 'good',
};

export function SettlementScreen({ navigation, route }: Props) {
  const { roomId, settlementId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, reload } = useLoader(async () => {
    const [room, members, s] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.settlement(settlementId),
    ]);
    // Opening the settlement marks it as seen for this member (PRD §11.7).
    await api.markSettlementSeen(settlementId).catch(() => undefined);
    const [acks, lineFlags, payFlags] = await Promise.all([
      api.settlementAcks(settlementId),
      api.targetFlags(
        'settlement_line',
        s.lines.map((l) => l.line_id),
      ),
      api.targetFlags(
        'payment',
        s.payments.map((p) => p.id),
      ),
    ]);
    const disputed = new Set(
      [...lineFlags, ...payFlags].filter((f) => OPEN_FLAG.includes(f.status)).map((f) => f.target_id),
    );
    return { room, members, ...s, acks, disputed };
  }, settlementId);

  if (!data) return <View style={styles.bg} />;
  const { room, members, settlement, cycle, lines, payments, acks, disputed } = data;
  const myAck = acks.find((a) => a.user_id === me);
  const ackState = (uid: string) => {
    const a = acks.find((x) => x.user_id === uid);
    if (!a) return 'pending';
    return a.acknowledged_at ? 'acknowledged' : a.seen_at ? 'seen' : 'delivered';
  };
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const money = (v: number) => formatMoney(v, settlement.currency, settlement.currency_decimals);
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');
  const adminCount = members.filter((m) => m.status === 'approved' && m.role === 'admin').length;
  const transfers = minimalTransfers(lines.map((l) => ({ userId: l.user_id, net: l.net })));
  const remaining = (l: (typeof lines)[number]) => Math.max(-l.net, 0) - l.confirmed - l.awaiting;

  async function decide(p: Payment, ok: boolean) {
    setError(null);
    if (!ok && !reason.trim()) return setError(t('errors.reason_required'));
    setBusyId(p.id);
    try {
      await api.decidePayment(p.id, ok, ok ? null : reason);
      setRejecting(null);
      setReason('');
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusyId(null);
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
        <Card>
          <Text style={styles.title}>{t('cycle.range', { from: cycle.starts_on, to: cycle.ends_on })}</Text>
          <Row>
            <Body>{t('settlement.total')}</Body>
            <Text style={styles.big}>{money(settlement.total)}</Text>
          </Row>
          <Meta>
            {t('settlement.generated', {
              when: formatDateTime(settlement.generated_at, room.time_zone),
              name: nameOf(settlement.generated_by),
            })}
          </Meta>
          <Badge tone="good">{t('cycle.locked')}</Badge>
        </Card>

        {myAck ? (
          myAck.acknowledged_at ? (
            <Notice tone="success">{t('ack.done')}</Notice>
          ) : (
            <Button
              title={t('ack.button')}
              onPress={async () => {
                await api.acknowledgeSettlement(settlementId).catch(() => undefined);
                await unpinSettlement(settlementId);
                await reload();
              }}
            />
          )
        ) : null}

        <Section>{t('settlement.lines')}</Section>
        {lines.map((l) => (
          <Card key={l.line_id}>
            <Row>
              <View style={styles.flex}>
                <Text style={styles.name}>
                  {nameOf(l.user_id)} {l.user_id === me ? t('members.you') : ''}
                </Text>
                <Meta>
                  {t('settlement.share')} {money(l.share)} · {t('settlement.paid')} {money(l.paid)}
                </Meta>
                <Badge tone={TONE[l.status]}>{t(`settlement.status_${l.status}`)}</Badge>
              </View>
              <Text style={[styles.amount, { color: l.net < 0 ? colors.danger : colors.success }]}>
                {l.net === 0
                  ? t('settlement.even')
                  : l.net < 0
                    ? t('settlement.toPay', { amount: money(-l.net) })
                    : t('settlement.toReceive', { amount: money(l.net) })}
              </Text>
            </Row>
            {isAdmin ? (
              <Meta>
                {t('ack.status')}: {t(`ack.${ackState(l.user_id)}`)}
              </Meta>
            ) : null}
            {disputed.has(l.line_id) ? <Badge tone="bad">{t('flag.badge')}</Badge> : null}
            <Button
              title={t('flag.raise')}
              variant="link"
              onPress={() =>
                navigation.navigate('Flag', { roomId, type: 'settlement_line', targetId: l.line_id })
              }
            />
            {l.net < 0 && remaining(l) > 0 ? (
              <>
                <Meta>{t('settlement.remaining', { amount: money(remaining(l)) })}</Meta>
                {l.user_id === me ? (
                  <Button
                    title={t('settlement.markPaid')}
                    onPress={() =>
                      navigation.navigate('Pay', { roomId, settlementId, lineId: l.line_id, mode: 'claim' })
                    }
                  />
                ) : null}
                {isAdmin && (l.user_id !== me || adminCount === 1) ? (
                  <Button
                    title={t('settlement.recordPayment')}
                    variant="secondary"
                    onPress={() =>
                      navigation.navigate('Pay', { roomId, settlementId, lineId: l.line_id, mode: 'record' })
                    }
                  />
                ) : null}
              </>
            ) : null}
          </Card>
        ))}

        <Section>{t('settlement.whoPaysWhom')}</Section>
        <Meta>{t('settlement.whoPaysWhomNote')}</Meta>
        <Spacer size="sm" />
        <Card>
          {transfers.length === 0 ? <Body muted>{t('settlement.nothing')}</Body> : null}
          {transfers.map((x) => (
            <Row key={`${x.from}-${x.to}`}>
              <Text style={styles.line}>
                {t('settlement.pays', { from: nameOf(x.from), to: nameOf(x.to) })}
              </Text>
              <Text style={styles.line}>{money(x.amount)}</Text>
            </Row>
          ))}
        </Card>

        <Section>{t('settlement.payments')}</Section>
        {payments.length === 0 ? <Body muted>{t('settlement.noPayments')}</Body> : null}
        {payments.map((p) => {
          const canDecide = isAdmin && p.status === 'awaiting' && (p.payer_id !== me || adminCount === 1);
          return (
            <Card key={p.id}>
              <Row>
                <View style={styles.flex}>
                  <Text style={styles.name}>{nameOf(p.payer_id)}</Text>
                  <Meta>
                    {t(`payment.method_${p.method}`)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </Meta>
                  <Meta>
                    {t('payment.by', {
                      name: nameOf(p.claimed_by),
                      when: formatDateTime(p.claimed_at, room.time_zone),
                    })}
                  </Meta>
                </View>
                <Text style={styles.amount}>{money(p.amount)}</Text>
              </Row>
              <Badge tone={p.status === 'confirmed' ? 'good' : p.status === 'rejected' ? 'bad' : 'warn'}>
                {t(`payment.status_${p.status}`)}
              </Badge>
              {p.self_confirmed ? <Meta>{t('payment.selfConfirmed')}</Meta> : null}
              {p.recorded_by_admin ? <Meta>{t('payment.recordedByAdmin')}</Meta> : null}
              {p.reject_reason ? <Meta>{t('payment.rejected', { reason: p.reject_reason })}</Meta> : null}
              {p.note ? <Meta>{p.note}</Meta> : null}
              {p.proof_path ? <ViewFileButton path={p.proof_path} title={t('payment.viewProof')} /> : null}
              {disputed.has(p.id) ? <Badge tone="bad">{t('flag.badge')}</Badge> : null}
              <Button
                title={t('flag.raise')}
                variant="link"
                onPress={() => navigation.navigate('Flag', { roomId, type: 'payment', targetId: p.id })}
              />
              {canDecide ? (
                rejecting === p.id ? (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder={t('payment.rejectReasonPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={reason}
                      onChangeText={setReason}
                      accessibilityLabel={t('payment.rejectReason')}
                    />
                    <Button
                      title={t('payment.reject')}
                      variant="danger"
                      loading={busyId === p.id}
                      onPress={() => decide(p, false)}
                    />
                    <Button title={t('common.cancel')} variant="link" onPress={() => setRejecting(null)} />
                  </>
                ) : (
                  <>
                    <Spacer size="sm" />
                    <Button
                      title={t('payment.confirm')}
                      loading={busyId === p.id}
                      onPress={() => decide(p, true)}
                    />
                    <Button
                      title={t('payment.reject')}
                      variant="secondary"
                      onPress={() => setRejecting(p.id)}
                    />
                  </>
                )
              ) : null}
            </Card>
          );
        })}
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
    title: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    big: { fontSize: font.xl, fontWeight: '700', color: colors.text },
    name: { fontSize: font.md, fontWeight: '600', color: colors.text },
    amount: {
      fontSize: font.md,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'right',
    },
    line: { fontSize: font.md, color: colors.text, paddingVertical: 4 },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
      marginVertical: space.sm,
      color: colors.text,
    },
  }),
);
