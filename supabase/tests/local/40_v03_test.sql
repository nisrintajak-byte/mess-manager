-- v0.3: notifications fan-out, prefs, acknowledgement, disputes, need requests.
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
create function pg_temp.count_n(p_user uuid, p_kind text) returns int language sql as $$
  select count(*)::int from public.notifications where user_id = p_user and kind = p_kind;
$$;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}');

-- Join flow notifications
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
create temp table code as select join_code from public.rooms;
grant select on code to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.request_join((select join_code from code));
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.request_join((select join_code from code));
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert pg_temp.count_n('aaaaaaaa-0000-0000-0000-000000000001', 'join_request') = 2, 'admin told about requests';
  perform public.decide_join(id, true) from public.room_members where status = 'pending';
end $$;
select pg_temp.act(null);
do $$ begin
  assert pg_temp.count_n('bbbbbbbb-0000-0000-0000-000000000002', 'join_approved') = 1;
end $$;

-- Expense fan-out skips the actor; optional prefs respected; mandatory prefs refused
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.set_notification_pref('expense_added', false);
select pg_temp.expect_error($$select public.set_notification_pref('settlement_generated', false)$$, 'mandatory_notification');
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table e as select public.create_expense((select room from t), 'Rice', 9000, current_date,
  'bbbbbbbb-0000-0000-0000-000000000002') as id;
grant select on e to authenticated;
select pg_temp.act(null);
do $$ begin
  assert pg_temp.count_n('aaaaaaaa-0000-0000-0000-000000000001', 'expense_added') = 1;
  assert pg_temp.count_n('bbbbbbbb-0000-0000-0000-000000000002', 'expense_added') = 0, 'actor not notified';
  assert pg_temp.count_n('cccccccc-0000-0000-0000-000000000003', 'expense_added') = 0, 'opted out';
end $$;

-- Inbox is private; mark read
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin
  assert (select count(*) from public.notifications where user_id <> auth.uid()) = 0, 'only own notifications visible';
  perform public.mark_notifications_read();
  assert (select count(*) from public.notifications where read_at is null) = 0;
end $$;
select pg_temp.expect_error($$insert into public.notifications (user_id, kind) values (auth.uid(), 'x')$$, 'permission denied');

-- Dispute: B's own expense flagged by C; owner and admin notified; badge state; resolution rules
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.raise_flag('expense', (select id from e), 'other', '')$$, 'reason_required');
create temp table f as select public.raise_flag('expense', (select id from e), 'wrong_amount', 'It was 6.000') as id;
grant select on f to authenticated;
select pg_temp.expect_error($$select public.raise_flag('expense', (select id from e), 'duplicate')$$, 'already_flagged');
select pg_temp.expect_error($$select public.resolve_flag((select id from f), true, 'ok')$$, 'not_allowed');
select pg_temp.act(null);
do $$ begin
  assert pg_temp.count_n('aaaaaaaa-0000-0000-0000-000000000001', 'dispute_raised') = 1, 'admin told';
  assert pg_temp.count_n('bbbbbbbb-0000-0000-0000-000000000002', 'dispute_raised') = 1, 'owner told';
  assert (select target_owner from public.flags where id = (select id from f)) = 'bbbbbbbb-0000-0000-0000-000000000002';
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.review_flag((select id from f));
select pg_temp.expect_error($$select public.resolve_flag((select id from f), false, ' ')$$, 'reason_required');
select public.resolve_flag((select id from f), true, 'Corrected by edit');
select pg_temp.act(null);
do $$ begin
  assert (select status from public.flags where id = (select id from f)) = 'accepted';
  assert pg_temp.count_n('cccccccc-0000-0000-0000-000000000003', 'dispute_resolved') = 1;
  assert pg_temp.count_n('bbbbbbbb-0000-0000-0000-000000000002', 'dispute_resolved') = 1;
  assert (select count(*) from public.audit_log where entity_type = 'flags') >= 3, 'flags audited';
end $$;
-- Admin's own item: with a second Admin, the other must resolve
update public.room_members set role = 'admin' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
create temp table f2 as select public.raise_flag('expense', (select id from e), 'duplicate') as id;
grant select on f2 to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.resolve_flag((select id from f2), false, 'no')$$, 'other_admin_must_resolve');
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.withdraw_flag((select id from f2));

-- Need requests
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
create temp table n as select public.create_need((select room from t), 'Milk', '2 litres') as id;
grant select on n to authenticated;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.accept_need((select id from n));
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.accept_need((select id from n))$$, 'need_taken');
select pg_temp.expect_error($$select public.complete_need((select id from n))$$, 'not_allowed');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table e2 as select public.create_expense((select room from t), 'Milk', 1000, current_date,
  'aaaaaaaa-0000-0000-0000-000000000001') as id;
grant select on e2 to authenticated;
select public.complete_need((select id from n), (select id from e2));
select pg_temp.act(null);
do $$ begin
  assert (select status from public.need_requests where id = (select id from n)) = 'completed';
  assert (select expense_id from public.need_requests where id = (select id from n)) = (select id from e2);
  assert pg_temp.count_n('bbbbbbbb-0000-0000-0000-000000000002', 'need_created') = 1;
  assert pg_temp.count_n('cccccccc-0000-0000-0000-000000000003', 'need_completed') = 1;
end $$;

-- Settlement: one notification + ack row per member; seen / acknowledged
update public.cycles set starts_on = current_date - 3;
update public.expenses set expense_date = current_date - 1;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table s as select public.generate_settlement((select id from public.cycles limit 1)) as id;
grant select on s to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.mark_settlement_seen((select id from s));
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select public.acknowledge_settlement((select id from s));
select pg_temp.act(null);
do $$ begin
  assert (select count(*) from public.settlement_acks where settlement_id = (select id from s)) = 3;
  assert pg_temp.count_n('cccccccc-0000-0000-0000-000000000003', 'settlement_generated') = 1;
  assert (select payload ? 'due' from public.notifications where kind = 'settlement_generated' limit 1);
  assert (select seen_at is not null and acknowledged_at is null from public.settlement_acks
          where user_id = 'bbbbbbbb-0000-0000-0000-000000000002');
  assert (select acknowledged_at is not null from public.settlement_acks
          where user_id = 'cccccccc-0000-0000-0000-000000000003');
end $$;

-- Payment claim notifies admins (not the payer); rejection notifies payer with reason
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
do $$
declare l uuid; p uuid;
begin
  select id into l from public.settlement_lines where user_id = auth.uid() and settlement_id = (select id from s);
  p := public.claim_payment(l, 100, 'cash');
  perform set_config('test.p', p::text, false);
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.decide_payment(current_setting('test.p')::uuid, false, 'Not received');
select pg_temp.act(null);
do $$ begin
  assert pg_temp.count_n('aaaaaaaa-0000-0000-0000-000000000001', 'payment_claimed') = 1;
  assert pg_temp.count_n('cccccccc-0000-0000-0000-000000000003', 'payment_claimed') = 0;
  assert (select payload ->> 'reason' from public.notifications where kind = 'payment_rejected') = 'Not received';
end $$;

-- Push tokens: registered tokens are never readable by clients
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.register_push_token('ExponentPushToken[abcdefghijkl]', 'android');
select pg_temp.expect_error($$select * from public.push_tokens$$, 'permission denied');
select public.unregister_push_token('ExponentPushToken[abcdefghijkl]');
select pg_temp.act(null);
select 'ALL DB TESTS PASSED' as result;
