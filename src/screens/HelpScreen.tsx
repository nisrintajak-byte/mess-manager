import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { helpTexts, HelpTopic } from '../help';
import { localizeDigits } from '../lib/digits';
import { Body, Screen, Section, Title } from '../ui/components';
import { Icon, IconName } from '../ui/Icon';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';

/** "How to use Mess Manager" — the in-app user guide (founder 2026-10-21). */
export function HelpScreen({ route }: { route: { params?: { topic?: string } } }) {
  const { i18n } = useTranslation();
  const h = helpTexts(i18n.language);
  const [open, setOpen] = useState<string | null>(route.params?.topic ?? h.topics[0]?.id ?? null);

  const list = (admin: boolean) =>
    h.topics
      .filter((x) => x.admin === admin)
      .map((x) => (
        <Topic key={x.id} x={x} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} />
      ));

  return (
    <Screen>
      <Title>{h.title}</Title>
      <Body muted>{h.intro}</Body>
      <Section>{h.everyone}</Section>
      {list(false)}
      <Section>{h.admins}</Section>
      {list(true)}
      <Body muted>{h.contact}</Body>
    </Screen>
  );
}

function Topic({ x, open, onToggle }: { x: HelpTopic; open: boolean; onToggle: () => void }) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={[styles.head, { flexDirection: rowDirection() }]}
      >
        <View style={styles.icon}>
          <Icon name={x.icon as IconName} size={20} color={colors.getText} />
        </View>
        <Text style={styles.title}>{x.title}</Text>
        <Text style={styles.chev}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.steps}>
          {x.steps.map((s, i) => (
            <View key={s} style={[styles.step, { flexDirection: rowDirection() }]}>
              <View style={styles.num}>
                <Text style={styles.numText}>{localizeDigits(String(i + 1))}</Text>
              </View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: space.sm,
      overflow: 'hidden',
    },
    head: { alignItems: 'center', gap: space.md, padding: space.md, minHeight: 56 },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.getBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { flex: 1, fontSize: font.md, fontWeight: '700', color: colors.text },
    chev: { fontSize: font.xl, color: colors.primary, fontWeight: '700', width: 24, textAlign: 'center' },
    steps: { paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
    step: { gap: space.sm, alignItems: 'flex-start' },
    num: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    numText: { color: colors.primaryText, fontSize: 12, fontWeight: '700' },
    stepText: { flex: 1, fontSize: font.md, color: colors.text, lineHeight: 22 },
  }),
);
