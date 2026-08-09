# Number Rules

A fast number-sense game for mobile. Playable at **any age**, with question
difficulty pitched at **upper-primary / lower-secondary** level. Built with
[Expo](https://expo.dev) and React Native + TypeScript.

This is a **standalone product**, separate from the main Koloso app. It may be
incorporated into Koloso in the future, but it is developed, versioned, and
published independently.

## How it plays

Each round shows a 2- or 3-digit number and **four rules** (properties), such as:

- _Divisible by 3_
- _Greater than 50_
- _Equal to 14 + 5_
- _A perfect square_
- _Square root of 144_ (is the number the square root of 144?)
- _A factor of 96_ (does the number divide 96?)
- _Ends in 7_, _Digits add up to 12_, _An even number_, _Between 40 and 90_, …

At least one rule is true (sometimes all four are). Tap every rule you think is
true, then press **Submit**. Scoring per round:

- **+1** for each true rule you selected
- **−1** for each false rule you selected
- **−1** for each true rule you missed

You have **2 minutes** — score as many points as you can.

## Accounts & leaderboard

Players can compete on a shared **leaderboard**. Sign-in is deliberately
minimal — a **username + numeric PIN**, with **no email and no personal data**
collected (a good fit for a game played by children). Anyone can also **play as
a guest** without an account.

The leaderboard is backed by [Supabase](https://supabase.com) (Postgres + Auth).
The backend is configured via environment variables and a one-time SQL script —
see **[docs/SETUP.md](docs/SETUP.md)** and **[supabase/schema.sql](supabase/schema.sql)**.
Your best score is also saved locally on the device.

## Code layout

```
App.tsx                       # Home / playing / game-over screens, timer, round flow
src/rules.ts                  # Rule engine: property factories, round generation, scoring
src/storage.ts                # Local best score (AsyncStorage; localStorage on web)
src/theme.ts                  # Shared colour palette
src/supabase.ts               # Supabase client (reads keys from env)
src/auth.ts                   # Username + PIN auth (no personal data)
src/leaderboard.ts            # Submit score / fetch top scores / fetch my rank
src/screens/AccountScreen.tsx # Log in / sign up / play as guest
src/screens/LeaderboardScreen.tsx
supabase/schema.sql           # Database tables, security rules, functions
docs/SETUP.md                 # One-time backend setup
assets/                       # App icon, splash, adaptive icons
app.json                      # Expo app configuration
```

`src/rules.ts` is deliberately free of any React/React Native code so it can be
unit-tested and reused. Adding a new rule = adding one factory to the
`FACTORIES` list.

## Run it

```bash
npm install
npm start          # opens the Expo dev server
```

Then press `i` (iOS simulator, macOS only), `a` (Android emulator), `w` (web),
or scan the QR code with the **Expo Go** app on a real phone.

## Publishing (later)

Because this uses Expo, releasing to the App Store and Google Play is done via
[EAS](https://docs.expo.dev/eas/):

```bash
npm install -g eas-cli
eas build --platform all
eas submit
```

Apple Developer and Google Play Console accounts are needed before the first
submission.

## Ideas for later

- Difficulty levels (which rule types appear, number size)
- More rule types (prime, square/cube, factors, rounding, place value)
- Sound and haptics; a per-round timer-pressure feel
- Daily challenge and shareable scores
- Accessibility passes (screen-reader labels, larger-text support)
```
