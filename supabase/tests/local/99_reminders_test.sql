-- Daily payment reminders + open (not yet acknowledged) settlements.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'member', 'approved', current_date from t;
-- a settlement made two days ago: Bilal pays 5.000, Asha receives it
insert into public.settlements (room_id, cycle_id, total, currency, currency_decimals, generated_by, generated_at)
select room, (select id from public.cycles where room_id = t.room limit 1), 10000, 'KWD', 3,
       'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '2 days' from t;
insert into public.settlement_lines (settlement_id, room_id, user_id, share, paid, net)
select s.id, s.room_id, u, 5000, case when u = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid then 10000 else 0 end,
       case when u = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid then 5000 else -5000 end
  from public.settlements s,
       unnest(array['aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002']::uuid[]) u;

create temp table w as
  select (((now() at time zone 'Asia/Kuwait')::date + 1) + time '10:20') at time zone 'Asia/Kuwait' as ten,
         (((now() at time zone 'Asia/Kuwait')::date + 1) + time '14:20') at time zone 'Asia/Kuwait' as two;
do $$ declare j jsonb; begin
  j := public.run_payment_reminders((select two from w));
  assert (j ->> 'payers')::int = 0, 'not outside 10:00 Room time';
  j := public.run_payment_reminders((select ten from w));
  assert (j ->> 'payers')::int = 1, 'only the person who owes: ' || j::text;
  assert (select count(*) from public.notifications where kind = 'payment_reminder'
           and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1;
  assert (select (payload ->> 'amount')::bigint from public.notifications where kind = 'payment_reminder') = 5000;
  j := public.run_payment_reminders((select ten from w));
  assert (j ->> 'payers')::int = 0, 'once a day';
  -- the next day again
  j := public.run_payment_reminders((select ten from w) + interval '1 day');
  assert (j ->> 'payers')::int = 1, 'every day until paid';
end $$;

-- open settlements: both see it until they acknowledge
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin assert (select count(*) from public.my_open_settlements()) = 1, 'pinned until acknowledged'; end $$;
select public.acknowledge_settlement((select id from public.settlements limit 1));
do $$ begin assert (select count(*) from public.my_open_settlements()) = 0, 'gone after acknowledging'; end $$;

-- a member who left is not reminded
select pg_temp.act(null);
update public.room_members set status = 'left', left_on = current_date
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
do $$ declare j jsonb; begin
  j := public.run_payment_reminders((select ten from w) + interval '2 days');
  assert (j ->> 'payers')::int = 0, 'not after leaving';
end $$;
select 'ALL DB TESTS PASSED';
