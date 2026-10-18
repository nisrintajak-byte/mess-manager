import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, Flag, FlagStatus } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Meta, Notice, Row } from '../ui/components';
import { ViewFileButton } from '../ui/FilePicker';
import { useLoader } from '../ui/hooks';
import { colors, font, radius, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Disputes'>;

const TONE: Record<FlagStatus, 'neutral' | 'good' | 'warn' | 'bad'> = {
  open: 'bad',
  under_review: 'warn',
  accepted: 'good',
  rejected: 'neutral',
  withdrawn: 'neutral',
};

/** Dispute & flag list with Admin resolution (PRD §12). */
export function DisputesScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<{ id: string; accept: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useLoader(async () => {
    const [room, members, flags] = await Promise.all([
      api.room(roomId),
      api.members(roomId),
      api.roomFlags(roomId),
    ]);
    const expenseIds = flags.filter((f) => f.target_type === 'expense').map((f) => f.target_id);
    const { data: ex } = expenseIds.length
      ? await supabase.from('expenses').select('id, title').in('id', expenseIds)
      : { data: [] as { id: string; title: string }[] };
    return { room, members, flags, titles: new Map((ex ?? []).map((e) => [e.id, e.title])) };
  }, roomId);

  if (!data) return <View style={styles.bg} />;
  const { room, members, flags, titles } = data;
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');
  const adminCount = members.filter((m) => m.status === 'approved' && m.role === 'admin').length;

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      setResolving(null);
      setNote('');
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  async function openItem(f: Flag) {
    if (f.target_type === 'expense') {
      return navigation.navigate('ExpenseDetail', { roomId, expenseId: f.target_id });
    }
    let lineId = f.target_id;
    if (f.target_type === 'payment') {
      const { data: p } = await supabase
        .from('payments')
        .select('settlement_line_id')
        .eq('id', f.target_id)
        .single();
      if (!p) return;
      lineId = p.settlement_line_id as string;
    }
    const { data: l } = await supabase
      .from('settlement_lines')
      .select('settlement_id')
      .eq('id', lineId)
      .single();
    if (l) navigation.navigate('Settlement', { roomId, settlementId: l.settlement_id as string });
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {flags.length === 0 ? <Body muted>{t('flag.none')}</Body> : null}
        {flags.map((f) => {
          const open = f.status === 'open' || f.status === 'under_review';
          const involved = f.target_owner === me;
          const canResolve = isAdmin && open && (!involved || adminCount === 1);
          return (
            <Card key={f.id}>
              <Row>
                <View style={styles.flex}>
                  <Text style={styles.name}>
                    {t(`flag.on_${f.target_type}`)}
                    {titles.get(f.target_id) ? `: ${titles.get(f.target_id)}` : ''}
                  </Text>
                  <Meta>
                    {t(`flag.r_${f.reason}`)}
                    {f.note ? ` — ${f.note}` : ''}
                  </Meta>
                  <Meta>
                    {t('flag.by', {
                      name: nameOf(f.raised_by),
                      when: formatDateTime(f.created_at, room.time_zone),
                    })}
                  </Meta>
                </View>
                <Badge tone={TONE[f.status]}>{t(`flag.s_${f.status}`)}</Badge>
              </Row>
              {f.resolution_note ? (
                <Meta>
                  {nameOf(f.resolved_by)}: {f.resolution_note}
                </Meta>
              ) : null}
              {f.resolved_by_involved_admin ? <Meta>{t('flag.involved')}</Meta> : null}
              {f.evidence_path ? <ViewFileButton path={f.evidence_path} /> : null}
              <Button title={t('flag.open')} variant="link" onPress={() => openItem(f)} />

              {open && f.raised_by === me ? (
                <Button
                  title={t('flag.withdraw')}
                  variant="link"
                  onPress={() => run(() => api.withdrawFlag(f.id))}
                />
              ) : null}

              {canResolve ? (
                resolving?.id === f.id ? (
                  <>
                    {resolving.accept ? <Meta>{t('flag.acceptHint')}</Meta> : null}
                    <TextInput
                      style={styles.input}
                      placeholder={t('flag.resolutionPlaceholder')}
                      placeholderTextColor={colors.textMuted}
                      value={note}
                      onChangeText={setNote}
                      accessibilityLabel={t('flag.resolution')}
                      multiline
                    />
                    <Button
                      title={t(resolving.accept ? 'flag.accept' : 'flag.reject')}
                      variant={resolving.accept ? 'primary' : 'danger'}
                      loading={busy}
                      onPress={() => run(() => api.resolveFlag(f.id, resolving.accept, note))}
                    />
                    <Button title={t('common.cancel')} variant="link" onPress={() => setResolving(null)} />
                  </>
                ) : (
                  <>
                    {f.status === 'open' ? (
                      <Button
                        title={t('flag.review')}
                        variant="secondary"
                        onPress={() => run(() => api.reviewFlag(f.id))}
                      />
                    ) : null}
                    <Button
                      title={t('flag.accept')}
                      onPress={() => setResolving({ id: f.id, accept: true })}
                    />
                    <Button
                      title={t('flag.reject')}
                      variant="secondary"
                      onPress={() => setResolving({ id: f.id, accept: false })}
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
    name: { fontSize: font.md, fontWeight: '600', color: colors.text },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
      marginVertical: space.sm,
      color: colors.text,
      minHeight: 60,
    },
  }),
);
