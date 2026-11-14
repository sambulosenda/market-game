# Market Street

A cozy idle mobile game: start with one bread stall on a quiet town square and grow it into a full street of shops. Expo + React Native + TypeScript, iOS and Android, no game engine.

This build is milestone 1: the bakery and the dairy, the order board, levels, the pantry, shop upgrades and the fountain to restore. Make goods, fill orders for coins and XP, and spend the coins on growing the street.

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
npm run build:art        # rebuild assets/art from the 1024px originals (see Art)
```

## Layout

| Folder | What lives there |
| --- | --- |
| `src/core` | The game rules. Pure TypeScript, no React: functions take a state and a timestamp and return a new state. |
| `src/content` | Content config as JSON (`data/`), its schema, and a loader that validates it and cross-checks references. No balance number is written in code. |
| `src/store` | A zustand store around the core that saves to MMKV after every change. |
| `src/scene` | The Skia street: scrolling, parallax, lots and in-scene indicators. |
| `src/art` | `manifest.ts` (generated) lists every image with its size in points; `index.ts` looks art up by good or shop id. |
| `src/ui` | React Native views on top of the canvas: the top bar, the order board, sheets and pop-ups, plus `strings.ts` for all player-facing text. |
| `src/ui/kit` | The interface kit: text, buttons, panels, the bottom sheet, pop-ups, toasts. Screens are built only from these. |
| `src/app` | Expo Router routes. |

## Art

The art is painted at 1024px, far bigger than the game draws it. The originals are not in git and never ship in the app. To rebuild the game's images, unzip the art archive into `art-src/` (gitignored) and run `npm run build:art`. The script:

- removes the faint haze left by background removal and trims each image to its artwork
- scales it to its size in points (set per group at the top of `scripts/build-art.mjs`) and writes `@2x` and `@3x` files to `assets/art`
- regenerates `src/art/manifest.ts`, and the app icon and splash in `assets/images`

Files are named by content id: `good_<goodId>`, `shop_<shopId>_l<level>`, `sign_<shopId>`. A test fails if a good or shop in the content has no art.

## Rules the code follows

- **Timestamps, not tickers.** A batch stores its start time and duration. Offline progress is worked out on resume. If the device clock moves backwards, the game holds at the latest time it has seen, so no progress is granted.
- **One versioned save.** The whole game state is one object with a `version`. A format change bumps `SAVE_VERSION` in `src/core/types.ts` and adds a migration to `MIGRATIONS` in `src/core/save.ts`. An unreadable save is kept aside under `save.unreadable.<time>`, never overwritten.
- **Content as data.** Durations, queue sizes and so on live in `src/content/data/*.json`. A broken file fails `npm test` with a message naming the file and field.
- **Effects never change the game.** Collected goods are in the pantry at once; the flying icons only delay when the counter shows them (`src/ui/fx`). With reduce motion on, they are skipped and only tap feedback remains.
- **Canvas below, views above.** The street is one screen-wide Skia canvas; panels are normal React Native views.

The product spec is the "Market Street: PRD and developer task breakdown" doc.
