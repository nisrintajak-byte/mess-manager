-- Need Request special alert: on by default, each person can switch it off.
\set ON_ERROR_STOP on
set timezone = 'Asia/Kuwait';
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
 ('aaaaaaaa-0000-0000-0000-000000000001', 'a@t.dev', now(), '{"display_name":"Asha","consent_version":"v"}');
do $$ begin assert public.need_sound_on('aaaaaaaa-0000-0000-0000-000000000001'), 'on by default'; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select public.set_notification_pref('need_sound', false);
reset role;
do $$ begin
  assert not public.need_sound_on('aaaaaaaa-0000-0000-0000-000000000001'), 'switched off';
end $$;
set role authenticated;
do $$ begin
  begin
    perform public.need_sound_on('aaaaaaaa-0000-0000-0000-000000000001');
    assert false, 'not callable by apps';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select 'ALL DB TESTS PASSED';
