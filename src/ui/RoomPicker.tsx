import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { RoomOverview } from '../lib/api';
import { Avatar } from './Avatar';
import { colors, font, radius, rowDirection, space, themedStyles } from './theme';

/** "Which Room?" — shown when a quick action needs a Room and the person is in several. */
export function RoomPicker({
  rooms,
  visible,
  onPick,
  onClose,
}: {
  rooms: RoomOverview[];
  visible: boolean;
  onPick: (roomId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{t('home.pickRoom')}</Text>
          {rooms.map((r) => (
            <Pressable
              key={r.room_id}
              accessibilityRole="button"
              onPress={() => onPick(r.room_id)}
              style={({ pressed }) => [styles.row, { flexDirection: rowDirection() }, pressed && styles.dim]}
            >
              <Avatar name={r.name} />
              <Text style={styles.name}>{r.name}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancel}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: space.lg,
      gap: space.sm,
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
    },
    title: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    row: { alignItems: 'center', gap: space.md, minHeight: 56 },
    name: { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
    dim: { opacity: 0.6 },
    cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontSize: font.md, fontWeight: '600', color: colors.primary },
  }),
);
