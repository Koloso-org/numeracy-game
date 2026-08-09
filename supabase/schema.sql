-- Number Rules — leaderboard schema for Supabase.
-- Run this once in your Supabase project: SQL Editor -> New query -> paste -> Run.
--
-- Design notes:
--  * No personal data is stored. A "profile" is just a username + best score.
--  * Email/password auth is used under the hood, but we map a made-up username
--    to a synthetic address (username@players.numbergame.app) and use the PIN as
--    the password. Supabase hashes the PIN for us — we never store it in plaintext.
--  * Row Level Security (RLS) is ON. Everyone can READ the leaderboard, but a
--    player can only raise THEIR OWN score, and only via the submit_score()
--    function below (which refuses to lower a score).

-- 1) Profiles table -----------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text unique not null,
  best_score  integer not null default 0,
  updated_at  timestamptz not null default now(),
  constraint username_format check (char_length(username) between 3 and 20)
);

alter table public.profiles enable row level security;

-- Anyone (even logged-out players) may read the leaderboard.
drop policy if exists "profiles are readable by everyone" on public.profiles;
create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);
grant select on public.profiles to anon, authenticated;

-- Note: players deliberately get NO direct INSERT/UPDATE. Profiles are created
-- by the trigger below, and scores change only through submit_score() — so a
-- player can never set an arbitrary score by writing to the table directly.
drop policy if exists "players manage their own profile" on public.profiles;

-- 2) Auto-create a profile when a new auth user signs up ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
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

-- This is a trigger-only function; no one should call it directly.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 3) Submit a score (only raises your own best; never lowers it) --------------
create or replace function public.submit_score(p_score integer)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  new_best integer;
begin
  if auth.uid() is null then
    raise exception 'must be logged in to submit a score';
  end if;

  update public.profiles
     set best_score = greatest(best_score, p_score),
         updated_at = now()
   where id = auth.uid()
  returning best_score into new_best;

  return new_best;
end;
$$;

-- Only logged-in players may call it (and it still checks auth.uid() inside).
revoke execute on function public.submit_score(integer) from public, anon;
grant execute on function public.submit_score(integer) to authenticated;

-- 4) Leaderboard view (ranked; only players who have scored) ------------------
create or replace view public.leaderboard as
  select
    username,
    best_score,
    rank() over (order by best_score desc) as rank
  from public.profiles
  where best_score > 0;

-- security_invoker makes the view run with the caller's own permissions (and
-- RLS), instead of the view owner's — this clears Supabase's "Security Definer
-- View" advisory. Reading still works because profiles is publicly readable.
alter view public.leaderboard set (security_invoker = on);
grant select on public.leaderboard to anon, authenticated;

-- 5) The caller's own rank + best score ---------------------------------------
create or replace function public.my_rank()
returns table (username text, best_score integer, rank bigint)
language sql
security definer set search_path = public
as $$
  select l.username, l.best_score, l.rank
  from public.leaderboard l
  join public.profiles p on p.username = l.username
  where p.id = auth.uid();
$$;

revoke execute on function public.my_rank() from public, anon;
grant execute on function public.my_rank() to authenticated;
