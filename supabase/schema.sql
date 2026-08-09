-- Number Rules — leaderboard schema for Supabase (fresh install).
-- Run once: SQL Editor -> New query -> paste -> Run.
-- (If you already ran an earlier version, run supabase/migration_002_plus_minus.sql instead.)
--
-- Design notes:
--  * No personal data is stored. A "profile" is a username + cumulative points.
--  * Each game contributes plus points and penalty (minus) points; the server
--    accumulates the totals. The leaderboard ranks by NET (plus − minus) high→low,
--    tie-broken by fewer penalty points (minus low→high).
--  * Row Level Security (RLS) is ON. Everyone can READ the leaderboard, but points
--    change only through submit_game() — nobody can write arbitrary totals.

-- 1) Profiles table -----------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique not null,
  total_plus    integer not null default 0,
  total_minus   integer not null default 0,
  games_played  integer not null default 0,
  updated_at    timestamptz not null default now(),
  constraint username_format check (char_length(username) between 3 and 20)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
grant select on public.profiles to anon, authenticated;

-- Players get NO direct INSERT/UPDATE. Profiles are created by the trigger,
-- and totals change only through submit_game().
drop policy if exists "players manage their own profile" on public.profiles;

-- 2) Auto-create a profile when a new auth user signs up ----------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'player_' || left(new.id::text, 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3) Submit a finished game (accumulates plus + penalty points) ---------------
create or replace function public.submit_game(p_plus integer, p_minus integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'must be logged in to submit a game';
  end if;
  update public.profiles
     set total_plus   = total_plus + greatest(p_plus, 0),
         total_minus  = total_minus + greatest(p_minus, 0),
         games_played = games_played + 1,
         updated_at   = now()
   where id = auth.uid();
end;
$$;

revoke execute on function public.submit_game(integer, integer) from public, anon;
grant execute on function public.submit_game(integer, integer) to authenticated;

-- 4) Leaderboard view — ranked by NET desc, then fewer penalties (minus asc) --
create or replace view public.leaderboard as
  select
    username,
    total_plus,
    total_minus,
    (total_plus - total_minus) as net,
    rank() over (order by (total_plus - total_minus) desc, total_minus asc) as rank
  from public.profiles
  where games_played > 0;

alter view public.leaderboard set (security_invoker = on);
grant select on public.leaderboard to anon, authenticated;

-- 5) The caller's own row -----------------------------------------------------
create or replace function public.my_rank()
returns table (username text, total_plus integer, total_minus integer, net integer, rank bigint)
language sql security definer set search_path = public as $$
  select l.username, l.total_plus, l.total_minus, l.net, l.rank
  from public.leaderboard l
  join public.profiles p on p.username = l.username
  where p.id = auth.uid();
$$;

revoke execute on function public.my_rank() from public, anon;
grant execute on function public.my_rank() to authenticated;
