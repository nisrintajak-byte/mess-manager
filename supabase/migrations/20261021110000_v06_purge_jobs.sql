-- Mess Manager v0.6 (part 2) — the jobs that remove data: retention purge (2 calendar months),
-- in-app/web account deletion, final erase after the 2-month hold, and their schedules.
-- Kept separate because it contains DELETE/DROP statements (needs explicit approval to apply).
--
-- Purge mode: only the server's own retention/deletion jobs may remove locked records.
-- Clients never have DELETE grants and cannot set this flag through the API.

-- ---------------------------------------------------------------------------
-- Purge mode: only the server's own retention/deletion jobs may remove locked records.
-- Clients never have DELETE grants and cannot set this flag through the API.
-- ---------------------------------------------------------------------------
create function public.purging() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('mm.purge', true), '') = 'on';
$$;

create or replace function public.audit_log_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and public.purging() then
    return old;
  end if;
  raise exception 'audit_log is append-only';
end;
$$;

create or replace function public.immutable_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and public.purging() then
    return old;
  end if;
  raise exception '% is immutable', tg_table_name;
end;
$$;

create or replace function public.guard_locked_split() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.purging() then
    return coalesce(new, old);
  end if;
  if exists (select 1 from public.expenses e join public.cycles c on c.id = e.cycle_id
             where e.id = coalesce(new.expense_id, old.expense_id) and c.status = 'locked') then
    raise exception 'cycle_locked' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.guard_locked_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.purging() then
    return new;
  end if;
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

create or replace function public.write_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_room uuid;
  v_action text;
begin
  if public.purging() then
    return new;
  end if;
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

alter table public.expenses drop constraint expenses_check;
alter table public.expenses add constraint expenses_credit_check
  check (not is_credit or adjusts_expense_id is not null or adjusts_purged);

