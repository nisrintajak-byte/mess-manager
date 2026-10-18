-- Mess Manager v0.3 — notifications (inbox + push), settlement acknowledgement,
-- dispute & flag system, Need Requests. PRD §11.7, §12, §13, §14.
-- Non-destructive (no DROP/DELETE). Notification text is rendered by the app in the reader's
-- language from (kind, payload); push messages use short English text until v0.4.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  room_id uuid references public.rooms (id),
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Optional kinds may be switched off; everything else is mandatory (PRD §7.7, §14).
create function public.notification_is_optional(p_kind text) returns boolean
language sql immutable set search_path = '' as $$
  select p_kind in ('expense_added', 'expense_edited', 'expense_deleted',
                    'need_created', 'need_accepted', 'need_completed');
$$;

create table public.notification_prefs (
  user_id uuid not null references auth.users (id),
  kind text not null,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind)
);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id),
  platform text not null check (platform in ('android', 'ios', 'web')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id) where active;

create function public.notify(p_user uuid, p_room uuid, p_kind text, p_payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_user is null then
    return;
  end if;
  if public.notification_is_optional(p_kind) and exists (
       select 1 from public.notification_prefs where user_id = p_user and kind = p_kind and not enabled) then
    return;
  end if;
  insert into public.notifications (user_id, room_id, kind, payload)
  values (p_user, p_room, p_kind, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- Fan out to approved members of a Room (optionally admins only), skipping the actor.
create function public.notify_room(p_room uuid, p_kind text, p_payload jsonb, p_admins_only boolean default false,
                                   p_skip uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  for m in select distinct user_id from public.room_members
            where room_id = p_room and status = 'approved'
              and (not p_admins_only or role = 'admin')
              and user_id is distinct from p_skip loop
    perform public.notify(m.user_id, p_room, p_kind, p_payload);
  end loop;
end;
$$;

create function public.display_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select display_name from public.profiles where id = p_user;
$$;

-- ---------------------------------------------------------------------------
-- Push delivery via Expo Push API (only when pg_net is available and tokens exist)
-- ---------------------------------------------------------------------------
create function public.push_text(n public.notifications) returns text[]
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
    when 'dispute_raised' then array['Dispute raised', coalesce(n.payload ->> 'name', '') || ' flagged an item']
    when 'dispute_resolved' then array['Dispute resolved', coalesce(n.payload ->> 'outcome', '')]
    when 'need_created' then array['Need request', coalesce(n.payload ->> 'title', '')]
    when 'need_accepted' then array['Need accepted', coalesce(n.payload ->> 'name', '') || ' will buy ' || coalesce(n.payload ->> 'title', '')]
    when 'need_completed' then array['Need completed', coalesce(n.payload ->> 'title', '')]
    else array['Mess Manager', 'You have a new notification']
  end;
$$;

create function public.send_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  msgs jsonb;
  txt text[];
begin
  if to_regnamespace('net') is null then
    return new; -- in-app inbox remains the fallback (PRD §14)
  end if;
  txt := public.push_text(new);
  select jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', txt[1], 'body', txt[2], 'sound', 'default',
           'data', jsonb_build_object('notification_id', new.id, 'kind', new.kind, 'room_id', new.room_id)))
    into msgs
    from public.push_tokens t where t.user_id = new.user_id and t.active and t.platform <> 'web';
  if msgs is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://exp.host/--/api/v2/push/send', msgs,
          '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
  return new;
exception when others then
  return new; -- never block the business action because push failed
end;
$$;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.send_push();

-- ---------------------------------------------------------------------------
-- Settlement acknowledgement (PRD §11.7)
-- ---------------------------------------------------------------------------
create table public.settlement_acks (
  settlement_id uuid not null references public.settlements (id),
  user_id uuid not null references auth.users (id),
  delivered_at timestamptz not null default now(),
  seen_at timestamptz,
  acknowledged_at timestamptz,
  primary key (settlement_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Disputes & flags (PRD §12)
-- ---------------------------------------------------------------------------
create type public.flag_target as enum ('expense', 'payment', 'settlement_line');
create type public.flag_reason as enum ('wrong_amount', 'not_shared', 'duplicate', 'payment_not_received', 'other');
create type public.flag_status as enum ('open', 'under_review', 'accepted', 'rejected', 'withdrawn');

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  target_type public.flag_target not null,
  target_id uuid not null,
  target_owner uuid references auth.users (id),
  reason public.flag_reason not null,
  note text check (note is null or char_length(note) <= 500),
  evidence_path text,
  status public.flag_status not null default 'open',
  raised_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  resolved_by uuid references auth.users (id),
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by_involved_admin boolean not null default false
);
create index flags_target_idx on public.flags (target_type, target_id);
create index flags_room_idx on public.flags (room_id, created_at desc);

create trigger flags_audit after insert or update on public.flags
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Need Requests (PRD §13)
-- ---------------------------------------------------------------------------
create type public.need_status as enum ('pending', 'accepted', 'completed', 'cancelled');

create table public.need_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  title text not null check (char_length(title) between 1 and 80),
  note text check (note is null or char_length(note) <= 300),
  status public.need_status not null default 'pending',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  accepted_by uuid references auth.users (id),
  accepted_at timestamptz,
  completed_at timestamptz,
  expense_id uuid references public.expenses (id),
  cancelled_by uuid references auth.users (id),
  cancelled_at timestamptz
);
create index need_requests_room_idx on public.need_requests (room_id, created_at desc);

create trigger need_requests_audit after insert or update on public.need_requests
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Event fan-out (triggers keep notifications consistent with every write path)
-- ---------------------------------------------------------------------------
create function public.room_name(p_room uuid) returns text
language sql stable security definer set search_path = '' as $$
  select name from public.rooms where id = p_room;
$$;

create function public.on_member_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  base jsonb := jsonb_build_object('room', public.room_name(new.room_id), 'name', public.display_name(new.user_id),
                                   'user_id', new.user_id);
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.notify_room(new.room_id, 'join_request', base, true, new.user_id);
    end if;
    return new;
  end if;
  if old.status = 'pending' and new.status = 'approved' then
    perform public.notify(new.user_id, new.room_id, 'join_approved', base);
  elsif old.status = 'pending' and new.status = 'rejected' then
    perform public.notify(new.user_id, new.room_id, 'join_rejected', base);
  elsif old.status = 'approved' and new.status = 'removed' then
    perform public.notify(new.user_id, new.room_id, 'member_removed', base);
  end if;
  if old.role = 'member' and new.role = 'admin' and new.status = 'approved' then
    perform public.notify(new.user_id, new.room_id, 'admin_promoted', base);
  end if;
  return new;
end;
$$;
create trigger room_members_notify after insert or update on public.room_members
  for each row execute function public.on_member_event();

create function public.on_expense_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := coalesce(auth.uid(), new.created_by);
  p jsonb := jsonb_build_object('expense_id', new.id, 'title', new.title, 'amount', new.amount,
                                'currency', new.currency, 'credit', new.is_credit,
                                'by', public.display_name(actor), 'room', public.room_name(new.room_id));
begin
  if tg_op = 'INSERT' then
    perform public.notify_room(new.room_id, 'expense_added', p, false, actor);
  elsif old.deleted_at is null and new.deleted_at is not null then
    perform public.notify_room(new.room_id, 'expense_deleted', p, false, actor);
  elsif (old.title, old.amount, old.expense_date, old.notes, old.split_mode)
        is distinct from (new.title, new.amount, new.expense_date, new.notes, new.split_mode) then
    perform public.notify_room(new.room_id, 'expense_edited',
      p || jsonb_build_object('old_amount', old.amount), false, actor);
  end if; -- pure cycle moves (early settlement) are silent
  return new;
end;
$$;
create trigger expenses_notify after insert or update on public.expenses
  for each row execute function public.on_expense_event();

create function public.on_room_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.country_code, old.currency, old.time_zone, old.settlement_cycle, old.pending_time_zone,
      old.pending_settlement_cycle)
     is distinct from
     (new.country_code, new.currency, new.time_zone, new.settlement_cycle, new.pending_time_zone,
      new.pending_settlement_cycle)
     and auth.uid() is not null then  -- skip automatic cycle roll-over
    perform public.notify_room(new.id, 'room_settings_changed', jsonb_build_object(
      'room', new.name,
      'old', jsonb_build_object('currency', old.currency, 'time_zone', old.time_zone, 'cycle', old.settlement_cycle),
      'new', jsonb_build_object('currency', new.currency, 'time_zone', new.time_zone, 'cycle', new.settlement_cycle,
                                'pending_time_zone', new.pending_time_zone,
                                'pending_cycle', new.pending_settlement_cycle)), false, null);
  end if;
  return new;
