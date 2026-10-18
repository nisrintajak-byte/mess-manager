-- Mess Manager v0.2 — settlement cycles, lock, selected-member splits, adjustments,
-- receipts, payment claims with proof + Admin confirmation, Room settings rules.
-- Backward compatible: v0.1 functions keep their signatures and now delegate.
-- PRD §8.1–8.6, §10.1–10.4, §11.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.cycle_status as enum ('open', 'locked');
create type public.payment_method as enum ('bank', 'wallet', 'cash', 'other');
create type public.payment_status as enum ('awaiting', 'confirmed', 'rejected');

-- ---------------------------------------------------------------------------
-- Room settings changes that wait for the next cycle (PRD §8.3)
-- ---------------------------------------------------------------------------
alter table public.rooms
  add column pending_time_zone text,
  add column pending_settlement_cycle public.settlement_cycle;

-- ---------------------------------------------------------------------------
-- Cycles
-- ---------------------------------------------------------------------------
create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  starts_on date not null,
  ends_on date not null,
  kind public.settlement_cycle not null,
  time_zone text not null,
  currency char(3) not null,
  currency_decimals smallint not null,
  status public.cycle_status not null default 'open',
  locked_at timestamptz,
  locked_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (room_id, starts_on)
);
create index cycles_room_idx on public.cycles (room_id, starts_on desc);

-- ---------------------------------------------------------------------------
-- Expenses: cycle, receipts, adjustments, selected-member splits
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column cycle_id uuid references public.cycles (id),
  add column receipt_path text,
  add column adjusts_expense_id uuid references public.expenses (id),
  -- 'equal' = everyone active on the date; 'selected' = chosen members (PRD §10.1)
  add column split_mode text not null default 'equal' check (split_mode in ('equal', 'selected')),
  -- Adjustments that reduce an earlier expense are stored as positive amounts with is_credit = true,
  -- so the v0.1 "amount > 0" and "split >= 0" rules stay untouched. Signed value = amount * sign.
  add column is_credit boolean not null default false check (not is_credit or adjusts_expense_id is not null);
create index expenses_cycle_idx on public.expenses (cycle_id);

create function public.expense_sign(p_is_credit boolean) returns int
language sql immutable set search_path = '' as $$
  select case when p_is_credit then -1 else 1 end;
$$;

-- Participants chosen for "selected members" splits (and remembered for re-splitting on edit)
create table public.expense_participants (
  expense_id uuid not null references public.expenses (id),
  user_id uuid not null references auth.users (id),
  active boolean not null default true, -- deselected on edit -> false (rows are never removed)
  primary key (expense_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Settlements
-- ---------------------------------------------------------------------------
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  cycle_id uuid not null unique references public.cycles (id),
  total bigint not null,
  currency char(3) not null,
  currency_decimals smallint not null,
  generated_by uuid not null references auth.users (id),
  generated_at timestamptz not null default now()
);

create table public.settlement_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements (id),
  room_id uuid not null references public.rooms (id),
  user_id uuid not null references auth.users (id),
  share bigint not null,
  paid bigint not null,
  net bigint not null, -- positive: receives; negative: pays
  unique (settlement_id, user_id)
);
create index settlement_lines_room_idx on public.settlement_lines (room_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id),
  settlement_line_id uuid not null references public.settlement_lines (id),
  payer_id uuid not null references auth.users (id),
  amount bigint not null check (amount > 0),
  currency char(3) not null,
  method public.payment_method not null,
  reference text check (reference is null or char_length(reference) <= 120),
  proof_path text,
  note text check (note is null or char_length(note) <= 500),
  status public.payment_status not null default 'awaiting',
  claimed_by uuid not null references auth.users (id),
  claimed_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 500),
  self_confirmed boolean not null default false,
  recorded_by_admin boolean not null default false,
  idempotency_key uuid unique
);
create index payments_line_idx on public.payments (settlement_line_id);

