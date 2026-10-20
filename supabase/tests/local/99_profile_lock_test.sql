-- Own profile edit + login lock after 5 wrong passwords.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}');
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select public.update_profile('  Asha  Khan ', 'aaaaaaaa-0000-0000-0000-000000000001/0b0f8c3e-0000-4000-8000-000000000001.jpg');
do $$ begin
  begin
    perform public.update_profile('X', 'bbbbbbbb-0000-0000-0000-000000000002/0b0f8c3e-0000-4000-8000-000000000001.jpg');
    assert false, 'cannot point at someone else''s photo';
  exception when others then assert sqlerrm like '%invalid_file%', sqlerrm; end;
  begin
    perform public.update_profile('   ', null);
    assert false, 'empty name refused';
  exception when others then assert sqlerrm like '%name_invalid%', sqlerrm; end;
end $$;
select public.update_profile('Asha K', 'aaaaaaaa-0000-0000-0000-000000000001/0b0f8c3e-0000-4000-8000-000000000002.jpg');
reset role;
do $$ begin
  assert (select display_name from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Asha K';
  assert (select count(*) from public.storage_purge where bucket = 'avatars') = 1, 'old photo queued for removal';
end $$;

-- login lock
set role anon;
do $$ declare w int; i int; begin
  assert public.login_wait('A@T.dev') = 0, 'not locked at first';
  for i in 1..4 loop w := public.login_failed('a@t.dev'); end loop;
  assert w = 0, 'four mistakes: still allowed';
  w := public.login_failed(' A@t.dev ');
  assert w between 890 and 900, 'fifth mistake locks for 15 minutes: ' || w;
  assert public.login_wait('a@t.dev') > 0, 'locked';
  assert public.login_wait('other@t.dev') = 0, 'other emails unaffected';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.login_failures) = 1;
  begin
    set local role anon;
    perform * from public.login_failures;
    assert false, 'table not readable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
-- lock over → counting starts again
update public.login_failures set locked_until = now() - interval '1 second', first_at = now() - interval '20 minutes';
set role anon;
do $$ begin
  assert public.login_wait('a@t.dev') = 0, 'lock over';
  assert public.login_failed('a@t.dev') = 0, 'counting restarts';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select public.login_succeeded();
reset role;
do $$ begin assert (select failures from public.login_failures) = 0, 'cleared after success'; end $$;
select 'ALL DB TESTS PASSED';