end;
$$;
create trigger rooms_notify after update on public.rooms
  for each row execute function public.on_room_event();

-- One notification + acknowledgement row per member line. Due date = 7 days after generation.
create function public.on_settlement_line() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.settlements;
  c public.cycles;
begin
  select * into s from public.settlements where id = new.settlement_id;
  select * into c from public.cycles where id = s.cycle_id;
  perform public.notify(new.user_id, new.room_id, 'settlement_generated', jsonb_build_object(
    'settlement_id', s.id, 'room', public.room_name(new.room_id), 'from', c.starts_on, 'to', c.ends_on,
    'net', new.net, 'currency', s.currency, 'decimals', s.currency_decimals,
    'status', case when new.net >= 0 then 'settled' else 'pending' end,
    'due', (s.generated_at at time zone c.time_zone)::date + 7));
  insert into public.settlement_acks (settlement_id, user_id) values (s.id, new.user_id)
  on conflict do nothing;
  return new;
end;
$$;
create trigger settlement_lines_notify after insert on public.settlement_lines
  for each row execute function public.on_settlement_line();

create function public.on_payment_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb := jsonb_build_object('payment_id', new.id, 'name', public.display_name(new.payer_id),
                                'amount', new.amount, 'currency', new.currency,
                                'room', public.room_name(new.room_id),
                                'settlement_id', (select settlement_id from public.settlement_lines
                                                  where id = new.settlement_line_id));
