// Leaderboard reads/writes for Number Rules.
//
// Each game contributes its plus points and penalty (minus) points. The server
// accumulates cumulative totals per player; the leaderboard ranks by NET points
// (plus − minus) high→low, tie-broken by fewer penalty points (minus low→high).

import { supabase } from './supabase';

export interface LeaderboardEntry {
  username: string;
  total_plus: number;
  total_minus: number;
  net: number;
  rank: number;
}

/** Record a finished game's plus points and penalty points. */
export async function submitGame(plus: number, minus: number): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('submit_game', { p_plus: plus, p_minus: minus });
}

/** Top N players, best net first. */
export async function getTopScores(limit = 20): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leaderboard')
    .select('username, total_plus, total_minus, net, rank')
    .order('rank', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data as LeaderboardEntry[];
}

/** The current player's own rank + totals, or null if unranked / guest. */
export async function getMyRank(): Promise<LeaderboardEntry | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_rank');
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as LeaderboardEntry;
}
