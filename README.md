# Numeracy Game

A simple numeracy (mental-maths) game for mobile, built with [Expo](https://expo.dev) and React Native + TypeScript.

This is a **standalone product**, separate from the main Koloso app. It may be
incorporated into Koloso in the future, but it is developed, versioned, and
published independently.

## What it does (current MVP)

- Pick a difficulty (Easy / Medium / Hard).
- Answer a round of 10 multiple-choice arithmetic questions (+ − ×).
- Immediate correct/incorrect feedback, running score, and an end-of-round summary.

Game logic lives in `src/game.ts` (pure, framework-free functions) so it can be
unit-tested and reused. The UI lives in `App.tsx`.

## Getting started

```bash
npm install
npm start          # opens the Expo dev server
```

Then:

- Press `i` for the iOS simulator (macOS only), `a` for an Android emulator, or
- Scan the QR code with the **Expo Go** app on a physical device, or
- Press `w` to run in a web browser.

## Project structure

```
App.tsx        # Screens: home, playing, results
src/game.ts    # Question generation, scoring, difficulty config (pure logic)
assets/        # App icon, splash, adaptive icons
app.json       # Expo app configuration (name, slug, icons, platforms)
```

## Publishing (later)

Because this uses Expo, releasing to the App Store and Google Play is handled
via [EAS](https://docs.expo.dev/eas/):

```bash
npm install -g eas-cli
eas build --platform all     # cloud builds for iOS + Android
eas submit                   # upload to App Store Connect / Play Console
```

Store accounts (Apple Developer Program, Google Play Console) are needed before
the first submission.

## Roadmap ideas

- Per-question countdown timer and streak bonuses
- Persistent high scores (local storage)
- More operations (division, fractions) and adaptive difficulty
- Sound and haptics
- Accessibility passes (screen-reader labels, larger-text support)
