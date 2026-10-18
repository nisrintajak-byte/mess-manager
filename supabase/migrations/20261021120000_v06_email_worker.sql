-- Mess Manager v0.6 (part 3) — schedule for the send-emails worker (Edge Function).
-- The worker proves itself with a random secret kept in the database vault; nothing secret is
-- stored in the repository. Safe on plain Postgres test databases (vault/pg_cron absent → skipped).

do $$
begin
  if to_regclass('vault.secrets') is not null then
    execute $q$
      select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'mm_worker_secret',
                                 'Shared secret for the send-emails worker')
      where not exists (select 1 from vault.secrets where name = 'mm_worker_secret')
    $q$;
  end if;
end $$;

create function public.worker_check(p_secret text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
begin
  if p_secret is null or p_secret = '' or to_regclass('vault.decrypted_secrets') is null then
    return false;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'mm_worker_secret';
  return v_secret is not null and v_secret = p_secret;
end;
$$;
revoke execute on function public.worker_check(text) from public, anon, authenticated;
grant execute on function public.worker_check(text) to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and to_regnamespace('net') is not null then
    create extension if not exists pg_cron;
    perform cron.schedule('mm-send-emails', '*/10 * * * *', $job$
      select net.http_post(
        url := 'https://egylgjgimuytmnmrvzhs.supabase.co/functions/v1/send-emails',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret',
                     (select decrypted_secret from vault.decrypted_secrets where name = 'mm_worker_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000)
    $job$);
  end if;
end $$;
