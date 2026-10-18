\set ON_ERROR_STOP on
-- dates in these tests are Room (Kuwait) dates, independent of the server clock's zone
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Lenovo","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"lenovo ","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'd@t.dev', now(), '{"display_name":"Lenovo","consent_version":"v"}');
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
set role authenticated;
create temp table t as select public.create_room('R', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
reset role;
insert into public.room_members (room_id, user_id, status, requested_at, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'approved'::public.member_status, now() + interval '1 min', current_date from t
union all select room, 'cccccccc-0000-0000-0000-000000000003'::uuid, 'approved'::public.member_status, now() + interval '2 min', current_date from t
union all select room, 'dddddddd-0000-0000-0000-000000000004'::uuid, 'left'::public.member_status, now() + interval '3 min', current_date from t;
select set_config('request.jwt.claim.sub', 'cccccccc-0000-0000-0000-000000000003', false);
set role authenticated;
do $$
declare l jsonb;
begin
  select jsonb_object_agg(user_id::text, label) into l from public.room_member_labels((select room from t));
  assert l ->> 'aaaaaaaa-0000-0000-0000-000000000001' = 'Lenovo1', l::text;
  assert l ->> 'bbbbbbbb-0000-0000-0000-000000000002' = 'lenovo2', l::text;
  assert l ->> 'dddddddd-0000-0000-0000-000000000004' = 'Lenovo3', 'former member keeps number: ' || l::text;
  assert l ->> 'cccccccc-0000-0000-0000-000000000003' = 'Asha', 'unique name unchanged';
end $$;
reset role;
select 'ALL DB TESTS PASSED' as result;
