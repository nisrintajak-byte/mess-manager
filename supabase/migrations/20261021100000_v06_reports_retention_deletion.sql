-- Mess Manager v0.6 — reports, 2-calendar-month retention, account deletion, email queue.
-- PRD §11.6, §15, §18.2–18.5. Backward compatible with v0.1–v0.5 apps.
--
-- Emails are written to public.email_outbox and sent by the `send-emails` Edge Function
-- (Resend). Until the email service is configured the queue simply waits.

-- An adjustment may outlive the (older, already removed) expense it corrected.
alter table public.expenses add column adjusts_purged boolean not null default false;

-- ---------------------------------------------------------------------------
-- Columns for the retention and deletion lifecycles
-- ---------------------------------------------------------------------------
alter table public.cycles
  add column purge_notice_at timestamptz,
  add column purged_at timestamptz;

alter table public.profiles
  add column deleted_at timestamptz,
  add column deleted_via text check (deleted_via is null or deleted_via in ('app', 'web')),
  add column purge_after date,
  add column final_queued_at timestamptz,
  add column purged_at timestamptz;

-- Deleted accounts cannot act, even with a still-valid token.
create or replace function public.require_verified_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and deleted_at is not null) then
    raise exception 'account_deleted' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and consent_version = 'unknown') then
    raise exception 'profile_incomplete' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Records are deleted on the first day of the third month after the lock month:
