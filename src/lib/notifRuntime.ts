import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { navigationRef } from '../navigation/navigationRef';
import { syncPinnedSettlements } from './pinned';

/**
 * Phone notification behaviour (native only):
 * - shown even while the app is open;
 * - tapping one opens the right screen;
 * - a settlement push arrives as data only, and the app itself posts the pinned notification
 *   (works with the app closed through a background task).
 */
export const BG_TASK = 'mm-background-notification';

if (Platform.OS !== 'web') {
  TaskManager.defineTask(BG_TASK, async ({ data }) => {
    const d = (data ?? {}) as { data?: { kind?: string }; kind?: string };
    const kind = d.data?.kind ?? d.kind;
    if (kind === 'settlement_generated') await syncPinnedSettlements(true);
  });
}

type Target = { kind?: string; room_id?: string; settlement_id?: string; expense_id?: string };

function openTarget(d: Target): void {
  if (!navigationRef.isReady() || !d.room_id) return;
  const roomId = d.room_id;
  if (d.settlement_id) return navigationRef.navigate('Settlement', { roomId, settlementId: d.settlement_id });
  if (d.expense_id && d.kind !== 'expense_deleted')
    return navigationRef.navigate('ExpenseDetail', { roomId, expenseId: d.expense_id });
  if (d.kind?.startsWith('need_')) return navigationRef.navigate('Needs', { roomId });
  if (d.kind?.startsWith('dispute_')) return navigationRef.navigate('Disputes', { roomId });
  if (d.kind === 'join_request') return navigationRef.navigate('RoomMembers', { roomId });
  navigationRef.navigate('Room', { roomId });
}

let started = false;
export function startNotificationRuntime(): void {
  if (started || Platform.OS === 'web') return;
  started = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  void Notifications.registerTaskAsync(BG_TASK).catch(() => undefined);
  Notifications.addNotificationReceivedListener((n) => {
    const d = n.request.content.data as Target | undefined;
    if (d?.kind === 'settlement_generated' && !n.request.identifier.startsWith('settle-'))
      void syncPinnedSettlements(true);
  });
  Notifications.addNotificationResponseReceivedListener((r) => {
    openTarget((r.notification.request.content.data ?? {}) as Target);
  });
  void Notifications.getLastNotificationResponseAsync().then((r) => {
    if (r) setTimeout(() => openTarget((r.notification.request.content.data ?? {}) as Target), 800);
  });
}
