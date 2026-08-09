// Username + PIN authentication for Number Rules.
//
// We deliberately collect NO personal data (no email, no real name) — a good
// fit for a game played by 8–14 year olds. Under the hood we use Supabase's
// email/password auth, mapping the username to a synthetic, non-routable address
// and using the numeric PIN as the password (which Supabase stores hashed).

import { supabase } from './supabase';

// Synthetic login-email domain — no mail is ever sent here. Supabase requires a
// REAL, mail-capable domain (it rejects made-up ones), so this must be a domain
// you own. Override it with EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN in .env.
const EMAIL_DOMAIN = process.env.EXPO_PUBLIC_LOGIN_EMAIL_DOMAIN ?? 'koloso.app';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
// Supabase Auth enforces a minimum password length of 6, so PINs are 6+ digits.
export const PIN_MIN = 6;
export const PIN_MAX = 10;

export interface AuthResult {
  ok: boolean;
  /** Human-readable message on failure. */
  error?: string;
}

/** Lowercased username restricted to letters, numbers and underscores. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MIN}–${USERNAME_MAX} characters.`;
  }
  if (!/^[a-z0-9_]+$/.test(username)) {
    return 'Use only letters, numbers and underscores.';
  }
  return null;
}

export function validatePin(pin: string): string | null {
  if (!/^\d+$/.test(pin)) return 'PIN must be numbers only.';
  if (pin.length < PIN_MIN || pin.length > PIN_MAX) {
    return `PIN must be ${PIN_MIN}–${PIN_MAX} digits.`;
  }
  return null;
}

function usernameToEmail(username: string): string {
  return `${username}@${EMAIL_DOMAIN}`;
}

/** Create a new account with a username + PIN. */
export async function signUp(rawUsername: string, pin: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Leaderboard is not set up yet.' };
  const username = normalizeUsername(rawUsername);
  const uErr = validateUsername(username);
  if (uErr) return { ok: false, error: uErr };
  const pErr = validatePin(pin);
  if (pErr) return { ok: false, error: pErr };

  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password: pin,
    options: { data: { username } },
  });
  if (error) {
    // Most common case: the synthetic email already exists.
    if (/already/i.test(error.message)) {
      return { ok: false, error: 'That username is taken — try another.' };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** Log in to an existing account. */
export async function signIn(rawUsername: string, pin: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'Leaderboard is not set up yet.' };
  const username = normalizeUsername(rawUsername);
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password: pin,
  });
  if (error) return { ok: false, error: 'Wrong username or PIN.' };
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** The current player's username, or null if playing as a guest. */
export async function currentUsername(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata as { username?: string } | undefined;
  return meta?.username ?? null;
}
