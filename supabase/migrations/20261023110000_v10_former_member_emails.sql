-- Admins also see the email of people who left or were removed, so they can invite them again
-- (founder 2026-10-20). Deleted accounts never show an email.
create or replace function public.room_member_emails(p_room uuid)
returns table (user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_room_admin(p_room) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select distinct u.id, u.email::text
      from public.room_members rm
      join auth.users u on u.id = rm.user_id
      join public.profiles p on p.id = rm.user_id
     where rm.room_id = p_room
       and rm.status in ('pending', 'approved', 'left', 'removed')
       and p.deleted_at is null;
end;
$$;
