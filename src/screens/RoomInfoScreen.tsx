import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { INVITE_APP_LINK } from '../config';
import { api } from '../lib/api';
import { getCountry, LanguageCode } from '../lib/countries';
import { dbErrorKey } from '../lib/errors';
import { requireReauth } from '../lib/reauth';
import type { AppStackParamList } from '../navigation/types';
import { Body, Button, Card, Label, Meta, Notice, Screen, Section, Spacer } from '../ui/components';
import { confirm, useLoader } from '../ui/hooks';
import { LegalCard } from '../ui/LegalCard';
import { colors, font, space, themedStyles } from '../ui/theme';

type Props = NativeStackScreenProps<AppStackParamList, 'RoomInfo'>;

/**
 * Room details for every member: invite code, the Room's settings, and — at the very bottom,
 * behind two confirmations and the password — leaving the Room (founder 2026-10-20: leaving
 * must not be one easy tap on the Room screen).
 */
export function RoomInfoScreen({ navigation, route }: Props) {
  const { roomId } = route.params;
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as LanguageCode) ?? 'en';
  const { session } = useAuth();
  const me = session?.user.id;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const { data } = useLoader(async () => {
    const [room, members] = await Promise.all([api.room(roomId), api.members(roomId)]);
    return { room, members };
  }, roomId);

  if (!data) {
    return (
      <Screen>
        <Body muted>{t('common.loading')}</Body>
      </Screen>
    );
  }
  const { room, members } = data;
  const isAdmin = members.some((m) => m.user_id === me && m.status === 'approved' && m.role === 'admin');

  async function invite() {
    const message = t('room.inviteMessage', { room: room.name, code: room.join_code, link: INVITE_APP_LINK });
    try {
      const r = await Share.share({ message });
      if (r.action === Share.dismissedAction) return;
    } catch {
      setFallback(message); // browsers without a share menu: show the text to copy
    }
  }

  async function leave() {
    setError(null);
    if (!(await confirm(t('room.leaveConfirm'), t('common.yes'), t('common.no')))) return;
    if (!(await confirm(t('room.leaveConfirm2', { room: room.name }), t('room.leave'), t('common.cancel'))))
      return;
    if (!(await requireReauth())) return;
    setBusy(true);
    try {
      await api.leaveRoom(roomId);
      navigation.popToTop();
    } catch (e) {
      setError(t(dbErrorKey(e as { message?: string })));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Label>{t('room.joinCode')}</Label>
        <Text selectable style={styles.code}>
          {room.join_code}
        </Text>
        <Meta>{t('room.joinCodeHint')}</Meta>
        <Spacer size="sm" />
        <Button title={t('room.inviteSend')} onPress={() => void invite()} />
        {fallback ? (
          <>
            <Meta>{t('room.inviteFallback')}</Meta>
            <Text selectable style={styles.message}>
              {fallback}
            </Text>
          </>
        ) : null}
      </Card>

      <Card>
        <Label>{t('room.details')}</Label>
        <Body>{getCountry(room.country_code)?.names[lang] ?? room.country_code}</Body>
        <Meta>
          {room.currency} · {room.time_zone.replace(/_/g, ' ')} · {t(`room.cycle_${room.settlement_cycle}`)}
        </Meta>
        {room.pending_time_zone || room.pending_settlement_cycle ? (
          <Meta>
            {t('settings.pending', {
              what: [
                room.pending_time_zone?.replace(/_/g, ' '),
                room.pending_settlement_cycle ? t(`room.cycle_${room.pending_settlement_cycle}`) : null,
              ]
                .filter(Boolean)
                .join(' · '),
            })}
          </Meta>
        ) : null}
        {isAdmin ? (
          <>
            <Spacer size="sm" />
            <Button
              title={t('settings.open')}
              variant="secondary"
              onPress={() => navigation.navigate('RoomSettings', { roomId })}
            />
          </>
        ) : null}
      </Card>

      <Button title={t('help.open')} variant="secondary" onPress={() => navigation.navigate('Help')} />
      <LegalCard />

      <Spacer size="xxl" />
      <Section>{t('room.dangerZone')}</Section>
      <Card>
        <Body muted>{t('room.leaveExplain')}</Body>
        <Spacer size="sm" />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Button title={t('room.leave')} variant="danger" loading={busy} onPress={() => void leave()} />
      </Card>
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    code: {
      fontSize: font.xl,
      fontWeight: '700',
      letterSpacing: 3,
      color: colors.text,
      marginVertical: space.xs,
    },
    message: { fontSize: font.sm, color: colors.text, marginTop: space.xs },
  }),
);
