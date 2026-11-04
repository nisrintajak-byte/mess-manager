-- When someone deletes their account from the app, we keep their records for the retention
-- window but must free their email address straight away, so they can register again and get a
-- fresh confirmation email. Before this, the banned auth row kept the address, so a re-signup was
-- treated as a repeated signup and no confirmation email was sent (founder report 2026-11-04).
--
-- The deleted account's records stay under its (now banned, login-anonymised) user id until the
-- 2-month purge. The 'account deleted' email is queued first — queue_email snapshots the address
-- into the outbox row — so freeing it here does not affect that email.

create or replace function public.perform_account_deletion(p_uid uuid, p_via text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m record;
  v_name text;
  v_tomb text := 'deleted+' || p_uid::text || '@deleted.invalid';
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

  -- the 'account deleted' email keeps its own copy of the address (queue_email snapshots it)
  perform public.queue_email(p_uid, 'account_deleted', null,
    jsonb_build_object('purge_after', (current_date + interval '2 months')::date, 'via', p_via));

  -- login is disabled immediately and the address is freed for a fresh signup
  update auth.users set banned_until = now() + interval '200 years', email = v_tomb where id = p_uid;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_uid;
  end if;
  -- the email provider's identity also holds the address (real Supabase only; the test stub does not)
  if to_regclass('auth.identities') is not null
     and exists (select 1 from information_schema.columns
                  where table_schema = 'auth' and table_name = 'identities' and column_name = 'identity_data') then
    execute $q$ update auth.identities
                   set identity_data = jsonb_set(coalesce(identity_data, '{}'::jsonb), '{email}', to_jsonb($2::text))
                 where user_id = $1 and provider = 'email' $q$
      using p_uid, v_tomb;
  end if;
end;
$$;

revoke execute on function public.perform_account_deletion(uuid, text) from public, anon, authenticated;
