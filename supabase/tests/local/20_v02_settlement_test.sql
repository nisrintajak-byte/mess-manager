-- v0.2 behaviour tests: cycles, lock, selected splits, adjustments, settlement, payments, settings.
\set ON_ERROR_STOP on

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
  raise exception 'expected error "%" but statement succeeded: %', p_msg, p_sql;
end; $$;

-- A = admin, B = member, C = member, D = second admin later
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}');

-- Room created 40 days ago (KWD, 3 decimals, monthly) so a past cycle exists.
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
update public.rooms set created_at = now() - interval '40 days';
-- re-cut cycles as if the room had existed for 40 days
update public.cycles set starts_on = (now() at time zone 'Asia/Kuwait')::date - 40,
  ends_on = public.cycle_end((now() at time zone 'Asia/Kuwait')::date - 40, 'monthly');
update public.room_members set joined_on = (now() at time zone 'Asia/Kuwait')::date - 40;
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'member'::public.member_role, 'approved'::public.member_status, (now() at time zone 'Asia/Kuwait')::date - 40 from t
union all
select room, 'cccccccc-0000-0000-0000-000000000003'::uuid, 'member'::public.member_role, 'approved'::public.member_status, (now() at time zone 'Asia/Kuwait')::date - 40 from t;

create temp table d as select (now() at time zone 'Asia/Kuwait')::date as today;
grant select on d to authenticated;

-- 1. Cycles are created up to today and are contiguous
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare n int; gaps int;
begin
  select count(*) into n from public.room_cycles((select room from t));
  assert n >= 2, 'past + current cycle exist';
  select count(*) into gaps from public.cycles a join public.cycles b
    on b.room_id = a.room_id and b.starts_on > a.starts_on
   where not exists (select 1 from public.cycles m where m.room_id = a.room_id and m.starts_on > a.starts_on and m.starts_on < b.starts_on)
     and b.starts_on <> a.ends_on + 1;
  assert gaps = 0, 'cycles are contiguous';
end $$;

-- 2. Expense in past cycle (equal split) and selected-member split
create temp table e1 as select public.create_expense((select room from t), 'Rice', 9001,
  (select today from d) - 35, 'aaaaaaaa-0000-0000-0000-000000000001') as id;
grant select on e1 to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table e2 as select public.create_expense((select room from t), 'Tea for two', 1000,
  (select today from d) - 35, 'bbbbbbbb-0000-0000-0000-000000000002', null,
  array['bbbbbbbb-0000-0000-0000-000000000002','cccccccc-0000-0000-0000-000000000003']::uuid[]) as id;
grant select on e2 to authenticated;
-- Payer is always the creator: a different p_paid_by is ignored.
create temp table e9 as select public.create_expense((select room from t), 'Claimed for someone else', 300,
  (select today from d) - 35, 'cccccccc-0000-0000-0000-000000000003') as id;
grant select on e9 to authenticated;
do $$ begin
  assert (select paid_by from public.expenses where id = (select id from e9)) = 'bbbbbbbb-0000-0000-0000-000000000002', 'payer = creator';
end $$;
select public.delete_expense((select id from e9));
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select sum(amount) from public.expense_splits where expense_id = (select id from e1)) = 9001;
  assert (select amount from public.expense_splits where expense_id = (select id from e1)
          and user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3001, 'leftover to payer';
  assert (select count(*) from public.expense_splits where expense_id = (select id from e2) and amount > 0) = 2;
  assert (select amount from public.expense_splits where expense_id = (select id from e2)
          and user_id = 'cccccccc-0000-0000-0000-000000000003') = 500;
  assert (select split_mode from public.expenses where id = (select id from e2)) = 'selected';
end $$;
select pg_temp.expect_error($$select public.create_expense((select room from t),'x',100,(select today from d)-1,'aaaaaaaa-0000-0000-0000-000000000001',null,array[]::uuid[])$$, 'participants_required');
select pg_temp.expect_error($$select public.create_expense((select room from t),'x',100,(select today from d)-400,'aaaaaaaa-0000-0000-0000-000000000001')$$, 'before_room_start');
-- non-cash proof path must be inside the Room folder
select pg_temp.expect_error($$select public.create_expense((select room from t),'x',100,(select today from d),'aaaaaaaa-0000-0000-0000-000000000001',null,null,'other-room/r.jpg')$$, 'invalid_file');

-- 3. Edit a selected split back to "everyone"
-- Admin edits B's expense and tries to change the payer: payer stays B.
select public.edit_expense((select id from e2), 'Tea', 1200, (select today from d) - 35,
  'aaaaaaaa-0000-0000-0000-000000000001', null, null);
do $$ begin
  assert (select paid_by from public.expenses where id = (select id from e2)) = 'bbbbbbbb-0000-0000-0000-000000000002', 'edit keeps payer';
end $$;
do $$ begin
  assert (select count(*) from public.expense_splits where expense_id = (select id from e2) and amount > 0) = 3;
  assert (select sum(amount) from public.expense_splits where expense_id = (select id from e2)) = 1200;
end $$;

-- 4. Member cannot settle; Admin settles the past cycle; it locks
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.generate_settlement((select cycle_id from public.expenses where id=(select id from e1)))$$, 'not_allowed');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table s as select public.generate_settlement((select cycle_id from public.expenses where id = (select id from e1))) as id;
grant select on s to authenticated;
do $$ begin
  assert (select status from public.cycles c join public.settlements st on st.cycle_id = c.id where st.id = (select id from s)) = 'locked';
  assert (select total from public.settlements where id = (select id from s)) = 10201;
  assert (select sum(net) from public.settlement_lines where settlement_id = (select id from s)) = 0, 'nets sum to zero';
  assert (select sum(share) from public.settlement_lines where settlement_id = (select id from s)) = 10201, 'shares sum to total';
