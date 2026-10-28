/**
 * Typed wrappers around the database functions in supabase/migrations.
 * Reads use RLS-protected selects; every write is an RPC so the server enforces the rules.
 */
import i18n from '../i18n';
import { cachedRead } from './offlineStore';
import type { ReportData } from './report';
import { withTimeout } from './net';
import { supabase } from './supabase';

export interface Room {
  id: string;
  name: string;
  country_code: string;
  currency: string;
  currency_decimals: number;
  time_zone: string;
  settlement_cycle: CycleKind;
  pending_time_zone: string | null;
  pending_settlement_cycle: CycleKind | null;
  join_code: string;
  created_at: string;
}

export type CycleKind = 'daily' | 'weekly' | 'monthly';

export interface Cycle {
  id: string;
  room_id: string;
  starts_on: string;
  ends_on: string;
  kind: CycleKind;
  time_zone: string;
  currency: string;
  currency_decimals: number;
  status: 'open' | 'locked';
  locked_at: string | null;
  /** set once the 2-month retention removed this cycle's records */
  purged_at?: string | null;
}

export interface Settlement {
  id: string;
  room_id: string;
  cycle_id: string;
  total: number;
  currency: string;
  currency_decimals: number;
  generated_by: string;
  generated_at: string;
}

export type LineStatus = 'settled' | 'pending' | 'awaiting' | 'partial' | 'paid';

export interface SettlementLine {
  line_id: string;
  user_id: string;
  share: number;
  paid: number;
  net: number;
  confirmed: number;
  awaiting: number;
  status: LineStatus;
}

export type PaymentMethod = 'bank' | 'wallet' | 'cash' | 'other';

export interface Payment {
  id: string;
  settlement_line_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  reference: string | null;
  proof_path: string | null;
  note: string | null;
  status: 'awaiting' | 'confirmed' | 'rejected';
  claimed_by: string;
  claimed_at: string;
  decided_by: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  self_confirmed: boolean;
  recorded_by_admin: boolean;
}

export interface RoomOverview {
  room_id: string;
  name: string;
  currency: string;
  decimals: number;
  role: 'admin' | 'member';
  members: number;
  cycle_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  total: number;
  my_paid: number;
  my_share: number;
  open_needs: number;
  pending_requests: number;
}

export interface Member {
  id: string;
  room_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: 'pending' | 'approved' | 'rejected' | 'left' | 'removed';
  requested_at: string;
  joined_on: string | null;
  left_on: string | null;
  profile?: { display_name: string; avatar_url: string | null } | null;
  /** Set for people who left or were removed: shown with a mark everywhere (founder 2026-10-20). */
  former?: { status: 'left' | 'removed'; name: string; removedByName: string | null } | null;
}

export interface Expense {
  id: string;
  room_id: string;
  title: string;
  amount: number;
  currency: string;
  category: string;
  expense_date: string;
  paid_by: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  cycle_id: string | null;
  receipt_path: string | null;
  adjusts_expense_id: string | null;
  split_mode: 'equal' | 'selected';
  is_credit: boolean;
  updated_at: string;
  late_entry_from: string | null;
}

export interface Split {
  expense_id: string;
  user_id: string;
  amount: number;
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

export interface BalanceRow {
  user_id: string;
  paid: number;
  share: number;
  net: number;
}

export interface AppNotification {
  id: string;
  room_id: string | null;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
}

export type FlagTarget = 'expense' | 'payment' | 'settlement_line';
export type FlagReason = 'wrong_amount' | 'not_shared' | 'duplicate' | 'payment_not_received' | 'other';
export type FlagStatus = 'open' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';

export interface Flag {
  id: string;
  room_id: string;
  target_type: FlagTarget;
  target_id: string;
  target_owner: string | null;
  reason: FlagReason;
  note: string | null;
  evidence_path: string | null;
  status: FlagStatus;
  raised_by: string;
  created_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  resolved_by_involved_admin: boolean;
}

export type NeedStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface NeedRequest {
  id: string;
  room_id: string;
  title: string;
  note: string | null;
  status: NeedStatus;
  created_by: string;
  created_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  expense_id: string | null;
}

export interface SettlementAck {
  settlement_id: string;
  user_id: string;
  delivered_at: string;
  seen_at: string | null;
  acknowledged_at: string | null;
}

export const OPTIONAL_NOTIFICATIONS = [
  'expense_added',
  'expense_edited',
  'expense_deleted',
  'need_created',
  'need_accepted',
  'need_completed',
] as const;

export const OPEN_FLAG: FlagStatus[] = ['open', 'under_review'];

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw error;
  return data as T;
}