begin
  if tg_op = 'INSERT' then
    if new.status = 'awaiting' then
      perform public.notify_room(new.room_id, 'payment_claimed', p, true, new.payer_id);
    elsif new.status = 'confirmed' then
      perform public.notify(new.payer_id, new.room_id, 'payment_confirmed', p);
    end if;
  elsif old.status = 'awaiting' and new.status = 'confirmed' then
    perform public.notify(new.payer_id, new.room_id, 'payment_confirmed', p);
  elsif old.status = 'awaiting' and new.status = 'rejected' then
    perform public.notify(new.payer_id, new.room_id, 'payment_rejected',
                          p || jsonb_build_object('reason', new.reject_reason));
  end if;
  return new;
end;
$$;
create trigger payments_notify after insert or update on public.payments
  for each row execute function public.on_payment_event();

create function public.on_flag_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb := jsonb_build_object('flag_id', new.id, 'target_type', new.target_type, 'target_id', new.target_id,
                                'reason', new.reason, 'name', public.display_name(new.raised_by),
                                'room', public.room_name(new.room_id));
begin
  if tg_op = 'INSERT' then
    perform public.notify_room(new.room_id, 'dispute_raised', p, true, new.raised_by);
    if new.target_owner is not null and new.target_owner <> new.raised_by and not exists (
         select 1 from public.room_members where room_id = new.room_id and user_id = new.target_owner
         and status = 'approved' and role = 'admin') then
      perform public.notify(new.target_owner, new.room_id, 'dispute_raised', p);
    end if;
  elsif old.status in ('open', 'under_review') and new.status in ('accepted', 'rejected') then
    p := p || jsonb_build_object('outcome', new.status, 'note', new.resolution_note);
    perform public.notify(new.raised_by, new.room_id, 'dispute_resolved', p);
    if new.target_owner is not null and new.target_owner <> new.raised_by then
      perform public.notify(new.target_owner, new.room_id, 'dispute_resolved', p);
    end if;
  end if;
  return new;
end;
$$;
create trigger flags_notify after insert or update on public.flags
  for each row execute function public.on_flag_event();

create function public.on_need_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p jsonb := jsonb_build_object('need_id', new.id, 'title', new.title, 'room', public.room_name(new.room_id));
begin
  if tg_op = 'INSERT' then
    perform public.notify_room(new.room_id, 'need_created', p || jsonb_build_object(
      'name', public.display_name(new.created_by)), false, new.created_by);
  elsif old.status = 'pending' and new.status = 'accepted' then
    perform public.notify_room(new.room_id, 'need_accepted', p || jsonb_build_object(
      'name', public.display_name(new.accepted_by)), false, new.accepted_by);
  elsif old.status = 'accepted' and new.status = 'completed' then
    perform public.notify(new.created_by, new.room_id, 'need_completed', p || jsonb_build_object(
      'name', public.display_name(new.accepted_by)));
  end if;
  return new;
end;
$$;
create trigger need_requests_notify after insert or update on public.need_requests
  for each row execute function public.on_need_event();

