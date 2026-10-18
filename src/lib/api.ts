/**
 * Typed wrappers around the database functions in supabase/migrations.
 * Reads use RLS-protected selects; every write is an RPC so the server enforces the rules.
 */
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

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw error;
  return data as T;
}

/** Postgres bigint arrives as string or number; normalise to number. */
const n = (v: unknown) => Number(v);

export const api = {
  async myRooms(): Promise<Room[]> {
    return unwrap(await supabase.from('rooms').select('*').is('deleted_at', null).order('created_at'));
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
    if (ids.length === 0) return rows;
    const profiles: { id: string; display_name: string; avatar_url: string | null }[] = unwrap(
      await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids),
    );
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return rows.map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null }));
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
};
