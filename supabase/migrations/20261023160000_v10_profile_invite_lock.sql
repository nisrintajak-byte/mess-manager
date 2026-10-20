-- v1.0 (founder 2026-10-20): edit own name + photo (PRD §7.7) and login lock after
-- 5 wrong passwords for 15 minutes (PRD §7.1).

-- ---------------------------------------------------------------------------
-- 1. Profile photo: private bucket, readable only by people who share a Room
-- ---------------------------------------------------------------------------
create function public.shares_room_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = auth.uid() or exists (
    select 1 from public.room_members a
      join public.room_members b on b.room_id = a.room_id
     where a.user_id = auth.uid() and a.status = 'approved'
       and b.user_id = p_user and b.status in ('approved', 'left', 'removed'));
$$;
revoke execute on function public.shares_room_with(uuid) from public, anon;
grant execute on function public.shares_room_with(uuid) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;
    execute $p$
      create policy avatars_read on storage.objects for select to authenticated
      using (bucket_id = 'avatars'
             and coalesce(public.shares_room_with(public.try_uuid((storage.foldername(name))[1])), false))
    $p$;
    execute $p$
      create policy avatars_upload on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;

create function public.update_profile(p_name text, p_avatar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_verified_user();
  v_old text;
begin
  if p_name is null or char_length(trim(p_name)) = 0 or char_length(p_name) > 80 then
    raise exception 'name_invalid' using errcode = '22023';
  end if;
  if p_avatar is not null and p_avatar !~ ('^' || v_uid::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'invalid_file' using errcode = '22023';
  end if;
  select avatar_url into v_old from public.profiles where id = v_uid;
  update public.profiles set display_name = p_name, avatar_url = p_avatar where id = v_uid;
  -- the old photo file is removed by the storage worker
  if v_old is not null and v_old is distinct from p_avatar then
    insert into public.storage_purge (path, bucket) values (v_old, 'avatars') on conflict do nothing;
  end if;
end;
$$;
revoke execute on function public.update_profile(text, text) from public, anon;
grant execute on function public.update_profile(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Login lock: 5 wrong passwords within 15 minutes lock that email for 15 minutes
-- ---------------------------------------------------------------------------
create table public.login_failures (
  email_hash text primary key,
  failures int not null default 0,
  first_at timestamptz not null default now(),
  locked_until timestamptz
);
alter table public.login_failures enable row level security;
revoke all on public.login_failures from anon, authenticated;

create function public.login_key(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(lower(trim(coalesce(p_email, ''))), 'sha256'), 'hex');
$$;
revoke execute on function public.login_key(text) from public, anon, authenticated;

-- seconds until this email may try again (0 = may try). Same answer for unknown emails.
create function public.login_wait(p_email text)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select greatest(ceil(extract(epoch from (f.locked_until - now()))), 0)::int
                     from public.login_failures f
                    where f.email_hash = public.login_key(p_email) and f.locked_until > now()), 0);
$$;

create function public.login_failed(p_email text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.login_failures;
begin
  if p_email is null or char_length(p_email) > 320 then
    return 0;
  end if;
  insert into public.login_failures as x (email_hash, failures) values (public.login_key(p_email), 1)
  on conflict (email_hash) do update
    set failures = case when x.first_at < now() - interval '15 minutes' or x.locked_until < now()
                        then 1 else x.failures + 1 end,
        first_at = case when x.first_at < now() - interval '15 minutes' or x.locked_until < now()
                        then now() else x.first_at end,
        locked_until = case when x.locked_until < now() then null else x.locked_until end
  returning * into f;
  if f.failures >= 5 and (f.locked_until is null or f.locked_until < now()) then
    update public.login_failures set locked_until = now() + interval '15 minutes'
     where email_hash = f.email_hash;
    return 900;
  end if;
  return public.login_wait(p_email);
end;
$$;

-- a successful sign-in clears the counter
create function public.login_succeeded()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.login_failures set failures = 0, locked_until = null
   where email_hash = public.login_key((select email from auth.users where id = auth.uid()));
$$;

revoke execute on function public.login_wait(text) from public;
revoke execute on function public.login_failed(text) from public;
revoke execute on function public.login_succeeded() from public, anon;
grant execute on function public.login_wait(text) to anon, authenticated;
grant execute on function public.login_failed(text) to anon, authenticated;
grant execute on function public.login_succeeded() to authenticated;
