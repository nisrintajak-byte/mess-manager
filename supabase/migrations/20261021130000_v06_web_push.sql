-- Mess Manager v0.6 — browser (web) push notifications, so a phone gets Need Requests and every
-- other notification even when the site is closed (founder request 2026-10-19).
-- Browser subscriptions are longer than Expo tokens and carry keys, so they get their own table.
-- Sending happens in the `web-push` Edge Function (VAPID + encryption), called per notification.

create table public.web_push_subscriptions (
  endpoint text primary key check (char_length(endpoint) between 20 and 1000 and endpoint like 'https://%'),
  user_id uuid not null references auth.users (id),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index web_push_user_idx on public.web_push_subscriptions (user_id) where active;
alter table public.web_push_subscriptions enable row level security;
revoke all on public.web_push_subscriptions from anon, authenticated;

create function public.register_web_push(p_endpoint text, p_p256dh text, p_auth text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 20 and 200
     or coalesce(char_length(p_auth), 0) not between 8 and 100 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  insert into public.web_push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, v_uid, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = v_uid, p256dh = excluded.p256dh, auth = excluded.auth, active = true, updated_at = now();
end;
$$;

-- Sign-out on a shared phone: this browser stops getting the previous user's notifications.
create function public.unregister_web_push(p_endpoint text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.web_push_subscriptions set active = false, updated_at = now()
   where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

-- Worker API (service role): what to send for one notification, and dropping dead subscriptions.
create function public.web_push_job(p_notification uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'kind', n.kind, 'payload', n.payload, 'room_id', n.room_id,
    'language', coalesce(p.language, 'en'),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint,
                                 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                                 from public.web_push_subscriptions s where s.user_id = n.user_id and s.active), '[]'::jsonb))
  from public.notifications n left join public.profiles p on p.id = n.user_id
  where n.id = p_notification and (p.deleted_at is null);
$$;

create function public.web_push_gone(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  update public.web_push_subscriptions set active = false, updated_at = now() where endpoint = p_endpoint;
$$;

-- Every new notification for a user with an active browser subscription is handed to the worker.
create function public.send_web_push() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return new;
  end if;
  if not exists (select 1 from public.web_push_subscriptions where user_id = new.user_id and active) then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'mm_worker_secret';
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using 'https://egylgjgimuytmnmrvzhs.supabase.co/functions/v1/web-push',
          jsonb_build_object('notification_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret);
  return new;
exception when others then
  return new; -- never block the action because a notification could not be pushed
end;
$$;
create trigger notifications_web_push after insert on public.notifications
  for each row execute function public.send_web_push();

revoke execute on function public.register_web_push(text, text, text) from public, anon;
revoke execute on function public.unregister_web_push(text) from public, anon;
grant execute on function public.register_web_push(text, text, text) to authenticated;
grant execute on function public.unregister_web_push(text) to authenticated;
revoke execute on function public.web_push_job(uuid) from public, anon, authenticated;
revoke execute on function public.web_push_gone(text) from public, anon, authenticated;
revoke execute on function public.send_web_push() from public, anon, authenticated;
grant execute on function public.web_push_job(uuid) to service_role;
grant execute on function public.web_push_gone(text) to service_role;
