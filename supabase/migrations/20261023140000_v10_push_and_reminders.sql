-- v1.0 (founder 2026-10-20):
-- 1. Phone pushes in the user's own language: the web-push worker now sends to browsers AND to
--    the Android/iPhone app (Expo), with the same translations as the in-app inbox. The old
--    English-only direct send stays only as a fallback where the worker is not set up.
-- 2. A new settlement stays pinned on the phone until the person opens/acknowledges it.
-- 3. Daily reminder (10:00 Room time) to everyone who still has to pay, until it is paid;
--    and to Admins while paid claims wait for their confirmation.

-- ---------------------------------------------------------------------------
-- 1. One worker for all pushes
-- ---------------------------------------------------------------------------
create or replace function public.web_push_job(p_notification uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', n.kind, 'payload', n.payload, 'room_id', n.room_id,
    'language', coalesce(p.language, 'en'),
    'loud', n.kind = 'need_created' and public.need_sound_on(n.user_id),
    'sticky', n.kind = 'settlement_generated'
              and exists (select 1 from public.settlement_acks a
                           where a.settlement_id = (n.payload ->> 'settlement_id')::uuid
                             and a.user_id = n.user_id and a.acknowledged_at is null),
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint,
                                 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                                 from public.web_push_subscriptions s where s.user_id = n.user_id and s.active), '[]'::jsonb),
    'expo_tokens', coalesce((select jsonb_agg(t.token) from public.push_tokens t
                              where t.user_id = n.user_id and t.active and t.platform <> 'web'), '[]'::jsonb))
  from public.notifications n left join public.profiles p on p.id = n.user_id
  where n.id = p_notification and (p.deleted_at is null);
$$;

-- An app token Expo says is no longer valid (app removed / signed out on that phone).
create function public.push_token_gone(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.push_tokens set active = false, updated_at = now() where token = p_token;
$$;
revoke execute on function public.push_token_gone(text) from public, anon, authenticated;
grant execute on function public.push_token_gone(text) to service_role;

create or replace function public.send_web_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if to_regnamespace('net') is null or to_regclass('vault.decrypted_secrets') is null then
    return new;
  end if;
  if not exists (select 1 from public.web_push_subscriptions where user_id = new.user_id and active)
     and not exists (select 1 from public.push_tokens where user_id = new.user_id and active and platform <> 'web') then
    return new;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1' into v_secret using 'mm_worker_secret';
  if v_secret is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 30000)'
    using 'https://egylgjgimuytmnmrvzhs.supabase.co/functions/v1/web-push',
          jsonb_build_object('notification_id', new.id),
          jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', v_secret);
  return new;
exception when others then
  return new; -- never block the action because a notification could not be pushed
end;
$$;

-- The worker handles app pushes now; the direct English send runs only without the worker.
create or replace function public.send_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  msgs jsonb;
  txt text[];
  v_loud boolean := new.kind = 'need_created' and public.need_sound_on(new.user_id);
begin
  if to_regnamespace('net') is null then
    return new; -- in-app inbox remains the fallback (PRD §14)
  end if;
  if to_regclass('vault.decrypted_secrets') is not null
     and exists (select 1 from vault.decrypted_secrets where name = 'mm_worker_secret') then
    return new; -- sent by the web-push worker in the user's language
  end if;
  txt := public.push_text(new);
  select jsonb_agg(jsonb_build_object(
           'to', t.token, 'title', txt[1], 'body', txt[2],
           'sound', case when v_loud then 'need_alert.wav' else 'default' end,
           'channelId', case when v_loud then 'need_alert' else 'default' end,
           'priority', 'high',
           'data', jsonb_build_object('notification_id', new.id, 'kind', new.kind, 'room_id', new.room_id)))
    into msgs
    from public.push_tokens t where t.user_id = new.user_id and t.active and t.platform <> 'web';
  if msgs is null then
    return new;
  end if;
  execute 'select net.http_post(url := $1, body := $2, headers := $3)'
    using 'https://exp.host/--/api/v2/push/send', msgs,
          '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
  return new;
