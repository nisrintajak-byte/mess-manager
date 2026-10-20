-- v0.6: reports, leaving statement, account deletion (app + web), retention, final purge.
\set ON_ERROR_STOP on
-- dates in these tests are Room (Kuwait) dates, independent of the server clock's zone
set timezone = 'Asia/Kuwait';
create function pg_temp.act(p uuid, p_fresh boolean default false) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  perform set_config('request.jwt.claims', case when p_fresh then
    json_build_object('amr', json_build_array(json_build_object('method', 'password',
      'timestamp', extract(epoch from now())::bigint)))::text
    else json_build_object('amr', json_build_array(json_build_object('method', 'password',
      'timestamp', extract(epoch from now())::bigint - 7200)))::text end, false);
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
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v","language":"ar"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'c@t.dev', now(), '{"display_name":"Chen","consent_version":"v"}'),
 ('dddddddd-0000-0000-0000-000000000004', 'd@t.dev', now(), '{"display_name":"Dina","consent_version":"v"}');
insert into auth.sessions (user_id) values ('cccccccc-0000-0000-0000-000000000003');

select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
select pg_temp.act(null);
create temp table d as select (now() at time zone 'Asia/Kuwait')::date as today;
grant select on d to authenticated;
-- the Room started ~5 months ago; first cycle is that month
update public.rooms set created_at = now() - interval '150 days';
update public.cycles set starts_on = (select today from d) - 150,
  ends_on = public.cycle_end((select today from d) - 150, 'monthly');
update public.room_members set joined_on = (select today from d) - 150;
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, u::uuid, 'member'::public.member_role, 'approved'::public.member_status, (select today from d) - 150
  from t, unnest(array['bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003',
                       'dddddddd-0000-0000-0000-000000000004']) u;

-- old cycle: expense with receipt, settlement, payment, dispute; later: an adjustment
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table e1 as select public.create_expense((select room from t), 'Rice', 8000, (select today from d) - 148,
  'aaaaaaaa-0000-0000-0000-000000000001') as id;
grant select on e1 to authenticated;
select pg_temp.act(null);
update public.expenses set receipt_path = (select room from t)::text || '/r1.jpg' where id = (select id from e1);
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table f1 as select public.raise_flag('expense', (select id from e1), 'wrong_amount', 'was 7') as id;
grant select on f1 to authenticated;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table s1 as select public.generate_settlement((select cycle_id from public.expenses where id = (select id from e1))) as id;
grant select on s1 to authenticated;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
create temp table p1 as select public.claim_payment(
  (select id from public.settlement_lines where settlement_id = (select id from s1)
      and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 2000, 'cash') as id;
grant select on p1 to authenticated;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table adj as select public.add_adjustment((select id from e1), -1000, 'was 7') as id;
grant select on adj to authenticated;
create temp table e2 as select public.create_expense((select room from t), 'Milk', 300, (select today from d),
  'aaaaaaaa-0000-0000-0000-000000000001') as id;
grant select on e2 to authenticated;

-- 1. Reports: own for everyone, full Room for Admins only; reference number verifiable
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.report_data((select room from t), null, 'room')$$, 'not_allowed');
create temp table rb as select public.report_data((select room from t), null, 'mine') as j;
grant select on rb to authenticated, anon;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table ra as select public.report_data((select room from t), null, 'room') as j;
grant select on ra to authenticated;
do $$ begin
  assert (select j ->> 'ref' from rb) like 'MM-%', 'ref present';
  assert jsonb_array_length((select j -> 'expenses' from ra)) = 3, 'room report has all expenses';
  assert jsonb_array_length((select j -> 'settlements' from ra)) = 1;
  assert jsonb_array_length((select j -> 'settlements' -> 0 -> 'lines' from ra)) = 4;
  assert jsonb_array_length((select j -> 'settlements' -> 0 -> 'lines' from rb)) = 1, 'own report: own line only';
  assert jsonb_array_length((select j -> 'payments' from ra)) = 1;
  assert jsonb_array_length((select j -> 'disputes' from ra)) = 1;
  assert jsonb_array_length((select j -> 'audit' from ra)) > 0;
  assert (select j -> 'people' -> 'bbbbbbbb-0000-0000-0000-000000000002' ->> 'name' from ra) = 'Bilal';
end $$;
select pg_temp.act(null);
set role anon;
do $$ begin
  assert (public.verify_report((select j ->> 'ref' from rb)) ->> 'found') = 'true';
  assert (public.verify_report('MM-00000000-NOPE') ->> 'found') = 'false';
