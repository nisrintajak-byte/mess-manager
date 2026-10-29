import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

/**
 * The special Need Request alert (founder 2026-10-20): ~4.5 s bell sound + long vibration on its
 * own Android channel. Android fixes a channel's sound when it is first created, so the sound
 * file name and channel id must never be reused for a different sound — make a new id instead.
 */
export const NEED_CHANNEL = 'need_alert';
export const NEED_SOUND = 'need_alert.wav';
const NEED_VIBRATION = [0, 600, 250, 600, 250, 1000];

export async function ensureNeedChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NEED_CHANNEL, {
    name,
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.MAX,
    sound: NEED_SOUND,
    vibrationPattern: NEED_VIBRATION,
    enableVibrate: true,
  });
}

/**
 * Let people hear the alert in Settings. On the phone it plays the file directly (media volume),
 * so the preview is heard even when the ringer is on silent (founder 2026-10-29).
 */
export async function previewNeedAlert(): Promise<void> {
  if (Platform.OS === 'web') {
    const base = (Constants.expoConfig?.experiments as { baseUrl?: string } | undefined)?.baseUrl ?? '';
    const audio = new Audio(`${window.location.origin}${base}/sounds/${NEED_SOUND}`);
    await audio.play().catch(() => undefined);
    return;
  }
  await setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  const player = createAudioPlayer(require('../../assets/sounds/need_alert.wav'));
  player.addListener('playbackStatusUpdate', (status) => {
    if (status.didJustFinish) player.remove();
  });
  player.play();
  Vibration.vibrate(NEED_VIBRATION);
}
