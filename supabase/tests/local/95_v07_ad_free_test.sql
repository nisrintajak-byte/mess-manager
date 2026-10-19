-- v0.7: ad-free subscription entitlement.
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
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'b@t.dev', now(), '{"display_name":"Bilal","consent_version":"v"}');

do $$ begin
  assert public.save_ad_free('aaaaaaaa-0000-0000-0000-000000000001', 'tok1', 'mm_adfree_monthly', 'android', 'active', now() + interval '30 days', true);
  assert not public.save_ad_free('bbbbbbbb-0000-0000-0000-000000000002', 'tok1', 'mm_adfree_monthly', 'android', 'active', now() + interval '30 days', true),
    'token cannot move to another account';
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin assert public.my_ad_free() > now() + interval '29 days'; end $$;
select pg_temp.expect_error($$select public.save_ad_free(auth.uid(), 'x', 'p', 'android', 'active', now() + interval '1 year', true)$$, 'permission denied');
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
do $$ begin assert public.my_ad_free() is null; end $$;
select pg_temp.act(null);
-- refund/expiry turns ads back on
select public.save_ad_free(null, 'tok1', 'mm_adfree_monthly', 'android', 'expired', now() - interval '1 day', false);
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin assert public.my_ad_free() is null; end $$;
select 'ALL DB TESTS PASSED' as result;
