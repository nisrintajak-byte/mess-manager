-- Settlement up to a day the Admin picks.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
create function pg_temp.act(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p::text, ''), false);
  if p is null then execute 'reset role'; else execute 'set role authenticated'; end if;
end; $$;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table t as select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait') as room;
grant select on t to authenticated;
create temp table d as select (now() at time zone 'Asia/Kuwait')::date as today;
grant select on d to authenticated;
select pg_temp.act(null);
-- a monthly cycle that started 10 days ago and is still running
update public.rooms set created_at = now() - interval '10 days';
update public.cycles set starts_on = (select today from d) - 10, ends_on = (select today from d) + 20;
update public.room_members set joined_on = (select today from d) - 10;
insert into public.room_members (room_id, user_id, role, status, joined_on)
select room, 'bbbbbbbb-0000-0000-0000-000000000002', 'member', 'approved', (select today from d) - 10 from t;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_expense((select room from t), 'Rice', 9000, (select today from d) - 8,
  'aaaaaaaa-0000-0000-0000-000000000001', null, null, null, gen_random_uuid());
select public.create_expense((select room from t), 'Milk', 1000, (select today from d) - 3,
  'aaaaaaaa-0000-0000-0000-000000000001', null, null, null, gen_random_uuid());
do $$ begin
  begin
    perform public.generate_settlement_until((select id from public.cycles limit 1), (select today from d));
    assert false, 'today is not allowed';
  exception when others then assert sqlerrm like '%date_invalid%', sqlerrm; end;
  begin
    perform public.generate_settlement_until((select id from public.cycles limit 1), (select today from d) - 11);
    assert false, 'before the cycle start is not allowed';
  exception when others then assert sqlerrm like '%date_invalid%', sqlerrm; end;
end $$;
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin
  begin
    perform public.generate_settlement_until((select id from public.cycles limit 1), (select today from d) - 5);
    assert false, 'members cannot settle';
  exception when others then assert sqlerrm like '%not_allowed%', sqlerrm; end;
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
create temp table s as
  select public.generate_settlement_until((select id from public.cycles order by starts_on limit 1),
                                          (select today from d) - 5) as id;
grant select on s to authenticated;
select pg_temp.act(null);
do $$ declare c1 public.cycles; c2 public.cycles; begin
  select * into c1 from public.cycles order by starts_on limit 1;
  select * into c2 from public.cycles order by starts_on offset 1 limit 1;
  assert c1.ends_on = (select today from d) - 5 and c1.status = 'locked', 'locked up to the chosen day';
  assert c2.starts_on = (select today from d) - 4 and c2.status = 'open', 'next cycle starts the day after';
  assert (select total from public.settlements) = 9000, 'only Rice is in the settlement';
  -- Milk (dated after the settled day) leaves the locked cycle for an open one that covers its date.
  -- With monthly cycles the day after the cut can fall on a month end, so there may be more than one
  -- new cycle; assert on the cycle that actually holds Milk rather than a fixed position.
  assert (select ch.status from public.expenses e join public.cycles ch on ch.id = e.cycle_id
          where e.title = 'Milk') = 'open', 'Milk is in an open cycle';
  assert (select e.expense_date between ch.starts_on and ch.ends_on
          from public.expenses e join public.cycles ch on ch.id = e.cycle_id
          where e.title = 'Milk'), 'Milk sits inside its cycle dates';
  assert (select cycle_id from public.expenses where title = 'Milk') <> c1.id, 'Milk left the locked cycle';
end $$;
select 'ALL DB TESTS PASSED';