create function public.perform_account_deletion(p_uid uuid, p_via text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_name text;
begin
  if exists (select 1 from public.profiles where id = p_uid and deleted_at is not null) then
    return;
  end if;
  if jsonb_array_length(public.deletion_blocking_rooms(p_uid)) > 0 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  perform set_config('mm.deleting', p_uid::text, true);
  v_name := public.display_name(p_uid);

  for m in select * from public.room_members where user_id = p_uid and status = 'approved' loop
    update public.room_members set status = 'left', left_on = public.room_today(m.room_id) where id = m.id;
    perform public.notify_room(m.room_id, 'member_account_deleted',
      jsonb_build_object('name', v_name, 'room', public.room_name(m.room_id), 'user_id', p_uid), false, p_uid);
    -- a Room left with nobody in it is closed
    if not exists (select 1 from public.room_members where room_id = m.room_id and status = 'approved') then
      update public.rooms set deleted_at = now() where id = m.room_id and deleted_at is null;
    end if;
  end loop;
  update public.room_members set status = 'left', left_on = public.room_today(room_id)
   where user_id = p_uid and status = 'pending';

  update public.profiles
     set deleted_at = now(), deleted_via = p_via, avatar_url = null,
         purge_after = (current_date + interval '2 months')::date
   where id = p_uid;
  delete from public.notification_prefs where user_id = p_uid;
  delete from public.push_tokens where user_id = p_uid;

  -- login is disabled immediately
  update auth.users set banned_until = now() + interval '200 years' where id = p_uid;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_uid;
  end if;

  perform public.queue_email(p_uid, 'account_deleted', null,
    jsonb_build_object('purge_after', (current_date + interval '2 months')::date, 'via', p_via));
end;
$$;

create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if not public.recent_auth(10) then
    raise exception 'reauth_required' using errcode = '42501';
  end if;
  perform public.perform_account_deletion(v_uid, 'app');
end;
$$;

create function public.confirm_account_deletion(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  d public.deletion_requests;
  v_block jsonb;
begin
  select * into d from public.deletion_requests
   where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
     and used_at is null and expires_at > now()
   for update;
  if d.id is null then
    return jsonb_build_object('ok', false, 'error', 'link_invalid');
  end if;
  v_block := public.deletion_blocking_rooms(d.user_id);
  if jsonb_array_length(v_block) > 0 then
    return jsonb_build_object('ok', false, 'error', 'last_admin',
                              'rooms', (select jsonb_agg(x ->> 'name') from jsonb_array_elements(v_block) x));
  end if;
  perform public.perform_account_deletion(d.user_id, 'web');
  update public.deletion_requests set used_at = now() where id = d.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled jobs
-- ---------------------------------------------------------------------------
create function public.purge_cycle(p_cycle uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_exp uuid[];
  v_sets uuid[];
  v_lines uuid[];
  v_pays uuid[];
  v_flags uuid[];
  v_needs uuid[];
begin
  perform set_config('mm.purge', 'on', true);
  select coalesce(array_agg(id), '{}') into v_exp from public.expenses where cycle_id = p_cycle;
  select coalesce(array_agg(id), '{}') into v_sets from public.settlements where cycle_id = p_cycle;
  select coalesce(array_agg(id), '{}') into v_lines from public.settlement_lines where settlement_id = any (v_sets);
  select coalesce(array_agg(id), '{}') into v_pays from public.payments where settlement_line_id = any (v_lines);
  select coalesce(array_agg(id), '{}') into v_flags from public.flags
   where target_id = any (v_exp) or target_id = any (v_lines) or target_id = any (v_pays);
  select coalesce(array_agg(id), '{}') into v_needs from public.need_requests where expense_id = any (v_exp);

  -- private files
  perform public.queue_file_purge(receipt_path) from public.expenses where id = any (v_exp);
  perform public.queue_file_purge(proof_path) from public.payments where id = any (v_pays);
  perform public.queue_file_purge(evidence_path) from public.flags where id = any (v_flags);

  -- adjustments in later cycles keep their own amount but lose the link
  update public.expenses set adjusts_expense_id = null, adjusts_purged = true
   where adjusts_expense_id = any (v_exp) and not (id = any (v_exp));

  delete from public.audit_log
   where entity_id = any (v_exp || v_sets || v_pays || v_flags || v_needs || array[p_cycle]);
  delete from public.flags where id = any (v_flags);
  delete from public.need_requests where id = any (v_needs);
  delete from public.payments where id = any (v_pays);
  delete from public.settlement_acks where settlement_id = any (v_sets);
  delete from public.settlement_lines where id = any (v_lines);
  delete from public.settlements where id = any (v_sets);
  delete from public.expense_splits where expense_id = any (v_exp);
  delete from public.expense_participants where expense_id = any (v_exp);
  update public.expenses set adjusts_expense_id = null, adjusts_purged = true
   where id = any (v_exp) and adjusts_expense_id is not null;
  delete from public.expenses where id = any (v_exp);
  update public.cycles set purged_at = now() where id = p_cycle;
  perform set_config('mm.purge', 'off', true);
end;
$$;

-- Daily: 7-day notice emails + in-app reminder, then deletion after 2 calendar months.
create function public.run_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  c record;
  u record;
  v_notices int := 0;
  v_purged int := 0;
begin
  for c in select cy.*, public.cycle_purge_on(cy.id) as purge_on, public.room_today(cy.room_id) as today
             from public.cycles cy
            where cy.status = 'locked' and cy.purged_at is null loop
    if c.purge_notice_at is null and c.today >= c.purge_on - 7 then
      for u in select distinct m.user_id from public.room_members m
                 join public.profiles p on p.id = m.user_id
                where m.room_id = c.room_id and p.purged_at is null
                  and m.status in ('approved', 'left', 'removed')
                  and coalesce(m.joined_on, c.starts_on) <= c.ends_on
                  and (m.left_on is null or m.left_on >= c.starts_on) loop
        perform public.queue_email(u.user_id, 'retention_notice', c.room_id,
          jsonb_build_object('cycle_id', c.id, 'from', c.starts_on, 'to', c.ends_on, 'delete_on', c.purge_on));
        if exists (select 1 from public.room_members
                    where room_id = c.room_id and user_id = u.user_id and status = 'approved') then
          perform public.notify(u.user_id, c.room_id, 'retention_reminder',
            jsonb_build_object('room', public.room_name(c.room_id), 'from', c.starts_on, 'to', c.ends_on,
                               'delete_on', c.purge_on, 'cycle_id', c.id));
        end if;
      end loop;
      update public.cycles set purge_notice_at = now() where id = c.id;
      v_notices := v_notices + 1;
    end if;
    -- never delete before the notice has gone out at least 7 days earlier
    if c.today >= c.purge_on
       and coalesce((select purge_notice_at from public.cycles where id = c.id), now()) <= now() - interval '7 days' then
      perform public.purge_cycle(c.id);
      v_purged := v_purged + 1;
    end if;
  end loop;

  -- housekeeping: old inbox items and sent mail records
  delete from public.notifications where created_at < now() - interval '3 months';
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '30 days';
  delete from public.deletion_requests where expires_at < now() - interval '7 days';
  return jsonb_build_object('notices', v_notices, 'purged', v_purged);
end;
$$;

-- Daily: end of the 2-month hold → final PDF to the person and their former Rooms, then erase.
create function public.run_account_purges() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p record;
  rm record;
  v_final int := 0;
  v_erased int := 0;
begin
  for p in select * from public.profiles
            where deleted_at is not null and final_queued_at is null and purge_after <= current_date loop
    perform public.queue_email(p.id, 'account_final', null,
      jsonb_build_object('rooms', (select coalesce(jsonb_agg(distinct m.room_id), '[]'::jsonb)
                                     from public.room_members m where m.user_id = p.id)));
    for rm in select distinct o.user_id, o.room_id from public.room_members o
               where o.status = 'approved' and o.user_id <> p.id
                 and o.room_id in (select m.room_id from public.room_members m
                                    where m.user_id = p.id and m.joined_on is not null) loop
      perform public.queue_email(rm.user_id, 'member_account_final', rm.room_id,
        jsonb_build_object('deleted_user', p.id, 'name', p.display_name));
    end loop;
    update public.profiles set final_queued_at = now() where id = p.id;
    v_final := v_final + 1;
  end loop;

  for p in select * from public.profiles
            where final_queued_at is not null and purged_at is null
              and (final_queued_at < now() - interval '14 days'
                   or not exists (select 1 from public.email_outbox e
                                   where e.status in ('queued', 'sending')
                                     and (e.user_id = p.id or e.payload ->> 'deleted_user' = p.id::text))) loop
    update public.profiles set display_name = 'Deleted user', date_of_birth = null, avatar_url = null,
           purged_at = now() where id = p.id;
    update auth.users set email = null, phone = null, encrypted_password = null,
           raw_user_meta_data = '{}'::jsonb where id = p.id;
    if to_regclass('auth.identities') is not null then
      execute 'delete from auth.identities where user_id = $1' using p.id;
    end if;
    update public.email_outbox set to_email = null where user_id = p.id;
    v_erased := v_erased + 1;
  end loop;
  return jsonb_build_object('final_queued', v_final, 'erased', v_erased);
end;
$$;

revoke execute on function public.purging() from public, anon, authenticated;
revoke execute on function public.perform_account_deletion(uuid, text) from public, anon, authenticated;
revoke execute on function public.purge_cycle(uuid) from public, anon, authenticated;
revoke execute on function public.run_retention() from public, anon, authenticated;
revoke execute on function public.run_account_purges() from public, anon, authenticated;
grant execute on function public.run_retention() to service_role;
grant execute on function public.run_account_purges() to service_role;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.confirm_account_deletion(text) from public;
grant execute on function public.confirm_account_deletion(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Schedules (Supabase only; skipped on plain Postgres test databases)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mm-retention', '17 * * * *',
      'select public.run_retention(); select public.run_account_purges();');
  end if;
end $$;
