import { StyleSheet, Text, View } from 'react-native';

import { Button } from './components';
import { Art, Illustration } from './Illustration';
import { colors, font, space, themedStyles } from './theme';

/**
 * A friendly empty screen (founder 2026-10-23): picture, one line on what will show here, and
 * the one thing to do next.
 */
export function EmptyState({
  art,
  title,
  body,
  action,
  secondary,
  size = 180,
}: {
  art: Art;
  title?: string;
  body: string;
  action?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  size?: number;
}) {
  return (
    <View style={styles.wrap}>
      <Illustration art={art} size={size} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.body}>{body}</Text>
      {action || secondary ? (
        <View style={styles.actions}>
          {action ? <Button title={action.label} onPress={action.onPress} /> : null}
          {secondary ? (
            <Button title={secondary.label} variant="secondary" onPress={secondary.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: space.lg, gap: space.sm },
    title: { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
    body: {
      fontSize: font.md,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 340,
    },
    actions: { alignSelf: 'center', marginTop: space.sm, width: '100%', maxWidth: 360 },
  }),
);
