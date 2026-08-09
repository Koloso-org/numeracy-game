-- Migration 002 — switch the leaderboard from a single best_score to cumulative
-- plus / minus / net points.
--
-- Run this ONCE in your Supabase SQL Editor if you already ran the earlier
-- schema.sql. It is safe to run on a project that has existing players (their
-- totals simply start at 0).

-- 1) New cumulative columns.
alter table public.profiles
  add column if not exists total_plus   integer not null default 0,
  add column if not exists total_minus  integer not null default 0,
  add column if not exists games_played integer not null default 0;

-- 2) Drop the old objects (their shapes changed, so they can't be replaced).
drop view if exists public.leaderboard;
drop function if exists public.my_rank();
drop function if exists public.submit_score(integer);

-- 3) Record a finished game (accumulates plus + penalty points).
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

-- 4) Leaderboard view — NET desc, then fewer penalties (minus asc).
create view public.leaderboard as
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

-- 5) The caller's own row.
create function public.my_rank()
returns table (username text, total_plus integer, total_minus integer, net integer, rank bigint)
language sql security definer set search_path = public as $$
  select l.username, l.total_plus, l.total_minus, l.net, l.rank
  from public.leaderboard l
  join public.profiles p on p.username = l.username
  where p.id = auth.uid();
$$;
revoke execute on function public.my_rank() from public, anon;
grant execute on function public.my_rank() to authenticated;

-- 6) Remove the now-unused column.
alter table public.profiles drop column if exists best_score;
