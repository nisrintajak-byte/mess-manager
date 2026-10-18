import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text } from 'react-native';

import { api, CycleKind, Room } from '../lib/api';
import { countriesSorted, Country, defaultTimeZone, getCountry, LanguageCode } from '../lib/countries';
import { dbErrorKey } from '../lib/errors';
import type { AppStackParamList } from '../navigation/types';
import {
  Body,
  Button,
  Chip,
  ChipRow,
  Field,
  Label,
  Meta,
  Notice,
  Screen,
  Spacer,
  Title,
} from '../ui/components';
import { confirm } from '../ui/hooks';
import { colors, font, space } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'RoomSettings'>;
const KINDS: CycleKind[] = ['daily', 'weekly', 'monthly'];

export function RoomSettingsScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as LanguageCode) ?? 'en';
  const all = useMemo(() => countriesSorted(lang), [lang]);

  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [query, setQuery] = useState('');
  const [zone, setZone] = useState<string | null>(null);
  const [kind, setKind] = useState<CycleKind>('monthly');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .room(roomId)
      .then((r) => {
        setRoom(r);
        setName(r.name);
        setCountry(getCountry(r.country_code) ?? null);
        setZone(r.pending_time_zone ?? r.time_zone);
        setKind(r.pending_settlement_cycle ?? r.settlement_cycle);
      })
      .catch(() => setNotice({ tone: 'error', text: t('common.genericError') }));
  }, [roomId, t]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return all.filter((c) => Object.values(c.names).some((n) => n.toLowerCase().includes(q))).slice(0, 8);
  }, [all, query]);

  if (!room || !country) {
    return (
      <Screen>
        {notice ? (
          <Notice tone={notice.tone}>{notice.text}</Notice>
        ) : (
          <Body muted>{t('common.loading')}</Body>
        )}
      </Screen>
    );
  }

  async function save() {
    if (!country || !zone || !name.trim()) return;
    setNotice(null);
    setBusy(true);
    try {
      const res = await api.updateRoomSettings({
        roomId,
        name: name.trim(),
        countryCode: country.code,
        currency: country.currency,
        decimals: country.decimals,
        timeZone: zone,
        cycle: kind,
      });
      setNotice({
        tone: 'success',
        text: res.startsWith('effective_next_cycle:')
          ? t('settings.effectiveNext', { date: res.split(':')[1] })
          : t('settings.saved'),
      });
    } catch (e) {
      setNotice({ tone: 'error', text: t(dbErrorKey(e as { message?: string })) });
    } finally {
      setBusy(false);
    }
  }

  async function removeRoom() {
    if (!(await confirm(t('settings.deleteConfirm'), t('common.yes'), t('common.no')))) return;
    try {
      await api.deleteRoom(roomId);
      navigation.popToTop();
    } catch (e) {
      setNotice({ tone: 'error', text: t(dbErrorKey(e as { message?: string })) });
    }
  }

  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      <Spacer />
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <Field label={t('settings.name')} value={name} onChangeText={setName} maxLength={80} />

      <Label>{t('room.country')}</Label>
      <Text style={styles.value}>
        {country.names[lang]} · {country.currency}
      </Text>
      <Field
        label={t('room.countrySearch')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        placeholder={t('room.countrySearch')}
      />
      {matches.map((c) => (
        <Pressable
          key={c.code}
          style={styles.option}
          onPress={() => {
            setCountry(c);
            setZone(defaultTimeZone(c));
            setQuery('');
          }}
        >
          <Text style={styles.value}>{c.names[lang]}</Text>
          <Meta>{c.currency}</Meta>
        </Pressable>
      ))}
      <Meta>{t('settings.currencyRule')}</Meta>
      <Spacer />

      <Label>{t('room.timeZone')}</Label>
      <ChipRow>
        {country.timeZones.map((z) => (
          <Chip key={z} on={zone === z} onPress={() => setZone(z)} label={z.replace(/_/g, ' ')} />
        ))}
      </ChipRow>

      <Label>{t('room.cycle')}</Label>
      <ChipRow>
        {KINDS.map((k) => (
          <Chip key={k} on={kind === k} onPress={() => setKind(k)} label={t(`room.cycle_${k}`)} />
        ))}
      </ChipRow>

      <Button title={t('settings.save')} onPress={save} loading={busy} disabled={!zone || !name.trim()} />
      <Spacer size="xxl" />
      <Button title={t('settings.deleteRoom')} variant="link" onPress={removeRoom} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: font.md, color: colors.text, marginBottom: space.sm },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: space.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
});
