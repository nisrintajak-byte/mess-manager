-- Former members visible to the Room.
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
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'd@t.dev', now(), '{"display_name":"Dina","consent_version":"v"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, u::uuid, 'member'::public.member_role, 'approved'::public.member_status, current_date - 10
  from t, unnest(array['bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003','dddddddd-0000-0000-0000-000000000004']) u;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.remove_member((select id from public.room_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'));
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.leave_room((select room from t));
select pg_temp.act('dddddddd-0000-0000-0000-000000000004');
do $$ declare r record; n int := 0; begin
  for r in select * from public.room_former_members((select room from t)) loop
    n := n + 1;
    if r.user_id = 'bbbbbbbb-0000-0000-0000-000000000002' then
      assert r.status = 'removed' and r.removed_by_name = 'Asha' and r.left_on is not null;
    else
      assert r.status = 'left' and r.removed_by is null;
    end if;
  end loop;
  assert n = 2, 'two former members visible to an ordinary member';
end $$;
-- a removed member who comes back is no longer "former"
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'approved', current_date from t;
select pg_temp.act('dddddddd-0000-0000-0000-000000000004');
do $$ begin assert (select count(*) from public.room_former_members((select room from t))) = 1; end $$;
-- the Admin still sees the email of the person who left (to invite again); members see none
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select email from public.room_member_emails((select room from t))
           where user_id = 'cccccccc-0000-0000-0000-000000000003') = 'c@t.dev', 'left member email for Admin';
  assert (select count(*) from public.room_member_emails((select room from t))) = 4, 'one row per person';
end $$;
select pg_temp.act('dddddddd-0000-0000-0000-000000000004');
do $$ begin
  begin
    perform public.room_member_emails((select room from t));
    assert false, 'members cannot see emails';
  exception when insufficient_privilege then null;
  end;
end $$;
select 'ALL DB TESTS PASSED' as result;
