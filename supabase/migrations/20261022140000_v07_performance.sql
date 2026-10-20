-- v0.7 performance pass (Supabase performance advisor).
-- 1. Evaluate auth.uid() once per query, not once per row (same rules as before).
alter policy profiles_select on public.profiles using (
  id = (select auth.uid())
  or exists (
    select 1
      from public.room_members mine
      join public.room_members theirs on theirs.room_id = mine.room_id
     where mine.user_id = (select auth.uid())
       and mine.status = 'approved'
       and theirs.user_id = profiles.id));
alter policy profiles_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy room_members_select on public.room_members using (
  user_id = (select auth.uid())
  or (public.is_room_member(room_id) and status = 'approved')
  or public.is_room_admin(room_id));
alter policy notifications_own on public.notifications using (user_id = (select auth.uid()));
alter policy notification_prefs_own on public.notification_prefs using (user_id = (select auth.uid()));

-- 2. Indexes for foreign keys: account purges and Room deletions look rows up by these columns,
--    and member lists / balances join on them.
create index if not exists expense_splits_user_idx on public.expense_splits (user_id);
create index if not exists expense_participants_user_idx on public.expense_participants (user_id);
create index if not exists expenses_paid_by_idx on public.expenses (paid_by);
create index if not exists expenses_created_by_idx on public.expenses (created_by);
create index if not exists expenses_deleted_by_idx on public.expenses (deleted_by) where deleted_by is not null;
create index if not exists expenses_adjusts_idx on public.expenses (adjusts_expense_id) where adjusts_expense_id is not null;
create index if not exists cycles_locked_by_idx on public.cycles (locked_by) where locked_by is not null;
create index if not exists flags_raised_by_idx on public.flags (raised_by);
create index if not exists flags_resolved_by_idx on public.flags (resolved_by) where resolved_by is not null;
create index if not exists flags_target_owner_idx on public.flags (target_owner);
create index if not exists need_requests_created_by_idx on public.need_requests (created_by);
create index if not exists need_requests_accepted_by_idx on public.need_requests (accepted_by) where accepted_by is not null;
create index if not exists need_requests_cancelled_by_idx on public.need_requests (cancelled_by) where cancelled_by is not null;
create index if not exists need_requests_expense_idx on public.need_requests (expense_id) where expense_id is not null;
create index if not exists notifications_room_idx on public.notifications (room_id);
create index if not exists payments_room_idx on public.payments (room_id);
create index if not exists payments_payer_idx on public.payments (payer_id);
create index if not exists payments_claimed_by_idx on public.payments (claimed_by);
create index if not exists payments_decided_by_idx on public.payments (decided_by) where decided_by is not null;
create index if not exists room_members_decided_by_idx on public.room_members (decided_by) where decided_by is not null;
create index if not exists rooms_created_by_idx on public.rooms (created_by);
create index if not exists settlement_acks_user_idx on public.settlement_acks (user_id);
create index if not exists settlement_lines_user_idx on public.settlement_lines (user_id);
create index if not exists settlements_room_idx on public.settlements (room_id);
create index if not exists settlements_generated_by_idx on public.settlements (generated_by);
