import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api, Member } from '../lib/api';
import { localizeDigits } from '../lib/digits';
import { dbErrorKey } from '../lib/errors';
import { requireReauth } from '../lib/reauth';
import { formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Avatar } from '../ui/Avatar';
import { Body, Button, Card, Notice, Spacer } from '../ui/components';
import { confirm, useLoader } from '../ui/hooks';
import { colors, font, rowDirection, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'RoomMembers'>;

export function RoomMembersScreen({ route }: Props) {
  const { roomId } = route.params;
  const { t } = useTranslation();
  const { session } = useAuth();
  const me = session?.user.id;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, loading, reload } = useLoader(async () => {
    const [room, members] = await Promise.all([api.room(roomId), api.members(roomId)]);
    const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');
    const emails = isAdmin ? await api.memberEmails(roomId) : new Map<string, string>();
    return { room, members, isAdmin, emails };
  }, `${roomId}:${me}`);

  async function run(m: Member, action: () => Promise<void>, confirmText?: string) {
    setError(null);
    if (confirmText && !(await confirm(confirmText, t('common.yes'), t('common.no')))) return;
    setBusyId(m.id);
    try {
      await action();
      await reload();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusyId(null);
    }
  }

  if (!data) return <View style={styles.bg} />;
  const { room, members, isAdmin, emails } = data;
  const pending = members.filter((m) => m.status === 'pending');
  const approved = members.filter((m) => m.status === 'approved');
  const former = members.filter((m) => m.former);
  const name = (m: Member) => m.profile?.display_name ?? '—';

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        {error ? <Notice tone="error">{error}</Notice> : null}

        {isAdmin ? (
          <>
            <Text style={styles.section}>{t('members.pending')}</Text>
            {pending.length === 0 ? <Body muted>{t('members.none')}</Body> : null}
            {pending.map((m) => (
              <Card key={m.id}>
                <View style={[styles.person, { flexDirection: rowDirection() }]}>
                  <Avatar name={name(m)} />
                  <View style={styles.flex}>
                    <Text style={styles.name}>{name(m)}</Text>
                    {emails.get(m.user_id) ? <Text style={styles.meta}>{emails.get(m.user_id)}</Text> : null}
                  </View>
                </View>
                <Text style={styles.meta}>
                  {t('members.requested', { when: formatDateTime(m.requested_at, room.time_zone) })}
                </Text>
                <Spacer size="sm" />
                <Button
                  title={t('members.approve')}
                  loading={busyId === m.id}
                  onPress={() => run(m, () => api.decideJoin(m.id, true))}
                />
                <Button
                  title={t('members.reject')}
                  variant="secondary"
                  disabled={busyId === m.id}
                  onPress={() => run(m, () => api.decideJoin(m.id, false))}
                />
              </Card>
            ))}
            <Spacer />
          </>
        ) : null}

        <Text style={styles.section}>{t('members.approved')}</Text>
        {approved.map((m) => (
          <Card key={m.id}>
            <View style={[styles.person, { flexDirection: rowDirection() }]}>
              <Avatar name={name(m)} />
              <View style={styles.flex}>
                <Text style={styles.name}>
                  {name(m)} {m.user_id === me ? t('members.you') : ''}
                </Text>
                <Text style={styles.meta}>
                  {t(m.role === 'admin' ? 'home.admin' : 'home.member')}
                  {isAdmin && emails.get(m.user_id) ? ` · ${emails.get(m.user_id)}` : ''}
                </Text>
              </View>
            </View>
            {isAdmin ? (
              <>
                <Spacer size="sm" />
                <Button
                  title={t(m.role === 'admin' ? 'members.removeAdmin' : 'members.makeAdmin')}
                  variant="secondary"
                  loading={busyId === m.id}
                  onPress={() => run(m, () => api.setRole(m.id, m.role === 'admin' ? 'member' : 'admin'))}
                />
                {m.user_id !== me ? (
                  <Button
                    title={t('members.remove')}
                    variant="link"
                    disabled={busyId === m.id}
                    onPress={() =>
                      run(
                        m,
                        async () => {
                          if (await requireReauth()) await api.removeMember(m.id);
                        },
                        t('members.removeConfirm', { name: name(m) }),
                      )
                    }
                  />
                ) : null}
              </>
            ) : null}
          </Card>
        ))}

        {former.length > 0 ? (
          <>
            <Spacer />
            <Text style={styles.section}>{t('members.former')}</Text>
            {former.map((m) => (
              <Card key={m.id}>
                <Text style={styles.name}>{m.former!.name}</Text>
                {isAdmin && emails.get(m.user_id) ? (
                  <Text style={styles.meta} selectable>
                    {emails.get(m.user_id)}
                  </Text>
                ) : null}
                <Text style={styles.meta}>
                  {m.former!.status === 'removed'
                    ? t('members.removedOn', {
                        date: localizeDigits(m.left_on ?? '—'),
                        by: m.former!.removedByName ?? '—',
                      })
                    : t('members.leftOn', { date: localizeDigits(m.left_on ?? '—') })}
                </Text>
                {m.joined_on ? (
                  <Text style={styles.meta}>
                    {t('members.stay', {
                      from: localizeDigits(m.joined_on),
                      to: localizeDigits(m.left_on ?? '—'),
                    })}
                  </Text>
                ) : null}
              </Card>
            ))}
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    person: { alignItems: 'center', gap: space.md },
    flex: { flex: 1 },
    bg: { flex: 1, backgroundColor: colors.bg },
    pad: { padding: space.lg, paddingBottom: space.xxl },
    column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    section: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.md },
    name: { fontSize: font.md, fontWeight: '600', color: colors.text },
    meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  }),
);