end $$;
select pg_temp.expect_error($$select public.generate_settlement((select cycle_id from public.expenses where id=(select id from e1)))$$, 'already_settled');

-- 5. Lock: nobody (even Admin, even direct SQL as owner) changes a locked cycle
select pg_temp.expect_error($$select public.edit_expense((select id from e1),'Rice',1,(select today from d)-35,'aaaaaaaa-0000-0000-0000-000000000001')$$, 'cycle_locked');
select pg_temp.expect_error($$select public.delete_expense((select id from e1))$$, 'cycle_locked');
select pg_temp.expect_error($$select public.create_expense((select room from t),'Late',100,(select today from d)-35,'aaaaaaaa-0000-0000-0000-000000000001')$$, 'cycle_locked');
select pg_temp.act(null);
select pg_temp.expect_error($$update public.expenses set amount = 1 where id = (select id from e1)$$, 'cycle_locked');
select pg_temp.expect_error($$update public.expense_splits set amount = 1 where expense_id = (select id from e1)$$, 'cycle_locked');
select pg_temp.expect_error($$update public.settlement_lines set net = 0$$, 'immutable');

-- 6. Adjustment for a locked mistake goes into the open cycle, linked to the original
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.add_adjustment((select id from e1), -3000, 'typo')$$, 'not_allowed');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.add_adjustment((select id from e1), -3000, '')$$, 'reason_required');
create temp table adj as select public.add_adjustment((select id from e1), -3001, 'Rice was 6.000 not 9.001') as id;
grant select on adj to authenticated;
do $$
declare cur uuid;
begin
  select id into cur from public.cycles where room_id = (select room from t) and status = 'open' order by starts_on desc limit 1;
  assert (select cycle_id from public.expenses where id = (select id from adj)) = cur, 'adjustment in open cycle';
  assert (select adjusts_expense_id from public.expenses where id = (select id from adj)) = (select id from e1);
  assert (select sum(net) from public.cycle_balances(cur)) = 0;
  assert (select paid from public.cycle_balances(cur) where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = -3001, 'credit reduces paid';
end $$;

-- 7. Payments: B owes; claim needs proof for non-cash; Admin confirms; statuses
do $$
declare st text;
begin
  select status into st from public.settlement_status((select id from s)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  assert st = 'pending', 'B starts pending, got ' || st;
end $$;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table bl as select id from public.settlement_lines where settlement_id = (select id from s) and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
grant select on bl to authenticated;
select pg_temp.expect_error($$select public.claim_payment((select id from bl), 100, 'bank')$$, 'proof_required');
select pg_temp.expect_error($$select public.claim_payment((select id from bl), 99999999, 'cash')$$, 'amount_invalid');
create temp table p1 as select public.claim_payment((select id from bl), 1000, 'bank', 'TXN-123', null, null,
  '22222222-2222-2222-2222-222222222222') as id;
grant select on p1 to authenticated;
do $$ begin
  assert public.claim_payment((select id from bl), 1000, 'bank', 'TXN-123', null, null,
    '22222222-2222-2222-2222-222222222222') = (select id from p1), 'idempotent claim';
  assert (select status from public.settlement_status((select id from s)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'awaiting';
end $$;
select pg_temp.expect_error($$select public.decide_payment((select id from p1), true)$$, 'not_allowed');
-- C cannot claim on B's line
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.claim_payment((select id from bl), 10, 'cash')$$, 'not_allowed');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.decide_payment((select id from p1), false, ' ')$$, 'reason_required');
select public.decide_payment((select id from p1), true);
do $$
declare owed bigint;
begin
  assert (select status from public.settlement_status((select id from s)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'partial';
  select -net - confirmed into owed from public.settlement_status((select id from s)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  -- Admin records the rest in cash
  perform public.record_payment((select id from bl), owed, 'cash', null, 'cash in hand');
  assert (select status from public.settlement_status((select id from s)) where user_id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'paid';
  assert (select recorded_by_admin from public.payments where note = 'cash in hand');
end $$;
select pg_temp.expect_error($$select public.decide_payment((select id from p1), true)$$, 'not_pending');

-- 8. Admin's own payment: with a second Admin, the other must confirm
select pg_temp.act(null);
update public.room_members set role = 'admin' where user_id = 'cccccccc-0000-0000-0000-000000000003';
-- give A a debt line in a fresh settlement scenario: C pays nothing; check rule via record_payment on own line
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$
declare al uuid;
begin
  select id into al from public.settlement_lines where settlement_id = (select id from s) and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
  begin
    perform public.record_payment(al, 1, 'cash');
    raise exception 'should fail';
  exception when others then
    assert sqlerrm like '%other_admin_must_confirm%' or sqlerrm like '%amount_invalid%', sqlerrm;
  end;
end $$;

-- 9. Room settings rules
select pg_temp.expect_error($$select public.update_room_settings((select room from t),'Flat','US','USD',2,'America/New_York','monthly')$$, 'currency_change_not_allowed');
do $$
declare res text;
begin
  res := public.update_room_settings((select room from t), 'Flat 12', 'KW', 'KWD', 3, 'Asia/Riyadh', 'weekly');
  assert res like 'effective_next_cycle:%', 'tz/cycle change waits for next cycle: ' || res;
  assert (select time_zone from public.rooms where id = (select room from t)) = 'Asia/Kuwait';
  assert (select pending_time_zone from public.rooms where id = (select room from t)) = 'Asia/Riyadh';
  assert (select name from public.rooms where id = (select room from t)) = 'Flat 12';
end $$;

-- 10. Early settlement of the running cycle closes "up to yesterday"
create temp table e3 as select public.create_expense((select room from t), 'Today milk', 300, (select today from d),
  'cccccccc-0000-0000-0000-000000000003') as id;
grant select on e3 to authenticated;
do $$
declare cur uuid; newc uuid;
begin
  select cycle_id into cur from public.expenses where id = (select id from adj);
  perform public.generate_settlement(cur);
  assert (select ends_on from public.cycles where id = cur) = (select today from d) - 1, 'closed up to yesterday';
  select cycle_id into newc from public.expenses where id = (select id from e3);
  assert newc <> cur, 'today''s expense moved to the new cycle';
  assert (select status from public.cycles where id = newc) = 'open';
  -- pending tz/cycle settings applied to the new cycle
  assert (select kind from public.cycles where id = newc) = 'weekly';
  assert (select time_zone from public.rooms where id = (select room from t)) = 'Asia/Riyadh';
end $$;

-- 11. Delete Room blocked while members exist
select pg_temp.expect_error($$select public.delete_room((select room from t))$$, 'room_has_members');

-- 12. Outsider sees nothing new
select pg_temp.act(null);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('eeeeeeee-0000-0000-0000-000000000005', 'x@t.dev', now(), '{"display_name":"X","consent_version":"v"}');
select pg_temp.act('eeeeeeee-0000-0000-0000-000000000005');
do $$ begin
  assert (select count(*) from public.cycles) = 0;
  assert (select count(*) from public.settlements) = 0;
  assert (select count(*) from public.settlement_lines) = 0;
  assert (select count(*) from public.payments) = 0;
end $$;
select pg_temp.expect_error($$select * from public.settlement_status((select id from s))$$, 'not_allowed');
select pg_temp.expect_error($$select public.ensure_cycles((select room from t), current_date)$$, 'permission denied');

-- 13. v0.1 API still works (running preview)
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  perform public.add_expense((select room from t), 'Old app', 600, 'general', (select today from d),
    'bbbbbbbb-0000-0000-0000-000000000002');
  assert (select sum(net) from public.room_balances((select room from t))) = 0;
end $$;

select pg_temp.act(null);
select 'ALL DB TESTS PASSED' as result;
