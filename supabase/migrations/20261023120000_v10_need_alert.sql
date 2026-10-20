-- Need Requests get a special, longer alert on phones (founder 2026-10-20): its own Android
-- channel with a ~4.5 s bell sound and long vibration. ON for everyone; each person can switch
-- it off (preference kind 'need_sound'), then Need Requests use the normal sound.
create or replace function public.notification_is_optional(p_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_kind in ('expense_added', 'expense_edited', 'expense_deleted',
                    'need_created', 'need_accepted', 'need_completed', 'need_sound');
$$;

create or replace function public.need_sound_on(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.notification_prefs
                      where user_id = p_user and kind = 'need_sound' and not enabled);
$$;
revoke execute on function public.need_sound_on(uuid) from public, anon, authenticated;

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
  return new; -- never block the business action because push failed
end;
$$;

-- Browser notifications: tell the service worker when to keep the Need Request on screen
-- and vibrate longer.
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
    'subscriptions', coalesce((select jsonb_agg(jsonb_build_object('endpoint', s.endpoint,
                                 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
                                 from public.web_push_subscriptions s where s.user_id = n.user_id and s.active), '[]'::jsonb))
  from public.notifications n left join public.profiles p on p.id = n.user_id
  where n.id = p_notification and (p.deleted_at is null);
$$;
