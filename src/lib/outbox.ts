import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { api } from './api';
import { dbErrorKey } from './errors';
import { isLocalFile, uploadLocalFile } from './files';
import { isNetworkError } from './net';
import { markOffline, markOnline } from './offlineStore';
import { supabase } from './supabase';
import { uuid } from './util';

/**
 * Outbox (PRD §17.2): actions taken without a network are saved on the phone with a unique id
 * (also the idempotency key), then sent when the network is back. The server re-checks every one
 * with its own clock; retries can never create duplicates.
 */
export type OutboxType =
  | 'expense_create'
  | 'expense_edit'
  | 'expense_delete'
  | 'need_create'
  | 'need_accept'
  | 'payment_claim';

export interface OutboxItem {
  id: string;
  type: OutboxType;
  userId: string;
  roomId: string;
  /** Short text shown in lists, e.g. the expense title. */
  label: string;
  /** Minor units for money items (used for the "estimated" balance). */
  amount: number | null;
  /** Pre-formatted amount for lists, e.g. "KWD 5.000". */
  amountText: string | null;
  payload: Record<string, unknown>;
  createdAt: number;
  status: 'waiting' | 'failed';
  errorKey: string | null;
  attempts: number;
}

const KEY = 'mm.outbox';
let items: OutboxItem[] = [];
let loaded: Promise<void> | null = null;
let running = false;
const listeners = new Set<() => void>();

function emit() {
  items = [...items];
  listeners.forEach((l) => l());
}

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // keep going in memory
  }
}

export function loadOutbox(): Promise<void> {
  loaded ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    } catch {
      items = [];
    }
    emit();
  })();
  return loaded;
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => items,
    () => items,
  );
}

export function pendingCount(): number {
  return items.length;
}

/** Forget everything (confirmed sign-out). */
export async function clearOutbox(): Promise<void> {
  items = [];
  emit();
  await persist();
}

type Result = { late?: boolean };

/** Send one item to the server. Throws on failure. */
async function send(item: OutboxItem, queued: boolean): Promise<Result> {
  const p = item.payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  switch (item.type) {
    case 'expense_create': {
      let receipt = (p.receiptPath as string | null) ?? null;
      if (isLocalFile(receipt)) {
        receipt = await uploadLocalFile(item.roomId, receipt);
        p.receiptPath = receipt; // remember so a retry does not upload twice
        await persist();
      }
      const args = {
        roomId: item.roomId,
        title: p.title as string,
        amount: p.amount as number,
        date: p.date as string,
        notes: p.notes as string,
        participants: (p.participants as string[] | null) ?? null,
        receiptPath: receipt,
        idempotencyKey: item.id,
      };
      let id: string;
      let late = false;
      if (queued) {
        const r = await api.syncCreateExpense(args);
        id = r.id;
        late = r.late;
      } else {
        id = await api.createExpense({ ...args, paidBy: item.userId });
      }
      if (p.needId) await api.completeNeed(p.needId as string, id);
      return { late };
    }
    case 'expense_edit': {
      let receipt = (p.receiptPath as string | null) ?? null;
      if (isLocalFile(receipt)) {
        receipt = await uploadLocalFile(item.roomId, receipt);
        p.receiptPath = receipt;
        await persist();
      }
      const args = {
        id: p.expenseId as string,
        title: p.title as string,
        amount: p.amount as number,
        date: p.date as string,
        notes: p.notes as string,
        participants: (p.participants as string[] | null) ?? null,
        receiptPath: receipt,
      };
      if (queued) await api.syncEditExpense({ ...args, baseUpdated: p.baseUpdated as string });
      else await api.editExpense({ ...args, paidBy: item.userId });
      return {};
    }
    case 'expense_delete':
      if (queued) await api.syncDeleteExpense(p.expenseId as string, p.baseUpdated as string);
      else await api.deleteExpense(p.expenseId as string);
      return {};
    case 'need_create':
      await api.syncCreateNeed(item.roomId, p.title as string, p.note as string, item.id);
      return {};
    case 'need_accept':
      await api.acceptNeed(p.needId as string);
      return {};
    case 'payment_claim': {
      let proof = (p.proofPath as string | null) ?? null;
      if (isLocalFile(proof)) {
        proof = await uploadLocalFile(item.roomId, proof);
        p.proofPath = proof;
        await persist();
      }
      await api.claimPayment({
        lineId: p.lineId as string,
        amount: p.amount as number,
        method: p.method as never,
        reference: p.reference as string,
        proofPath: proof,
        note: p.note as string,
        idempotencyKey: item.id,
      });
      return {};
    }
  }
}

export interface SubmitInput {
  type: OutboxType;
  userId: string;
  roomId: string;
  label: string;
  amount?: number | null;
  amountText?: string | null;
  payload: Record<string, unknown>;
  /** Fixed id so a form's double-tap or retry reuses the same idempotency key. */
  id?: string;
}

/**
 * Try right now. If the network is down the action is saved and `queued` is true.
 * Server rule errors (not a network problem) are thrown so the screen can show the reason.
 */
export async function submitOrQueue(input: SubmitInput): Promise<{ queued: boolean }> {
  await loadOutbox();
  const item: OutboxItem = {
    id: input.id ?? uuid(),
    type: input.type,
    userId: input.userId,
    roomId: input.roomId,
    label: input.label,
    amount: input.amount ?? null,
    amountText: input.amountText ?? null,
    payload: input.payload,
    createdAt: Date.now(),
    status: 'waiting',
    errorKey: null,
    attempts: 0,
  };
  try {
    await send(item, false);
    markOnline();
    return { queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    markOffline();
    if (!items.some((i) => i.id === item.id)) {
      items.push(item);
      emit();
      await persist();
    }
    return { queued: true };
  }
}

/** Send everything waiting, oldest first. Stops at the first network failure. */
export async function runOutbox(): Promise<void> {
  await loadOutbox();
  if (running) return;
  running = true;
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    for (const item of [...items]) {
      if (item.status === 'failed' || item.userId !== uid) continue;
      try {
        item.attempts += 1;
        await send(item, true);
        items = items.filter((i) => i.id !== item.id);
        markOnline();
      } catch (e) {
        if (isNetworkError(e)) {
          markOffline();
          break;
        }
        item.status = 'failed';
        item.errorKey = dbErrorKey(e as { message?: string });
      }
      emit();
      await persist();
    }
  } finally {
    running = false;
    emit();
    await persist();
  }
}

/** Failed items go back to waiting (e.g. after the user fixed the cause). */
export async function retryItem(id: string): Promise<void> {
  const it = items.find((i) => i.id === id);
  if (it) {
    it.status = 'waiting';
    it.errorKey = null;
    emit();
    await persist();
  }
  await runOutbox();
}

export async function discardItem(id: string): Promise<void> {
  items = items.filter((i) => i.id !== id);
  emit();
  await persist();
}

let started = false;
/** Start background syncing: when the app opens or returns to the foreground, and every 20 s. */
export function startSync(): void {
  if (started) return;
  started = true;
  void loadOutbox().then(() => runOutbox());
  AppState.addEventListener('change', (s) => {
    if (s === 'active') void runOutbox();
  });
  setInterval(() => {
    if (items.some((i) => i.status === 'waiting')) void runOutbox();
  }, 20_000);
}
