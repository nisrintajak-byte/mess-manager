/**
 * Register this phone for push notifications (Expo Push). Native only; the in-app inbox
 * is the fallback everywhere (PRD §14). Needs an EAS project id in production builds.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api } from './api';

let currentToken: string | null = null;

export type PushState = 'on' | 'web' | 'denied' | 'unavailable';

export async function registerForPush(): Promise<PushState> {
  if (Platform.OS === 'web') return 'web';
  if (!Device.isDevice) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Mess Manager',
        // eslint-disable-next-line import/namespace
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return 'denied';
    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    currentToken = data;
    await api.registerPushToken(data, Platform.OS === 'ios' ? 'ios' : 'android');
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Stop pushes to this phone for the signed-out user (shared phones). */
export async function unregisterPush(): Promise<void> {
  if (!currentToken) return;
  try {
    await api.unregisterPushToken(currentToken);
  } catch {
    // ignore — the token is also replaced on the next sign-in
  }
  currentToken = null;
}