-- Audit the new tables too (append-only log from v0.1)
create trigger cycles_audit after insert or update on public.cycles
  for each row execute function public.write_audit();
create trigger settlements_audit after insert or update on public.settlements
  for each row execute function public.write_audit();
create trigger payments_audit after insert or update on public.payments
  for each row execute function public.write_audit();

-- ---------------------------------------------------------------------------
-- Cycle helpers
-- ---------------------------------------------------------------------------
create function public.cycle_end(p_start date, p_kind public.settlement_cycle) returns date
language sql immutable set search_path = '' as $$
  select case p_kind
    when 'daily' then p_start
    when 'weekly' then p_start + ((7 - extract(isodow from p_start)::int) % 7)  -- through Sunday
    else (date_trunc('month', p_start) + interval '1 month - 1 day')::date
  end;
$$;

-- Create every missing cycle up to (and including) the one containing p_date. Pending
-- time-zone / cycle-type changes are applied when the next cycle is created (PRD §8.3).
create function public.ensure_cycles(p_room uuid, p_date date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  last public.cycles;
  v_start date;
begin
  select * into r from public.rooms where id = p_room for update;
  select * into last from public.cycles where room_id = p_room order by starts_on desc limit 1;
  if last.id is null then
    v_start := (r.created_at at time zone r.time_zone)::date;
    insert into public.cycles (room_id, starts_on, ends_on, kind, time_zone, currency, currency_decimals)
    values (p_room, v_start, public.cycle_end(v_start, r.settlement_cycle), r.settlement_cycle,
            r.time_zone, r.currency, r.currency_decimals)
    returning * into last;
  end if;
  while last.ends_on < p_date loop
    if r.pending_time_zone is not null or r.pending_settlement_cycle is not null then
      update public.rooms
         set time_zone = coalesce(pending_time_zone, time_zone),
             settlement_cycle = coalesce(pending_settlement_cycle, settlement_cycle),
             pending_time_zone = null, pending_settlement_cycle = null
       where id = p_room
       returning * into r;
    end if;
    v_start := last.ends_on + 1;
    insert into public.cycles (room_id, starts_on, ends_on, kind, time_zone, currency, currency_decimals)
    values (p_room, v_start, public.cycle_end(v_start, r.settlement_cycle), r.settlement_cycle,
            r.time_zone, r.currency, r.currency_decimals)
    returning * into last;
  end loop;
end;
$$;

-- The cycle a date belongs to (creating cycles as needed). Null if before the Room existed.
create function public.cycle_for_date(p_room uuid, p_date date) returns public.cycles
language plpgsql security definer set search_path = '' as $$
declare
  c public.cycles;
begin
  perform public.ensure_cycles(p_room, p_date);
  select * into c from public.cycles
   where room_id = p_room and p_date between starts_on and ends_on;
  return c;
end;
$$;

create function public.current_cycle(p_room uuid) returns public.cycles
language sql security definer set search_path = '' as $$
  select public.cycle_for_date(p_room, public.room_today(p_room));
$$;

-- ---------------------------------------------------------------------------
-- Lock enforced in the database (PRD §11.5): nothing in a locked cycle changes.
-- ---------------------------------------------------------------------------
create function public.guard_locked_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.cycle_id is not null and exists (
       select 1 from public.cycles where id = old.cycle_id and status = 'locked') then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  if new.cycle_id is not null and exists (
       select 1 from public.cycles where id = new.cycle_id and status = 'locked') then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger expenses_lock_guard before insert or update on public.expenses
  for each row execute function public.guard_locked_expense();

create function public.guard_locked_split() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.expenses e join public.cycles c on c.id = e.cycle_id
             where e.id = coalesce(new.expense_id, old.expense_id) and c.status = 'locked') then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger expense_splits_lock_guard before insert or update or delete on public.expense_splits
  for each row execute function public.guard_locked_split();
