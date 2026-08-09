# Number Blitz

A fast-paced numeracy (mental-maths) arcade game for mobile, aimed at
**8–14 year olds**. Built with [Expo](https://expo.dev) and React Native +
TypeScript.

This is a **standalone product**, separate from the main Koloso app. It may be
incorporated into Koloso in the future, but it is developed, versioned, and
published independently.

## How it plays

- You get **30 seconds** on the clock.
- Solve as many arithmetic problems as you can before time runs out.
- ✅ **Correct** → adds time and builds your **combo multiplier** (bigger combo = more points per answer).
- ❌ **Wrong** → costs time and resets your combo.
- The maths gets **harder the longer your streak** (starts with + and −, then bigger numbers, then × and ÷) so it scales across the whole 8–14 range.
- Your **best score** is saved between plays.

## Code layout

```
App.tsx          # Screens (home / playing / game-over) and the game loop/timer
src/game.ts      # Pure logic: question generation, difficulty scaling, scoring
src/storage.ts   # Saves/loads the best score (AsyncStorage; localStorage on web)
assets/          # App icon, splash, adaptive icons
app.json         # Expo app configuration
```

The logic in `src/game.ts` is deliberately free of any React/React Native code
so it can be unit-tested and reused.

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
eas build --platform all     # cloud builds for iOS + Android
eas submit                   # upload to the stores
```

Apple Developer and Google Play Console accounts are needed before the first
submission.

## Ideas for later

- Sound effects and haptics on correct/wrong
- Tile "pop" animations and a countdown-urgency effect
- Daily challenge / shareable scores
- Choosable focus (e.g. "times tables only") and adjustable starting time
- Accessibility passes (screen-reader labels, larger-text support)
```
