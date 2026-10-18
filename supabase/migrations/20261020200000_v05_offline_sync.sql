-- v0.5: safe sync for offline actions (PRD §17.2). The server decides, using server time.
--  * sync_create_expense: idempotent; if the expense date fell in a cycle that was locked
--    meanwhile it is booked into the current open cycle as a "late entry" and the creator is told.
--  * sync_edit_expense / sync_delete_expense: refuse with `conflict` when the expense changed on the
--    server after the device last saw it (the earlier accepted change wins; the other is returned).
--  * sync_create_need: idempotent Need Request.
-- Existing functions are untouched, so v0.1–v0.4 clients keep working.

alter table public.expenses add column if not exists late_entry_from date;
alter table public.need_requests add column if not exists idempotency_key uuid unique;

create or replace function public.sync_create_expense(
  p_room uuid, p_title text, p_amount bigint, p_expense_date date,
  p_notes text default null, p_participants uuid[] default null,
  p_receipt_path text default null, p_idempotency_key uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_id uuid;
  v_late date;
begin
  if p_idempotency_key is null then
    raise exception 'idempotency_required' using errcode = '22023';
  end if;
  select id, late_entry_from into v_id, v_late from public.expenses where idempotency_key = p_idempotency_key;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'late', v_late is not null, 'replay', true);
  end if;

  begin
    v_id := public.create_expense(p_room, p_title, p_amount, p_expense_date, v_uid, p_notes,
                                  p_participants, p_receipt_path, p_idempotency_key);
  exception when others then
    if sqlerrm <> 'cycle_locked' then
      raise;
    end if;
    -- Locked meanwhile: keep the money, book it today, remember the original date.
    v_id := public.create_expense(p_room, p_title, p_amount, public.room_today(p_room), v_uid, p_notes,
                                  p_participants, p_receipt_path, p_idempotency_key);
    update public.expenses set late_entry_from = p_expense_date where id = v_id;
    perform public.notify(v_uid, p_room, 'expense_late_entry',
      jsonb_build_object('title', p_title, 'original_date', p_expense_date, 'expense_id', v_id));
    return jsonb_build_object('id', v_id, 'late', true, 'replay', false);
  end;
  return jsonb_build_object('id', v_id, 'late', false, 'replay', false);
end;
$$;

create or replace function public.sync_edit_expense(
  p_expense uuid, p_base_updated timestamptz, p_title text, p_amount bigint, p_expense_date date,
  p_notes text default null, p_participants uuid[] default null, p_receipt_path text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_updated timestamptz;
begin
  select updated_at into v_updated from public.expenses where id = p_expense for update;
  if v_updated is not null and p_base_updated is not null and v_updated > p_base_updated then
    raise exception 'conflict' using errcode = '40001';
  end if;
  perform public.edit_expense(p_expense, p_title, p_amount, p_expense_date, v_uid, p_notes,
                              p_participants, p_receipt_path);
end;
$$;

create or replace function public.sync_delete_expense(p_expense uuid, p_base_updated timestamptz)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  e public.expenses;
begin
  select * into e from public.expenses where id = p_expense for update;
  if e.id is not null and e.deleted_at is not null and e.deleted_by = v_uid then
    return; -- already deleted by this user: a retry is harmless
  end if;
  if e.id is not null and p_base_updated is not null and e.updated_at > p_base_updated then
    raise exception 'conflict' using errcode = '40001';
  end if;
  perform public.delete_expense(p_expense);
end;
$$;

create or replace function public.sync_create_need(
  p_room uuid, p_title text, p_note text default null, p_idempotency_key uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform public.require_verified_user();
  if p_idempotency_key is null then
    raise exception 'idempotency_required' using errcode = '22023';
  end if;
  select id into v_id from public.need_requests where idempotency_key = p_idempotency_key;
  if v_id is not null then
    return v_id;
  end if;
  v_id := public.create_need(p_room, p_title, p_note);
  update public.need_requests set idempotency_key = p_idempotency_key where id = v_id;
  return v_id;
end;
$$;

revoke execute on function
  public.sync_create_expense(uuid, text, bigint, date, text, uuid[], text, uuid),
  public.sync_edit_expense(uuid, timestamptz, text, bigint, date, text, uuid[], text),
  public.sync_delete_expense(uuid, timestamptz),
  public.sync_create_need(uuid, text, text, uuid)
  from public, anon;
grant execute on function
  public.sync_create_expense(uuid, text, bigint, date, text, uuid[], text, uuid),
  public.sync_edit_expense(uuid, timestamptz, text, bigint, date, text, uuid[], text),
  public.sync_delete_expense(uuid, timestamptz),
  public.sync_create_need(uuid, text, text, uuid)
  to authenticated;