end $$;
select pg_temp.expect_error($$select public.report_data(gen_random_uuid(), null, 'mine')$$, 'permission denied');
select pg_temp.expect_error($$select public.run_retention()$$, 'permission denied');
select pg_temp.expect_error($$select public.email_claim(5)$$, 'permission denied');
reset role;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.perform_account_deletion('cccccccc-0000-0000-0000-000000000003', 'app')$$, 'permission denied');
select pg_temp.expect_error($$select * from public.email_outbox$$, 'permission denied');
select pg_temp.act(null);

-- 2. Data export
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ declare j jsonb := public.my_data_export(); begin
  assert j -> 'profile' ->> 'email' = 'b@t.dev';
  assert jsonb_array_length(j -> 'rooms') = 1;
end $$;

-- 3. Leaving statement email
select public.leave_room((select room from t));
select pg_temp.act(null);
do $$ begin
  assert (select count(*) from public.email_outbox where kind = 'leave_statement'
          and user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and language = 'ar') = 1, 'leave statement queued in ar';
end $$;

-- 4. In-app deletion: needs a fresh sign-in; last Admin is blocked; effects
select pg_temp.act('cccccccc-0000-0000-0000-000000000003');
select pg_temp.expect_error($$select public.delete_my_account()$$, 'reauth_required');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001', true);
do $$ begin
  assert jsonb_array_length(public.account_deletion_check() -> 'blocking_rooms') = 1;
end $$;
select pg_temp.expect_error($$select public.delete_my_account()$$, 'last_admin');
select pg_temp.act('cccccccc-0000-0000-0000-000000000003', true);
do $$ declare j jsonb := public.account_deletion_check(); begin
  assert jsonb_array_length(j -> 'blocking_rooms') = 0;
