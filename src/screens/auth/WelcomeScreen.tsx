import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AuthStackParamList } from '../../navigation/types';
import { GoogleButton } from '../../ui/GoogleButton';
import { LanguagePicker } from '../../ui/LanguagePicker';
import { colors, font, radius, rowDirection, space, themedStyles } from '../../ui/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const LOGO = require('../../../assets/logo-large.png');

/**
 * First screen (founder 2026-10-21: as simple as possible): logo, one line about the app, and
 * three clear choices. Language can be picked before anything else.
 */
export function WelcomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bg, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.md }]}>
      <View style={styles.column}>
        <LanguagePicker />
        <View style={styles.center}>
          <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
          <Text style={styles.name}>{t('app.name')}</Text>
          <Text style={styles.tagline}>{t('welcome.tagline')}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Signup')}
            style={({ pressed }) => [styles.primary, pressed && styles.dim]}
          >
            <Text style={styles.primaryText}>{t('welcome.signUp')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondary, pressed && styles.dim]}
          >
            <Text style={styles.secondaryText}>{t('welcome.logIn')}</Text>
          </Pressable>
          <GoogleButton />
        </View>
        <View style={[styles.links, { flexDirection: rowDirection() }]}>
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => navigation.navigate('Legal', { doc: 'terms' })}
          >
            {t('welcome.terms')}
          </Text>
          <Text style={styles.sep}>|</Text>
          <Text
            style={styles.link}
            accessibilityRole="link"
            onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}
          >
            {t('welcome.privacy')}
          </Text>
          <Text style={styles.sep}>|</Text>
          <Text style={styles.link} accessibilityRole="link" onPress={() => navigation.navigate('Help')}>
            {t('help.short')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: space.xl },
    column: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
    logo: { width: 140, height: 140, borderRadius: 32 },
    name: { fontSize: font.xxl, fontWeight: '700', color: colors.primary },
    tagline: { fontSize: font.md, color: colors.textMuted, textAlign: 'center', maxWidth: 300 },
    actions: { gap: space.md, marginBottom: space.xl },
    primary: {
      minHeight: 56,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: { color: colors.primaryText, fontSize: font.lg, fontWeight: '700' },
    secondary: {
      minHeight: 56,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: { color: colors.text, fontSize: font.lg, fontWeight: '600' },
    dim: { opacity: 0.7 },
    links: { justifyContent: 'center', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
    link: {
      fontSize: font.sm,
      color: colors.textMuted,
      textDecorationLine: 'underline',
      paddingVertical: space.sm,
    },
    sep: { color: colors.border },
  }),
);
