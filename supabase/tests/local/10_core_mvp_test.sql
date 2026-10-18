-- Behaviour tests for the v0.1 core schema. Run with scripts/test-db.sh.
-- Any failed assertion raises an exception and stops the run.
\set ON_ERROR_STOP on

-- Users: admin (A), member (B), outsider (C), unverified (U)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev', now(), '{"display_name":"Asha","consent_version":"2026-10","date_of_birth":"1990-01-01"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev', now(), '{"display_name":"Bilal","consent_version":"2026-10"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@test.dev', now(), '{"display_name":"Chen","consent_version":"2026-10"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'u@test.dev', null,  '{"display_name":"Uma","consent_version":"2026-10"}');

-- helper: act as a user
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
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
  raise exception 'expected error "%" but statement succeeded: %', p_msg, p_sql;
end; $$;

-- 1. Profile created from signup metadata
do $$ begin
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Asha';
  assert (select consent_version from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = '2026-10';
end $$;

-- 2. Unverified user cannot create a Room
select pg_temp.act('dddddddd-0000-0000-0000-000000000004');
select pg_temp.expect_error($$select public.create_room('X','KW','KWD',3,'Asia/Kuwait')$$, 'email_not_verified');
reset role;

-- 3. Admin creates a Room (KWD, 3 decimals)
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.create_room('X','KW','KWD',3,'Mars/Base')$$, 'invalid_time_zone');
create temp table t_room as select public.create_room('Flat 12', 'KW', 'KWD', 3, 'Asia/Kuwait') as id;
grant select on t_room to authenticated;
do $$ begin
  assert (select count(*) from public.rooms) = 1, 'admin sees own room';
  assert (select role from public.room_members where user_id = auth.uid()) = 'admin';
  assert length((select join_code from public.rooms)) = 8;
end $$;
reset role;

-- 4. Member requests to join by code; cannot see room until approved
create temp table t_code as select join_code from public.rooms;
grant select on t_code to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.request_join(lower((select join_code from t_code)));
select pg_temp.expect_error($$select public.request_join((select join_code from t_code))$$, 'already_requested_or_member');
do $$ begin
  assert (select count(*) from public.rooms) = 0, 'pending member must not see room';
  assert (select count(*) from public.room_members) = 1, 'pending member sees only own request';
end $$;
-- member cannot approve self
select pg_temp.expect_error($$select public.decide_join((select id from public.room_members), true)$$, 'not_allowed');
reset role;

-- 5. Admin approves
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.decide_join((select id from public.room_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), true);
do $$ begin
  assert (select count(*) from public.room_member_emails((select id from t_room))) = 2, 'admin sees emails';
end $$;
reset role;

-- 6. Member sees room but not emails; outsider sees nothing
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  assert (select count(*) from public.rooms) = 1;
  assert (select count(*) from public.profiles) = 2, 'member sees room-mate profiles';
end $$;
select pg_temp.expect_error($$select * from public.room_member_emails((select id from t_room))$$, 'not_allowed');
reset role;
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
do $$ begin
  assert (select count(*) from public.rooms) = 0, 'RLS: outsider sees no rooms';
  assert (select count(*) from public.expenses) = 0;
  assert (select count(*) from public.audit_log) = 0;
  assert (select count(*) from public.profiles) = 1, 'outsider sees only self';
end $$;
select pg_temp.expect_error($$select public.add_expense((select id from t_room),'Hack',100,'x',current_date,'cccccccc-0000-0000-0000-000000000003')$$, 'not_allowed');
select pg_temp.expect_error($$select * from public.room_balances((select id from t_room))$$, 'not_allowed');
reset role;

-- 7. Expenses: equal split, remainder to payer, totals exact
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table t_exp as
  select public.add_expense((select id from t_room), 'Rice', 10001, 'food', current_date,
                            'bbbbbbbb-0000-0000-0000-000000000002', null,
                            '11111111-1111-1111-1111-111111111111') as id;
grant select on t_exp to authenticated;
do $$ begin
  assert (select sum(amount) from public.expense_splits) = 10001, 'splits sum to total';
  assert (select amount from public.expense_splits where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 5001, 'leftover to payer';
  assert (select currency from public.expenses) = 'KWD';
end $$;
-- idempotent retry returns same id, no duplicate
do $$ begin
  assert public.add_expense((select id from t_room), 'Rice', 10001, 'food', current_date,
    'bbbbbbbb-0000-0000-0000-000000000002', null, '11111111-1111-1111-1111-111111111111') = (select id from t_exp);
  assert (select count(*) from public.expenses) = 1, 'no duplicate on retry';
end $$;
select pg_temp.expect_error($$select public.add_expense((select id from t_room),'Future',100,'x',current_date + 3,'bbbbbbbb-0000-0000-0000-000000000002')$$, 'future_date');
select pg_temp.expect_error($$select public.add_expense((select id from t_room),'Zero',0,'x',current_date,'bbbbbbbb-0000-0000-0000-000000000002')$$, 'check');
-- clients cannot write tables directly
select pg_temp.expect_error($$update public.expenses set amount = 1$$, 'permission denied');
select pg_temp.expect_error($$insert into public.audit_log (entity_type, entity_id, action) values ('x', gen_random_uuid(), 'x')$$, 'permission denied');
-- own edit inside 30 minutes works
select public.update_expense((select id from t_exp), 'Rice 5kg', 9000, 'food', current_date, 'bbbbbbbb-0000-0000-0000-000000000002', 'note');
do $$ begin
  assert (select sum(amount) from public.expense_splits) = 9000;
end $$;
reset role;

-- 8. 30-minute rule uses server time
select set_config('request.jwt.claim.sub', '', false);
update public.expenses set created_at = now() - interval '31 minutes';
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.update_expense((select id from t_exp),'Late',1,'x',current_date,'bbbbbbbb-0000-0000-0000-000000000002')$$, 'edit_not_allowed');
select pg_temp.expect_error($$select public.delete_expense((select id from t_exp))$$, 'delete_not_allowed');
reset role;

-- 9. Admin can still edit/delete; delete is soft
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select net from public.room_balances((select id from t_room)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 4500;
  assert (select sum(net) from public.room_balances((select id from t_room))) = 0, 'nets sum to zero';
end $$;
select public.delete_expense((select id from t_exp));
do $$ begin
  assert (select count(*) from public.expenses where deleted_at is not null) = 1, 'soft delete keeps row';
  assert (select sum(net) from public.room_balances((select id from t_room))) = 0;
  assert (select paid from public.room_balances((select id from t_room)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 0, 'deleted not in totals';
  -- (the test's own backdating in step 8 is also audited, with no actor)
  assert (select count(*) from public.audit_log where entity_type = 'expenses' and actor_id is not null) = 3, 'create + edit + delete audited';
  assert (select action from public.audit_log where entity_type = 'expenses' order by id desc limit 1) = 'delete';
end $$;
reset role;

-- 10. Audit log immutable even for the database owner
select pg_temp.expect_error($$update public.audit_log set action = 'x'$$, 'append-only');
select pg_temp.expect_error($$delete from public.audit_log$$, 'append-only');

-- 11. Last Admin rule
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.leave_room((select id from t_room))$$, 'last_admin');
select public.set_member_role((select id from public.room_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and status = 'approved'), 'admin');
select public.leave_room((select id from t_room));
reset role;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.set_member_role((select id from public.room_members where user_id = auth.uid() and status = 'approved'), 'member')$$, 'last_admin');
reset role;

select 'ALL DB TESTS PASSED' as result;
