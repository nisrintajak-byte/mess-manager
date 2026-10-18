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
  settlement_cycle: 'daily' | 'weekly' | 'monthly';
  join_code: string;
  created_at: string;
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
    const profiles: { id: string; display_name: string; avatar_url: string | null }[] = ids.length
      ? unwrap(await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids))
      : [];
    const byId = new Map(profiles.map((p) => [p.id, p]));
    // Same names in a Room get a join-order number (Lenovo1, Lenovo2) — computed by the server.
    const labelRows: { user_id: string; label: string }[] = unwrap(
      await supabase.rpc('room_member_labels', { p_room: roomId }),
    );
    const labels = new Map(labelRows.map((l) => [l.user_id, l.label]));
    const withLabel = (uid: string) => {
      const p = byId.get(uid);
      const label = labels.get(uid);
      return label ? { display_name: label, avatar_url: p?.avatar_url ?? null } : (p ?? null);
    };
    const out: Member[] = rows.map((r) => ({ ...r, profile: withLabel(r.user_id) }));
    // Former members are not listed to everyone, but their names must still show in history.
    const known = new Set(rows.map((r) => r.user_id));
    for (const [uid, label] of labels) {
      if (known.has(uid)) continue;
      out.push({
        id: `former:${uid}`,
        room_id: roomId,
        user_id: uid,
        role: 'member',
        status: 'left',
        requested_at: '',
        joined_on: null,
        left_on: null,
        profile: { display_name: label, avatar_url: null },
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

  async expense(id: string): Promise<{ expense: Expense; splits: Split[]; history: AuditEntry[] }> {
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
    return {
      expense: { ...e, amount: n(e.amount) },
      splits: splits.map((s) => ({ ...s, amount: n(s.amount) })),
      history,
    };
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
