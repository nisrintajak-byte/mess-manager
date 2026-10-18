-- Mess Manager v0.1 — core schema
-- Profiles, Rooms, membership with Admin approval, expenses with equal split,
-- append-only audit log, Row Level Security on every table.
-- All money is bigint minor units with an ISO 4217 code (PRD §10.2, §26).
-- All writes go through SECURITY DEFINER functions that re-check permissions
-- using server time; tables grant clients SELECT only.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('admin', 'member');
create type public.member_status as enum ('pending', 'approved', 'rejected', 'left', 'removed');
create type public.settlement_cycle as enum ('daily', 'weekly', 'monthly');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  date_of_birth date,
  language text not null default 'en' check (language in ('en', 'ar', 'ur', 'hi')),
  consent_version text not null,
  consent_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  country_code char(2) not null,
  currency char(3) not null,
  currency_decimals smallint not null check (currency_decimals between 0 and 4),
  time_zone text not null,
  settlement_cycle public.settlement_cycle not null default 'monthly',
  join_code text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  user_id uuid not null references auth.users (id),
  role public.member_role not null default 'member',
  status public.member_status not null default 'pending',
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  joined_on date,
  left_on date
);
-- One live (pending or approved) membership per user per Room.
create unique index room_members_live_uniq on public.room_members (room_id, user_id)
  where status in ('pending', 'approved');
create index room_members_user_idx on public.room_members (user_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  title text not null check (char_length(title) between 1 and 120),
  amount bigint not null check (amount > 0 and amount < 1000000000000000),
  currency char(3) not null,
  category text not null default 'general' check (char_length(category) between 1 and 40),
  expense_date date not null,
  paid_by uuid not null references auth.users (id),
  notes text check (notes is null or char_length(notes) <= 1000),
  split_method text not null default 'equal' check (split_method in ('equal')),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id),
  idempotency_key uuid unique
);
create index expenses_room_idx on public.expenses (room_id, expense_date desc);

