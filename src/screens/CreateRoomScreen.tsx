import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '../lib/api';
import { countriesSorted, Country, defaultTimeZone, LanguageCode } from '../lib/countries';
import { dbErrorKey } from '../lib/errors';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Field, Notice, Screen, Spacer, Title } from '../ui/components';
import { colors, font, radius, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'CreateRoom'>;

export function CreateRoomScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as LanguageCode) ?? 'en';
  const all = useMemo(() => countriesSorted(lang), [lang]);

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all
      .filter(
        (c) => Object.values(c.names).some((n) => n.toLowerCase().includes(q)) || c.code.toLowerCase() === q,
      )
      .slice(0, 8);
  }, [all, query]);

  function pick(c: Country) {
    setCountry(c);
    setZone(defaultTimeZone(c));
    setQuery('');
  }

  async function create() {
    setError(null);
    if (!name.trim() || !country || !zone) return;
    setBusy(true);
    try {
      const id = await api.createRoom({
        name: name.trim(),
        countryCode: country.code,
        currency: country.currency,
        decimals: country.decimals,
        timeZone: zone,
      });
      navigation.replace('Room', { roomId: id });
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>{t('room.createTitle')}</Title>
      <Spacer />
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Field
        label={t('room.name')}
        placeholder={t('room.namePlaceholder')}
        value={name}
        onChangeText={setName}
      />

      {country ? (
        <View style={styles.selected}>
          <View style={styles.flex}>
            <Text style={styles.label}>{t('room.country')}</Text>
            <Text style={styles.value}>{country.names[lang]}</Text>
          </View>
          <Button title={t('common.cancel')} variant="link" onPress={() => setCountry(null)} />
        </View>
      ) : (
        <>
          <Field
            label={t('room.country')}
            placeholder={t('room.countrySearch')}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {matches.map((c) => (
            <Pressable key={c.code} onPress={() => pick(c)} style={styles.option}>
              <Text style={styles.value}>{c.names[lang]}</Text>
              <Text style={styles.meta}>{c.currency}</Text>
            </Pressable>
          ))}
        </>
      )}

      {country ? (
        <>
          <View style={styles.selected}>
            <View style={styles.flex}>
              <Text style={styles.label}>{t('room.currency')}</Text>
              <Text style={styles.value}>{country.currency}</Text>
              <Text style={styles.meta}>{t('room.currencyAuto')}</Text>
            </View>
          </View>
          <Text style={styles.label}>{t('room.timeZone')}</Text>
          {country.timeZones.length > 1 ? <Body muted>{t('room.timeZonePick')}</Body> : null}
          <View style={styles.zones}>
            {country.timeZones.map((z) => (
              <Pressable
                key={z}
                onPress={() => setZone(z)}
                style={[styles.chip, zone === z && styles.chipOn]}
                accessibilityState={{ selected: zone === z }}
              >
                <Text style={[styles.chipText, zone === z && styles.chipTextOn]}>{z.replace(/_/g, ' ')}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Spacer size="xl" />
      <Button
        title={t('room.create')}
        onPress={create}
        loading={busy}
        disabled={!name.trim() || !country || !zone}
      />
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
    label: { fontSize: font.sm, fontWeight: '600', color: colors.text, marginBottom: space.xs },
    value: { fontSize: font.md, color: colors.text },
    meta: { fontSize: font.sm, color: colors.textMuted },
    option: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: space.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    selected: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: space.md,
      marginBottom: space.lg,
    },
    zones: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
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
  }),
);