-- locked any day in October → kept through November and December → deleted 1 January.
create function public.cycle_purge_on(p_cycle uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (date_trunc('month', greatest(c.ends_on, (c.locked_at at time zone c.time_zone)::date))
          + interval '3 months')::date
  from public.cycles c where c.id = p_cycle and c.status = 'locked';
$$;

-- ---------------------------------------------------------------------------
-- Email queue (service only; clients have no access)
-- ---------------------------------------------------------------------------
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  to_email text,
  language text not null default 'en',
  kind text not null check (kind in ('retention_notice', 'leave_statement', 'account_deleted',
                                     'account_final', 'member_account_final', 'deletion_confirm')),
  room_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due_idx on public.email_outbox (next_attempt_at) where status in ('queued', 'sending');
create index email_outbox_user_idx on public.email_outbox (user_id);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

create function public.queue_email(p_user uuid, p_kind text, p_room uuid, p_payload jsonb,
                                   p_email text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := p_email;
  v_lang text;
begin
  if v_email is null and p_user is not null then
    select u.email into v_email from auth.users u where u.id = p_user;
  end if;
  if v_email is null or v_email = '' then
    return;
  end if;
  select p.language into v_lang from public.profiles p where p.id = p_user;
  insert into public.email_outbox (user_id, to_email, language, kind, room_id, payload)
  values (p_user, v_email, coalesce(v_lang, 'en'), p_kind, p_room, coalesce(p_payload, '{}'::jsonb));
end;
$$;

-- Worker API (send-emails Edge Function, service role)
create function public.email_claim(p_limit int default 20) returns setof public.email_outbox
language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.email_outbox o set status = 'sending', attempts = o.attempts + 1,
         next_attempt_at = now() + interval '15 minutes'
   where o.id in (select e.id from public.email_outbox e
                   where e.status in ('queued', 'sending') and e.next_attempt_at <= now()
                   order by e.created_at limit greatest(1, least(p_limit, 100))
                   for update skip locked)
  returning o.*;
end;
$$;

create function public.email_done(p_id uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_ok then
    -- the confirmation token and the address are not kept after sending
    update public.email_outbox set status = 'sent', sent_at = now(), last_error = null,
           payload = payload - 'token', to_email = null
     where id = p_id;
  else
    update public.email_outbox
       set status = case when attempts >= 6 then 'failed' else 'queued' end,
           last_error = left(p_error, 500),
           next_attempt_at = now() + make_interval(mins => (2 ^ least(attempts, 10))::int)
     where id = p_id;
  end if;
end;
$$;

-- Files to remove from private storage (done by the worker through the Storage API)
create table public.storage_purge (
  path text primary key,
  bucket text not null default 'room-files',
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table public.storage_purge enable row level security;
revoke all on public.storage_purge from anon, authenticated;

create function public.queue_file_purge(p_path text) returns void
language sql security definer set search_path = '' as $$
  insert into public.storage_purge (path) select p_path
  where p_path is not null and p_path <> '' and p_path not like 'local::%'
  on conflict (path) do nothing;
$$;

create function public.storage_purge_claim(p_limit int default 100) returns setof text
language sql security definer set search_path = '' as $$
  select path from public.storage_purge where done_at is null order by created_at limit p_limit;
$$;

create function public.storage_purge_done(p_paths text[]) returns void
language sql security definer set search_path = '' as $$
  update public.storage_purge set done_at = now() where path = any (p_paths);
$$;

-- ---------------------------------------------------------------------------
-- Report data (PRD §15). One JSON document drives the app's PDF/CSV and the emailed PDF.
-- ---------------------------------------------------------------------------
create table public.report_refs (
  ref text primary key,
  user_id uuid,
  room_id uuid,
  scope text not null,
  channel text not null default 'app' check (channel in ('app', 'email', 'export')),
  created_at timestamptz not null default now()
);
alter table public.report_refs enable row level security;
revoke all on public.report_refs from anon, authenticated;

create function public.new_report_ref(p_user uuid, p_room uuid, p_scope text, p_channel text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_ref text;
begin
  loop
    v_ref := 'MM-' || to_char(now(), 'YYYYMMDD') || '-'
             || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));
    begin
      insert into public.report_refs (ref, user_id, room_id, scope, channel)
      values (v_ref, p_user, p_room, p_scope, p_channel);
      return v_ref;
    exception when unique_violation then
      -- try another
    end;
  end loop;
end;
$$;

-- Same-name labels (Lenovo1, Lenovo2) without the caller check, for server-side reports.
create function public.member_labels_for(p_room uuid)
returns table (user_id uuid, label text, deleted boolean)
language sql stable security definer set search_path = '' as $$
  with firsts as (
    select rm.user_id, min(rm.requested_at) as first_at
    from public.room_members rm where rm.room_id = p_room group by rm.user_id
  ),
  named as (
    select f.user_id, f.first_at, trim(p.display_name) as name, lower(trim(p.display_name)) as k,
           p.deleted_at is not null as deleted
    from firsts f join public.profiles p on p.id = f.user_id
  ),
  numbered as (
    select n.*, row_number() over (partition by n.k order by n.first_at, n.user_id) as num,
           count(*) over (partition by n.k) as dupes
    from named n
  )
  select x.user_id, case when x.dupes > 1 then x.name || x.num::text else x.name end, x.deleted
  from numbered x;
$$;

-- p_scope: 'room' (everything) or 'mine' (items involving p_user).
-- p_cycle limits to one cycle; p_from/p_to limit by date (leaving statement).
create function public.report_data_internal(p_user uuid, p_room uuid, p_cycle uuid, p_scope text,
                                            p_from date default null, p_to date default null,
                                            p_channel text default 'app') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  v_mine boolean := p_scope = 'mine';
  v_cycles uuid[];
  v_exp uuid[];
  v_lines uuid[];
  v_out jsonb;
  v_from date;
  v_to date;
begin
  select * into r from public.rooms where id = p_room;
  if r.id is null then
    raise exception 'not_found' using errcode = '02000';
  end if;
  select array_agg(c.id order by c.starts_on) into v_cycles from public.cycles c
   where c.room_id = p_room and c.purged_at is null
     and (p_cycle is null or c.id = p_cycle)
     and (p_from is null or c.ends_on >= p_from)
     and (p_to is null or c.starts_on <= p_to);
  v_cycles := coalesce(v_cycles, '{}');
  select min(starts_on), max(ends_on) into v_from, v_to from public.cycles where id = any (v_cycles);
  v_from := greatest(v_from, p_from);
  v_to := least(v_to, p_to);

  select array_agg(e.id) into v_exp from public.expenses e
   where e.room_id = p_room and e.cycle_id = any (v_cycles)
     and (p_from is null or e.expense_date >= p_from)
     and (p_to is null or e.expense_date <= p_to)
     and (not v_mine or e.paid_by = p_user or e.created_by = p_user
          or exists (select 1 from public.expense_splits s where s.expense_id = e.id and s.user_id = p_user));
  v_exp := coalesce(v_exp, '{}');

  select array_agg(l.id) into v_lines from public.settlement_lines l
    join public.settlements s on s.id = l.settlement_id
   where s.cycle_id = any (v_cycles) and (not v_mine or l.user_id = p_user);
  v_lines := coalesce(v_lines, '{}');

  select jsonb_build_object(
    'ref', public.new_report_ref(p_user, p_room, p_scope, p_channel),
    'generated_at', now(),
    'scope', p_scope,
    'requester', p_user,
    'room', jsonb_build_object('name', r.name, 'currency', r.currency, 'decimals', r.currency_decimals,
                               'time_zone', r.time_zone),
    'period', jsonb_build_object('from', v_from, 'to', v_to),
    'people', coalesce((select jsonb_object_agg(l.user_id, jsonb_build_object('name', l.label, 'deleted', l.deleted))
                          from public.member_labels_for(p_room) l), '{}'::jsonb),
    'cycles', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', c.id, 'starts_on', c.starts_on, 'ends_on', c.ends_on, 'status', c.status,
                 'locked_at', c.locked_at, 'currency', c.currency, 'decimals', c.currency_decimals,
                 'delete_on', public.cycle_purge_on(c.id)) order by c.starts_on)
               from public.cycles c where c.id = any (v_cycles)), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', e.id, 'cycle_id', e.cycle_id, 'date', e.expense_date, 'title', e.title,
                 'amount', e.amount * public.expense_sign(e.is_credit), 'currency', e.currency,
                 'paid_by', e.paid_by, 'created_by', e.created_by, 'created_at', e.created_at,
                 'notes', e.notes, 'deleted', e.deleted_at is not null, 'adjustment', e.adjusts_expense_id is not null
                                                                       or e.adjusts_purged,
                 'late_entry_from', e.late_entry_from, 'has_receipt', e.receipt_path is not null,
                 'my_share', (select s.amount * public.expense_sign(e.is_credit) from public.expense_splits s
                               where s.expense_id = e.id and s.user_id = p_user),
                 'participants', (select count(*) from public.expense_splits s where s.expense_id = e.id))
                 order by e.expense_date, e.created_at)
               from public.expenses e where e.id = any (v_exp)), '[]'::jsonb),
    'settlements', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', s.id, 'cycle_id', s.cycle_id, 'total', s.total, 'currency', s.currency,
                 'decimals', s.currency_decimals, 'generated_at', s.generated_at,
                 'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                             'user_id', l.user_id, 'share', l.share, 'paid', l.paid, 'net', l.net,
                             'confirmed', public.line_confirmed(l.id), 'awaiting', public.line_awaiting(l.id))
                             order by l.net), '[]'::jsonb)
                           from public.settlement_lines l where l.settlement_id = s.id and l.id = any (v_lines)))
                 order by s.generated_at)
               from public.settlements s where s.cycle_id = any (v_cycles)), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', p.id, 'payer', p.payer_id, 'amount', p.amount, 'currency', p.currency,
                 'method', p.method, 'reference', p.reference, 'has_proof', p.proof_path is not null,
                 'status', p.status, 'claimed_at', p.claimed_at, 'decided_by', p.decided_by,
                 'decided_at', p.decided_at, 'reject_reason', p.reject_reason)
                 order by p.claimed_at)
               from public.payments p
              where p.settlement_line_id = any (v_lines)), '[]'::jsonb),
    'disputes', coalesce((select jsonb_agg(jsonb_build_object(
                 'id', f.id, 'target_type', f.target_type, 'target_id', f.target_id, 'reason', f.reason,
                 'note', f.note, 'status', f.status, 'raised_by', f.raised_by, 'created_at', f.created_at,
                 'resolved_by', f.resolved_by, 'resolved_at', f.resolved_at, 'resolution_note', f.resolution_note)
                 order by f.created_at)
               from public.flags f
              where f.room_id = p_room
                and (f.target_id = any (v_exp) or f.target_id = any (v_lines)
                     or f.target_id in (select p.id from public.payments p where p.settlement_line_id = any (v_lines)))
                and (not v_mine or f.raised_by = p_user or f.target_owner = p_user)), '[]'::jsonb),
    'audit', coalesce((select jsonb_agg(jsonb_build_object(
                 'at', a.created_at, 'entity', a.entity_type, 'action', a.action, 'actor', a.actor_id,
                 'title', coalesce(a.new_value ->> 'title', a.new_value ->> 'name')) order by a.created_at)
               from (select * from public.audit_log a
                      where a.room_id = p_room
                        and (a.entity_id = any (v_exp) or a.entity_id = any (v_cycles)
                             or a.entity_id in (select s.id from public.settlements s where s.cycle_id = any (v_cycles))
                             or a.entity_id in (select p.id from public.payments p where p.settlement_line_id = any (v_lines)))
                        and (not v_mine or a.actor_id = p_user)
                      order by a.created_at desc limit 500) a), '[]'::jsonb)
  ) into v_out;
  return v_out;
