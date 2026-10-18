-- Founder decision 2026-10-18: "Paid by" is always the member who adds the expense.
-- The server ignores any p_paid_by sent by a client (kept in the signature so v0.1/v0.2 apps keep working),
-- and an edit never changes who paid. Prevents disputes from picking the wrong (or a same-named) member.

create or replace function public.create_expense(
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
  values (p_room, c.id, trim(p_title), p_amount, c.currency, 'general', p_expense_date, v_uid,
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

create or replace function public.edit_expense(
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
  c := public.cycle_for_date(e.room_id, p_expense_date);
  if c.id is null then
    raise exception 'before_room_start' using errcode = '22023';
  end if;
  if c.status = 'locked' then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  update public.expenses
     set title = trim(p_title), amount = p_amount, cycle_id = c.id, currency = c.currency,
         expense_date = p_expense_date, notes = nullif(trim(p_notes), ''),
         split_mode = case when p_participants is null then 'equal' else 'selected' end,
         receipt_path = coalesce(p_receipt_path, receipt_path)
   where id = p_expense;
  if p_participants is not null then
    perform public.set_participants(p_expense, p_participants);
  end if;
  perform public.write_equal_split(p_expense);
end;
$$;
