-- Migration 003 — Koloso Challenge leaderboards (per level: beginner / expert).
--
-- Run this ONCE in your Supabase SQL Editor. It adds a per-level best-score
-- table plus a submit function, a public leaderboard view, and a "my rank"
-- function. A player's standing is their BEST game for that level: highest
-- score (out of 10), ties broken by fastest time.

-- 1) Per-player, per-level best score.
create table if not exists public.challenge_scores (
  user_id      uuid    not null references public.profiles(id) on delete cascade,
  level        text    not null check (level in ('beginner', 'expert')),
  best_score   integer not null default 0,
  best_time_ms integer not null default 0,
  games_played integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, level)
);

alter table public.challenge_scores enable row level security;

-- The board is public; reads go through the view, but the security_invoker view
-- needs the caller to be able to read the underlying rows.
drop policy if exists "challenge_scores are readable" on public.challenge_scores;
create policy "challenge_scores are readable"
  on public.challenge_scores for select using (true);
grant select on public.challenge_scores to anon, authenticated;

-- 2) Record a finished game; keep it only if it beats the player's best
--    (higher score, or same score with a faster time).
create or replace function public.submit_challenge(p_level text, p_score integer, p_time_ms integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'must be logged in to submit a game';
  end if;
  if p_level not in ('beginner', 'expert') then
    raise exception 'invalid level';
  end if;

  insert into public.challenge_scores (user_id, level, best_score, best_time_ms, games_played, updated_at)
    values (auth.uid(), p_level, greatest(p_score, 0), greatest(p_time_ms, 0), 1, now())
  on conflict (user_id, level) do update set
    games_played = public.challenge_scores.games_played + 1,
    updated_at   = now(),
    best_score = case
        when excluded.best_score > public.challenge_scores.best_score then excluded.best_score
        else public.challenge_scores.best_score end,
    best_time_ms = case
        when excluded.best_score > public.challenge_scores.best_score then excluded.best_time_ms
        when excluded.best_score = public.challenge_scores.best_score
             and excluded.best_time_ms < public.challenge_scores.best_time_ms then excluded.best_time_ms
        else public.challenge_scores.best_time_ms end;
end;
$$;
revoke execute on function public.submit_challenge(text, integer, integer) from public, anon;
grant execute on function public.submit_challenge(text, integer, integer) to authenticated;

-- 3) Public leaderboard view — ranked per level, best score then fastest time.
create or replace view public.challenge_leaderboard as
  select
    p.username,
    s.level,
    s.best_score,
    s.best_time_ms,
    rank() over (partition by s.level order by s.best_score desc, s.best_time_ms asc) as rank
  from public.challenge_scores s
  join public.profiles p on p.id = s.user_id
  where s.games_played > 0;
alter view public.challenge_leaderboard set (security_invoker = on);
grant select on public.challenge_leaderboard to anon, authenticated;

-- 4) The caller's own row for a level.
create or replace function public.my_challenge_rank(p_level text)
returns table (username text, level text, best_score integer, best_time_ms integer, rank bigint)
language sql security definer set search_path = public as $$
  select l.username, l.level, l.best_score, l.best_time_ms, l.rank
  from public.challenge_leaderboard l
  join public.profiles p on p.username = l.username
  where p.id = auth.uid() and l.level = p_level;
$$;
revoke execute on function public.my_challenge_rank(text) from public, anon;
grant execute on function public.my_challenge_rank(text) to authenticated;
