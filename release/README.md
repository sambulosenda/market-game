# Release

What a store submission needs that is not code.

| File | What it is |
| --- | --- |
| `../store.config.json` | The App Store listing: name, subtitle, description, keywords, categories, age rating answers and review notes. `eas metadata:push` sends it to App Store Connect. |
| `store-listing.md` | The Google Play listing text, the in-app products to create in both stores, and why the listing says what it says. |
| `privacy-labels.md` | The answers for Apple's App Privacy section, Google's Data safety form, the age rating forms and export compliance. |
| `screenshots.md` | Which screenshots to take, in what order, with captions and sizes. |
| `../docs/` | The public privacy policy, terms and support page, served by GitHub Pages. |

## Commands

```bash
npm run check:release                                   # what is still missing before a submission
npx eas-cli@latest init                                 # once: create the EAS project
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --profile production --platform ios   # uploads the build to TestFlight
npx eas-cli@latest metadata:push                        # sends store.config.json to App Store Connect
```

`eas submit` uploads a build to App Store Connect. It does not send the app to review: that is a button in App Store Connect, pressed by the account owner.

Build numbers live on EAS (`appVersionSource: remote`) and go up by one on every production build. The version players see is `version` in `app.json`; keep `package.json` and `store.config.json` the same, which `npm run check:release` checks.

## When something changes

- A new SDK that collects data (ads, attribution, sign-in): update `docs/privacy.md` and `privacy-labels.md` in the same pull request, then change the answers in both stores.
- A new native library: check whether it ships a `PrivacyInfo.xcprivacy` with required-reason APIs, and add any new reasons to `ios.privacyManifests` in `app.json`.
- A feature named in the listing is cut: remove it from `store.config.json`, `store-listing.md` and the support page. Apple rejects listings that describe features the build does not have.
