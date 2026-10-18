-- v0.5: offline sync rules.
\set ON_ERROR_STOP on
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
create function pg_temp.expect_error(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_msg || '%' then raise exception 'expected "%", got "%"', p_msg, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error "%" but succeeded: %', p_msg, p_sql;
end; $$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');

select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
update public.rooms set created_at = now() - interval '40 days';
update public.cycles set starts_on = (now() at time zone 'Asia/Kuwait')::date - 40,
  ends_on = public.cycle_end((now() at time zone 'Asia/Kuwait')::date - 40, 'monthly');
update public.room_members set joined_on = (now() at time zone 'Asia/Kuwait')::date - 40;
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'member'::public.member_role, 'approved'::public.member_status,
       (now() at time zone 'Asia/Kuwait')::date - 40 from t;
create temp table d as select (now() at time zone 'Asia/Kuwait')::date as today;
grant select on d to authenticated;

-- 1. Normal sync create + idempotent replay (no duplicates)
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table k1 as select gen_random_uuid() as k;
grant select on k1 to authenticated;
create temp table r1 as select public.sync_create_expense((select room from t), 'Rice', 5000,
  (select today from d) - 35, null, null, null, (select k from k1)) as j;
grant select on r1 to authenticated;
do $$ begin
  assert (select j ->> 'late' from r1) = 'false';
  assert (select j ->> 'replay' from r1) = 'false';
end $$;
select public.sync_create_expense((select room from t), 'Rice', 5000, (select today from d) - 35, null, null, null, (select k from k1));
do $$ begin
  assert (select count(*) from public.expenses where idempotency_key = (select k from k1)) = 1, 'no duplicate on retry';
  assert (select j ->> 'id' from r1)::uuid = (select id from public.expenses where idempotency_key = (select k from k1));
end $$;
select pg_temp.expect_error($$select public.sync_create_expense((select room from t), 'x', 100, (select today from d), null, null, null, null)$$, 'idempotency_required');

-- 2. Cycle gets locked meanwhile -> late entry in the open cycle, creator notified
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.generate_settlement((select cycle_id from public.expenses where idempotency_key = (select k from k1)));
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table k2 as select gen_random_uuid() as k;
grant select on k2 to authenticated;
create temp table r2 as select public.sync_create_expense((select room from t), 'Offline tea', 700,
  (select today from d) - 35, null, null, null, (select k from k2)) as j;
grant select on r2 to authenticated;
do $$
declare e public.expenses;
begin
  assert (select j ->> 'late' from r2) = 'true';
  select * into e from public.expenses where idempotency_key = (select k from k2);
  assert e.expense_date = (select today from d), 'booked today';
  assert e.late_entry_from = (select today from d) - 35, 'original date remembered';
  assert e.amount = 700;
  assert (select count(*) from public.notifications where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
          and kind = 'expense_late_entry') = 1, 'creator told';
end $$;
select public.sync_create_expense((select room from t), 'Offline tea', 700, (select today from d) - 35, null, null, null, (select k from k2));
do $$ begin
  assert (select count(*) from public.expenses where idempotency_key = (select k from k2)) = 1, 'late entry replay is idempotent';
end $$;

-- 3. Edit conflicts: stale base is refused, fresh base accepted
create temp table k3 as select gen_random_uuid() as k;
grant select on k3 to authenticated;
select public.sync_create_expense((select room from t), 'Milk', 400, (select today from d), null, null, null, (select k from k3));
create temp table base as select id, updated_at from public.expenses where idempotency_key = (select k from k3);
grant select on base to authenticated;
select public.sync_edit_expense((select id from base), (select updated_at from base), 'Milk 2L', 450, (select today from d));
do $$ begin
  assert (select amount from public.expenses where id = (select id from base)) = 450;
end $$;
-- a second offline edit made from the old base must be returned, not applied
select pg_temp.expect_error($$select public.sync_edit_expense((select id from base), (select updated_at from base) - interval '1 second', 'Milk 3L', 999, (select today from d))$$, 'conflict');
do $$ begin
  assert (select amount from public.expenses where id = (select id from base)) = 450, 'earlier accepted change kept';
end $$;

-- 4. Delete: stale base conflicts; fresh base deletes; retry is harmless
select pg_temp.expect_error($$select public.sync_delete_expense((select id from base), (select updated_at from base) - interval '1 second')$$, 'conflict');
create temp table base2 as select updated_at from public.expenses where id = (select id from base);
grant select on base2 to authenticated;
select public.sync_delete_expense((select id from base), (select updated_at from base2));
select public.sync_delete_expense((select id from base), (select updated_at from base2));
do $$ begin
  assert (select deleted_at from public.expenses where id = (select id from base)) is not null;
end $$;

-- 5. Need requests are idempotent
create temp table nk as select gen_random_uuid() as k;
grant select on nk to authenticated;
select public.sync_create_need((select room from t), 'Gas', null, (select k from nk));
select public.sync_create_need((select room from t), 'Gas', null, (select k from nk));
do $$ begin
  assert (select count(*) from public.need_requests where idempotency_key = (select k from nk)) = 1;
end $$;

-- 6. anon cannot call
select pg_temp.act(null);
set role anon;
select pg_temp.expect_error($$select public.sync_create_need(gen_random_uuid(), 'x', null, gen_random_uuid())$$, 'permission denied');
reset role;

select 'ALL DB TESTS PASSED' as result;