end $$;
select public.delete_my_account();
select pg_temp.act(null);
do $$ begin
  assert (select deleted_at from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') is not null;
  assert (select purge_after from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003')
         = (current_date + interval '2 months')::date;
  assert (select banned_until from auth.users where id = 'cccccccc-0000-0000-0000-000000000003') > now();
  assert not exists (select 1 from auth.sessions where user_id = 'cccccccc-0000-0000-0000-000000000003'), 'sessions ended';
  assert (select status from public.room_members where user_id = 'cccccccc-0000-0000-0000-000000000003') = 'left';
  assert (select count(*) from public.notifications where kind = 'member_account_deleted') = 2, 'A and D notified';
  assert (select count(*) from public.email_outbox where user_id = 'cccccccc-0000-0000-0000-000000000003'
          and kind = 'account_deleted') = 1;
  assert (select count(*) from public.email_outbox where user_id = 'cccccccc-0000-0000-0000-000000000003'
          and kind = 'leave_statement') = 0, 'no separate leave mail on deletion';
end $$;
select pg_temp.act('cccccccc-0000-0000-0000-000000000003', true);
select pg_temp.expect_error($$select public.report_data((select room from t), null, 'mine')$$, 'account_deleted');
select pg_temp.act(null);

-- 5. Web deletion: request (no enumeration), confirm with emailed link, link used once
set role anon;
select public.request_account_deletion('nobody@t.dev');
select public.request_account_deletion(' D@T.dev ');
reset role;
create temp table tok as select payload ->> 'token' as tk from public.email_outbox where kind = 'deletion_confirm';
grant select on tok to anon;
do $$ begin
  assert (select count(*) from tok) = 1, 'only a real account gets a link';
end $$;
set role anon;
do $$ begin
  assert (public.confirm_account_deletion('bad') ->> 'error') = 'link_invalid';
  assert (public.confirm_account_deletion((select tk from tok)) ->> 'ok') = 'true';
  assert (public.confirm_account_deletion((select tk from tok)) ->> 'error') = 'link_invalid', 'single use';
end $$;
reset role;
do $$ begin
  assert (select deleted_via from public.profiles where id = 'dddddddd-0000-0000-0000-000000000004') = 'web';
end $$;

-- 6. Email worker API
do $$ declare n int; r record; begin
  select count(*) into n from public.email_claim(100);
  assert n >= 4, 'claimed queued mails';
  for r in select id from public.email_outbox where kind = 'deletion_confirm' loop
    perform public.email_done(r.id, true);
  end loop;
  assert (select payload ? 'token' from public.email_outbox where kind = 'deletion_confirm') = false, 'token scrubbed';
  assert (select to_email from public.email_outbox where kind = 'deletion_confirm') is null, 'address scrubbed';
  for r in select id from public.email_outbox where kind = 'leave_statement' loop
    perform public.email_done(r.id, false, 'smtp down');
  end loop;
  assert (select status from public.email_outbox where kind = 'leave_statement') = 'queued', 'retried later';
end $$;
-- domain not verified yet: the email waits 6 hours and keeps its attempts
do $$ declare r record; a int; begin
  select id, attempts into r from public.email_outbox where kind = 'leave_statement';
  perform public.email_hold(r.id, 'resend 403');
  select attempts into a from public.email_outbox where id = r.id;
  assert a = greatest(r.attempts - 1, 0), 'attempt given back';
  assert (select status from public.email_outbox where id = r.id) = 'queued', 'still queued';
  assert (select next_attempt_at from public.email_outbox where id = r.id) > now() + interval '5 hours', 'waits';
end $$;

-- 7. Retention: notice 7 days before, deletion after 2 calendar months
update public.cycles set locked_at = now() - interval '4 months',
  ends_on = (select today from d) - 125 where id = (select cycle_id from public.expenses where id = (select id from e1));
create temp table oc as select cycle_id as id from public.expenses where id = (select id from e1);
do $$ declare j jsonb; begin
  assert public.cycle_purge_on((select id from oc)) <= (select today from d);
  j := public.run_retention();
  assert (j ->> 'notices')::int = 1, 'notice sent: ' || j::text;
  assert (j ->> 'purged')::int = 0, 'not deleted on the same day as the notice';
  assert (select count(*) from public.email_outbox where kind = 'retention_notice') = 4,
    'everyone active in that cycle (incl. left/deleted, not yet purged)';
  assert (select count(*) from public.notifications where kind = 'retention_reminder') = 1, 'only current members in-app';
end $$;
update public.cycles set purge_notice_at = now() - interval '8 days' where id = (select id from oc);
do $$ declare j jsonb; begin
  j := public.run_retention();
  assert (j ->> 'purged')::int = 1;
  assert not exists (select 1 from public.expenses where id = (select id from e1)), 'expense gone';
  assert not exists (select 1 from public.settlements where id = (select id from s1)), 'settlement gone';
  assert not exists (select 1 from public.payments where id = (select id from p1)), 'payment gone';
  assert not exists (select 1 from public.flags where id = (select id from f1)), 'dispute gone';
  assert not exists (select 1 from public.audit_log where entity_id = (select id from e1)), 'audit gone';
  assert (select purged_at from public.cycles where id = (select id from oc)) is not null;
  assert (select adjusts_purged from public.expenses where id = (select id from adj)), 'adjustment kept';
  assert exists (select 1 from public.expenses where id = (select id from e2)), 'current cycle untouched';
  assert exists (select 1 from public.storage_purge where path like '%/r1.jpg'), 'receipt file queued for removal';
end $$;
-- audit stays append-only for everyone else
select pg_temp.expect_error($$delete from public.audit_log where id = (select min(id) from public.audit_log)$$, 'append-only');

-- 8. End of hold: final mails, then the person is erased
update public.profiles set purge_after = current_date - 1 where id = 'cccccccc-0000-0000-0000-000000000003';
do $$ declare j jsonb; begin
  j := public.run_account_purges();
  assert (j ->> 'final_queued')::int = 1;
  assert (j ->> 'erased')::int = 0, 'waits for the final mail';
  assert (select count(*) from public.email_outbox where kind = 'account_final') = 1;
  assert (select count(*) from public.email_outbox where kind = 'member_account_final') = 1, 'A (still a member) gets it';
end $$;
do $$ declare r record; begin
  for r in select id from public.email_outbox where status in ('queued', 'sending')
            and (user_id = 'cccccccc-0000-0000-0000-000000000003'
                 or payload ->> 'deleted_user' = 'cccccccc-0000-0000-0000-000000000003') loop
    perform public.email_done(r.id, true);
  end loop;
  assert (public.run_account_purges() ->> 'erased')::int = 1;
  assert (select email from auth.users where id = 'cccccccc-0000-0000-0000-000000000003') is null, 'email erased';
  assert (select display_name from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') = 'Deleted user';
end $$;

select 'ALL DB TESTS PASSED' as result;
