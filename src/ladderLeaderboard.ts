// Leaderboard reads/writes for Number Ladder.
//
// Each level (beginner / expert) has its own board. A player's standing is their
// BEST run: the most rungs climbed, ties broken by the fastest time. Ranked
// rungs high→low, then time low→high.

import { supabase } from './supabase';
import { LadderLevel } from './ladder/generator';

export interface LadderRank {
  username: string;
  level: LadderLevel;
  best_score: number; // rungs climbed
  best_time_ms: number;
  rank: number;
}

/** Record a finished run; the server keeps it only if it beats the player's best. */
export async function submitLadder(level: LadderLevel, steps: number, timeMs: number): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('submit_ladder', { p_level: level, p_score: steps, p_time_ms: timeMs });
}

/** Top N players for a level, most rungs (then fastest) first. */
export async function getLadderTop(level: LadderLevel, limit = 20): Promise<LadderRank[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ladder_leaderboard')
    .select('username, level, best_score, best_time_ms, rank')
    .eq('level', level)
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as LadderRank[];
}

/** The leading score (rungs) for a level, for the score-bar medal. */
export async function getLadderTopScore(level: LadderLevel): Promise<number | null> {
  const top = await getLadderTop(level, 1);
  return top.length > 0 ? top[0].best_score : null;
}

/** The current player's own rank for a level, or null if unranked / guest. */
export async function getMyLadderRank(level: LadderLevel): Promise<LadderRank | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_ladder_rank', { p_level: level });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as LadderRank;
}