exception when others then
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Settlements this person has not acknowledged yet (the app keeps them pinned)
-- ---------------------------------------------------------------------------
create function public.my_open_settlements()
returns table (settlement_id uuid, room_id uuid, room text, net bigint, currency text,
               decimals smallint, generated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.room_id, r.name, l.net, s.currency::text, s.currency_decimals, s.generated_at
    from public.settlement_acks a
    join public.settlements s on s.id = a.settlement_id
    join public.settlement_lines l on l.settlement_id = s.id and l.user_id = a.user_id
    join public.rooms r on r.id = s.room_id
   where a.user_id = auth.uid()
     and a.acknowledged_at is null
     and s.generated_at > now() - interval '60 days'
     and r.deleted_at is null
   order by s.generated_at desc
   limit 10;
$$;
revoke execute on function public.my_open_settlements() from public, anon;
grant execute on function public.my_open_settlements() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Daily payment reminders
-- ---------------------------------------------------------------------------
-- What a member still has to pay on a settlement line (claims waiting for the Admin count as
-- sent, so the payer is not reminded while the Admin checks).
create function public.line_left_to_pay(p_line uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(-l.net - public.line_confirmed(l.id) - public.line_awaiting(l.id), 0)
    from public.settlement_lines l where l.id = p_line;
$$;
revoke execute on function public.line_left_to_pay(uuid) from public, anon, authenticated;

create function public.run_payment_reminders(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_payers int := 0;
  v_admins int := 0;
begin
  -- members who still owe: once a day at 10:00 Room time, from the day after the settlement,
  -- for up to 60 days, only while they are still in the Room
  for r in
    select l.id as line_id, l.user_id, l.room_id, s.id as settlement_id,
           (p_now at time zone ro.time_zone)::date as day, s.currency, s.currency_decimals,
           c.starts_on, c.ends_on, (s.generated_at at time zone c.time_zone)::date + 7 as due,
           public.line_left_to_pay(l.id) as left_to_pay
      from public.settlement_lines l
      join public.settlements s on s.id = l.settlement_id
      join public.cycles c on c.id = s.cycle_id
      join public.rooms ro on ro.id = l.room_id
     where l.net < 0
       and ro.deleted_at is null
       and c.purged_at is null
       and s.generated_at > p_now - interval '60 days'
       and (p_now at time zone ro.time_zone)::date > (s.generated_at at time zone ro.time_zone)::date
       and extract(hour from p_now at time zone ro.time_zone) = 10
       and exists (select 1 from public.room_members m
                    where m.room_id = l.room_id and m.user_id = l.user_id and m.status = 'approved')
       and not exists (select 1 from public.notifications n
                        where n.user_id = l.user_id and n.kind = 'payment_reminder'
                          and n.payload ->> 'line_id' = l.id::text
                          and n.payload ->> 'day' = ((p_now at time zone ro.time_zone)::date)::text)
  loop
    continue when r.left_to_pay <= 0;
    perform public.notify(r.user_id, r.room_id, 'payment_reminder', jsonb_build_object(
      'line_id', r.line_id, 'settlement_id', r.settlement_id, 'room', public.room_name(r.room_id),
      'amount', r.left_to_pay, 'currency', r.currency, 'decimals', r.currency_decimals,
      'from', r.starts_on, 'to', r.ends_on, 'due', r.due, 'day', r.day));
    v_payers := v_payers + 1;
  end loop;

  -- Admins: claimed payments waiting for confirmation
  for r in
    select m.user_id, p.room_id, count(*) as waiting, (p_now at time zone ro.time_zone)::date as day
      from public.payments p
      join public.rooms ro on ro.id = p.room_id
      join public.room_members m on m.room_id = p.room_id and m.role = 'admin' and m.status = 'approved'
     where p.status = 'awaiting'
       and ro.deleted_at is null
       and p.claimed_at < p_now - interval '12 hours'
       and extract(hour from p_now at time zone ro.time_zone) = 10
       and not exists (select 1 from public.notifications n
                        where n.user_id = m.user_id and n.room_id = p.room_id and n.kind = 'confirm_reminder'
                          and n.payload ->> 'day' = ((p_now at time zone ro.time_zone)::date)::text)
     group by m.user_id, p.room_id, ro.time_zone
  loop
    perform public.notify(r.user_id, r.room_id, 'confirm_reminder', jsonb_build_object(
      'room', public.room_name(r.room_id), 'count', r.waiting, 'day', r.day));
    v_admins := v_admins + 1;
  end loop;
  return jsonb_build_object('payers', v_payers, 'admins', v_admins);
end;
$$;
revoke execute on function public.run_payment_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.run_payment_reminders(timestamptz) to service_role;

-- English fallback text (the worker uses the translations)
create or replace function public.push_text(n public.notifications) returns text[]
language sql stable set search_path = '' as $$
  select case n.kind
    when 'join_request' then array['Join request', coalesce(n.payload ->> 'name', 'Someone') || ' wants to join ' || coalesce(n.payload ->> 'room', 'your Room')]
    when 'join_approved' then array['Request approved', 'You can now enter ' || coalesce(n.payload ->> 'room', 'the Room')]
    when 'join_rejected' then array['Request declined', 'Your request to join ' || coalesce(n.payload ->> 'room', 'the Room') || ' was declined']
    when 'member_removed' then array['Removed from Room', 'You were removed from ' || coalesce(n.payload ->> 'room', 'a Room')]
    when 'admin_promoted' then array['You are now an Admin', coalesce(n.payload ->> 'room', 'Room')]
    when 'expense_added' then array['New expense', coalesce(n.payload ->> 'by', '') || ' added ' || coalesce(n.payload ->> 'title', '')]
    when 'expense_edited' then array['Expense edited', coalesce(n.payload ->> 'title', '')]
    when 'expense_deleted' then array['Expense deleted', coalesce(n.payload ->> 'title', '')]
    when 'room_settings_changed' then array['Room settings changed', coalesce(n.payload ->> 'room', '')]
    when 'settlement_generated' then array['Settlement ready', coalesce(n.payload ->> 'room', '') || ' · ' || coalesce(n.payload ->> 'from', '') || ' – ' || coalesce(n.payload ->> 'to', '')]
    when 'payment_claimed' then array['Payment to confirm', coalesce(n.payload ->> 'name', '') || ' marked a payment as paid']
    when 'payment_confirmed' then array['Payment confirmed', coalesce(n.payload ->> 'room', '')]
    when 'payment_rejected' then array['Payment rejected', coalesce(n.payload ->> 'reason', '')]
    when 'payment_reminder' then array['Payment reminder', 'Please pay your share for ' || coalesce(n.payload ->> 'room', 'your Room')]
    when 'confirm_reminder' then array['Payments to confirm', coalesce(n.payload ->> 'count', '') || ' payment(s) in ' || coalesce(n.payload ->> 'room', 'your Room') || ' wait for your confirmation']
    when 'dispute_raised' then array['Dispute raised', coalesce(n.payload ->> 'name', '') || ' flagged an item']
    when 'dispute_resolved' then array['Dispute resolved', coalesce(n.payload ->> 'outcome', '')]
    when 'need_created' then array['Need request', coalesce(n.payload ->> 'title', '')]
    when 'need_accepted' then array['Need accepted', coalesce(n.payload ->> 'name', '') || ' will buy ' || coalesce(n.payload ->> 'title', '')]
    when 'need_completed' then array['Need completed', coalesce(n.payload ->> 'title', '')]
    when 'expense_late_entry' then array['Late entry', coalesce(n.payload ->> 'title', '')]
    when 'member_account_deleted' then array['Member left', coalesce(n.payload ->> 'name', '') || ' deleted their account']
    when 'retention_reminder' then array['Download your reports', 'Records of ' || coalesce(n.payload ->> 'from', '') || ' – ' || coalesce(n.payload ->> 'to', '') || ' will be deleted on ' || coalesce(n.payload ->> 'delete_on', '')]
    else array['Mess Manager', 'You have a new notification']
  end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('mm-payment-reminders', '3 * * * *', 'select public.run_payment_reminders();');
  end if;
end $$;
