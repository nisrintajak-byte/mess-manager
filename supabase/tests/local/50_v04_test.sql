-- v0.4: Google profile completion.
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
 ('aaaaaaaa-0000-0000-0000-000000000001', 'gina@t.dev', now(),
  '{"full_name":"Gina Google","picture":"https://lh3.example/p.png","language":"xx"}'),
 ('bbbbbbbb-0000-0000-0000-000000000002', 'pw@t.dev', now(),
  '{"display_name":"Pat","consent_version":"v1","date_of_birth":"1990-01-01","language":"ur"}'),
 ('cccccccc-0000-0000-0000-000000000003', 'bad@t.dev', now(),
  '{"full_name":"Evil","picture":"http://insecure.example/p.png"}');

do $$ begin
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Gina Google';
  assert (select avatar_url from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'https://lh3.example/p.png';
  assert (select consent_version from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'unknown';
  assert (select language from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'en', 'bad language ignored';
  assert (select language from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'ur';
  assert (select avatar_url from public.profiles where id = 'cccccccc-0000-0000-0000-000000000003') is null, 'non-https picture dropped';
end $$;

-- Password signups are unaffected
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select public.create_room('Flat', 'KW', 'KWD', 3, 'Asia/Kuwait');

-- Google user cannot use Rooms until the profile is completed
select pg_temp.act('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_error($$select public.create_room('Nope', 'KW', 'KWD', 3, 'Asia/Kuwait')$$, 'profile_incomplete');
select pg_temp.expect_error($$select public.request_join('ABCDEFGH')$$, 'profile_incomplete');
select pg_temp.expect_error($$select public.complete_profile((current_date - interval '10 years')::date, 'v1')$$, 'minor_not_allowed');
select pg_temp.expect_error($$select public.complete_profile(current_date + 1, 'v1')$$, 'dob_invalid');
select pg_temp.expect_error($$select public.complete_profile(date '1990-05-01', 'unknown')$$, 'consent_required');
select public.complete_profile(date '1990-05-01', '2026-10-v1');
select public.create_room('Now fine', 'KW', 'KWD', 3, 'Asia/Kuwait');

-- Cannot be used again to rewrite the date of birth
select pg_temp.expect_error($$select public.complete_profile(date '1980-01-01', 'v2')$$, 'not_allowed');
select pg_temp.act('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_error($$select public.complete_profile(date '1980-01-01', 'v2')$$, 'not_allowed');

-- anon cannot call it
select pg_temp.act(null);
set role anon;
select pg_temp.expect_error($$select public.complete_profile(date '1990-01-01', 'v1')$$, 'permission denied');
reset role;

do $$ begin
  assert (select date_of_birth from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = date '1990-05-01';
end $$;
select 'ALL DB TESTS PASSED' as result;
