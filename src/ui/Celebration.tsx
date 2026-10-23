import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from './components';
import { colors, font, radius, space, themedStyles } from './theme';

const PIECES = 40;
const native = Platform.OS !== 'web';

/** steady pseudo-random 0..1 so the confetti is the same on every draw */
function rnd(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Confetti + a short "all clear" message (founder 2026-10-23: a member whose payable amount is
 * fully settled should feel that their account is clear). Shown once per settlement line.
 */
export function Celebration({
  visible,
  title,
  body,
  button,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  button: string;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [fall] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(0));
  const palette = [colors.accent, colors.success, colors.primary, colors.payText, '#E85D75', '#4FB3D9'];
  const pieces = Array.from({ length: PIECES }, (_, i) => ({
    x: rnd(i, 1) * width,
    drift: (rnd(i, 2) - 0.5) * 120,
    delay: rnd(i, 3) * 0.35,
    spin: (rnd(i, 4) > 0.5 ? 1 : -1) * (360 + rnd(i, 5) * 540),
    w: 6 + rnd(i, 6) * 6,
    h: 10 + rnd(i, 7) * 8,
    round: i % 4 === 0,
    color: palette[i % palette.length],
  }));

  useEffect(() => {
    if (!visible) return;
    fall.setValue(0);
    pop.setValue(0);
    Animated.parallel([
      Animated.timing(fall, {
        toValue: 1,
        duration: 3400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: native,
      }),
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 80, useNativeDriver: native }),
    ]).start();
  }, [visible, fall, pop]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {pieces.map((p, i) => {
            const start = p.delay;
            const progress = fall.interpolate({
              inputRange: [0, start, 1],
              outputRange: [0, 0, 1],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={{
                  position: 'absolute',
                  left: p.x,
                  top: -20,
                  width: p.w,
                  height: p.round ? p.w : p.h,
                  borderRadius: p.round ? p.w / 2 : 2,
                  backgroundColor: p.color,
                  opacity: progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    {
                      translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }),
                    },
                    { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                    {
                      rotate: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', `${p.spin}deg`],
                      }),
                    },
                  ],
                }}
              />
            );
          })}
        </View>
        <Animated.View
          accessibilityViewIsModal
          accessibilityLiveRegion="polite"
          style={[
            styles.card,
            {
              opacity: pop,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
            },
          ]}
        >
          <Text style={styles.emoji}>{'🎉'}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.btn}>
            <Button title={button} onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(10, 20, 30, 0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: space.xl,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.xl,
      alignItems: 'center',
      gap: space.sm,
    },
    emoji: { fontSize: 56 },
    title: { fontSize: font.xl, fontWeight: '700', color: colors.success, textAlign: 'center' },
    body: { fontSize: font.md, color: colors.text, textAlign: 'center', lineHeight: 22 },
    btn: { alignSelf: 'stretch', marginTop: space.md },
  }),
);
