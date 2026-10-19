-- v0.6: browser push subscriptions.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
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
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v","language":"hi"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');

select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.register_web_push('http://x', 'p', 'a')$$, 'invalid_token');
select public.register_web_push('https://fcm.googleapis.com/fcm/send/abc123', repeat('k', 87), repeat('a', 22));
select pg_temp.expect_error($$select * from public.web_push_subscriptions$$, 'permission denied');
select pg_temp.expect_error($$select public.web_push_job(gen_random_uuid())$$, 'permission denied');

-- same browser, another user signs in: the subscription moves to them
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.register_web_push('https://fcm.googleapis.com/fcm/send/abc123', repeat('k', 87), repeat('a', 22));
select pg_temp.act(null);
do $$ begin
  assert (select user_id from public.web_push_subscriptions) = 'bbbbbbbb-0000-0000-0000-000000000002';
end $$;
-- other user cannot switch it off
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select public.unregister_web_push('https://fcm.googleapis.com/fcm/send/abc123');
select pg_temp.act(null);
do $$ begin assert (select active from public.web_push_subscriptions); end $$;

-- a notification produces a job with the language and the subscription; inserting never fails
insert into public.notifications (user_id, kind, payload) values ('bbbbbbbb-0000-0000-0000-000000000002', 'need_created', '{"name":"Asha","title":"Milk"}');
do $$ declare j jsonb; begin
  j := public.web_push_job((select id from public.notifications limit 1));
  assert j ->> 'kind' = 'need_created';
  assert jsonb_array_length(j -> 'subscriptions') = 1;
  assert j -> 'subscriptions' -> 0 -> 'keys' ->> 'auth' = repeat('a', 22);
end $$;
select public.web_push_gone('https://fcm.googleapis.com/fcm/send/abc123');
do $$ begin assert not (select active from public.web_push_subscriptions); end $$;

select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.unregister_web_push('https://fcm.googleapis.com/fcm/send/abc123');
select 'ALL DB TESTS PASSED' as result;
