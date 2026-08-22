// Leaderboard reads/writes for Koloso Challenge.
//
// Each level (beginner / expert) has its own board. A player's standing is their
// BEST game: highest score (out of 10), ties broken by the fastest time. Ranked
// score high→low, then time low→high.

import { supabase } from './supabase';
import { Level } from './challenge/questions';

export interface ChallengeRank {
  username: string;
  level: Level;
  best_score: number;
  best_time_ms: number;
  rank: number;
}

/** Record a finished game; the server keeps it only if it beats the player's best. */
export async function submitChallenge(level: Level, score: number, timeMs: number): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('submit_challenge', { p_level: level, p_score: score, p_time_ms: timeMs });
}

/** Top N players for a level, best score (then fastest) first. */
export async function getChallengeTop(level: Level, limit = 20): Promise<ChallengeRank[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('challenge_leaderboard')
    .select('username, level, best_score, best_time_ms, rank')
    .eq('level', level)
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as ChallengeRank[];
}

/** The current player's own rank for a level, or null if unranked / guest. */
export async function getMyChallengeRank(level: Level): Promise<ChallengeRank | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_challenge_rank', { p_level: level });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as ChallengeRank;
}
