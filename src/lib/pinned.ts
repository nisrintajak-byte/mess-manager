import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import i18n from '../i18n';
import { api } from './api';
import { formatMoney } from './money';

/**
 * A new settlement stays pinned on the phone (an ongoing notification that cannot be swiped
 * away) until the member opens it and taps "I have seen this" (founder 2026-10-20). The pinned
 * notification is silent — the alert sound comes with the push itself. After that, members who
 * still owe get a normal daily reminder from the server.
 */
export const SETTLEMENT_CHANNEL = 'settlement';
export const PINNED_CHANNEL = 'settlement_pinned';
const PREFIX = 'settle-';

export async function ensureSettlementChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(SETTLEMENT_CHANNEL, {
    name: i18n.t('push.settlementChannel'),
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 400, 200, 400],
  });
  await Notifications.setNotificationChannelAsync(PINNED_CHANNEL, {
    name: i18n.t('push.pinnedChannel'),
    // eslint-disable-next-line import/namespace
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
    enableVibrate: false,
  });
}

function text(net: number, currency: string, decimals: number): string {
  if (net < 0) return i18n.t('settlement.toPay', { amount: formatMoney(-net, currency, decimals) });
  if (net > 0) return i18n.t('settlement.toReceive', { amount: formatMoney(net, currency, decimals) });
  return i18n.t('settlement.even');
}

/** Show a pinned notification for every open settlement and remove the ones acknowledged. */
export async function syncPinnedSettlements(alert = false): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const open = await api.myOpenSettlements();
    const keep = new Set(open.map((o) => PREFIX + o.settlement_id));
    const shown = await Notifications.getPresentedNotificationsAsync();
    for (const n of shown) {
      const id = n.request.identifier;
      if (id.startsWith(PREFIX) && !keep.has(id)) await Notifications.dismissNotificationAsync(id);
    }
    const already = new Set(shown.map((n) => n.request.identifier));
    for (const o of open) {
      const id = PREFIX + o.settlement_id;
      if (already.has(id)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: id,
        content: {
          title: i18n.t('push.settlementTitle', { room: o.room }),
          body: `${text(o.net, o.currency, o.decimals)} · ${i18n.t('push.settlementTap')}`,
          sticky: true,
          autoDismiss: false,
          sound: alert ? 'default' : undefined,
          data: { kind: 'settlement_generated', room_id: o.room_id, settlement_id: o.settlement_id },
        },
        trigger:
          Platform.OS === 'android' ? { channelId: alert ? SETTLEMENT_CHANNEL : PINNED_CHANNEL } : null,
      });
    }
  } catch {
    // offline or signed out: try again next time the app opens
  }
}

/** Remove the pinned notification right after acknowledging. */
export async function unpinSettlement(settlementId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.dismissNotificationAsync(PREFIX + settlementId).catch(() => undefined);
}

let watching = false;
export function watchPinnedSettlements(): void {
  if (watching || Platform.OS === 'web') return;
  watching = true;
  void syncPinnedSettlements();
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void syncPinnedSettlements();
  });
}
