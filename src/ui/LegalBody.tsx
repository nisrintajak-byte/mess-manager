import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { legalTexts } from '../legal';
import { Body, Meta, Notice } from './components';
import { colors, font, space, themedStyles } from './theme';

/** The sections of the Privacy Policy or the Terms, in the reader's language. */
export function LegalBody({ doc, showTitle = false }: { doc: 'privacy' | 'terms'; showTitle?: boolean }) {
  const { i18n } = useTranslation();
  const texts = legalTexts(i18n.language);
  const d = texts[doc];
  return (
    <View>
      {showTitle ? <Text style={styles.title}>{d.title}</Text> : null}
      <Notice tone="info">{texts.draft}</Notice>
      <Meta>{texts.updated}</Meta>
      {d.sections.map((s) => (
        <View key={s.h} style={styles.section}>
          <Text style={styles.h}>{s.h}</Text>
          {s.p.map((para, i) => (
            <Body key={i}>{para}</Body>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    title: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    section: { marginTop: space.md, gap: space.xs },
    h: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  }),
);
