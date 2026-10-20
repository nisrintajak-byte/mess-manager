import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, font, space, themedStyles } from './theme';

const LOGO = require('../../assets/logo-small.png');

/** Logo + app name at the top of the sign-in screens. */
export function BrandMark() {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={styles.name}>{t('app.name')}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: { alignItems: 'center', marginTop: space.xl, gap: space.sm },
    logo: { width: 88, height: 88, borderRadius: 20 },
    name: { fontSize: font.xl, fontWeight: '700', color: colors.primary },
  }),
);
