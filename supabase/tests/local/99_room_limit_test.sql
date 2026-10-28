-- Free accounts: at most 2 Rooms (pending or approved); Plus: up to 10.
\set ON_ERROR_STOP on
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('a1000000-0000-0000-0000-000000000001', 'lim-a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('b1000000-0000-0000-0000-000000000002', 'lim-b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', false);
create temp table lim as select public.create_room('One', 'IN', 'INR', 2, 'Asia/Kolkata') as room;
insert into lim select public.create_room('Two', 'IN', 'INR', 2, 'Asia/Kolkata');
do $$ begin
  assert (select used from public.my_room_allowance()) = 2, 'two Rooms in use';
  assert (select room_limit from public.my_room_allowance()) = 2, 'free limit is 2';
  begin
    perform public.create_room('Three', 'IN', 'INR', 2, 'Asia/Kolkata');
    assert false, 'third Room must be refused';
  exception when others then
    assert sqlerrm = 'room_limit_free', sqlerrm;
  end;
end $$;
-- Bilal (free) has one Room; joining a second one is fine (pending counts), a third is not
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', false);
insert into lim select public.create_room('Bilal flat', 'IN', 'INR', 2, 'Asia/Kolkata');
reset role;
create temp table codes as select join_code, name from public.rooms where id in (select room from lim);
grant select on codes to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-0000-0000-000000000002', false);
select public.request_join((select join_code from codes where name = 'One'));
do $$ begin
  begin
    perform public.request_join((select join_code from codes where name = 'Two'));
    assert false, 'third Room (pending) must be refused';
  exception when others then
    assert sqlerrm = 'room_limit_free', sqlerrm;
  end;
end $$;
-- leaving frees a place
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', false);
reset role;
update public.room_members set status = 'left', left_on = current_date
 where user_id = 'a1000000-0000-0000-0000-000000000001' and room_id = (select room from lim limit 1);
-- with Plus the limit is 10
insert into public.ad_free_subscriptions (purchase_token, user_id, product_id, status, expires_at)
values ('tok-lim', 'a1000000-0000-0000-0000-000000000001', 'mm_adfree_monthly', 'active', now() + interval '20 days');
set role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', false);
do $$ declare i int; begin
  assert (select room_limit from public.my_room_allowance()) = 10, 'Plus limit is 10';
  assert (select plus from public.my_room_allowance()), 'Plus flag';
  for i in 1..9 loop perform public.create_room('Plus ' || i, 'IN', 'INR', 2, 'Asia/Kolkata'); end loop;
  assert (select used from public.my_room_allowance()) = 10, 'ten Rooms in use';
  begin
    perform public.create_room('Eleven', 'IN', 'INR', 2, 'Asia/Kolkata');
    assert false, 'eleventh Room must be refused';
  exception when others then
    assert sqlerrm = 'room_limit_max', sqlerrm;
  end;
end $$;
reset role;
select 'ALL DB TESTS PASSED';
