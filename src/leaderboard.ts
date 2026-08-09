// Leaderboard reads/writes for Number Rules.

import { supabase } from './supabase';

export interface LeaderboardEntry {
  username: string;
  best_score: number;
  rank: number;
}

/**
 * Submit a finished-game score. The server keeps only the player's best, and
 * never lowers it. Returns the player's new best, or null if not logged in /
 * not configured.
 */
export async function submitScore(score: number): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('submit_score', { p_score: score });
  if (error) return null;
  return typeof data === 'number' ? data : null;
}

/** Top N players, best score first. */
export async function getTopScores(limit = 20): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leaderboard')
    .select('username, best_score, rank')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as LeaderboardEntry[];
}

/** The current player's own rank + best score, or null if unranked / guest. */
export async function getMyRank(): Promise<LeaderboardEntry | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_rank');
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as LeaderboardEntry;
}
