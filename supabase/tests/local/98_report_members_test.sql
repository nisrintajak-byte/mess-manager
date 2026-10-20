-- Reports list every member of the period with role, status and totals (all scopes).
\set ON_ERROR_STOP on
set timezone = 'Asia/Kolkata';
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Imran","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Uyoon","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Mohd","consent_version":"v"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Sakina', 'IN', 'INR', 2, 'Asia/Kolkata') as room;
grant select on t to authenticated;
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, u::uuid, 'member'::public.member_role, 'approved'::public.member_status, public.room_today(room)
  from t, unnest(array['bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003']) u;
-- Mohd pays a meal for all three, Imran a perfume for himself + Uyoon; Uyoon pays nothing.
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.create_expense((select room from t), 'meal', 50000, current_date,
  'cccccccc-0000-0000-0000-000000000003', null, null, null, gen_random_uuid());
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_expense((select room from t), 'Perfume', 50000, current_date,
  'aaaaaaaa-0000-0000-0000-000000000001', null,
  array['aaaaaaaa-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-000000000002']::uuid[], null, gen_random_uuid());
select public.remove_member((select id from public.room_members where user_id = 'cccccccc-0000-0000-0000-000000000003'));
do $$ declare j jsonb; m jsonb; begin
  j := public.report_data((select room from t), null, 'mine');
  assert jsonb_array_length(j -> 'members') = 3, 'all three members listed in My statement: ' || (j -> 'members')::text;
  assert (j -> 'people' -> 'cccccccc-0000-0000-0000-000000000003' ->> 'status') = 'removed', 'removed status';
  assert (j -> 'people' -> 'cccccccc-0000-0000-0000-000000000003' ->> 'left_on') is not null, 'removed date';
  assert (j -> 'people' -> 'aaaaaaaa-0000-0000-0000-000000000001' ->> 'role') = 'admin', 'admin role';
  assert (j -> 'people' -> 'bbbbbbbb-0000-0000-0000-000000000002' ->> 'status') = 'approved', 'active member';
  select x into m from jsonb_array_elements(j -> 'members') x where x ->> 'user_id' = 'bbbbbbbb-0000-0000-0000-000000000002';
  assert (m ->> 'paid')::bigint = 0 and (m ->> 'share')::bigint between 41666 and 41668, 'Uyoon totals: ' || m::text;
  select x into m from jsonb_array_elements(j -> 'members') x where x ->> 'user_id' = 'cccccccc-0000-0000-0000-000000000003';
  assert (m ->> 'paid')::bigint = 50000, 'removed member keeps what he paid';
  assert (select sum((x ->> 'paid')::bigint) from jsonb_array_elements(j -> 'members') x)
       = (select sum((x ->> 'share')::bigint) from jsonb_array_elements(j -> 'members') x), 'paid = shares';
end $$;
select 'ALL DB TESTS PASSED';
