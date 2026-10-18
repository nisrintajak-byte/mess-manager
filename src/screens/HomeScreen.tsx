import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { api } from '../lib/api';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Notice, Spacer } from '../ui/components';
import { useLoader } from '../ui/hooks';
import { colors, font, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const { data, error, loading, reload } = useLoader(async () => {
    const [rooms, pending] = await Promise.all([api.myRooms(), api.myPendingRequests()]);
    return { rooms, pending };
  });
  const name = (session?.user.user_metadata?.display_name as string | undefined) ?? session?.user.email ?? '';

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
    >
      <View style={styles.column}>
        <Body muted>{t('home.signedInAs', { name })}</Body>
        <Spacer />
        {error ? <Notice tone="error">{t('common.genericError')}</Notice> : null}
        {data && data.pending.length > 0 ? (
          <Notice tone="info">{t('home.pendingCount', { count: data.pending.length })}</Notice>
        ) : null}
        {data && data.rooms.length === 0 ? <Body muted>{t('home.empty')}</Body> : null}
        {data?.rooms.map((r) => (
          <Card key={r.id} onPress={() => navigation.navigate('Room', { roomId: r.id })}>
            <Text style={styles.roomName}>{r.name}</Text>
            <Text style={styles.meta}>
              {r.currency} · {r.time_zone}
            </Text>
          </Card>
        ))}
        <Spacer />
        <Button title={t('home.createRoom')} onPress={() => navigation.navigate('CreateRoom')} />
        <Button title={t('home.joinRoom')} variant="secondary" onPress={() => navigation.navigate('JoinRoom')} />
        <Spacer size="xxl" />
        <Button title={t('auth.signOut')} variant="link" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  roomName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  meta: { fontSize: font.sm, color: colors.textMuted, marginTop: space.xs },
});
