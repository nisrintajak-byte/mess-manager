-- v0.4: Google Sign-In support.
--  * handle_new_user reads Google's name / picture (name, email and picture only — PRD §7.3)
--  * Google users have no date of birth or consent yet: their profile starts with
--    consent_version = 'unknown' and they must call complete_profile() before using Rooms.
--  * Backward compatible with v0.1–v0.3 (password signups always carry a consent version).

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_avatar text := nullif(coalesce(m ->> 'avatar_url', m ->> 'picture'), '');
begin
  if v_avatar is not null and (v_avatar !~ '^https://' or char_length(v_avatar) > 500) then
    v_avatar := null;
  end if;
  insert into public.profiles (id, display_name, avatar_url, date_of_birth, language, consent_version, consent_at)
  values (
    new.id,
    left(coalesce(
      nullif(trim(m ->> 'display_name'), ''),
      nullif(trim(m ->> 'full_name'), ''),
      nullif(trim(m ->> 'name'), ''),
      split_part(new.email, '@', 1)
    ), 80),
    v_avatar,
    nullif(m ->> 'date_of_birth', '')::date,
    case when m ->> 'language' in ('en', 'ar', 'ur', 'hi') then m ->> 'language' else 'en' end,
    coalesce(nullif(m ->> 'consent_version', ''), 'unknown'),
    coalesce(nullif(m ->> 'consent_at', '')::timestamptz, now())
  );
  return new;
end;
$$;

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
  if exists (select 1 from public.profiles where id = v_uid and consent_version = 'unknown') then
    raise exception 'profile_incomplete' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- One-time completion of a profile created by Google Sign-In: date of birth + consent.
create or replace function public.complete_profile(p_dob date, p_consent_version text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'email_not_verified' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and consent_version = 'unknown') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_consent_version is null or trim(p_consent_version) in ('', 'unknown') then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  if p_dob is null or p_dob > current_date or p_dob < current_date - interval '120 years' then
    raise exception 'dob_invalid' using errcode = '22023';
  end if;
  if p_dob > (current_date - interval '18 years')::date then
    raise exception 'minor_not_allowed' using errcode = '42501';
  end if;
  update public.profiles
     set date_of_birth = p_dob, consent_version = trim(p_consent_version), consent_at = now()
   where id = v_uid;
end;
$$;

revoke execute on function public.complete_profile(date, text) from public, anon;
grant execute on function public.complete_profile(date, text) to authenticated;
