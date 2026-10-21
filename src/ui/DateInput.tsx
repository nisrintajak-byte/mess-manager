import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, rowDirection, space, themedStyles } from './theme';

/**
 * A date typed as three boxes — Day / Month / Year — with the separators already in place and
 * the cursor jumping to the next box (founder 2026-10-21: no need to type "-" or "/").
 * `value` and `onChange` use YYYY-MM-DD ('' while incomplete).
 */
export function DateInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string | null;
}) {
  const { t } = useTranslation();
  const init = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const [d, setD] = useState(init?.[3] ?? '');
  const [m, setM] = useState(init?.[2] ?? '');
  const [y, setY] = useState(init?.[1] ?? '');
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  // follow outside changes (e.g. "Today" / "Yesterday" buttons)
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (p) {
      setD(p[3] ?? '');
      setM(p[2] ?? '');
      setY(p[1] ?? '');
    }
  }

  function emit(dd: string, mm: string, yy: string) {
    const iso = dd.length === 2 && mm.length === 2 && yy.length === 4 ? `${yy}-${mm}-${dd}` : '';
    setSeen(iso || seen);
    onChange(iso);
  }
  const digits = (s: string, n: number) => s.replace(/\D/g, '').slice(0, n);
  const pad = (s: string) => (s.length === 1 ? `0${s}` : s);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.row, { flexDirection: rowDirection() }]}>
        <TextInput
          value={d}
          onChangeText={(v) => {
            const x = digits(v, 2);
            setD(x);
            emit(x, m, y);
            if (x.length === 2) monthRef.current?.focus();
          }}
          onBlur={() => {
            const x = pad(d);
            setD(x);
            emit(x, m, y);
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('date.dd')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${label} — ${t('date.day')}`}
          style={[styles.box, styles.small, error ? styles.bad : null]}
        />
        <Text style={styles.sep}>/</Text>
        <TextInput
          ref={monthRef}
          value={m}
          onChangeText={(v) => {
            const x = digits(v, 2);
            setM(x);
            emit(d, x, y);
            if (x.length === 2) yearRef.current?.focus();
          }}
          onBlur={() => {
            const x = pad(m);
            setM(x);
            emit(d, x, y);
          }}
          keyboardType="number-pad"
          maxLength={2}
          placeholder={t('date.mm')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${label} — ${t('date.month')}`}
          style={[styles.box, styles.small, error ? styles.bad : null]}
        />
        <Text style={styles.sep}>/</Text>
        <TextInput
          ref={yearRef}
          value={y}
          onChangeText={(v) => {
            const x = digits(v, 4);
            setY(x);
            emit(d, m, x);
          }}
          keyboardType="number-pad"
          maxLength={4}
          placeholder={t('date.yyyy')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`${label} — ${t('date.year')}`}
          style={[styles.box, styles.year, error ? styles.bad : null]}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    field: { marginBottom: space.lg },
    label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.xs },
    row: { alignItems: 'center', gap: space.sm },
    box: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: space.md,
      fontSize: font.lg,
      color: colors.text,
      textAlign: 'center',
    },
    small: { width: 64 },
    year: { width: 96 },
    sep: { fontSize: font.xl, color: colors.textMuted },
    bad: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: font.sm, marginTop: space.xs },
  }),
);
