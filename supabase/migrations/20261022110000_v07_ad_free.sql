-- Mess Manager v0.7 — ad-free subscription (founder 2026-10-19; PRD §19.4).
-- Google Play subscriptions are verified on the server (verify-purchase Edge Function) and stored
-- here; the app hides banners while the account has an active entitlement, on every device.

create table public.ad_free_subscriptions (
  purchase_token text primary key,
  user_id uuid not null references auth.users (id),
  product_id text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  status text not null,
  expires_at timestamptz,
  auto_renewing boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ad_free_user_idx on public.ad_free_subscriptions (user_id);
alter table public.ad_free_subscriptions enable row level security;
revoke all on public.ad_free_subscriptions from anon, authenticated;

create function public.ad_free_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select max(expires_at) from public.ad_free_subscriptions
  where user_id = p_user and expires_at > now() and status in ('active', 'grace', 'canceled');
$$;

-- App: until when is this account ad-free (null = shows ads).
create function public.my_ad_free() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select public.ad_free_until(auth.uid());
$$;

-- Server (verify-purchase): record the store's answer. A purchase token belongs to the account
-- that first bought with it, so one subscription cannot be shared between accounts.
create function public.save_ad_free(p_user uuid, p_token text, p_product text, p_platform text,
                                    p_status text, p_expires timestamptz, p_auto boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.ad_free_subscriptions where purchase_token = p_token;
  if v_owner is not null and p_user is not null and v_owner <> p_user then
    return false;
  end if;
  insert into public.ad_free_subscriptions (purchase_token, user_id, product_id, platform, status, expires_at, auto_renewing)
  values (p_token, coalesce(v_owner, p_user), p_product, p_platform, p_status, p_expires, p_auto)
  on conflict (purchase_token) do update
    set product_id = excluded.product_id, status = excluded.status, expires_at = excluded.expires_at,
        auto_renewing = excluded.auto_renewing, updated_at = now();
  return true;
end;
$$;

-- Server: tokens to re-check (renewals, cancellations, refunds).
create function public.ad_free_to_recheck() returns setof public.ad_free_subscriptions
language sql stable security definer set search_path = '' as $$
  select * from public.ad_free_subscriptions
  where status in ('active', 'grace', 'canceled', 'on_hold', 'paused', 'pending')
    and (expires_at is null or expires_at > now() - interval '3 days')
  order by updated_at limit 200;
$$;

revoke execute on function public.ad_free_until(uuid) from public, anon, authenticated;
revoke execute on function public.save_ad_free(uuid, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
revoke execute on function public.ad_free_to_recheck() from public, anon, authenticated;
grant execute on function public.save_ad_free(uuid, text, text, text, text, timestamptz, boolean) to service_role;
grant execute on function public.ad_free_to_recheck() to service_role;
revoke execute on function public.my_ad_free() from public, anon;
grant execute on function public.my_ad_free() to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and to_regnamespace('net') is not null then
    create extension if not exists pg_cron;
    perform cron.schedule('mm-ad-free-recheck', '41 3 * * *', $job$
      select net.http_post(
        url := 'https://egylgjgimuytmnmrvzhs.supabase.co/functions/v1/verify-purchase',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret',
                     (select decrypted_secret from vault.decrypted_secrets where name = 'mm_worker_secret')),
        body := '{"recheck":true}'::jsonb,
        timeout_milliseconds := 120000)
    $job$);
  end if;
end $$;
