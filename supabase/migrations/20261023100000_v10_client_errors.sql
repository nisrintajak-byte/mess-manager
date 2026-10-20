-- v1.0: our own small crash log (PRD §21/§25: crash reporting without personal data).
-- One row per distinct error per day with a counter, so a crash loop cannot fill the table.
-- No user id, no email, no Room data: only what is needed to find the bug.
create table public.client_errors (
  day date not null default current_date,
  fingerprint text not null,
  platform text not null,
  app_version text not null,
  screen text,
  message text not null,
  stack text,
  count integer not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  primary key (day, fingerprint)
);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from anon, authenticated;

-- Removes emails and long numbers (phone, card, amounts) from error text before storing it.
create function public.scrub_error_text(p text, p_max int)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(regexp_replace(regexp_replace(coalesce(p, ''),
           '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}', '<email>', 'g'),
           '\d{6,}', '<number>', 'g'), p_max);
$$;

create function public.log_client_error(p_platform text, p_app_version text, p_screen text,
                                        p_message text, p_stack text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg text := public.scrub_error_text(p_message, 500);
  v_stack text := public.scrub_error_text(p_stack, 3000);
  v_fp text;
begin
  if v_msg = '' then return; end if;
  -- the same error from the same place counts as one row per day
  v_fp := encode(extensions.digest(v_msg || '|' || left(coalesce(v_stack, ''), 300) || '|'
                                   || coalesce(p_platform, ''), 'sha256'), 'hex');
  if (select count(*) from public.client_errors where day = current_date) >= 500
     and not exists (select 1 from public.client_errors where day = current_date and fingerprint = v_fp) then
    return; -- daily cap on distinct errors
  end if;
  insert into public.client_errors (fingerprint, platform, app_version, screen, message, stack)
  values (v_fp, left(coalesce(p_platform, '?'), 20), left(coalesce(p_app_version, '?'), 40),
          left(p_screen, 60), v_msg, nullif(v_stack, ''))
  on conflict (day, fingerprint) do update
    set count = least(public.client_errors.count + 1, 1000000), last_at = now();
end;
$$;

revoke execute on function public.scrub_error_text(text, int) from public, anon, authenticated;
revoke execute on function public.log_client_error(text, text, text, text, text) from public;
grant execute on function public.log_client_error(text, text, text, text, text) to anon, authenticated;
