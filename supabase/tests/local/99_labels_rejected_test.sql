-- Same-name labels ignore rejected join requests.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Imran","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Imran","consent_version":"v"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'd@t.dev', now(), '{"display_name":"Imran","consent_version":"v"}');
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
reset role;
-- b asked first and was rejected; c is a member; d is waiting
insert into public.room_members (room_id, user_id, role, status, requested_at, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'member'::public.member_role, 'rejected'::public.member_status, now() - interval '3 days', null::date from t
union all
select room, 'cccccccc-0000-0000-0000-000000000003'::uuid, 'member'::public.member_role, 'approved'::public.member_status, now() - interval '2 days', current_date from t
union all
select room, 'dddddddd-0000-0000-0000-000000000004'::uuid, 'member'::public.member_role, 'pending'::public.member_status, now() - interval '1 day', null from t;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
do $$ declare r record; begin
  for r in select * from public.room_member_labels((select room from t)) loop
    if r.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' then assert false, 'rejected person has no label'; end if;
    if r.user_id = 'cccccccc-0000-0000-0000-000000000003' then assert r.label = 'Imran1', r.label; end if;
    if r.user_id = 'dddddddd-0000-0000-0000-000000000004' then assert r.label = 'Imran2', r.label; end if;
  end loop;
  assert (select count(*) from public.room_member_labels((select room from t))) = 3, 'Asha, Imran1, Imran2';
end $$;
reset role;
select 'ALL DB TESTS PASSED';
