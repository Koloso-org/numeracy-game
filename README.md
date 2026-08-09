# Number Rules

A fast number-sense game for mobile, aimed at **8–14 year olds**. Built with
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
- _Ends in 7_, _Digits add up to 12_, _An even number_, _Between 40 and 90_, …

At least one rule is true (sometimes all four are). Tap every rule you think is
true, then press **Submit**. Scoring per round:

- **+1** for each true rule you selected
- **−1** for each false rule you selected
- **−1** for each true rule you missed

You have **2 minutes** — score as many points as you can. Your best score is
saved between plays.

## Code layout

```
App.tsx          # Screens (home / playing / game-over), timer, round flow
src/rules.ts     # The rule engine: property factories, round generation, scoring
src/storage.ts   # Saves/loads the best score (AsyncStorage; localStorage on web)
assets/          # App icon, splash, adaptive icons
app.json         # Expo app configuration
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
