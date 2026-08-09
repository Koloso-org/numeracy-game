// Thin wrapper around AsyncStorage for persisting the player's best score.
// Works on native (Expo Go / device) and on web (falls back to localStorage
// automatically inside AsyncStorage).

import AsyncStorage from '@react-native-async-storage/async-storage';

const HIGH_SCORE_KEY = 'numberBlitz.highScore';

export async function loadHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(HIGH_SCORE_KEY);
    const value = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

/** Persists `score` only if it beats the stored best. Returns the new best. */
export async function saveHighScore(score: number): Promise<number> {
  try {
    const best = await loadHighScore();
    if (score > best) {
      await AsyncStorage.setItem(HIGH_SCORE_KEY, String(score));
      return score;
    }
    return best;
  } catch {
    return score;
  }
}
