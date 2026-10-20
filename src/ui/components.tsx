import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, space, themedStyles } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={styles.scroll}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.column}>{body}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityLabel={label}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'link' | 'danger';
}) {
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'link' && styles.btnLink,
        (pressed || off) && styles.btnDim,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.primaryText : colors.primary} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === 'primary' && styles.btnTextPrimary,
            variant === 'danger' && styles.btnTextPrimary,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Notice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: ReactNode }) {
  return (
    <View
      style={[
        styles.notice,
        tone === 'error' && { backgroundColor: colors.dangerBg },
        tone === 'success' && { backgroundColor: colors.successBg },
        tone === 'info' && { backgroundColor: colors.warnBg },
      ]}
    >
      <Text style={[styles.body, tone === 'error' && { color: colors.danger }]}>{children}</Text>
    </View>
  );
}

export function Checkbox({
  checked,
  onToggle,
  children,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  error?: string | null;
}) {
  return (
    <View style={styles.field}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={styles.checkRow}
      >
        <View style={[styles.box, checked && styles.boxOn, error ? styles.inputError : null]}>
          {checked ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <View style={styles.flex}>{children}</View>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  if (!onPress) return <View style={styles.card}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.btnDim]}>
      {children}
    </Pressable>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function Chip({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Meta({ children }: { children: ReactNode }) {
  return <Text style={styles.meta}>{children}</Text>;
}

export function Badge({
  tone,
  children,
}: {
  tone: 'neutral' | 'good' | 'warn' | 'bad';
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.badge,
        tone === 'good' && { backgroundColor: colors.successBg },
        tone === 'warn' && { backgroundColor: colors.warnBg },
        tone === 'bad' && { backgroundColor: colors.dangerBg },
      ]}
    >
      <Text style={[styles.badgeText, tone === 'bad' && { color: colors.danger }]}>{children}</Text>
    </View>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function Spacer({ size = 'lg' }: { size?: keyof typeof space }) {
  return <View style={{ height: space[size] }} />;
}

const styles = themedStyles(() =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
    scroll: { padding: space.lg, paddingBottom: space.xxl, flexGrow: 1 },
    title: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: space.sm },
    body: { fontSize: font.md, color: colors.text, lineHeight: 22 },
    muted: { color: colors.textMuted },
    field: { marginBottom: space.lg },
    label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.xs },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: space.md,
      paddingVertical: space.md,
      fontSize: font.md,
      color: colors.text,
    },
    inputError: { borderColor: colors.danger },
    error: { color: colors.danger, fontSize: font.sm, marginTop: space.xs },
    btn: {
      minHeight: 50,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: space.lg,
      marginBottom: space.sm,
    },
    btnPrimary: { backgroundColor: colors.primary },
    btnSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    btnDanger: { backgroundColor: colors.danger },
    btnLink: { minHeight: 40 },
    btnDim: { opacity: 0.6 },
    btnText: { fontSize: font.md, fontWeight: '600', color: colors.primary },
    btnTextPrimary: { color: colors.primaryText },
    notice: { borderRadius: radius.md, padding: space.md, marginBottom: space.lg },
    checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    box: {
      width: 24,
      height: 24,
      borderRadius: radius.sm,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tick: { color: colors.primaryText, fontWeight: '700' },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.lg,
      marginBottom: space.md,
      shadowColor: '#14202B',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
    chip: {
      paddingHorizontal: space.md,
      paddingVertical: space.sm,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.text, fontSize: font.sm },
    chipTextOn: { color: colors.primaryText },
    meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: space.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.border,
      marginTop: space.xs,
    },
    badgeText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
    section: {
      fontSize: font.lg,
      fontWeight: '700',
      color: colors.text,
      marginTop: space.lg,
      marginBottom: space.md,
    },
  }),
);