end;
$$;

-- App: members download their own report; Admins may download the full Room.
create function public.report_data(p_room uuid, p_cycle uuid default null, p_scope text default 'mine')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if p_scope not in ('mine', 'room') then
    raise exception 'not_allowed' using errcode = '22023';
  end if;
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_scope = 'room' and not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_cycle is not null and not exists (select 1 from public.cycles where id = p_cycle and room_id = p_room) then
    raise exception 'not_found' using errcode = '02000';
  end if;
  return public.report_data_internal(v_uid, p_room, p_cycle, p_scope, null, null, 'app');
end;
$$;

-- Anyone holding a report can check that its reference number is genuine.
create function public.verify_report(p_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('found', true, 'generated_at', created_at, 'scope', scope)
                     from public.report_refs where ref = upper(trim(p_ref))),
                  jsonb_build_object('found', false));
$$;

-- PRD §18.5: download all my data.
create function public.my_data_export() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  return jsonb_build_object(
    'ref', public.new_report_ref(v_uid, null, 'export', 'export'),
    'generated_at', now(),
    'profile', (select jsonb_build_object('display_name', p.display_name, 'email', u.email,
                                          'date_of_birth', p.date_of_birth, 'language', p.language,
                                          'consent_version', p.consent_version, 'consent_at', p.consent_at,
                                          'created_at', p.created_at)
                  from public.profiles p join auth.users u on u.id = p.id where p.id = v_uid),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
                     'room', r.name, 'role', m.role, 'status', m.status, 'requested_at', m.requested_at,
                     'joined_on', m.joined_on, 'left_on', m.left_on) order by m.requested_at)
                   from public.room_members m join public.rooms r on r.id = m.room_id
                  where m.user_id = v_uid), '[]'::jsonb),
    'rooms', coalesce((select jsonb_agg(public.report_data_internal(v_uid, m.room_id, null, 'mine',
                                                                     null, null, 'export'))
                  from public.room_members m where m.user_id = v_uid and m.status = 'approved'), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaving statement (PRD §11.6): emailed when a member leaves or is removed.
-- ---------------------------------------------------------------------------
create function public.on_member_left() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'approved' and new.status in ('left', 'removed')
     and coalesce(current_setting('mm.deleting', true), '') <> new.user_id::text then
    perform public.queue_email(new.user_id, 'leave_statement', new.room_id,
      jsonb_build_object('from', new.joined_on, 'to', coalesce(new.left_on, public.room_today(new.room_id)),
                         'removed', new.status = 'removed'));
  end if;
  return new;
end;
$$;
create trigger room_members_left_statement after update on public.room_members
  for each row execute function public.on_member_left();

-- ---------------------------------------------------------------------------
-- Account deletion (PRD §18.3, §18.4)
-- ---------------------------------------------------------------------------
-- The user proved it is them within the last 10 minutes (fresh sign-in with password).
create function public.recent_auth(p_minutes int default 10) returns boolean
language sql stable set search_path = '' as $$
  select coalesce((select max((a ->> 'timestamp')::bigint)
                     from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a), 0)
         >= extract(epoch from now())::bigint - p_minutes * 60;
$$;

create function public.deletion_blocking_rooms(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('room_id', r.id, 'name', r.name)), '[]'::jsonb)
  from public.room_members m join public.rooms r on r.id = m.room_id
  where m.user_id = p_uid and m.status = 'approved' and m.role = 'admin'
    and (select count(*) from public.room_members a
          where a.room_id = m.room_id and a.status = 'approved' and a.role = 'admin') = 1
    and exists (select 1 from public.room_members o
                 where o.room_id = m.room_id and o.status = 'approved' and o.user_id <> p_uid);
