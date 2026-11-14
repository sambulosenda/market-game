# Market Street

A cozy idle mobile game: start with one bread stall on a quiet town square and grow it into a full street of shops. Expo + React Native + TypeScript, iOS and Android, no game engine.

This first build is the core loop only: one bakery on the street with placeholder art. Bake, close the app, come back, collect.

## Run it on an iPhone

The game uses native modules (Skia, MMKV), so it runs in a **development build**, not Expo Go.

With a Mac, Xcode and an iPhone plugged in (or on the same Wi-Fi with developer mode on):

```bash
npm install
npx expo run:ios --device   # pick the iPhone; Xcode signs with your team
```

Or build in the cloud with EAS and install from a link:

```bash
npx eas-cli@latest build --profile development --platform ios
npm start                   # then open the dev build on the phone
```

## Commands

```bash
npm test                 # unit tests for the game core, saves, content and store
npm run typecheck
npm run lint
npm run validate:content # just the content config checks
```

## Layout

| Folder | What lives there |
| --- | --- |
| `src/core` | The game rules. Pure TypeScript, no React: functions take a state and a timestamp and return a new state. |
| `src/content` | Content config as JSON (`data/`), its schema, and a loader that validates it and cross-checks references. No balance number is written in code. |
| `src/store` | A zustand store around the core that saves to MMKV after every change. |
| `src/scene` | The Skia street: scrolling, parallax, lots, placeholder art and in-scene indicators. |
| `src/ui` | React Native views on top of the canvas, plus `strings.ts` for all player-facing text. |
| `src/app` | Expo Router routes. |

## Rules the code follows

- **Timestamps, not tickers.** A batch stores its start time and duration. Offline progress is worked out on resume. If the device clock moves backwards, the game holds at the latest time it has seen, so no progress is granted.
- **One versioned save.** The whole game state is one object with a `version`. A format change bumps `SAVE_VERSION` in `src/core/types.ts` and adds a migration to `MIGRATIONS` in `src/core/save.ts`. An unreadable save is kept aside under `save.unreadable.<time>`, never overwritten.
- **Content as data.** Durations, queue sizes and so on live in `src/content/data/*.json`. A broken file fails `npm test` with a message naming the file and field.
- **Canvas below, views above.** The street is one screen-wide Skia canvas; panels are normal React Native views.

The product spec is the "Market Street: PRD and developer task breakdown" doc.