create table public.expense_splits (
  expense_id uuid not null references public.expenses (id),
  user_id uuid not null references auth.users (id),
  amount bigint not null check (amount >= 0),
  primary key (expense_id, user_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  room_id uuid references public.rooms (id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index audit_log_room_idx on public.audit_log (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit log is append-only for everyone (PRD §10.5, §18.1)
-- ---------------------------------------------------------------------------
create function public.audit_log_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end;
$$;

create trigger audit_log_no_update before update or delete on public.audit_log
  for each row execute function public.audit_log_immutable();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public.audit_log_immutable();

create function public.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_room uuid;
  v_action text;
begin
  v_room := case tg_table_name when 'rooms' then new.id else (to_jsonb(new) ->> 'room_id')::uuid end;
  v_action := case
    when tg_op = 'INSERT' then 'create'
    when tg_table_name = 'expenses' and to_jsonb(old) ->> 'deleted_at' is null
         and to_jsonb(new) ->> 'deleted_at' is not null then 'delete'
    else 'update'
  end;
  insert into public.audit_log (room_id, entity_type, entity_id, action, old_value, new_value, actor_id)
  values (
    v_room, tg_table_name, new.id, v_action,
    case when tg_op = 'UPDATE' then to_jsonb(old) end,
    to_jsonb(new),
    auth.uid()
  );
  return new;
end;
$$;

create trigger rooms_audit after insert or update on public.rooms
  for each row execute function public.write_audit();
create trigger room_members_audit after insert or update on public.room_members
  for each row execute function public.write_audit();
create trigger expenses_audit after insert or update on public.expenses
  for each row execute function public.write_audit();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger rooms_touch before update on public.rooms
  for each row execute function public.touch_updated_at();
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profile is created from signup metadata (name, DOB, consent)
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, date_of_birth, language, consent_version, consent_at)
  values (
    new.id,
    coalesce(nullif(trim(m ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    nullif(m ->> 'date_of_birth', '')::date,
    coalesce(nullif(m ->> 'language', ''), 'en'),
    coalesce(nullif(m ->> 'consent_version', ''), 'unknown'),
    coalesce(nullif(m ->> 'consent_at', '')::timestamptz, now())
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = auth.uid() and status = 'approved'
  );
$$;

create function public.is_room_admin(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = auth.uid() and status = 'approved' and role = 'admin'
  );
$$;

create function public.require_verified_user() returns uuid
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
  return v_uid;
end;
$$;

create function public.room_today(p_room uuid) returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone r.time_zone)::date from public.rooms r where r.id = p_room;
$$;

create function public.new_join_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
  b bytea;
begin
  loop
    b := extensions.gen_random_bytes(8);
    code := '';
    for i in 0..7 loop
      code := code || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where join_code = code);
  end loop;
  return code;
end;
$$;

-- ---------------------------------------------------------------------------
-- Room functions
-- ---------------------------------------------------------------------------
create function public.create_room(
  p_name text, p_country_code text, p_currency text, p_currency_decimals int, p_time_zone text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_room uuid;
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  insert into public.rooms (name, country_code, currency, currency_decimals, time_zone, join_code, created_by)
  values (trim(p_name), upper(p_country_code), upper(p_currency), p_currency_decimals, p_time_zone,
          public.new_join_code(), v_uid)
  returning id into v_room;

  insert into public.room_members (room_id, user_id, role, status, decided_at, decided_by, joined_on)
  values (v_room, v_uid, 'admin', 'approved', now(), v_uid, public.room_today(v_room));
  return v_room;
end;
$$;

-- Join by code: always creates a pending request (a code never bypasses approval, PRD §8.5)
create function public.request_join(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_room uuid;
  v_member uuid;
begin
  select id into v_room from public.rooms
  where join_code = upper(trim(p_code)) and deleted_at is null;
  if v_room is null then
    raise exception 'room_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.room_members where room_id = v_room and user_id = v_uid
             and status in ('pending', 'approved')) then
    raise exception 'already_requested_or_member' using errcode = '23505';
  end if;
  insert into public.room_members (room_id, user_id) values (v_room, v_uid) returning id into v_member;
  return v_member;
end;
$$;

create function public.decide_join(p_member uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  m public.room_members;
begin
  select * into m from public.room_members where id = p_member for update;
  if m.id is null or not public.is_room_admin(m.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if m.status <> 'pending' then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  update public.room_members
     set status = case when p_approve then 'approved' else 'rejected' end::public.member_status,
         decided_at = now(), decided_by = v_uid,
         joined_on = case when p_approve then public.room_today(m.room_id) end
   where id = p_member;
end;
$$;

create function public.approved_admin_count(p_room uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.room_members
  where room_id = p_room and status = 'approved' and role = 'admin';
$$;

create function public.set_member_role(p_member uuid, p_role public.member_role) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.room_members;
begin
  perform public.require_verified_user();
  select * into m from public.room_members where id = p_member for update;
  if m.id is null or not public.is_room_admin(m.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if m.status <> 'approved' then
    raise exception 'not_approved_member' using errcode = '22023';
  end if;
  if m.role = 'admin' and p_role = 'member' and public.approved_admin_count(m.room_id) <= 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  update public.room_members set role = p_role where id = p_member;
end;
$$;

create function public.remove_member(p_member uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  m public.room_members;
begin
  select * into m from public.room_members where id = p_member for update;
  if m.id is null or not public.is_room_admin(m.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if m.status <> 'approved' then
    raise exception 'not_approved_member' using errcode = '22023';
  end if;
  if m.role = 'admin' and public.approved_admin_count(m.room_id) <= 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  update public.room_members
     set status = 'removed', decided_at = now(), decided_by = v_uid, left_on = public.room_today(m.room_id)
   where id = p_member;
end;
$$;

create function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  m public.room_members;
begin
  select * into m from public.room_members
  where room_id = p_room and user_id = v_uid and status = 'approved' for update;
  if m.id is null then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if m.role = 'admin' and public.approved_admin_count(p_room) <= 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  update public.room_members set status = 'left', left_on = public.room_today(p_room) where id = m.id;
end;
$$;

-- Admin-only: member emails (other members see only display name, PRD §7.5)
create function public.room_member_emails(p_room uuid)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text from public.room_members rm join auth.users u on u.id = rm.user_id
    where rm.room_id = p_room and rm.status in ('pending', 'approved');
end;
$$;

-- ---------------------------------------------------------------------------
-- Expense functions
-- ---------------------------------------------------------------------------

-- Equal split among members active on the expense date; leftover minor units to payer.
-- Mirrors src/lib/money.ts splitEqual.
create function public.write_equal_split(p_expense uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
  ids uuid[];
  n int;
  base bigint;
  remainder bigint;
  remainder_to uuid;
begin
  select * into e from public.expenses where id = p_expense;
  select array_agg(user_id order by user_id::text) into ids
  from (
    select distinct user_id from public.room_members
    where room_id = e.room_id
      and joined_on is not null and joined_on <= e.expense_date
      and (left_on is null or left_on >= e.expense_date)
      and status in ('approved', 'left', 'removed')
  ) s;
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then
    raise exception 'no_active_members_on_date' using errcode = '22023';
  end if;
  base := e.amount / n;
  remainder := e.amount - base * n;
  remainder_to := case when e.paid_by = any (ids) then e.paid_by else ids[1] end;

  delete from public.expense_splits where expense_id = p_expense;
  insert into public.expense_splits (expense_id, user_id, amount)
  select p_expense, uid, base + case when uid = remainder_to then remainder else 0 end
  from unnest(ids) as uid;
end;
$$;

create function public.add_expense(
  p_room uuid, p_title text, p_amount bigint, p_category text, p_expense_date date,
  p_paid_by uuid, p_notes text default null, p_idempotency_key uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_id uuid;
  r public.rooms;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.expenses where idempotency_key = p_idempotency_key;
    if v_id is not null then
      return v_id; -- safe retry, no duplicate
    end if;
  end if;
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from public.rooms where id = p_room;
  if p_expense_date > public.room_today(p_room) then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_paid_by
                 and status = 'approved') then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;

  insert into public.expenses (room_id, title, amount, currency, category, expense_date, paid_by, notes,
                               created_by, idempotency_key)
  values (p_room, trim(p_title), p_amount, r.currency, coalesce(nullif(trim(p_category), ''), 'general'),
          p_expense_date, p_paid_by, nullif(trim(p_notes), ''), v_uid, p_idempotency_key)
  returning id into v_id;
  perform public.write_equal_split(v_id);
  return v_id;
end;
$$;

-- Members: own expense within 30 minutes (server clock). Admins: any expense. (PRD §10.4)
create function public.can_modify_expense(e public.expenses) returns boolean
language sql stable security definer set search_path = '' as $$
  select e.deleted_at is null and (
    public.is_room_admin(e.room_id)
    or (public.is_room_member(e.room_id) and e.created_by = auth.uid()
        and now() - e.created_at <= interval '30 minutes')
  );
$$;

create function public.update_expense(
  p_expense uuid, p_title text, p_amount bigint, p_category text, p_expense_date date,
  p_paid_by uuid, p_notes text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
begin
  perform public.require_verified_user();
  select * into e from public.expenses where id = p_expense for update;
  if e.id is null or not public.can_modify_expense(e) then
    raise exception 'edit_not_allowed' using errcode = '42501';
  end if;
  if p_expense_date > public.room_today(e.room_id) then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_members where room_id = e.room_id and user_id = p_paid_by
                 and status = 'approved') then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;
  update public.expenses
     set title = trim(p_title), amount = p_amount,
         category = coalesce(nullif(trim(p_category), ''), 'general'),
         expense_date = p_expense_date, paid_by = p_paid_by, notes = nullif(trim(p_notes), '')
   where id = p_expense;
  perform public.write_equal_split(p_expense);
end;
$$;

-- Soft delete: hidden from totals, kept in history (PRD §10.4)
create function public.delete_expense(p_expense uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  e public.expenses;
begin
  select * into e from public.expenses where id = p_expense for update;
  if e.id is null or not public.can_modify_expense(e) then
    raise exception 'delete_not_allowed' using errcode = '42501';
  end if;
  update public.expenses set deleted_at = now(), deleted_by = v_uid where id = p_expense;
end;
$$;

create function public.room_balances(p_room uuid)
returns table (user_id uuid, paid bigint, share bigint, net bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with people as (
    select distinct rm.user_id from public.room_members rm
    where rm.room_id = p_room and rm.joined_on is not null
  ),
  live as (
    select * from public.expenses where room_id = p_room and deleted_at is null
  ),
  paid as (select paid_by as uid, sum(amount) as amt from live group by paid_by),
  owed as (
    select s.user_id as uid, sum(s.amount) as amt
    from public.expense_splits s join live l on l.id = s.expense_id group by s.user_id
  )
  select p.user_id,
         coalesce(pd.amt, 0)::bigint,
         coalesce(o.amt, 0)::bigint,
         (coalesce(pd.amt, 0) - coalesce(o.amt, 0))::bigint
  from people p
  left join paid pd on pd.uid = p.user_id
  left join owed o on o.uid = p.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: clients may only SELECT; all writes go through functions
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.profiles, public.rooms, public.room_members, public.expenses,
  public.expense_splits, public.audit_log from anon, authenticated;
grant select on public.profiles, public.rooms, public.room_members, public.expenses,
  public.expense_splits, public.audit_log to authenticated;
grant update (display_name, avatar_url, language) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or exists (
    select 1 from public.room_members mine
    join public.room_members theirs on theirs.room_id = mine.room_id
    where mine.user_id = auth.uid() and mine.status = 'approved' and theirs.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy rooms_select on public.rooms for select to authenticated using (public.is_room_member(id));

create policy room_members_select on public.room_members for select to authenticated using (
  user_id = auth.uid()
  or (public.is_room_member(room_id) and status = 'approved')
  or public.is_room_admin(room_id)
);

create policy expenses_select on public.expenses for select to authenticated
  using (public.is_room_member(room_id));

create policy expense_splits_select on public.expense_splits for select to authenticated using (
  exists (select 1 from public.expenses e where e.id = expense_id and public.is_room_member(e.room_id))
);

create policy audit_log_select on public.audit_log for select to authenticated
  using (room_id is not null and public.is_room_member(room_id));

-- Functions: only signed-in users may call the public API
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_room(text, text, text, int, text),
  public.request_join(text),
  public.decide_join(uuid, boolean),
  public.set_member_role(uuid, public.member_role),
  public.remove_member(uuid),
  public.leave_room(uuid),
  public.room_member_emails(uuid),
  public.add_expense(uuid, text, bigint, text, date, uuid, text, uuid),
  public.update_expense(uuid, text, bigint, text, date, uuid, text),
  public.delete_expense(uuid),
  public.room_balances(uuid),
  public.is_room_member(uuid),
  public.is_room_admin(uuid)
to authenticated;
