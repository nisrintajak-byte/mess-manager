-- Founder 2026-11-04: the last person or the only Admin is never stuck in a Room.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kolkata';
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_msg || '%' then
      raise exception 'expected error "%", got "%"', p_msg, sqlerrm;
    end if;
    return;
  end;
  raise exception 'expected error "%", but statement succeeded', p_msg;
end; $$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'd@t.dev', now(), '{"display_name":"Dina","consent_version":"v"}');
create temp table t (name text primary key, room uuid);
grant select, insert on t to authenticated;

-- 1. Alone with an expense: the Admin can delete the Room, and it no longer counts to the limit
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
insert into t select 'solo', public.create_room('Solo', 'IN', 'INR', 2, 'Asia/Kolkata');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_expense((select room from t where name = 'solo'), 'Rice', 9000, current_date,
  'aaaaaaaa-0000-0000-0000-000000000001', null, null, null, gen_random_uuid());
select public.delete_room((select room from t where name = 'solo'));
select pg_temp.act(null);
do $$ begin
  assert (select deleted_at from public.rooms where id = (select room from t where name = 'solo')) is not null, 'solo deleted';
  assert (select status from public.room_members where room_id = (select room from t where name = 'solo')) = 'left', 'Asha left';
  assert public.rooms_in_use('aaaaaaaa-0000-0000-0000-000000000001') = 0, 'limit freed';
end $$;

-- 2. Alone: leaving closes the Room
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
insert into t select 'unused', public.create_room('Unused', 'IN', 'INR', 2, 'Asia/Kolkata');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.leave_room((select room from t where name = 'unused'));
select pg_temp.act(null);
do $$ begin
  assert (select deleted_at from public.rooms where id = (select room from t where name = 'unused')) is not null, 'unused closed';
  assert public.rooms_in_use('aaaaaaaa-0000-0000-0000-000000000001') = 0, 'limit freed after leaving';
end $$;

-- 3. Only Admin leaves while others stay: the longest-standing member becomes Admin
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
insert into t select 'flat', public.create_room('Flat', 'IN', 'INR', 2, 'Asia/Kolkata');
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'cccccccc-0000-0000-0000-000000000003', 'member', 'approved', current_date - 5 from t where name = 'flat';
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'member', 'approved', current_date - 10 from t where name = 'flat';
insert into public.room_members (room_id, user_id, role, status)
select room, 'dddddddd-0000-0000-0000-000000000004', 'member', 'pending' from t where name = 'flat';
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.leave_room((select room from t where name = 'flat'));
select pg_temp.act(null);
do $$ declare r uuid := (select room from t where name = 'flat'); begin
  assert (select role from public.room_members where room_id = r and status = 'approved'
           and user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'admin', 'Bilal (longest) is Admin';
  assert (select role from public.room_members where room_id = r and status = 'approved'
           and user_id = 'cccccccc-0000-0000-0000-000000000003') = 'member', 'Chen unchanged';
  assert exists (select 1 from public.notifications where room_id = r and kind = 'admin_promoted'
                  and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Bilal told';
  assert (select deleted_at from public.rooms where id = r) is null, 'Room stays';
end $$;

-- 4. With members: unsettled expenses block deleting; ordinary members can't delete
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.create_expense((select room from t where name = 'flat'), 'Milk', 1000, current_date,
  'cccccccc-0000-0000-0000-000000000003', null, null, null, gen_random_uuid());
select pg_temp.expect_error($$select public.delete_room((select room from t where name = 'flat'))$$, 'not_allowed');
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.delete_room((select room from t where name = 'flat'))$$, 'room_has_unsettled_cycle');

-- 5. Last two leave one by one: the Room closes and the pending request is declined
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.leave_room((select room from t where name = 'flat'));
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.leave_room((select room from t where name = 'flat'));
select pg_temp.act(null);
do $$ declare r uuid := (select room from t where name = 'flat'); begin
  assert (select deleted_at from public.rooms where id = r) is not null, 'flat closed';
  assert (select status from public.room_members where room_id = r
           and user_id = 'dddddddd-0000-0000-0000-000000000004') = 'rejected', 'pending declined';
end $$;

-- 6. With members and nothing unsettled: the Admin can delete; everyone is told and leaves
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
insert into t select 'shared', public.create_room('Shared', 'IN', 'INR', 2, 'Asia/Kolkata');
select pg_temp.act(null);
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'member', 'approved', current_date from t where name = 'shared';
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.delete_room((select room from t where name = 'shared'));
select pg_temp.act(null);
do $$ declare r uuid := (select room from t where name = 'shared'); begin
  assert (select deleted_at from public.rooms where id = r) is not null, 'shared deleted';
  assert not exists (select 1 from public.room_members where room_id = r and status = 'approved'), 'all left';
  assert exists (select 1 from public.notifications where room_id = r and kind = 'room_deleted'
                  and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 'Bilal told';
  assert not exists (select 1 from public.notifications where room_id = r and kind = 'room_deleted'
                      and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 'deleter not told';
  assert (select (public.push_text(n))[1] from public.notifications n where room_id = r and kind = 'room_deleted') = 'Room deleted';
end $$;
-- a deleted Room can't be deleted or left again
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.delete_room((select room from t where name = 'shared'))$$, 'not_allowed');
select pg_temp.expect_error($$select public.leave_room((select room from t where name = 'shared'))$$, 'not_member');
reset role;
select 'ALL DB TESTS PASSED';