/** Postgres bigint arrives as string or number; normalise to number. */
const n = (v: unknown) => Number(v);

const rawApi = {
  // ---- v1.0: own profile + login lock ----
  async myProfile(userId: string): Promise<{ display_name: string; avatar_url: string | null }> {
    const rows = unwrap(
      await supabase.from('profiles').select('display_name, avatar_url').eq('id', userId),
    ) as { display_name: string; avatar_url: string | null }[];
    return rows[0] ?? { display_name: '', avatar_url: null };
  },

  async updateProfile(name: string, avatarPath: string | null): Promise<void> {
    unwrap(await supabase.rpc('update_profile', { p_name: name, p_avatar: avatarPath }));
  },

  /** Seconds until this email may try to sign in again (0 = now). */
  async loginWait(email: string): Promise<number> {
    const { data } = await supabase.rpc('login_wait', { p_email: email });
    return Number(data ?? 0);
  },

  async loginFailed(email: string): Promise<number> {
    const { data } = await supabase.rpc('login_failed', { p_email: email });
    return Number(data ?? 0);
  },

  async loginSucceeded(): Promise<void> {
    await supabase.rpc('login_succeeded');
  },

  /** Home screen: every Room with this period's total, what I paid and my share. */
  async myRoomsOverview(): Promise<RoomOverview[]> {
    const rows: RoomOverview[] = unwrap(await supabase.rpc('my_rooms_overview'));
    return rows.map((r) => ({
      ...r,
      total: n(r.total),
      my_paid: n(r.my_paid),
      my_share: n(r.my_share),
    }));
  },

  async myRooms(): Promise<Room[]> {
    return unwrap(await supabase.from('rooms').select('*').is('deleted_at', null).order('created_at'));
  },

  /**
   * 'incomplete' = Google sign-in without date of birth/consent yet; 'outdated' = the legal texts
   * changed since the user accepted them (they must accept again); otherwise 'ok'.
   */
  async profileState(currentLegalVersion: string, userId: string): Promise<'incomplete' | 'outdated' | 'ok'> {
    const rows = unwrap(
      await withTimeout(
        Promise.resolve(supabase.from('profiles').select('consent_version').eq('id', userId)),
        4000,
      ),
    ) as { consent_version: string }[];
    const v = rows[0]?.consent_version;
    if (!v) return 'ok';
    if (v === 'unknown') return 'incomplete';
    return v < currentLegalVersion ? 'outdated' : 'ok';
  },

  async acceptLegal(version: string): Promise<void> {
    unwrap(await supabase.rpc('accept_legal', { p_version: version }));
  },

  async completeProfile(dob: string, consentVersion: string): Promise<void> {
    unwrap(await supabase.rpc('complete_profile', { p_dob: dob, p_consent_version: consentVersion }));
  },

  async myPendingRequests(): Promise<Member[]> {
    const { data: u } = await supabase.auth.getUser();
    return unwrap(
      await supabase
        .from('room_members')
        .select('*')
        .eq('user_id', u.user?.id ?? '')
        .eq('status', 'pending'),
    );
  },

  async room(id: string): Promise<Room> {
    return unwrap(await supabase.from('rooms').select('*').eq('id', id).single());
  },

  async members(roomId: string): Promise<Member[]> {
    const rows: Member[] = unwrap(
      await supabase.from('room_members').select('*').eq('room_id', roomId).order('requested_at'),
    );
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const profiles: {
      id: string;
      display_name: string;
      avatar_url: string | null;
      deleted_at?: string | null;
      purged_at?: string | null;
    }[] = ids.length
      ? unwrap(
          await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, deleted_at, purged_at')
            .in('id', ids),
        )
      : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    // Same names in a Room get a join-order number (Lenovo1, Lenovo2) — computed by the server.
    const labelRows: { user_id: string; label: string }[] = unwrap(
      await supabase.rpc('room_member_labels', { p_room: roomId }),
    );
    // A deleted account shows as "Name (account deleted)" during the 2-month hold (PRD §18.3).
    const deletedLabel = (uid: string, label: string) => {
      const p = byId.get(uid);
      if (p?.purged_at) return i18n.t('account.deletedUser');
      return p?.deleted_at ? i18n.t('account.deletedName', { name: label }) : label;
    };
    const labels = new Map(labelRows.map((l) => [l.user_id, deletedLabel(l.user_id, l.label)]));
    const withLabel = (uid: string) => {
      const p = byId.get(uid);
      const label = labels.get(uid);
      return label ? { display_name: label, avatar_url: p?.avatar_url ?? null } : (p ?? null);
    };
    // Current members (Admins also receive old left/removed rows; those are shown via `former`).
    const current = rows.filter((r) => r.status === 'approved' || r.status === 'pending');
    const out: Member[] = current.map((r) => ({ ...r, profile: withLabel(r.user_id) }));
    const known = new Set(current.map((r) => r.user_id));
    // Everyone sees who left or was removed, when and by whom (transparency).
    const formerRows: {
      user_id: string;
      status: 'left' | 'removed';
      joined_on: string | null;
      left_on: string | null;
      removed_by_name: string | null;
    }[] = unwrap(await supabase.rpc('room_former_members', { p_room: roomId }));
    const formerById = new Map(formerRows.map((f) => [f.user_id, f]));
    for (const [uid, label] of labels) {
      if (known.has(uid)) continue;
      const f = formerById.get(uid);
      // only people who left or were removed; a rejected join request was never a member
      if (!f) continue;
      const status = f.status;
      out.push({
        id: `former:${uid}`,
        room_id: roomId,
        user_id: uid,
        role: 'member',
        status,
        requested_at: '',
        joined_on: f.joined_on,
        left_on: f.left_on,
        profile: { display_name: i18n.t(`members.tag_${status}`, { name: label }), avatar_url: null },
        former: { status, name: label, removedByName: f.removed_by_name },
      });
    }
    return out;
  },

  async memberEmails(roomId: string): Promise<Map<string, string>> {
    const rows: { user_id: string; email: string }[] = unwrap(
      await supabase.rpc('room_member_emails', { p_room: roomId }),
    );
    return new Map(rows.map((r) => [r.user_id, r.email]));
  },

  async expenses(roomId: string): Promise<Expense[]> {
    const rows: Expense[] = unwrap(
      await supabase
        .from('expenses')
        .select('*')
        .eq('room_id', roomId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
    );
    return rows.map((r) => ({ ...r, amount: n(r.amount) }));
  },

  async cycleExpenses(cycleId: string): Promise<Expense[]> {
    const rows: Expense[] = unwrap(
      await supabase
        .from('expenses')
        .select('*')
        .eq('cycle_id', cycleId)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
    );
    return rows.map((r) => ({ ...r, amount: n(r.amount) }));
  },

  async expense(id: string): Promise<{
    expense: Expense;
    splits: Split[];
    history: AuditEntry[];
    cycle: Cycle | null;
    participants: string[];
  }> {
    const e: Expense = unwrap(await supabase.from('expenses').select('*').eq('id', id).single());
    const splits: Split[] = unwrap(await supabase.from('expense_splits').select('*').eq('expense_id', id));
    const history: AuditEntry[] = unwrap(
      await supabase
        .from('audit_log')
        .select('*')
        .eq('entity_type', 'expenses')
        .eq('entity_id', id)
        .order('id', { ascending: false }),
    );
    const participants: { user_id: string }[] = unwrap(
      await supabase.from('expense_participants').select('user_id').eq('expense_id', id).eq('active', true),
    );
    const cycle: Cycle | null = e.cycle_id
      ? unwrap(await supabase.from('cycles').select('*').eq('id', e.cycle_id).single())
      : null;
    return {
      expense: { ...e, amount: n(e.amount) },
      splits: splits.map((s) => ({ ...s, amount: n(s.amount) })),
      history,
      cycle,
      participants: participants.map((x) => x.user_id),
    };
  },

  async cycles(roomId: string): Promise<Cycle[]> {
    return unwrap(await supabase.rpc('room_cycles', { p_room: roomId }));
  },

  async cycleBalances(cycleId: string): Promise<BalanceRow[]> {
    const rows: BalanceRow[] = unwrap(await supabase.rpc('cycle_balances', { p_cycle: cycleId }));
    return rows.map((r) => ({ user_id: r.user_id, paid: n(r.paid), share: n(r.share), net: n(r.net) }));
  },

  async settlements(roomId: string): Promise<Settlement[]> {
    const rows: Settlement[] = unwrap(
      await supabase
        .from('settlements')
        .select('*')
        .eq('room_id', roomId)
        .order('generated_at', { ascending: false }),
    );
    return rows.map((r) => ({ ...r, total: n(r.total) }));
  },

  async settlement(
    id: string,
  ): Promise<{ settlement: Settlement; cycle: Cycle; lines: SettlementLine[]; payments: Payment[] }> {
    const st: Settlement = unwrap(await supabase.from('settlements').select('*').eq('id', id).single());
    const cycle: Cycle = unwrap(await supabase.from('cycles').select('*').eq('id', st.cycle_id).single());
    const lines: SettlementLine[] = unwrap(await supabase.rpc('settlement_status', { p_settlement: id }));
    const ids = lines.map((l) => l.line_id);
    const payments: Payment[] = ids.length
      ? unwrap(
          await supabase
            .from('payments')
            .select('*')
            .in('settlement_line_id', ids)
            .order('claimed_at', { ascending: false }),
        )
      : [];
    return {
      settlement: { ...st, total: n(st.total) },
      cycle,
      lines: lines.map((l) => ({
        ...l,
        share: n(l.share),
        paid: n(l.paid),
        net: n(l.net),
        confirmed: n(l.confirmed),
        awaiting: n(l.awaiting),
      })),
      payments: payments.map((p) => ({ ...p, amount: n(p.amount) })),
    };
  },

  async createExpense(p: {
    roomId: string;
    title: string;
    amount: number;
    date: string;
    paidBy: string;
    notes: string;
    participants: string[] | null;
    receiptPath: string | null;
    idempotencyKey: string;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('create_expense', {
        p_room: p.roomId,
        p_title: p.title,
        p_amount: p.amount,
        p_expense_date: p.date,
        p_paid_by: p.paidBy,
        p_notes: p.notes,
        p_participants: p.participants,
        p_receipt_path: p.receiptPath,
        p_idempotency_key: p.idempotencyKey,
      }),
    );
  },

  async editExpense(p: {
    id: string;
    title: string;
    amount: number;
    date: string;
    paidBy: string;
    notes: string;
    participants: string[] | null;
    receiptPath: string | null;
  }): Promise<void> {
    unwrap(
      await supabase.rpc('edit_expense', {
        p_expense: p.id,
        p_title: p.title,
        p_amount: p.amount,
        p_expense_date: p.date,
        p_paid_by: p.paidBy,
        p_notes: p.notes,
        p_participants: p.participants,
        p_receipt_path: p.receiptPath,
      }),
    );
  },

  async addAdjustment(expenseId: string, amount: number, note: string): Promise<string> {
    return unwrap(
      await supabase.rpc('add_adjustment', { p_expense: expenseId, p_amount: amount, p_note: note }),
    );
  },

  async generateSettlementUntil(cycleId: string, until: string): Promise<string> {
    return unwrap(await supabase.rpc('generate_settlement_until', { p_cycle: cycleId, p_until: until }));
  },

  async generateSettlement(cycleId: string): Promise<string> {
    return unwrap(await supabase.rpc('generate_settlement', { p_cycle: cycleId }));
  },

  async claimPayment(p: {
    lineId: string;
    amount: number;
    method: PaymentMethod;
    reference: string;
    proofPath: string | null;
    note: string;
    idempotencyKey: string;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('claim_payment', {
        p_line: p.lineId,
        p_amount: p.amount,
        p_method: p.method,
        p_reference: p.reference,
        p_proof_path: p.proofPath,
        p_note: p.note,
        p_idempotency_key: p.idempotencyKey,
      }),
    );
  },

  async decidePayment(paymentId: string, confirm: boolean, reason: string | null): Promise<void> {
    unwrap(
      await supabase.rpc('decide_payment', { p_payment: paymentId, p_confirm: confirm, p_reason: reason }),
    );
  },

  async recordPayment(p: {
    lineId: string;
    amount: number;
    method: PaymentMethod;
    reference: string;
    note: string;
  }) {
    return unwrap(
      await supabase.rpc('record_payment', {
        p_line: p.lineId,
        p_amount: p.amount,
        p_method: p.method,
        p_reference: p.reference,
        p_note: p.note,
      }),
    );
  },

  async updateRoomSettings(p: {
    roomId: string;
    name: string;
    countryCode: string;
    currency: string;
    decimals: number;
    timeZone: string;
    cycle: CycleKind;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('update_room_settings', {
        p_room: p.roomId,
        p_name: p.name,
        p_country_code: p.countryCode,
        p_currency: p.currency,
        p_currency_decimals: p.decimals,
        p_time_zone: p.timeZone,
        p_cycle: p.cycle,
      }),
    );
  },

  // ---- v0.3: notifications ----
  async notifications(limit = 50): Promise<AppNotification[]> {
    return unwrap(
      await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(limit),
    );
  },

  async unreadCount(): Promise<number> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null);
    if (error) throw error;
    return count ?? 0;
  },

  async markNotificationsRead(ids: string[] | null): Promise<void> {
    unwrap(await supabase.rpc('mark_notifications_read', { p_ids: ids }));
  },

  async notificationPrefs(): Promise<Map<string, boolean>> {
    const rows: { kind: string; enabled: boolean }[] = unwrap(
      await supabase.from('notification_prefs').select('kind, enabled'),
    );
    return new Map(rows.map((r) => [r.kind, r.enabled]));
  },

  async setNotificationPref(kind: string, enabled: boolean): Promise<void> {
    unwrap(await supabase.rpc('set_notification_pref', { p_kind: kind, p_enabled: enabled }));
  },

  async registerPushToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<void> {
    unwrap(await supabase.rpc('register_push_token', { p_token: token, p_platform: platform }));
  },

  /** Rooms I'm in or waiting for, my limit (free 2, Plus 10) and whether I have Plus. */
  async myRoomAllowance(): Promise<{ used: number; limit: number; plus: boolean }> {
    const rows = unwrap(await supabase.rpc('my_room_allowance')) as
      { used: number; room_limit: number; plus: boolean }[] | null;
    const r = rows?.[0];
    return { used: r?.used ?? 0, limit: r?.room_limit ?? 2, plus: !!r?.plus };
  },

  async myAdFree(): Promise<string | null> {
    return unwrap(await supabase.rpc('my_ad_free')) as string | null;
  },

  async verifyPurchase(
    productId: string,
    purchaseToken: string,
  ): Promise<{ ok: boolean; error?: string; status?: string; expires?: string }> {
    const { data, error } = await supabase.functions.invoke('verify-purchase', {
      body: { productId, purchaseToken },
    });
    if (error) throw error;
    return data as { ok: boolean; error?: string };
  },

  async registerWebPush(endpoint: string, p256dh: string, auth: string): Promise<void> {
    unwrap(await supabase.rpc('register_web_push', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth }));
  },

  async unregisterWebPush(endpoint: string): Promise<void> {
    unwrap(await supabase.rpc('unregister_web_push', { p_endpoint: endpoint }));
  },

  async unregisterPushToken(token: string): Promise<void> {
    unwrap(await supabase.rpc('unregister_push_token', { p_token: token }));
  },

  // ---- v0.3: settlement acknowledgement ----
  async settlementAcks(settlementId: string): Promise<SettlementAck[]> {
    return unwrap(await supabase.from('settlement_acks').select('*').eq('settlement_id', settlementId));
  },

  async markSettlementSeen(settlementId: string): Promise<void> {
    unwrap(await supabase.rpc('mark_settlement_seen', { p_settlement: settlementId }));
  },

  /** Settlements I have not acknowledged yet — kept pinned on the phone (founder 2026-10-20). */
  async myOpenSettlements(): Promise<
    {
      settlement_id: string;
      room_id: string;
      room: string;
      net: number;
      currency: string;
      decimals: number;
    }[]
  > {
    const rows: {
      settlement_id: string;
      room_id: string;
      room: string;
      net: number | string;
      currency: string;
      decimals: number;
    }[] = unwrap(await supabase.rpc('my_open_settlements'));
    return rows.map((r) => ({ ...r, net: Number(r.net) }));
  },

  async acknowledgeSettlement(settlementId: string): Promise<void> {
    unwrap(await supabase.rpc('acknowledge_settlement', { p_settlement: settlementId }));
  },

  // ---- v0.3: disputes ----
  async roomFlags(roomId: string): Promise<Flag[]> {
    return unwrap(
      await supabase
        .from('flags')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false }),
    );
  },

  async targetFlags(type: FlagTarget, ids: string[]): Promise<Flag[]> {
    if (ids.length === 0) return [];
    return unwrap(await supabase.from('flags').select('*').eq('target_type', type).in('target_id', ids));
  },

  async raiseFlag(p: {
    type: FlagTarget;
    targetId: string;
    reason: FlagReason;
    note: string;
    evidencePath: string | null;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('raise_flag', {
        p_type: p.type,
        p_target: p.targetId,
        p_reason: p.reason,
        p_note: p.note,
        p_evidence_path: p.evidencePath,
      }),
    );
  },

  async reviewFlag(id: string): Promise<void> {
    unwrap(await supabase.rpc('review_flag', { p_flag: id }));
  },

  async resolveFlag(id: string, accept: boolean, note: string): Promise<void> {
    unwrap(await supabase.rpc('resolve_flag', { p_flag: id, p_accept: accept, p_note: note }));
  },

  async withdrawFlag(id: string): Promise<void> {
    unwrap(await supabase.rpc('withdraw_flag', { p_flag: id }));
  },

  // ---- v0.3: need requests ----
  async needs(roomId: string): Promise<NeedRequest[]> {
    return unwrap(
      await supabase
        .from('need_requests')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50),
    );
  },

  async createNeed(roomId: string, title: string, note: string): Promise<string> {
    return unwrap(await supabase.rpc('create_need', { p_room: roomId, p_title: title, p_note: note }));
  },

  async acceptNeed(id: string): Promise<void> {
    unwrap(await supabase.rpc('accept_need', { p_need: id }));
  },

  async completeNeed(id: string, expenseId: string | null): Promise<void> {
    unwrap(await supabase.rpc('complete_need', { p_need: id, p_expense: expenseId }));
  },

  async cancelNeed(id: string): Promise<void> {
    unwrap(await supabase.rpc('cancel_need', { p_need: id }));
  },

  async reportData(roomId: string, cycleId: string | null, scope: 'mine' | 'room'): Promise<ReportData> {
    return unwrap(await supabase.rpc('report_data', { p_room: roomId, p_cycle: cycleId, p_scope: scope }));
  },

  async verifyReport(ref: string): Promise<{ found: boolean; generated_at?: string; scope?: string }> {
    return unwrap(await supabase.rpc('verify_report', { p_ref: ref }));
  },

  async myDataExport(): Promise<Record<string, unknown> & { ref: string; rooms: ReportData[] }> {
    return unwrap(await supabase.rpc('my_data_export'));
  },

  async accountDeletionCheck(): Promise<{
    blocking_rooms: { room_id: string; name: string }[];
    unpaid: number;
    open_disputes: number;
    purge_after: string;
  }> {
    return unwrap(await supabase.rpc('account_deletion_check'));
  },

  async deleteMyAccount(): Promise<void> {
    unwrap(await supabase.rpc('delete_my_account'));
  },

  async deleteRoom(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('delete_room', { p_room: roomId }));
  },

  async balances(roomId: string): Promise<BalanceRow[]> {
    const rows: BalanceRow[] = unwrap(await supabase.rpc('room_balances', { p_room: roomId }));
    return rows.map((r) => ({ user_id: r.user_id, paid: n(r.paid), share: n(r.share), net: n(r.net) }));
  },

  async createRoom(p: {
    name: string;
    countryCode: string;
    currency: string;
    decimals: number;
    timeZone: string;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('create_room', {
        p_name: p.name,
        p_country_code: p.countryCode,
        p_currency: p.currency,
        p_currency_decimals: p.decimals,
        p_time_zone: p.timeZone,
      }),
    );
  },

  async requestJoin(code: string): Promise<string> {
    return unwrap(await supabase.rpc('request_join', { p_code: code }));
  },

  async decideJoin(memberId: string, approve: boolean): Promise<void> {
    unwrap(await supabase.rpc('decide_join', { p_member: memberId, p_approve: approve }));
  },

  async setRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
    unwrap(await supabase.rpc('set_member_role', { p_member: memberId, p_role: role }));
  },

  async removeMember(memberId: string): Promise<void> {
    unwrap(await supabase.rpc('remove_member', { p_member: memberId }));
  },

  async leaveRoom(roomId: string): Promise<void> {
    unwrap(await supabase.rpc('leave_room', { p_room: roomId }));
  },

  async addExpense(p: {
    roomId: string;
    title: string;
    amount: number;
    category: string;
    date: string;
    paidBy: string;
    notes: string;
    idempotencyKey: string;
  }): Promise<string> {
    return unwrap(
      await supabase.rpc('add_expense', {
        p_room: p.roomId,
        p_title: p.title,
        p_amount: p.amount,
        p_category: p.category,
        p_expense_date: p.date,
        p_paid_by: p.paidBy,
        p_notes: p.notes,
        p_idempotency_key: p.idempotencyKey,
      }),
    );
  },

  async updateExpense(p: {
    id: string;
    title: string;
    amount: number;
    category: string;
    date: string;
    paidBy: string;
    notes: string;
  }): Promise<void> {
    unwrap(
      await supabase.rpc('update_expense', {
        p_expense: p.id,
        p_title: p.title,
        p_amount: p.amount,
        p_category: p.category,
        p_expense_date: p.date,
        p_paid_by: p.paidBy,
        p_notes: p.notes,
      }),
    );
  },

  async deleteExpense(id: string): Promise<void> {
    unwrap(await supabase.rpc('delete_expense', { p_expense: id }));
  },

  // ---- v0.5: offline sync (server re-checks everything with server time) ----
  async syncCreateExpense(p: {
    roomId: string;
    title: string;
    amount: number;
    date: string;
    notes: string;
    participants: string[] | null;
    receiptPath: string | null;
    idempotencyKey: string;
  }): Promise<{ id: string; late: boolean }> {
    return unwrap(
      await supabase.rpc('sync_create_expense', {
        p_room: p.roomId,
        p_title: p.title,
        p_amount: p.amount,
        p_expense_date: p.date,
        p_notes: p.notes,
        p_participants: p.participants,
        p_receipt_path: p.receiptPath,
        p_idempotency_key: p.idempotencyKey,
      }),
    );
  },

  async syncEditExpense(p: {
    id: string;
    baseUpdated: string;
    title: string;
    amount: number;
    date: string;
    notes: string;
    participants: string[] | null;
    receiptPath: string | null;
  }): Promise<void> {
    unwrap(
      await supabase.rpc('sync_edit_expense', {
        p_expense: p.id,
        p_base_updated: p.baseUpdated,
        p_title: p.title,
        p_amount: p.amount,
        p_expense_date: p.date,
        p_notes: p.notes,
        p_participants: p.participants,
        p_receipt_path: p.receiptPath,
      }),
    );
  },

  async syncDeleteExpense(id: string, baseUpdated: string): Promise<void> {
    unwrap(await supabase.rpc('sync_delete_expense', { p_expense: id, p_base_updated: baseUpdated }));
  },

  async syncCreateNeed(roomId: string, title: string, note: string, idempotencyKey: string): Promise<string> {
    return unwrap(
      await supabase.rpc('sync_create_need', {
        p_room: roomId,
        p_title: title,
        p_note: note,
        p_idempotency_key: idempotencyKey,
      }),
    );
  },
};

/** Reads that fall back to the last saved copy when the phone is offline (PRD §17.1). */
const OFFLINE_READS = [
  'myRooms',
  'myRoomsOverview',
  'myOpenSettlements',
  'myPendingRequests',
  'room',
  'members',
  'memberEmails',
  'expenses',
  'cycleExpenses',
  'expense',
  'cycles',
  'cycleBalances',
  'settlements',
  'settlement',
  'notifications',
  'unreadCount',
  'notificationPrefs',
  'settlementAcks',
  'roomFlags',
  'targetFlags',
  'needs',
  'balances',
] as const satisfies readonly (keyof typeof rawApi)[];

function withOfflineReads(raw: typeof rawApi): typeof rawApi {
  const out: Record<string, unknown> = { ...raw };
  for (const name of OFFLINE_READS) {
    const fn = raw[name] as (...a: unknown[]) => Promise<unknown>;
    out[name] = (...args: unknown[]) => cachedRead(name, args, () => fn(...args));
  }
  return out as typeof rawApi;
}

export const api = withOfflineReads(rawApi);
