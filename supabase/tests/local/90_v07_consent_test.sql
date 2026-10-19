-- v0.7: consent log + re-acceptance.
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
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"2026-10-v1"}');
do $$ begin
  assert (select count(*) from public.consent_log) = 1, 'signup consent logged';
end $$;
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.accept_legal('anything')$$, 'consent_required');
select public.accept_legal('2026-10-v2');
select public.accept_legal('2026-10-v2');
select pg_temp.expect_error($$select * from public.consent_log$$, 'permission denied');
select pg_temp.act(null);
do $$ begin
  assert (select consent_version from public.profiles) = '2026-10-v2';
  assert (select count(*) from public.consent_log) = 2, 'one row per new version';
end $$;
select pg_temp.expect_error($$update public.consent_log set version = 'x'$$, 'immutable');
select 'ALL DB TESTS PASSED' as result;
