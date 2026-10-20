import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { avatarUrl } from '../lib/files';

import { colors, themedStyles } from './theme';

/** Two letters of a name in a soft circle — people are told apart without photos. */
export function initials(name: string): string {
  const parts = name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '·';
  const a = Array.from(parts[0] ?? '')[0] ?? '';
  const b =
    parts.length > 1
      ? (Array.from(parts[parts.length - 1] ?? '')[0] ?? '')
      : (Array.from(parts[0] ?? '')[1] ?? '');
  return (a + b).toUpperCase();
}

export function Avatar({
  name,
  size = 40,
  muted,
  photo,
}: {
  name: string;
  size?: number;
  muted?: boolean;
  /** storage path of the person's profile photo, if any */
  photo?: string | null;
}) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (photo)
      void avatarUrl(photo)
        .then((u) => alive && setUri(u))
        .catch(() => undefined);
    else setUri(null);
    return () => {
      alive = false;
    };
  }, [photo]);
  if (uri && !muted) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        muted ? styles.muted : null,
      ]}
    >
      <Text style={[styles.text, muted ? styles.mutedText : null]}>{initials(name)}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    circle: { backgroundColor: colors.getBg, alignItems: 'center', justifyContent: 'center' },
    text: { color: colors.getText, fontWeight: '700', fontSize: 14 },
    muted: { backgroundColor: colors.border },
    mutedText: { color: colors.textMuted },
  }),
);