-- ---------------------------------------------------------------------------
-- Notification API
-- ---------------------------------------------------------------------------
create function public.mark_notifications_read(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  update public.notifications set read_at = now()
   where user_id = v_uid and read_at is null and (p_ids is null or id = any (p_ids));
end;
$$;

create function public.set_notification_pref(p_kind text, p_enabled boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if not public.notification_is_optional(p_kind) then
    raise exception 'mandatory_notification' using errcode = '22023';
  end if;
  insert into public.notification_prefs (user_id, kind, enabled) values (v_uid, p_kind, p_enabled)
  on conflict (user_id, kind) do update set enabled = excluded.enabled, updated_at = now();
end;
$$;

create function public.register_push_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if p_token is null or char_length(p_token) not between 10 and 300 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, platform, active) values (p_token, v_uid, p_platform, true)
  on conflict (token) do update set user_id = v_uid, platform = excluded.platform, active = true, updated_at = now();
end;
$$;

-- Called on logout so a shared phone stops receiving this user's notifications.
create function public.unregister_push_token(p_token text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.push_tokens set active = false, updated_at = now()
   where token = p_token and user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlement acknowledgement API
-- ---------------------------------------------------------------------------
create function public.mark_settlement_seen(p_settlement uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  update public.settlement_acks set seen_at = coalesce(seen_at, now())
   where settlement_id = p_settlement and user_id = v_uid;
end;
$$;

create function public.acknowledge_settlement(p_settlement uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  update public.settlement_acks
     set seen_at = coalesce(seen_at, now()), acknowledged_at = coalesce(acknowledged_at, now())
   where settlement_id = p_settlement and user_id = v_uid;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dispute API
-- ---------------------------------------------------------------------------
create function public.flag_target_room_owner(p_type public.flag_target, p_id uuid,
                                              out room_id uuid, out owner uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_type = 'expense' then
    select e.room_id, e.created_by into room_id, owner from public.expenses e where e.id = p_id;
  elsif p_type = 'payment' then
    select p.room_id, p.payer_id into room_id, owner from public.payments p where p.id = p_id;
  else
    select l.room_id, l.user_id into room_id, owner from public.settlement_lines l where l.id = p_id;
  end if;
end;
$$;

create function public.raise_flag(p_type public.flag_target, p_target uuid, p_reason public.flag_reason,
                                  p_note text default null, p_evidence_path text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  t record;
  v_id uuid;
begin
  select * into t from public.flag_target_room_owner(p_type, p_target);
  if t.room_id is null or not public.is_room_member(t.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_reason = 'other' and nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not public.valid_room_file(t.room_id, p_evidence_path) then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  if exists (select 1 from public.flags where target_type = p_type and target_id = p_target
             and raised_by = v_uid and status in ('open', 'under_review')) then
    raise exception 'already_flagged' using errcode = '23505';
  end if;
  insert into public.flags (room_id, target_type, target_id, target_owner, reason, note, evidence_path, raised_by)
  values (t.room_id, p_type, p_target, t.owner, p_reason, nullif(trim(p_note), ''), p_evidence_path, v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.review_flag(p_flag uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  f public.flags;
begin
  perform public.require_verified_user();
  select * into f from public.flags where id = p_flag for update;
  if f.id is null or not public.is_room_admin(f.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if f.status <> 'open' then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  update public.flags set status = 'under_review' where id = p_flag;
end;
$$;

-- An Admin cannot resolve a flag on their own item where another Admin exists.
create function public.resolve_flag(p_flag uuid, p_accept boolean, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  f public.flags;
  v_involved boolean;
begin
  select * into f from public.flags where id = p_flag for update;
  if f.id is null or not public.is_room_admin(f.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if f.status not in ('open', 'under_review') then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  v_involved := f.target_owner = v_uid;
  if v_involved and public.approved_admin_count(f.room_id) > 1 then
    raise exception 'other_admin_must_resolve' using errcode = '42501';
  end if;
  update public.flags
     set status = case when p_accept then 'accepted' else 'rejected' end::public.flag_status,
         resolved_by = v_uid, resolved_at = now(), resolution_note = trim(p_note),
         resolved_by_involved_admin = v_involved
   where id = p_flag;
end;
$$;

create function public.withdraw_flag(p_flag uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  f public.flags;
begin
  select * into f from public.flags where id = p_flag for update;
  if f.id is null or f.raised_by <> v_uid then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if f.status not in ('open', 'under_review') then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  update public.flags set status = 'withdrawn' where id = p_flag;
end;
$$;

-- ---------------------------------------------------------------------------
-- Need Request API
-- ---------------------------------------------------------------------------
create function public.create_need(p_room uuid, p_title text, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_id uuid;
begin
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if nullif(trim(coalesce(p_title, '')), '') is null then
    raise exception 'title_required' using errcode = '22023';
  end if;
  insert into public.need_requests (room_id, title, note, created_by)
  values (p_room, trim(p_title), nullif(trim(p_note), ''), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.accept_need(p_need uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  n public.need_requests;
begin
  select * into n from public.need_requests where id = p_need for update;
  if n.id is null or not public.is_room_member(n.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if n.status <> 'pending' then
    raise exception 'need_taken' using errcode = '22023';
  end if;
  update public.need_requests set status = 'accepted', accepted_by = v_uid, accepted_at = now() where id = p_need;
end;
$$;

-- Completed by whoever accepted it; optionally linked to the expense they just added.
create function public.complete_need(p_need uuid, p_expense uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  n public.need_requests;
begin
  select * into n from public.need_requests where id = p_need for update;
  if n.id is null or n.accepted_by is distinct from v_uid then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if n.status <> 'accepted' then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  if p_expense is not null and not exists (
       select 1 from public.expenses where id = p_expense and room_id = n.room_id and created_by = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.need_requests set status = 'completed', completed_at = now(), expense_id = p_expense
   where id = p_need;
end;
$$;

create function public.cancel_need(p_need uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  n public.need_requests;
begin
  select * into n from public.need_requests where id = p_need for update;
  if n.id is null or not (n.created_by = v_uid or public.is_room_admin(n.room_id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if n.status not in ('pending', 'accepted') then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  update public.need_requests set status = 'cancelled', cancelled_by = v_uid, cancelled_at = now()
   where id = p_need;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_tokens enable row level security;
alter table public.settlement_acks enable row level security;
alter table public.flags enable row level security;
alter table public.need_requests enable row level security;

revoke all on public.notifications, public.notification_prefs, public.push_tokens, public.settlement_acks,
  public.flags, public.need_requests from anon, authenticated;
grant select on public.notifications, public.notification_prefs, public.settlement_acks,
  public.flags, public.need_requests to authenticated;

create policy notifications_own on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notification_prefs_own on public.notification_prefs for select to authenticated
  using (user_id = auth.uid());
create policy settlement_acks_select on public.settlement_acks for select to authenticated
  using (exists (select 1 from public.settlements s where s.id = settlement_id and public.is_room_member(s.room_id)));
create policy flags_select on public.flags for select to authenticated
  using (public.is_room_member(room_id));
create policy need_requests_select on public.need_requests for select to authenticated
  using (public.is_room_member(room_id));

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_room(text, text, text, int, text),
  public.request_join(text),
  public.decide_join(uuid, boolean),
  public.set_member_role(uuid, public.member_role),
  public.remove_member(uuid),
  public.leave_room(uuid),
  public.room_member_emails(uuid),
  public.room_member_labels(uuid),
  public.add_expense(uuid, text, bigint, text, date, uuid, text, uuid),
  public.update_expense(uuid, text, bigint, text, date, uuid, text),
  public.delete_expense(uuid),
  public.room_balances(uuid),
  public.is_room_member(uuid),
  public.is_room_admin(uuid),
  public.try_uuid(text),
  public.create_expense(uuid, text, bigint, date, uuid, text, uuid[], text, uuid),
  public.edit_expense(uuid, text, bigint, date, uuid, text, uuid[], text),
  public.add_adjustment(uuid, bigint, text),
  public.cycle_balances(uuid),
  public.room_cycles(uuid),
  public.generate_settlement(uuid),
  public.claim_payment(uuid, bigint, public.payment_method, text, text, text, uuid),
  public.decide_payment(uuid, boolean, text),
  public.record_payment(uuid, bigint, public.payment_method, text, text),
  public.settlement_status(uuid),
  public.update_room_settings(uuid, text, text, text, int, text, public.settlement_cycle),
  public.delete_room(uuid),
  public.mark_notifications_read(uuid[]),
  public.set_notification_pref(text, boolean),
  public.register_push_token(text, text),
  public.unregister_push_token(text),
  public.mark_settlement_seen(uuid),
  public.acknowledge_settlement(uuid),
  public.raise_flag(public.flag_target, uuid, public.flag_reason, text, text),
  public.review_flag(uuid),
  public.resolve_flag(uuid, boolean, text),
  public.withdraw_flag(uuid),
  public.create_need(uuid, text, text),
  public.accept_need(uuid),
  public.complete_need(uuid, uuid),
  public.cancel_need(uuid)
to authenticated;
