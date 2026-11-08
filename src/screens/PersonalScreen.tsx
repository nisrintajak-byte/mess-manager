import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, type PersonalExpense } from '../lib/api';
import { dateLocale, localizeDigits } from '../lib/digits';
import { formatMoney } from '../lib/money';
import { deviceToday, monthBounds, monthTotals, shiftMonth } from '../lib/personal';
import type { AppStackParamList } from '../navigation/types';
import { BottomBar } from '../ui/BottomBar';
import { Notice } from '../ui/components';
import { EmptyState } from '../ui/EmptyState';
import { useLoader } from '../ui/hooks';
import { Icon } from '../ui/Icon';
import { colors, font, radius, rowDirection, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'Personal'>;

function monthLabel(month: string): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    );
  } catch {
    return month;
  }
}

function dayLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    return iso;
  }
}

/**
 * My expenses (v1.1, founder 2026-11-08): the member's own spending, one month at a time.
 * Private to the member and fully separate from Rooms — nothing here reaches a Room, its
 * members, history, settlements or reports.
 */
export function PersonalScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const thisMonth = deviceToday().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const { from, to } = monthBounds(month);
  const { data, error, loading, reload } = useLoader(() => api.personalExpenses(from, to), month);
  const rows = data ?? [];
  const totals = monthTotals(rows);
  const money = (x: { amount: number; currency: string; decimals: number }) =>
    localizeDigits(formatMoney(x.amount, x.currency, x.decimals));

  // entries grouped by day, newest day first (the server already sorts them)
  const days: { date: string; items: PersonalExpense[] }[] = [];
  for (const r of rows) {
    const last = days[days.length - 1];
    if (last && last.date === r.expense_date) last.items.push(r);
    else days.push({ date: r.expense_date, items: [r] });
  }

  const add = () => navigation.navigate('PersonalExpense');
  const flip = rowDirection() === 'row-reverse';

  return (
    <View style={styles.bg}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}
      >
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
          <View style={styles.heroInner}>
            <Text style={styles.heroTitle}>{t('personal.title')}</Text>
            <View style={[styles.privateRow, { flexDirection: rowDirection() }]}>
              <Icon name="lock" size={14} color={colors.heroMuted} />
              <Text style={styles.heroMuted}>{t('personal.privateNote')}</Text>
            </View>

            <View style={[styles.monthRow, { flexDirection: rowDirection() }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('personal.prevMonth')}
                onPress={() => setMonth(shiftMonth(month, -1))}
                style={styles.monthBtn}
              >
                <View style={flip ? null : styles.flip}>
                  <Icon name="chevron" size={20} color={colors.heroText} />
                </View>
              </Pressable>
              <Text style={styles.monthText}>{localizeDigits(monthLabel(month))}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('personal.nextMonth')}
                accessibilityState={{ disabled: month >= thisMonth }}
                disabled={month >= thisMonth}
                onPress={() => setMonth(shiftMonth(month, 1))}
                style={[styles.monthBtn, month >= thisMonth && styles.hidden]}
              >
                <View style={flip ? styles.flip : null}>
                  <Icon name="chevron" size={20} color={colors.heroText} />
                </View>
              </Pressable>
            </View>

            <View style={styles.totalTile}>
              <Text style={styles.heroMuted}>{t('personal.monthTotal')}</Text>
              {totals.length === 0 ? (
                <Text style={styles.totalBig}>—</Text>
              ) : (
                totals.map((x) => (
                  <Text key={x.currency} style={styles.totalBig}>
                    {money(x)}
                  </Text>
                ))
              )}
              <Text style={styles.heroMuted}>
                {localizeDigits(t('personal.entryCount', { count: rows.length }))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.column}>
          {error ? <Notice tone="error">{t('common.genericError')}</Notice> : null}

          <Pressable
            accessibilityRole="button"
            onPress={add}
            style={({ pressed }) => [styles.addBtn, { flexDirection: rowDirection() }, pressed && styles.dim]}
          >
            <Icon name="plus" size={20} color={colors.primaryText} />
            <Text style={styles.addText}>{t('personal.add')}</Text>
          </Pressable>

          {totals.some((x) => x.byCategory.length > 1) ? (
            <View style={styles.card}>
              <Text style={styles.section}>{t('personal.byCategory')}</Text>
              {totals.flatMap((x) =>
                x.byCategory.map((c) => (
                  <View
                    key={`${x.currency}-${c.category}`}
                    style={[styles.catRow, { flexDirection: rowDirection() }]}
                  >
                    <Text style={[styles.catName, styles.flex]}>{t(`personal.cat_${c.category}`)}</Text>
                    <View style={styles.catBarWrap}>
                      <View
                        style={[styles.catBar, { width: `${Math.max(4, (c.amount / x.amount) * 100)}%` }]}
                      />
                    </View>
                    <Text style={styles.catAmount}>
                      {money({ amount: c.amount, currency: x.currency, decimals: x.decimals })}
                    </Text>
                  </View>
                )),
              )}
            </View>
          ) : null}

          {data && rows.length === 0 ? (
            <View style={styles.card}>
              <EmptyState
                art="expense"
                size={140}
                title={t('personal.emptyTitle')}
                body={t(month === thisMonth ? 'personal.emptyBody' : 'personal.emptyMonth')}
              />
            </View>
          ) : null}

          {days.map((d) => (
            <View key={d.date} style={styles.day}>
              <Text style={styles.dayHead}>{localizeDigits(dayLabel(d.date))}</Text>
              {d.items.map((x) => (
                <Pressable
                  key={x.id}
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('PersonalExpense', { id: x.id })}
                  style={({ pressed }) => [
                    styles.row,
                    { flexDirection: rowDirection() },
                    pressed && styles.dim,
                  ]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {x.title}
                    </Text>
                    {x.category || x.notes ? (
                      <Text style={styles.meta} numberOfLines={1}>
                        {[x.category ? t(`personal.cat_${x.category}`) : null, x.notes]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.rowAmount}>
                    {money({ amount: x.amount, currency: x.currency, decimals: x.currency_decimals })}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomBar current="Personal" />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    bg: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: space.xxl },
    flex: { flex: 1 },
    dim: { opacity: 0.7 },
    flip: { transform: [{ scaleX: -1 }] },
    hidden: { opacity: 0 },
    hero: { backgroundColor: colors.hero, paddingHorizontal: space.lg, paddingBottom: space.lg },
    heroInner: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: space.sm },
    heroTitle: { fontSize: font.xl, fontWeight: '700', color: colors.heroText },
    heroMuted: { fontSize: font.sm, color: colors.heroMuted },
    privateRow: { alignItems: 'center', gap: space.xs },
    monthRow: { alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
    monthBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    monthText: { fontSize: font.lg, fontWeight: '700', color: colors.heroText },
    totalTile: {
      backgroundColor: colors.heroTile,
      borderRadius: radius.lg,
      padding: space.md,
      alignItems: 'center',
      gap: 2,
    },
    totalBig: { fontSize: font.xxl, fontWeight: '700', color: colors.heroText },
    column: {
      width: '100%',
      maxWidth: 560,
      alignSelf: 'center',
      paddingHorizontal: space.lg,
      paddingTop: space.lg,
    },
    addBtn: {
      minHeight: 52,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      marginBottom: space.lg,
    },
    addText: { fontSize: font.md, fontWeight: '700', color: colors.primaryText },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      padding: space.md,
      marginBottom: space.lg,
      borderWidth: 1,
      borderColor: colors.border,
      gap: space.sm,
    },
    section: { fontSize: font.md, fontWeight: '700', color: colors.text },
    catRow: { alignItems: 'center', gap: space.sm },
    catName: { fontSize: font.sm, color: colors.text },
    catBarWrap: { width: 80, height: 6, borderRadius: 3, backgroundColor: colors.getBg, overflow: 'hidden' },
    catBar: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
    catAmount: { fontSize: font.sm, fontWeight: '700', color: colors.text, minWidth: 90, textAlign: 'right' },
    day: { marginBottom: space.md },
    dayHead: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted, marginBottom: space.xs },
    row: {
      alignItems: 'center',
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: space.md,
      marginBottom: space.xs,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rowTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
    meta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
    rowAmount: { fontSize: font.md, fontWeight: '700', color: colors.text },
  }),
);
