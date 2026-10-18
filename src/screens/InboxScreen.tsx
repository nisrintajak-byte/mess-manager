import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { api, AppNotification } from '../lib/api';
import { notificationText } from '../lib/notifText';
import { formatDateTime } from '../lib/util';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Meta, Row } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { colors, font, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Inbox'>;

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** In-app inbox: the fallback when push fails, and the full history (PRD §14). */
export function InboxScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { data, loading, reload } = useLoader(() => api.notifications(), 'inbox');

  async function open(n: AppNotification) {
    if (!n.read_at) await api.markNotificationsRead([n.id]).catch(() => undefined);
    const p = n.payload as Record<string, string | undefined>;
    const roomId = n.room_id ?? undefined;
    if (!roomId) return reload();
    if (p.settlement_id) return navigation.navigate('Settlement', { roomId, settlementId: p.settlement_id });
    if (p.expense_id && n.kind !== 'expense_deleted')
      return navigation.navigate('ExpenseDetail', { roomId, expenseId: p.expense_id });
    if (n.kind.startsWith('dispute_')) return navigation.navigate('Disputes', { roomId });
    if (n.kind.startsWith('need_')) return navigation.navigate('Needs', { roomId });
    if (n.kind === 'join_request') return navigation.navigate('RoomMembers', { roomId });
    if (n.kind === 'retention_reminder') return navigation.navigate('Reports', { roomId });
    if (n.kind === 'join_rejected' || n.kind === 'member_removed') return reload();
    return navigation.navigate('Room', { roomId });
  }

  async function markAll() {
    await api.markNotificationsRead(null);
    await reload();
  }

  const items = data ?? [];
  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.pad}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
    >
      <View style={styles.column}>
        <Row>
          <Button title={t('inbox.markAll')} variant="link" onPress={markAll} />
          <Button
            title={t('inbox.settings')}
            variant="link"
            onPress={() => navigation.navigate('NotificationSettings')}
          />
        </Row>
        {items.length === 0 && !loading ? <Body muted>{t('inbox.empty')}</Body> : null}
        {items.map((n) => (
          <Card key={n.id} onPress={() => open(n)}>
            <Row>
              <View style={styles.flex}>
                <Text style={[styles.text, !n.read_at && styles.unread]}>{notificationText(n, t)}</Text>
                <Meta>{formatDateTime(n.created_at, tz)}</Meta>
              </View>
              {!n.read_at ? <View style={styles.dot} /> : null}
            </Row>
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
    flex: { flex: 1 },
    text: { fontSize: font.md, color: colors.text, lineHeight: 21 },
    unread: { fontWeight: '700' },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  }),
);
