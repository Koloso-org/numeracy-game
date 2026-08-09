# Project status — where things stand

_Last updated: 2026-08-09_

## What this is

**Number Rules** — a standalone numeracy game (Expo / React Native + TypeScript),
separate from the main Koloso app. Repo: `Koloso-org/numeracy-game`, branch `main`.

## The game — built & verified ✅

- 2-minute round. Each turn shows a 2–3 digit number and **4 rules**; the player
  taps every rule that's true, then submits.
- Scoring: **+1** per true rule picked, **−1** per false rule picked, **−1** per
  true rule missed.
- 14 rule types, including **"Square root of X"** and **"A factor of Y"**.
  Difficulty is pitched at upper-primary / lower-secondary; playable at any age.
- Rule logic independently verified over **60,000 generated rounds** (zero errors).
- Code: `App.tsx` (screens/timer), `src/rules.ts` (engine), `src/storage.ts`
  (local best score).

## Accounts & leaderboard — built; needs a live run to verify ⏳

- Backed by **Supabase** (Postgres + Auth).
- Login is **username + 6-digit PIN**, with **no email / no personal data**.
  Guest play is also supported.
- Code: `src/supabase.ts`, `src/auth.ts`, `src/leaderboard.ts`,
  `src/screens/AccountScreen.tsx`, `src/screens/LeaderboardScreen.tsx`.
- Database: `supabase/schema.sql` (profiles table, ranked leaderboard view, Row
  Level Security, `submit_score` / `my_rank` functions; hardened per Supabase's
  Security Advisor).
- Keys are read from `.env` (`EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`). `.env` is git-ignored — see `.env.example`.

## Supabase project — done by the owner ✅ (one item to confirm)

- Project created (ref `vdmowfyufftvlhltqmrg`); `schema.sql` + hardening SQL run
  successfully.
- **Minimum password length is 6** (Supabase's floor) → that's why PINs are 6 digits.
- **To confirm on a live run:** in Supabase → Authentication → Sign In / Providers
  → **Email**, ensure **Enable email provider = ON** and **Confirm email = OFF**.
  (These couldn't be tested from the build sandbox — see note below.)

## What's left to go live

1. **Run it on a machine/phone with normal internet** (see `docs/SETUP.md`):
   `npm install` → create `.env` with the two keys → `npm start` → open in the
   **Expo Go** app or a simulator.
2. **Create the first account in-app** (e.g. `jb45` + a 6-digit PIN). If login
   fails with *"Email not confirmed"*, flip **Confirm email → OFF** in Supabase
   and try again.
3. **Confirm** the leaderboard fills and ranks display.
4. **Publish** to the App Store / Google Play via **EAS** (`eas build` /
   `eas submit`) — needs Apple Developer + Google Play accounts. Future step.

## Note on the build sandbox

The environment this was developed in has a strict egress policy that **blocks
`supabase.co` and Expo's cloud servers**. That's why the live sign-up → score →
leaderboard round-trip, and any EAS build, must be run from the owner's own
machine (or a differently-configured environment) rather than from here. It is a
property of the build sandbox only — it does not affect the shipped app.
