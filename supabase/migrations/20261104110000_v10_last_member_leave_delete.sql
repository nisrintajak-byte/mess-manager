-- Founder 2026-11-04: nobody may be stuck in a Room. Before this, the only Admin (or the only
-- person left) could neither leave nor delete the Room, and the stuck Room kept counting
-- against their Room limit.
--
-- Leaving:
--   * the last person in a Room may leave; the Room is then closed (soft-deleted, records kept);
--   * the only Admin may leave while others remain: Admin rights pass to the longest-standing
--     approved member, who is notified (admin_promoted, via the member trigger).
-- Deleting (Admins only):
--   * alone in the Room: always allowed, even with expenses in the open cycle (nobody else
--     shares them);
--   * with other members: allowed once nothing is unsettled (no expenses in the open cycle and
--     every settlement line paid and confirmed). Everyone is notified (room_deleted), leaves the
--     Room and gets their leaving statement; pending join requests are declined.

create or replace function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  m public.room_members;
  v_next uuid;
begin
  -- one leave/delete at a time per Room, so two last Admins can't both walk out
  perform 1 from public.rooms where id = p_room and deleted_at is null for update;
  select * into m from public.room_members
  where room_id = p_room and user_id = v_uid and status = 'approved' for update;
  if m.id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;

  if m.role = 'admin' and public.approved_admin_count(p_room) <= 1 then
    select id into v_next from public.room_members
     where room_id = p_room and status = 'approved' and id <> m.id
     order by joined_on nulls last, decided_at nulls last, requested_at, id
     limit 1;
    if v_next is not null then
      update public.room_members set role = 'admin' where id = v_next;
    end if;
  end if;

  update public.room_members set status = 'left', left_on = public.room_today(p_room) where id = m.id;

  -- a Room left with nobody in it is closed (same rule as account deletion)
  if not exists (select 1 from public.room_members where room_id = p_room and status = 'approved') then
    update public.room_members set status = 'rejected', decided_at = now(), decided_by = v_uid
     where room_id = p_room and status = 'pending';
    update public.rooms set deleted_at = now() where id = p_room and deleted_at is null;
  end if;
end;
$$;

-- Something still to settle in a Room: expenses in the open cycle, or a settlement line not
-- yet fully paid and confirmed.
create or replace function public.room_has_unsettled(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cycles c
                  where c.room_id = p_room and c.status = 'open'
                    and exists (select 1 from public.expenses e
                                 where e.cycle_id = c.id and e.deleted_at is null))
      or exists (select 1 from public.settlement_lines l
                  where l.room_id = p_room and l.net < 0 and public.line_confirmed(l.id) < -l.net);
$$;

create or replace function public.delete_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_alone boolean;
begin
  if not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.rooms where id = p_room and deleted_at is null for update;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_alone := not exists (select 1 from public.room_members where room_id = p_room and status = 'approved'
                          and user_id <> v_uid);
  if not v_alone and public.room_has_unsettled(p_room) then
    raise exception 'room_has_unsettled_cycle' using errcode = '22023';
  end if;

  if not v_alone then
    perform public.notify_room(p_room, 'room_deleted', jsonb_build_object(
      'room', public.room_name(p_room), 'name', public.display_name(v_uid), 'user_id', v_uid), false, v_uid);
  end if;
  update public.room_members set status = 'left', left_on = public.room_today(p_room)
   where room_id = p_room and status = 'approved';
  update public.room_members set status = 'rejected', decided_at = now(), decided_by = v_uid
   where room_id = p_room and status = 'pending';
  update public.rooms set deleted_at = now() where id = p_room;
end;
$$;

-- English fallback push text: same as before plus room_deleted.
create or replace function public.push_text(n public.notifications) returns text[]
language sql stable set search_path = '' as $$
  select case n.kind
    when 'join_request' then array['Join request', coalesce(n.payload ->> 'name', 'Someone') || ' wants to join ' || coalesce(n.payload ->> 'room', 'your Room')]
    when 'join_approved' then array['Request approved', 'You can now enter ' || coalesce(n.payload ->> 'room', 'the Room')]
    when 'join_rejected' then array['Request declined', 'Your request to join ' || coalesce(n.payload ->> 'room', 'the Room') || ' was declined']
    when 'member_removed' then array['Removed from Room', 'You were removed from ' || coalesce(n.payload ->> 'room', 'a Room')]
    when 'admin_promoted' then array['You are now an Admin', coalesce(n.payload ->> 'room', 'Room')]
    when 'expense_added' then array['New expense', coalesce(n.payload ->> 'by', '') || ' added ' || coalesce(n.payload ->> 'title', '')]
    when 'expense_edited' then array['Expense edited', coalesce(n.payload ->> 'title', '')]
    when 'expense_deleted' then array['Expense deleted', coalesce(n.payload ->> 'title', '')]
    when 'room_settings_changed' then array['Room settings changed', coalesce(n.payload ->> 'room', '')]
    when 'settlement_generated' then array['Settlement ready', coalesce(n.payload ->> 'room', '') || ' · ' || coalesce(n.payload ->> 'from', '') || ' – ' || coalesce(n.payload ->> 'to', '')]
    when 'payment_claimed' then array['Payment to confirm', coalesce(n.payload ->> 'name', '') || ' marked a payment as paid']
    when 'payment_confirmed' then array['Payment confirmed', coalesce(n.payload ->> 'room', '')]
    when 'payment_rejected' then array['Payment rejected', coalesce(n.payload ->> 'reason', '')]
    when 'payment_reminder' then array['Payment reminder', 'Please pay your share for ' || coalesce(n.payload ->> 'room', 'your Room')]
    when 'confirm_reminder' then array['Payments to confirm', coalesce(n.payload ->> 'count', '') || ' payment(s) in ' || coalesce(n.payload ->> 'room', 'your Room') || ' wait for your confirmation']
    when 'dispute_raised' then array['Dispute raised', coalesce(n.payload ->> 'name', '') || ' flagged an item']
    when 'dispute_resolved' then array['Dispute resolved', coalesce(n.payload ->> 'outcome', '')]
    when 'need_created' then array['Need request', coalesce(n.payload ->> 'title', '')]
    when 'need_accepted' then array['Need accepted', coalesce(n.payload ->> 'name', '') || ' will buy ' || coalesce(n.payload ->> 'title', '')]
    when 'need_completed' then array['Need completed', coalesce(n.payload ->> 'title', '')]
    when 'expense_late_entry' then array['Late entry', coalesce(n.payload ->> 'title', '')]
    when 'member_account_deleted' then array['Member left', coalesce(n.payload ->> 'name', '') || ' deleted their account']
    when 'room_deleted' then array['Room deleted', coalesce(n.payload ->> 'name', '') || ' deleted ' || coalesce(n.payload ->> 'room', 'the Room')]
    when 'retention_reminder' then array['Download your reports', 'Records of ' || coalesce(n.payload ->> 'from', '') || ' – ' || coalesce(n.payload ->> 'to', '') || ' will be deleted on ' || coalesce(n.payload ->> 'delete_on', '')]
    else array['Mess Manager', 'You have a new notification']
  end;
$$;

revoke execute on function public.room_has_unsettled(uuid) from public, anon, authenticated;
