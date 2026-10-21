-- Admin picks the last day a settlement covers (founder 2026-10-21). Expenses after that day
-- move to the next cycle. The day must be inside the cycle and before today (Room time),
-- so today's new expenses always have an open cycle.
create function public.generate_settlement_until(p_cycle uuid, p_until date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_verified_user();
  c public.cycles;
  v_today date;
  v_id uuid;
  v_total bigint;
  v_check bigint;
  v_old_end date;
begin
  select * into c from public.cycles where id = p_cycle for update;
  if c.id is null or not public.is_room_admin(c.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if c.status = 'locked' then
    raise exception 'already_settled' using errcode = '22023';
  end if;
  v_today := public.room_today(c.room_id);
  if c.starts_on >= v_today then
    raise exception 'cycle_not_ended' using errcode = '22023';
  end if;
  if p_until is null or p_until < c.starts_on or p_until > c.ends_on or p_until >= v_today then
    raise exception 'date_invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.cycles where room_id = c.room_id and starts_on < c.starts_on
             and status = 'open') then
    raise exception 'earlier_cycle_open' using errcode = '22023';
  end if;

  if p_until < c.ends_on then
    v_old_end := c.ends_on;
    update public.cycles set ends_on = p_until where id = p_cycle returning * into c;
    if exists (select 1 from public.cycles where room_id = c.room_id and starts_on > p_until) then
      -- a later cycle already exists: the days in between get their own open cycle
      insert into public.cycles (room_id, starts_on, ends_on, kind, time_zone, currency, currency_decimals)
      values (c.room_id, p_until + 1, v_old_end, c.kind, c.time_zone, c.currency, c.currency_decimals);
    else
      perform public.ensure_cycles(c.room_id, v_today);
    end if;
    update public.expenses e set cycle_id = n.id
      from public.cycles n
     where e.cycle_id = p_cycle and n.room_id = c.room_id
       and e.expense_date between n.starts_on and n.ends_on;
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
revoke execute on function public.generate_settlement_until(uuid, date) from public, anon;
grant execute on function public.generate_settlement_until(uuid, date) to authenticated;

-- the old one-tap action = "up to the cycle's end, or yesterday if it is still running"
create or replace function public.generate_settlement(p_cycle uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cycles;
begin
  select * into c from public.cycles where id = p_cycle;
  if c.id is null or not public.is_room_admin(c.room_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return public.generate_settlement_until(p_cycle, least(c.ends_on, public.room_today(c.room_id) - 1));
end;
$$;
