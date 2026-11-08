-- v1.1 Personal expenses (founder 2026-11-08: post-launch update).
-- Each member can keep their own private spending list, fully separate from Rooms:
--   * no link to any Room, cycle, settlement, notification, report or audit row;
--   * only the owner can read it (RLS) and only the owner's RPCs can change it;
--   * the owner may edit or delete an entry at any time (no 30-minute lock, nothing shared);
--   * deleting the account removes the list at once.
-- Self-contained: drop this file (and the app feature switch) and nothing else changes.

create table public.personal_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  amount bigint not null check (amount > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  currency_decimals smallint not null check (currency_decimals between 0 and 4),
  category text check (category in ('food', 'transport', 'bills', 'shopping', 'health', 'education', 'other')),
  expense_date date not null check (expense_date >= date '2000-01-01'),
  notes text check (char_length(notes) <= 1000),
  -- one key per form on the phone: a double tap or a retry never saves twice
  client_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create index personal_expenses_user_date on public.personal_expenses (user_id, expense_date desc, created_at desc);

alter table public.personal_expenses enable row level security;

create policy personal_expenses_owner_read on public.personal_expenses
  for select to authenticated using (user_id = (select auth.uid()));

-- reads only through RLS; every write goes through the functions below
revoke all on public.personal_expenses from public, anon, authenticated;
grant select on public.personal_expenses to authenticated;

create function public.save_personal_expense(
  p_id uuid,
  p_client_id uuid,
  p_title text,
  p_amount bigint,
  p_currency text,
  p_decimals int,
  p_category text,
  p_date date,
  p_notes text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
  v_title text := btrim(coalesce(p_title, ''));
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_currency text := upper(btrim(coalesce(p_currency, '')));
  v_id uuid;
begin
  if v_title = '' or char_length(v_title) > 120 then
    raise exception 'personal_title_invalid' using errcode = '22023';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'personal_amount_invalid' using errcode = '22023';
  end if;
  if v_currency !~ '^[A-Z]{3}$' or p_decimals is null or p_decimals not between 0 and 4 then
    raise exception 'personal_currency_invalid' using errcode = '22023';
  end if;
  if p_category is not null
     and p_category not in ('food', 'transport', 'bills', 'shopping', 'health', 'education', 'other') then
    raise exception 'personal_category_invalid' using errcode = '22023';
  end if;
  -- one day of slack: the phone may be ahead of the server's UTC date
  if p_date is null or p_date < date '2000-01-01' or p_date > current_date + 1 then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 1000 then
    raise exception 'personal_notes_too_long' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.personal_expenses
      (user_id, title, amount, currency, currency_decimals, category, expense_date, notes, client_id)
    values (v_uid, v_title, p_amount, v_currency, p_decimals, p_category, p_date, v_notes,
            coalesce(p_client_id, gen_random_uuid()))
    on conflict (user_id, client_id) do nothing
    returning id into v_id;
    if v_id is null then
      -- same form sent twice: return the entry saved the first time
      select id into v_id from public.personal_expenses where user_id = v_uid and client_id = p_client_id;
    end if;
    return v_id;
  end if;

  update public.personal_expenses
     set title = v_title, amount = p_amount, currency = v_currency, currency_decimals = p_decimals,
         category = p_category, expense_date = p_date, notes = v_notes, updated_at = now()
   where id = p_id and user_id = v_uid
  returning id into v_id;
  if v_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return v_id;
end;
$$;

create function public.delete_personal_expense(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_verified_user();
begin
  delete from public.personal_expenses where id = p_id and user_id = v_uid;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- Account deletion (app or web) marks the profile deleted; the private list goes at once —
-- unlike Room records, nobody else needs it.
create function public.erase_personal_expenses_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.personal_expenses where user_id = new.id;
  return new;
end;
$$;

create trigger profiles_erase_personal_expenses
  after update of deleted_at on public.profiles
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.erase_personal_expenses_on_delete();

revoke execute on function public.save_personal_expense(uuid, uuid, text, bigint, text, int, text, date, text)
  from public, anon;
revoke execute on function public.delete_personal_expense(uuid) from public, anon;
revoke execute on function public.erase_personal_expenses_on_delete() from public, anon, authenticated;
grant execute on function public.save_personal_expense(uuid, uuid, text, bigint, text, int, text, date, text)
  to authenticated;
grant execute on function public.delete_personal_expense(uuid) to authenticated;