create trigger expense_participants_lock_guard before insert or update or delete on public.expense_participants
  for each row execute function public.guard_locked_split();

-- Settlement snapshots are immutable once written.
create function public.immutable_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is immutable', tg_table_name;
end;
$$;
create trigger settlements_immutable before update or delete on public.settlements
  for each row execute function public.immutable_row();
create trigger settlement_lines_immutable before update or delete on public.settlement_lines
  for each row execute function public.immutable_row();

-- ---------------------------------------------------------------------------
-- Splits: equal among members active on the date, or among selected members.
-- Leftover minor units go to the payer (or first participant); parts sum exactly.
-- ---------------------------------------------------------------------------
create or replace function public.write_equal_split(p_expense uuid) returns void
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
  if e.split_mode = 'selected' then
    select array_agg(user_id order by user_id::text) into ids
    from public.expense_participants where expense_id = p_expense and active;
  else
    select array_agg(user_id order by user_id::text) into ids
    from (
      select distinct user_id from public.room_members
      where room_id = e.room_id
        and joined_on is not null and joined_on <= e.expense_date
        and (left_on is null or left_on >= e.expense_date)
        and status in ('approved', 'left', 'removed')
    ) s;
  end if;
  n := coalesce(array_length(ids, 1), 0);
  if n = 0 then
    raise exception 'no_active_members_on_date' using errcode = '22023';
  end if;
  base := e.amount / n;
  remainder := e.amount - base * n;
  remainder_to := case when e.paid_by = any (ids) then e.paid_by else ids[1] end;

  insert into public.expense_splits (expense_id, user_id, amount)
  select p_expense, uid, base + case when uid = remainder_to then remainder else 0 end
  from unnest(ids) as uid
  on conflict (expense_id, user_id) do update set amount = excluded.amount;
  update public.expense_splits set amount = 0
   where expense_id = p_expense and not (user_id = any (ids));
end;
$$;

