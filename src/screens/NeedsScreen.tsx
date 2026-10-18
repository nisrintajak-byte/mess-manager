import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, NeedRequest, NeedStatus } from '../lib/api';
import { dbErrorKey } from '../lib/errors';
import type { AppStackParamList } from '../navigation/types';
import { Badge, Body, Button, Card, Field, Meta, Notice, Row, Section } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { colors, font, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Needs'>;

const TONE: Record<NeedStatus, 'neutral' | 'good' | 'warn' | 'bad'> = {
  pending: 'bad',
  accepted: 'warn',
  completed: 'good',
  cancelled: 'neutral',
};

/** Need Requests (PRD §13): ask, accept, buy → one tap to an expense. */
export function NeedsScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, reload } = useLoader(async () => {
    const [members, needs] = await Promise.all([api.members(roomId), api.needs(roomId)]);
    return { members, needs };
  }, roomId);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <View style={styles.bg} />;
  const { members, needs } = data;
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profile?.display_name ?? '—';
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');

  function actions(n: NeedRequest) {
    const out = [];
    if (n.status === 'pending') {
      out.push(<Button key="a" title={t('need.accept')} onPress={() => run(() => api.acceptNeed(n.id))} />);
    }
    if (n.status === 'accepted' && n.accepted_by === me) {
      out.push(
        <Button
          key="b"
          title={t('need.bought')}
          onPress={() => navigation.navigate('AddExpense', { roomId, needId: n.id, presetTitle: n.title })}
        />,
        <Button
          key="d"
          title={t('need.doneNoExpense')}
          variant="secondary"
          onPress={() => run(() => api.completeNeed(n.id, null))}
        />,
      );
    }
    if ((n.status === 'pending' || n.status === 'accepted') && (n.created_by === me || isAdmin)) {
      out.push(
        <Button
          key="c"
          title={t('need.cancel')}
          variant="link"
          onPress={() => run(() => api.cancelNeed(n.id))}
        />,
      );
    }
    return out;
  }

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        <Body muted>{t('need.explain')}</Body>
        <Section>{t('need.new')}</Section>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field
          label={t('need.new')}
          placeholder={t('need.placeholder')}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Field label={t('need.note')} value={note} onChangeText={setNote} maxLength={300} />
        <Button
          title={t('need.create')}
          loading={busy}
          disabled={!title.trim()}
          onPress={() =>
            run(async () => {
              await api.createNeed(roomId, title, note);
              setTitle('');
              setNote('');
            })
          }
        />

        <Section>{t('need.title')}</Section>
        {needs.length === 0 ? <Body muted>{t('need.none')}</Body> : null}
        {needs.map((n) => (
          <Card key={n.id}>
            <Row>
              <View style={styles.flex}>
                <Text style={styles.name}>{n.title}</Text>
                {n.note ? <Meta>{n.note}</Meta> : null}
                <Meta>{t('need.by', { name: nameOf(n.created_by) })}</Meta>
                {n.accepted_by ? <Meta>{t('need.acceptedBy', { name: nameOf(n.accepted_by) })}</Meta> : null}
              </View>
              <Badge tone={TONE[n.status]}>{t(`need.s_${n.status}`)}</Badge>
            </Row>
            {n.expense_id ? (
              <Button
                title={t('flag.open')}
                variant="link"
                onPress={() => navigation.navigate('ExpenseDetail', { roomId, expenseId: n.expense_id! })}
              />
            ) : null}
            {actions(n)}
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
  flex: { flex: 1 },
  name: { fontSize: font.md, fontWeight: '600', color: colors.text },
});
