import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthProvider';
import i18n, { isRtlLanguage } from '../i18n';
import { localizeDigits } from '../lib/digits';
import { setPref } from '../lib/prefs';
import type { AppStackParamList } from '../navigation/types';
import { Art, Illustration } from '../ui/Illustration';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Onboarding'>;

const SLIDES: { key: 'open' | 'split' | 'settle'; art: Art }[] = [
  { key: 'open', art: 'room' },
  { key: 'split', art: 'expense' },
  { key: 'settle', art: 'settle' },
];

/** Shown once on the device after the first sign-in; can be watched again from Help or Me. */
export const TOUR_PREF = 'tourSeen';

/**
 * Three short intro slides for a new member (founder 2026-10-23): what the app is for, how an
 * expense is split, and how a period is settled. Swipe or tap Next; Skip at any time.
 */
export function OnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  // dir: 1 when moving forward, -1 when going back (slide-in side)
  const [{ index, dir }, setPos] = useState({ index: 0, dir: 1 });
  const [anim] = useState(() => new Animated.Value(1));
  const name = ((session?.user.user_metadata?.display_name as string | undefined) ?? '').split(' ')[0] ?? '';
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index] ?? SLIDES[0]!;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [index, anim]);

  async function finish() {
    await setPref(TOUR_PREF, '1');
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Home');
  }
  function go(to: number) {
    if (to < 0 || to >= SLIDES.length) return;
    setPos({ index: to, dir: to > index ? 1 : -1 });
  }

  // swipe towards the reading direction to go forward
  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 20 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderRelease: (_e, g) => {
        const rtl = isRtlLanguage(i18n.language);
        const step = (rtl ? g.dx > 50 : g.dx < -50) ? 1 : (rtl ? g.dx < -50 : g.dx > 50) ? -1 : 0;
        if (step === 0) return;
        setPos((p) => {
          const to = p.index + step;
          return to < 0 || to >= SLIDES.length ? p : { index: to, dir: step };
        });
      },
    }),
  );

  const shift = (isRtlLanguage(i18n.language) ? -1 : 1) * dir * 40;
  return (
    <View style={[styles.bg, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.column}>
        <View style={[styles.top, { flexDirection: rowDirection() }]}>
          <Text style={styles.step}>
            {localizeDigits(t('tour.step', { n: index + 1, total: SLIDES.length }))}
          </Text>
          {!last ? (
            <Pressable accessibilityRole="button" onPress={() => void finish()} style={styles.skip}>
              <Text style={styles.skipText}>{t('tour.skip')}</Text>
            </Pressable>
          ) : (
            <View style={styles.skip} />
          )}
        </View>

        <Animated.View
          {...pan.panHandlers}
          style={[
            styles.slide,
            {
              opacity: anim,
              transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [shift, 0] }) }],
            },
          ]}
        >
          <View style={styles.art}>
            <Illustration art={slide.art} size={280} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {index === 0 && name ? t('tour.open_titleName', { name }) : t(`tour.${slide.key}_title`)}
          </Text>
          <Text style={styles.body}>{t(`tour.${slide.key}_body`)}</Text>
        </Animated.View>

        <View style={[styles.dots, { flexDirection: rowDirection() }]}>
          {SLIDES.map((s, i) => (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityLabel={localizeDigits(t('tour.step', { n: i + 1, total: SLIDES.length }))}
              accessibilityState={{ selected: i === index }}
              onPress={() => go(i)}
              hitSlop={8}
            >
              <View style={[styles.dot, i === index && styles.dotOn]} />
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (last ? void finish() : go(index + 1))}
          style={({ pressed }) => [styles.next, pressed && styles.dim]}
        >
          <Text style={styles.nextText}>{last ? t('tour.start') : t('tour.next')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: space.xl },
    column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
    top: { alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
    step: { fontSize: font.sm, color: colors.textMuted, fontWeight: '600' },
    skip: { minHeight: 44, minWidth: 64, justifyContent: 'center', alignItems: 'flex-end' },
    skipText: { fontSize: font.md, fontWeight: '700', color: colors.primary },
    slide: { flex: 1, justifyContent: 'center', gap: space.md },
    art: { alignItems: 'center', marginBottom: space.lg },
    title: { fontSize: font.xxl, fontWeight: '700', color: colors.text, lineHeight: 36 },
    body: { fontSize: font.lg, color: colors.textMuted, lineHeight: 26 },
    dots: { justifyContent: 'center', gap: space.sm, marginVertical: space.lg },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    dotOn: { width: 24, backgroundColor: colors.primary },
    next: {
      minHeight: 52,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nextText: { color: colors.primaryText, fontSize: font.md, fontWeight: '700' },
    dim: { opacity: 0.7 },
  }),
);
