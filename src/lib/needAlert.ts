import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * The special Need Request alert (founder 2026-10-20): ~4.5 s bell sound + long vibration on its
 * own Android channel. Android fixes a channel's sound when it is first created, so the sound
 * file name and channel id must never be reused for a different sound — make a new id instead.
 */
export const NEED_CHANNEL = 'need_alert';
export const NEED_SOUND = 'need_alert.wav';

export async function ensureNeedChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NEED_CHANNEL, {
    name,
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.MAX,
    sound: NEED_SOUND,
    vibrationPattern: [0, 600, 250, 600, 250, 1000],
    enableVibrate: true,
  });
}

/** Let people hear the alert in Settings. */
export async function previewNeedAlert(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') {
    const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
    const audio = new Audio(`${window.location.origin}${base}/sounds/${NEED_SOUND}`);
    await audio.play().catch(() => undefined);
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: NEED_SOUND },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
      ...(Platform.OS === 'android' ? { channelId: NEED_CHANNEL } : {}),
    },
  });
}
