-- Home screen overview: each Room with this period's total, what I paid and my share.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'member', 'approved', current_date from t;
insert into public.room_members (room_id, user_id, role, status)
select room, 'cccccccc-0000-0000-0000-000000000003', 'member', 'pending' from t;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_expense((select room from t), 'Rice', 9000, current_date,
  'aaaaaaaa-0000-0000-0000-000000000001', null, null, null, gen_random_uuid());
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.create_expense((select room from t), 'Milk', 1000, current_date,
  'bbbbbbbb-0000-0000-0000-000000000002', null, null, null, gen_random_uuid());
do $$ declare r record; begin
  select * into r from public.my_rooms_overview();
  assert r.name = 'Flat' and r.members = 2 and r.role = 'member', 'room row';
  assert r.total = 10000 and r.my_paid = 1000 and r.my_share = 5000, 'numbers: ' || row_to_json(r)::text;
  assert r.pending_requests = 0, 'members do not see pending requests';
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ declare r record; begin
  select * into r from public.my_rooms_overview();
  assert r.my_paid = 9000 and r.my_share = 5000 and r.pending_requests = 1, 'admin view: ' || row_to_json(r)::text;
end $$;
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
do $$ begin assert (select count(*) from public.my_rooms_overview()) = 0, 'pending people see no Room'; end $$;
reset role;
select 'ALL DB TESTS PASSED';
