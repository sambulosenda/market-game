Market Street is an Expo/React Native game. See README.md for the layout and the rules the code follows.

## Before writing Expo or React Native code

Expo ships breaking changes every SDK release (this project is on SDK 58, React Native 0.88, Skia 2.14, Reanimated 4, Gesture Handler 3). Check the versioned docs at `https://docs.expo.dev/versions/v58.0.0/` and the installed type definitions rather than memory. Notable: Skia paths are immutable (build them with `Skia.PathBuilder`), and gestures use the Gesture Handler 3 hooks (`usePanGesture`, `useTapGesture`).

## Commands

```bash
npx expo install <package>  # resolves SDK-compatible versions
npm test                    # vitest: core, content, store
npm run typecheck
npm run lint
```

Run lint, typecheck and tests before declaring a task done.

## Rules

- Game rules go in `src/core` with no React or native imports, and get unit tests.
- Balance numbers go in `src/content/data`, never in code.
- Player-facing text goes in `src/ui/strings.ts`.
- Never commit 1024px art or edit `assets/art` or `src/art/manifest.ts` by hand: run `npm run build:art`.
- Tappable things outside the canvas use `Bouncy` from `src/ui`.
- `ios/` and `android/` are generated (Continuous Native Generation) and gitignored. Configure native behaviour in `app.json` and config plugins.