$$;

-- Warnings shown before deleting (they do not block, except the last-Admin rule).
create function public.account_deletion_check() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  return jsonb_build_object(
    'blocking_rooms', public.deletion_blocking_rooms(v_uid),
    'unpaid', (select count(*) from public.settlement_lines l
                where l.user_id = v_uid and l.net < 0 and public.line_confirmed(l.id) < -l.net),
    'open_disputes', (select count(*) from public.flags f
                       where (f.raised_by = v_uid or f.target_owner = v_uid)
                         and f.status in ('open', 'under_review')),
    'purge_after', (current_date + interval '2 months')::date
  );
end;
$$;

-- Web page: email → confirmation link → confirm. Never reveals whether an email is registered.
create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz
);
alter table public.deletion_requests enable row level security;
revoke all on public.deletion_requests from anon, authenticated;

create function public.request_account_deletion(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_token text;
begin
  if p_email is null or char_length(p_email) > 320 then
    return;
  end if;
  select u.id into v_uid from auth.users u
   where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null;
  if v_uid is null or exists (select 1 from public.profiles where id = v_uid and deleted_at is not null) then
    return;
  end if;
  if (select count(*) from public.deletion_requests
       where user_id = v_uid and created_at > now() - interval '1 hour') >= 3 then
    return;
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.deletion_requests (user_id, token_hash)
  values (v_uid, encode(extensions.digest(v_token, 'sha256'), 'hex'));
  perform public.queue_email(v_uid, 'deletion_confirm', null, jsonb_build_object('token', v_token));
end;
$$;

-- In-app texts for the new notification kinds (push fallback text is English; app localizes)
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
    when 'dispute_raised' then array['Dispute raised', coalesce(n.payload ->> 'name', '') || ' flagged an item']
    when 'dispute_resolved' then array['Dispute resolved', coalesce(n.payload ->> 'outcome', '')]
    when 'need_created' then array['Need request', coalesce(n.payload ->> 'title', '')]
    when 'need_accepted' then array['Need accepted', coalesce(n.payload ->> 'name', '') || ' will buy ' || coalesce(n.payload ->> 'title', '')]
    when 'need_completed' then array['Need completed', coalesce(n.payload ->> 'title', '')]
    when 'expense_late_entry' then array['Late entry', coalesce(n.payload ->> 'title', '')]
    when 'member_account_deleted' then array['Member left', coalesce(n.payload ->> 'name', '') || ' deleted their account']
    when 'retention_reminder' then array['Download your reports', 'Records of ' || coalesce(n.payload ->> 'from', '') || ' – ' || coalesce(n.payload ->> 'to', '') || ' will be deleted on ' || coalesce(n.payload ->> 'delete_on', '')]
    else array['Mess Manager', 'You have a new notification']
  end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: only the public API is callable by the app; jobs and worker API are service-only.
-- ---------------------------------------------------------------------------
revoke execute on function public.cycle_purge_on(uuid) from public, anon, authenticated;
revoke execute on function public.queue_email(uuid, text, uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.email_claim(int) from public, anon, authenticated;
revoke execute on function public.email_done(uuid, boolean, text) from public, anon, authenticated;
revoke execute on function public.queue_file_purge(text) from public, anon, authenticated;
revoke execute on function public.storage_purge_claim(int) from public, anon, authenticated;
revoke execute on function public.storage_purge_done(text[]) from public, anon, authenticated;
revoke execute on function public.new_report_ref(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.member_labels_for(uuid) from public, anon, authenticated;
revoke execute on function public.report_data_internal(uuid, uuid, uuid, text, date, date, text) from public, anon, authenticated;
revoke execute on function public.on_member_left() from public, anon, authenticated;
revoke execute on function public.recent_auth(int) from public, anon, authenticated;
revoke execute on function public.deletion_blocking_rooms(uuid) from public, anon, authenticated;

grant execute on function public.email_claim(int) to service_role;
grant execute on function public.email_done(uuid, boolean, text) to service_role;
grant execute on function public.storage_purge_claim(int) to service_role;
grant execute on function public.storage_purge_done(text[]) to service_role;
grant execute on function public.report_data_internal(uuid, uuid, uuid, text, date, date, text) to service_role;

revoke execute on function public.report_data(uuid, uuid, text) from public, anon;
revoke execute on function public.my_data_export() from public, anon;
revoke execute on function public.account_deletion_check() from public, anon;
grant execute on function public.report_data(uuid, uuid, text) to authenticated;
grant execute on function public.my_data_export() to authenticated;
grant execute on function public.account_deletion_check() to authenticated;

revoke execute on function public.verify_report(text) from public;
revoke execute on function public.request_account_deletion(text) from public;
grant execute on function public.verify_report(text) to anon, authenticated;
grant execute on function public.request_account_deletion(text) to anon, authenticated;
