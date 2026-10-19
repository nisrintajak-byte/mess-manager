-- Mess Manager v0.7 — legal consent versions (PRD §20.2 "material changes need fresh consent").
-- Every acceptance of the Privacy Policy/Terms is kept in an append-only log; the app asks again
-- whenever the legal version it ships with is newer than the one the user accepted.

create table public.consent_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id),
  version text not null,
  accepted_at timestamptz not null default now()
);
create index consent_log_user_idx on public.consent_log (user_id, accepted_at desc);
alter table public.consent_log enable row level security;
revoke all on public.consent_log from anon, authenticated;
create trigger consent_log_immutable before update or delete on public.consent_log
  for each row execute function public.immutable_row();

create function public.log_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.consent_version <> 'unknown'
     and (tg_op = 'INSERT' or new.consent_version is distinct from old.consent_version) then
    insert into public.consent_log (user_id, version, accepted_at) values (new.id, new.consent_version, new.consent_at);
  end if;
  return new;
end;
$$;
create trigger profiles_consent_log after insert or update of consent_version on public.profiles
  for each row execute function public.log_consent();

-- Existing accounts: record what they accepted at signup.
insert into public.consent_log (user_id, version, accepted_at)
select id, consent_version, consent_at from public.profiles where consent_version <> 'unknown';

-- Accept a newer version of the legal texts (works even while the old one is outdated).
create function public.accept_legal(p_version text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_version is null or p_version !~ '^[0-9]{4}-[0-9]{2}-v[0-9]{1,3}$' then
    raise exception 'consent_required' using errcode = '22023';
  end if;
  update public.profiles set consent_version = p_version, consent_at = now()
   where id = v_uid and deleted_at is null and consent_version <> 'unknown'
     and consent_version is distinct from p_version;
end;
$$;

revoke execute on function public.log_consent() from public, anon, authenticated;
revoke execute on function public.accept_legal(text) from public, anon;
grant execute on function public.accept_legal(text) to authenticated;