-- Store the chosen sharers for a 'selected' split; anyone not chosen becomes inactive.
create function public.set_participants(p_expense uuid, p_participants uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
  bad int;
begin
  select * into e from public.expenses where id = p_expense;
  if p_participants is null or coalesce(array_length(p_participants, 1), 0) = 0 then
    raise exception 'participants_required' using errcode = '22023';
  end if;
  select count(*) into bad from unnest(p_participants) as uid
  where not exists (
    select 1 from public.room_members rm
    where rm.room_id = e.room_id and rm.user_id = uid
      and rm.joined_on is not null and rm.joined_on <= e.expense_date
      and (rm.left_on is null or rm.left_on >= e.expense_date)
  );
  if bad > 0 then
    raise exception 'participant_not_active' using errcode = '22023';
  end if;
  insert into public.expense_participants (expense_id, user_id, active)
  select distinct p_expense, uid, true from unnest(p_participants) as uid
  on conflict (expense_id, user_id) do update set active = true;
  update public.expense_participants set active = false
   where expense_id = p_expense and not (user_id = any (p_participants));
end;
$$;

create function public.valid_room_file(p_room uuid, p_path text) returns boolean
language sql immutable set search_path = '' as $$
  select p_path is null or (p_path like p_room::text || '/%' and p_path !~ '\.\.');
$$;

-- ---------------------------------------------------------------------------
-- Expense API (v0.2). v0.1 functions delegate here.
-- ---------------------------------------------------------------------------
create function public.create_expense(
  p_room uuid, p_title text, p_amount bigint, p_expense_date date, p_paid_by uuid,
  p_notes text default null, p_participants uuid[] default null,
  p_receipt_path text default null, p_idempotency_key uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_id uuid;
  r public.rooms;
  c public.cycles;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.expenses where idempotency_key = p_idempotency_key;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_expense_date > public.room_today(p_room) then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if not public.valid_room_file(p_room, p_receipt_path) then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_paid_by
                 and status = 'approved') then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;
  select * into r from public.rooms where id = p_room;
  c := public.cycle_for_date(p_room, p_expense_date);
  if c.id is null then
    raise exception 'before_room_start' using errcode = '22023';
  end if;
  if c.status = 'locked' then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;

  insert into public.expenses (room_id, cycle_id, title, amount, currency, category, expense_date, paid_by,
                               notes, split_mode, receipt_path, created_by, idempotency_key)
  values (p_room, c.id, trim(p_title), p_amount, c.currency, 'general', p_expense_date, p_paid_by,
          nullif(trim(p_notes), ''),
          case when p_participants is null then 'equal' else 'selected' end,
          p_receipt_path, v_uid, p_idempotency_key)
  returning id into v_id;
  if p_participants is not null then
    perform public.set_participants(v_id, p_participants);
  end if;
  perform public.write_equal_split(v_id);
  return v_id;
end;
$$;

create function public.edit_expense(
  p_expense uuid, p_title text, p_amount bigint, p_expense_date date, p_paid_by uuid,
  p_notes text default null, p_participants uuid[] default null, p_receipt_path text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses;
  c public.cycles;
begin
  perform public.require_verified_user();
  select * into e from public.expenses where id = p_expense for update;
  if e.id is null or not public.can_modify_expense(e) or e.adjusts_expense_id is not null then
    raise exception 'edit_not_allowed' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_expense_date > public.room_today(e.room_id) then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if not public.valid_room_file(e.room_id, p_receipt_path) then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  if not exists (select 1 from public.room_members where room_id = e.room_id and user_id = p_paid_by
                 and status = 'approved') then
    raise exception 'payer_not_member' using errcode = '22023';
  end if;
  c := public.cycle_for_date(e.room_id, p_expense_date);
  if c.id is null then
    raise exception 'before_room_start' using errcode = '22023';
  end if;
  if c.status = 'locked' then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  update public.expenses
     set title = trim(p_title), amount = p_amount, cycle_id = c.id, currency = c.currency,
         expense_date = p_expense_date, paid_by = p_paid_by, notes = nullif(trim(p_notes), ''),
         split_mode = case when p_participants is null then 'equal' else 'selected' end,
         receipt_path = coalesce(p_receipt_path, receipt_path)
   where id = p_expense;
  if p_participants is not null then
    perform public.set_participants(p_expense, p_participants);
  end if;
  perform public.write_equal_split(p_expense);
end;
$$;

-- v0.1 API kept for the running preview; now cycle- and lock-aware.
create or replace function public.add_expense(
  p_room uuid, p_title text, p_amount bigint, p_category text, p_expense_date date,
  p_paid_by uuid, p_notes text default null, p_idempotency_key uuid default null
) returns uuid
language sql security definer set search_path = '' as $$
  select public.create_expense(p_room, p_title, p_amount, p_expense_date, p_paid_by, p_notes,
                               null, null, p_idempotency_key);
$$;

create or replace function public.update_expense(
  p_expense uuid, p_title text, p_amount bigint, p_category text, p_expense_date date,
  p_paid_by uuid, p_notes text default null
) returns void
language sql security definer set search_path = '' as $$
  select public.edit_expense(p_expense, p_title, p_amount, p_expense_date, p_paid_by, p_notes, null, null);
$$;

-- delete_expense: unchanged body; the lock trigger now blocks locked cycles.

-- Correction after a lock (PRD §11.5): Admin adds a linked adjustment in the open cycle.
-- Same payer and same sharers as the original. Positive p_amount adds, negative reduces.
create function public.add_adjustment(p_expense uuid, p_amount bigint, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  o public.expenses;
  c public.cycles;
  v_id uuid;
begin
  select * into o from public.expenses where id = p_expense;
  if o.id is null or not public.is_room_admin(o.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_amount is null or p_amount = 0 then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_note is null or char_length(trim(p_note)) = 0 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  c := public.current_cycle(o.room_id);
  insert into public.expenses (room_id, cycle_id, title, amount, currency, category, expense_date, paid_by,
                               notes, split_mode, created_by, adjusts_expense_id, is_credit)
  values (o.room_id, c.id, left('Adjustment: ' || o.title, 120), abs(p_amount), c.currency, 'general',
          public.room_today(o.room_id), o.paid_by, trim(p_note), 'selected', v_uid, o.id, p_amount < 0)
  returning id into v_id;
  insert into public.expense_participants (expense_id, user_id)
  select v_id, s.user_id from public.expense_splits s where s.expense_id = o.id and s.amount <> 0;
  perform public.write_equal_split(v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Balances for one cycle (live, from expenses). Defaults to the current cycle.
-- ---------------------------------------------------------------------------
create function public.cycle_balances(p_cycle uuid)
returns table (user_id uuid, paid bigint, share bigint, net bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.cycles;
begin
  select * into c from public.cycles where id = p_cycle;
  if c.id is null or not public.is_room_member(c.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with live as (
    select * from public.expenses where cycle_id = p_cycle and deleted_at is null
  ),
  people as (
    select rm.user_id from public.room_members rm
     where rm.room_id = c.room_id and rm.joined_on is not null
       and rm.joined_on <= c.ends_on and (rm.left_on is null or rm.left_on >= c.starts_on)
    union select paid_by from live
    union select s.user_id from public.expense_splits s join live l on l.id = s.expense_id
  ),
  paid as (select paid_by as uid, sum(amount * public.expense_sign(is_credit)) as amt from live group by paid_by),
  owed as (
    select s.user_id as uid, sum(s.amount * public.expense_sign(l.is_credit)) as amt
    from public.expense_splits s join live l on l.id = s.expense_id group by s.user_id
  )
  select p.user_id, coalesce(pd.amt, 0)::bigint, coalesce(o.amt, 0)::bigint,
         (coalesce(pd.amt, 0) - coalesce(o.amt, 0))::bigint
  from (select distinct people.user_id from people) p
  left join paid pd on pd.uid = p.user_id
  left join owed o on o.uid = p.user_id;
end;
$$;

-- Room cycles list for the UI (ensures the current cycle exists).
create function public.room_cycles(p_room uuid)
returns setof public.cycles
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_room_member(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform public.current_cycle(p_room);
  return query select * from public.cycles where room_id = p_room order by starts_on desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Settlement generation + lock (Admin, ended cycles only, server time)
-- ---------------------------------------------------------------------------
create function public.generate_settlement(p_cycle uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  c public.cycles;
  v_id uuid;
  v_total bigint;
  v_check bigint;
begin
  select * into c from public.cycles where id = p_cycle for update;
  if c.id is null or not public.is_room_admin(c.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if c.status = 'locked' then
    raise exception 'already_settled' using errcode = '22023';
  end if;
  -- A cycle still running can be closed early "up to yesterday": today's entries move to a new cycle.
  if c.ends_on >= public.room_today(c.room_id) then
    if c.starts_on >= public.room_today(c.room_id) then
      raise exception 'cycle_not_ended' using errcode = '22023';
    end if;
    update public.cycles set ends_on = public.room_today(c.room_id) - 1 where id = p_cycle
      returning * into c;
    perform public.ensure_cycles(c.room_id, public.room_today(c.room_id));
    update public.expenses e set cycle_id = n.id
      from public.cycles n
     where e.cycle_id = p_cycle and n.room_id = c.room_id
       and e.expense_date between n.starts_on and n.ends_on;
  end if;
  -- Earlier cycles must be settled first so balances never skip a period.
  if exists (select 1 from public.cycles where room_id = c.room_id and starts_on < c.starts_on
             and status = 'open') then
    raise exception 'earlier_cycle_open' using errcode = '22023';
  end if;

  select coalesce(sum(amount * public.expense_sign(is_credit)), 0) into v_total
  from public.expenses where cycle_id = p_cycle and deleted_at is null;

  insert into public.settlements (room_id, cycle_id, total, currency, currency_decimals, generated_by)
  values (c.room_id, p_cycle, v_total, c.currency, c.currency_decimals, v_uid)
  returning id into v_id;

  insert into public.settlement_lines (settlement_id, room_id, user_id, share, paid, net)
  select v_id, c.room_id, b.user_id, b.share, b.paid, b.net
  from public.cycle_balances(p_cycle) b;

  select coalesce(sum(net), 0) into v_check from public.settlement_lines where settlement_id = v_id;
  if v_check <> 0 then
    raise exception 'settlement_unbalanced' using errcode = 'XX000';
  end if;

  update public.cycles set status = 'locked', locked_at = now(), locked_by = v_uid where id = p_cycle;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments (PRD §11.4)
-- ---------------------------------------------------------------------------
create function public.line_confirmed(p_line uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::bigint from public.payments
  where settlement_line_id = p_line and status = 'confirmed';
$$;

create function public.line_awaiting(p_line uuid) returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::bigint from public.payments
  where settlement_line_id = p_line and status = 'awaiting';
$$;

create function public.claim_payment(
  p_line uuid, p_amount bigint, p_method public.payment_method,
  p_reference text default null, p_proof_path text default null, p_note text default null,
  p_idempotency_key uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  l public.settlement_lines;
  s public.settlements;
  v_id uuid;
  v_owed bigint;
begin
  if p_idempotency_key is not null then
    select id into v_id from public.payments where idempotency_key = p_idempotency_key;
    if v_id is not null then
      return v_id;
    end if;
  end if;
  select * into l from public.settlement_lines where id = p_line for update;
  if l.id is null or l.user_id <> v_uid or not public.is_room_member(l.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into s from public.settlements where id = l.settlement_id;
  v_owed := greatest(-l.net, 0) - public.line_confirmed(p_line) - public.line_awaiting(p_line);
  if p_amount is null or p_amount <= 0 or p_amount > v_owed then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  if p_method <> 'cash' and nullif(trim(coalesce(p_reference, '')), '') is null and p_proof_path is null then
    raise exception 'proof_required' using errcode = '22023';
  end if;
  if not public.valid_room_file(l.room_id, p_proof_path) then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  insert into public.payments (room_id, settlement_line_id, payer_id, amount, currency, method, reference,
                               proof_path, note, claimed_by, idempotency_key)
  values (l.room_id, p_line, v_uid, p_amount, s.currency, p_method, nullif(trim(p_reference), ''),
          p_proof_path, nullif(trim(p_note), ''), v_uid, p_idempotency_key)
  returning id into v_id;
  return v_id;
end;
$$;

-- Admin confirms or rejects (reason required). Not on own claim when another Admin exists.
create function public.decide_payment(p_payment uuid, p_confirm boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  p public.payments;
  v_self boolean;
begin
  select * into p from public.payments where id = p_payment for update;
  if p.id is null or not public.is_room_admin(p.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p.status <> 'awaiting' then
    raise exception 'not_pending' using errcode = '22023';
  end if;
  v_self := p.payer_id = v_uid;
  if v_self and public.approved_admin_count(p.room_id) > 1 then
    raise exception 'other_admin_must_confirm' using errcode = '42501';
  end if;
  if not p_confirm and nullif(trim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update public.payments
     set status = case when p_confirm then 'confirmed' else 'rejected' end::public.payment_status,
         decided_by = v_uid, decided_at = now(),
         reject_reason = case when p_confirm then null else trim(p_reason) end,
         self_confirmed = p_confirm and v_self
   where id = p_payment;
end;
$$;

-- Admin records money received directly (e.g. cash in hand); logged with the Admin's name.
create function public.record_payment(
  p_line uuid, p_amount bigint, p_method public.payment_method,
  p_reference text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  l public.settlement_lines;
  s public.settlements;
  v_id uuid;
  v_owed bigint;
  v_self boolean;
begin
  select * into l from public.settlement_lines where id = p_line for update;
  if l.id is null or not public.is_room_admin(l.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_self := l.user_id = v_uid;
  if v_self and public.approved_admin_count(l.room_id) > 1 then
    raise exception 'other_admin_must_confirm' using errcode = '42501';
  end if;
  select * into s from public.settlements where id = l.settlement_id;
  v_owed := greatest(-l.net, 0) - public.line_confirmed(p_line) - public.line_awaiting(p_line);
  if p_amount is null or p_amount <= 0 or p_amount > v_owed then
    raise exception 'amount_invalid' using errcode = '22023';
  end if;
  insert into public.payments (room_id, settlement_line_id, payer_id, amount, currency, method, reference,
                               note, status, claimed_by, decided_by, decided_at, recorded_by_admin,
                               self_confirmed)
  values (l.room_id, p_line, l.user_id, p_amount, s.currency, p_method, nullif(trim(p_reference), ''),
          nullif(trim(p_note), ''), 'confirmed', v_uid, v_uid, now(), true, v_self)
  returning id into v_id;
  return v_id;
end;
$$;

-- Lines with live payment status for a settlement.
-- Status: settled (nothing to pay) · pending · awaiting · partial · paid
create function public.settlement_status(p_settlement uuid)
returns table (line_id uuid, user_id uuid, share bigint, paid bigint, net bigint,
               confirmed bigint, awaiting bigint, status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.settlements;
begin
  select * into s from public.settlements where id = p_settlement;
  if s.id is null or not public.is_room_member(s.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select l.id, l.user_id, l.share, l.paid, l.net,
         public.line_confirmed(l.id), public.line_awaiting(l.id),
         case
           when l.net >= 0 then 'settled'
           when public.line_confirmed(l.id) >= -l.net then 'paid'
           when public.line_awaiting(l.id) > 0 then 'awaiting'
           when public.line_confirmed(l.id) > 0 then 'partial'
           else 'pending'
         end
  from public.settlement_lines l where l.settlement_id = p_settlement
  order by l.net;
end;
$$;

-- ---------------------------------------------------------------------------
-- Room settings with PRD rules (§8.1–8.3) and Room delete rule (§8.6)
-- ---------------------------------------------------------------------------
create function public.update_room_settings(
  p_room uuid, p_name text, p_country_code text, p_currency text, p_currency_decimals int,
  p_time_zone text, p_cycle public.settlement_cycle
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
  c public.cycles;
  v_quiet boolean; -- current cycle has no expenses and every earlier cycle is locked
  v_result text := 'saved';
begin
  perform public.require_verified_user();
  if not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_time_zone) then
    raise exception 'invalid_time_zone' using errcode = '22023';
  end if;
  c := public.current_cycle(p_room);
  select * into r from public.rooms where id = p_room for update;
  v_quiet := not exists (select 1 from public.expenses where cycle_id = c.id and deleted_at is null)
         and not exists (select 1 from public.cycles where room_id = p_room and starts_on < c.starts_on
                         and status = 'open');

  update public.rooms set name = trim(p_name) where id = p_room;

  if upper(p_currency) <> r.currency or upper(p_country_code) <> r.country_code then
    if upper(p_currency) <> r.currency and not v_quiet then
      raise exception 'currency_change_not_allowed' using errcode = '22023';
    end if;
    update public.rooms
       set country_code = upper(p_country_code), currency = upper(p_currency),
           currency_decimals = p_currency_decimals
     where id = p_room;
    update public.cycles set currency = upper(p_currency), currency_decimals = p_currency_decimals
     where id = c.id;
  end if;

  if p_time_zone <> r.time_zone or p_cycle <> r.settlement_cycle then
    if v_quiet then
      -- Nothing recorded yet in this cycle: apply now and re-cut the current cycle.
      update public.rooms
         set time_zone = p_time_zone, settlement_cycle = p_cycle,
             pending_time_zone = null, pending_settlement_cycle = null
       where id = p_room;
      update public.cycles
         set time_zone = p_time_zone, kind = p_cycle,
             ends_on = greatest(c.starts_on, public.cycle_end(c.starts_on, p_cycle))
       where id = c.id;
    else
      update public.rooms
         set pending_time_zone = nullif(p_time_zone, r.time_zone),
             pending_settlement_cycle = nullif(p_cycle, r.settlement_cycle)
       where id = p_room;
      v_result := 'effective_next_cycle:' || (c.ends_on + 1)::text;
    end if;
  else
    update public.rooms set pending_time_zone = null, pending_settlement_cycle = null where id = p_room;
  end if;
  return v_result;
end;
$$;

create function public.delete_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room and status = 'approved'
             and user_id <> v_uid) then
    raise exception 'room_has_members' using errcode = '22023';
  end if;
  if exists (select 1 from public.cycles c where c.room_id = p_room and c.status = 'open'
             and exists (select 1 from public.expenses e where e.cycle_id = c.id and e.deleted_at is null)) then
    raise exception 'room_has_unsettled_cycle' using errcode = '22023';
  end if;
  update public.room_members set status = 'left', left_on = public.room_today(p_room)
   where room_id = p_room and user_id = v_uid and status = 'approved';
  update public.rooms set deleted_at = now() where id = p_room;
end;
$$;

-- New Rooms get their first cycle immediately.
create or replace function public.create_room(
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
  perform public.current_cycle(v_room);
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: cycles for existing Rooms; assign existing expenses.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in select id from public.rooms loop
    perform public.ensure_cycles(r.id, public.room_today(r.id));
  end loop;
  update public.expenses e set cycle_id = c.id
    from public.cycles c
   where c.room_id = e.room_id and e.expense_date between c.starts_on and c.ends_on
     and e.cycle_id is null;
  -- An expense dated before its Room's first cycle joins the first cycle.
  update public.expenses e set cycle_id = (
      select c.id from public.cycles c where c.room_id = e.room_id order by starts_on limit 1)
   where e.cycle_id is null;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for receipts and payment proofs (PRD §10.3, §18.1)
-- Path: <room_id>/<uuid>.<ext>. Members of that Room can read and upload; nobody overwrites.
-- ---------------------------------------------------------------------------
create function public.try_uuid(p text) returns uuid
language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('room-files', 'room-files', false, 10485760,
            array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    on conflict (id) do nothing;

    execute $p$
      create policy room_files_read on storage.objects for select to authenticated
      using (bucket_id = 'room-files'
             and coalesce(public.is_room_member(public.try_uuid((storage.foldername(name))[1])), false))
    $p$;
    execute $p$
      create policy room_files_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'room-files'
                  and coalesce(public.is_room_member(public.try_uuid((storage.foldername(name))[1])), false))
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS + grants for new tables and functions
-- ---------------------------------------------------------------------------
alter table public.cycles enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlements enable row level security;
alter table public.settlement_lines enable row level security;
alter table public.payments enable row level security;

revoke all on public.cycles, public.expense_participants, public.settlements,
  public.settlement_lines, public.payments from anon, authenticated;
grant select on public.cycles, public.expense_participants, public.settlements,
  public.settlement_lines, public.payments to authenticated;

create policy cycles_select on public.cycles for select to authenticated
  using (public.is_room_member(room_id));
create policy expense_participants_select on public.expense_participants for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_room_member(e.room_id)));
create policy settlements_select on public.settlements for select to authenticated
  using (public.is_room_member(room_id));
create policy settlement_lines_select on public.settlement_lines for select to authenticated
  using (public.is_room_member(room_id));
-- Payment history and proofs are visible to all approved members (PRD §11.4)
create policy payments_select on public.payments for select to authenticated
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
  public.delete_room(uuid)
to authenticated;
