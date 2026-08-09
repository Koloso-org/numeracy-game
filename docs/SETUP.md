# Backend setup (Supabase) — leaderboard & accounts

The game runs fine with no backend (guest play, local best score). To turn on
the **shared leaderboard** and **username/PIN accounts**, connect it to a free
Supabase project. This takes a few minutes and only has to be done once.

## 1. Create a Supabase project

1. Go to <https://supabase.com> and sign up / log in (free tier is fine).
2. Click **New project**. Give it a name (e.g. `number-rules`), set a database
   password (save it somewhere — it's separate from the game), pick a region
   near your players, and create it. Wait ~1–2 minutes for it to provision.

## 2. Create the database tables

1. In the project, open **SQL Editor** (left sidebar) → **New query**.
2. Open [`supabase/schema.sql`](../supabase/schema.sql) from this repo, copy its
   entire contents, paste into the editor, and click **Run**.
   You should see "Success. No rows returned."

This creates the `profiles` table, the leaderboard view, security rules, and the
`submit_score` / `my_rank` functions.

## 3. Allow short PINs and skip email confirmation

Because we use a numeric PIN as the password and a synthetic (never-emailed)
address:

1. Go to **Authentication** → **Sign In / Providers** → **Email**.
2. Set **Minimum password length** to `4` (so 4-digit PINs work).
3. Turn **Confirm email** **OFF** (no real emails are ever sent).
4. Save.

## 4. Copy your two keys into the app

1. Go to **Project Settings** → **API**.
2. Copy the **Project URL** and the **anon / public** API key.
3. In the repo, copy `.env.example` to `.env` and paste them in:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

   `.env` is git-ignored, so these never get committed. The anon key is safe to
   ship in the app; the database is protected by the security rules from step 2.
   **Never** put the `service_role` key in the app.

4. Restart the Expo dev server (`npm start`) so it picks up the new values.

That's it — the **Log in / Sign up** and **Leaderboard** screens are now live.
Create the first account (e.g. username `jb45`, PIN `4582`) right in the app.

## How security works (quick summary)

- Passwords/PINs are **hashed by Supabase Auth** — never stored in plaintext,
  not even we can read them.
- **Row Level Security** means the app (using the public anon key) can read the
  leaderboard but can only ever raise *your own* score, via the `submit_score`
  function — nobody can overwrite someone else's score.
- **No personal data** is stored: a profile is just a username + best score.
