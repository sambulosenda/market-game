# Privacy, age rating and compliance answers

These answers describe the launch build: PostHog for analytics, Sentry for crash reports, RevenueCat for purchases, Supabase for anonymous cloud save, local notifications, no adverts, no account, no advertising identifier. If one of those services is not in the build that ships, drop its rows here and in `docs/privacy.md`.

The answers say "not linked to the user" because the only identifier is a random ID per installation and the game never collects a name, email address or other contact detail. That stops being true the day the game adds sign-in with Apple, Google or email.

## Apple: App Privacy

"Do you or your third-party partners collect data from this app?" **Yes.**

| Data type | Collected | Purposes | Linked to the user | Used for tracking | Comes from |
| --- | --- | --- | --- | --- | --- |
| Identifiers: User ID | Yes | App Functionality, Analytics | No | No | Supabase, RevenueCat and PostHog installation IDs |
| Purchases: Purchase History | Yes | App Functionality, Analytics | No | No | RevenueCat |
| User Content: Gameplay Content | Yes | App Functionality | No | No | Supabase cloud save |
| Usage Data: Product Interaction | Yes | Analytics | No | No | PostHog |
| Diagnostics: Crash Data | Yes | App Functionality | No | No | Sentry |
| Diagnostics: Performance Data | Yes | App Functionality | No | No | Sentry |

Everything else: **not collected**. That includes Contact Info, Location (the country is derived from the IP address and the address is not stored, which Apple does not count as collecting location), Device ID (the game does not read the advertising identifier or the vendor identifier), Contacts, Photos, Health, Financial Info, Browsing History and Search History.

Tracking: **No.** The app does not show the App Tracking Transparency prompt and must not include `NSUserTrackingUsageDescription`.

For this to stay true, the build needs: PostHog set to discard the client IP address (a project setting in PostHog), no session replay, and Sentry set not to send default personal data (`sendDefaultPii: false`).

## Google Play: Data safety

- Does the app collect or share any of the required user data types? **Yes.**
- Is all of the data encrypted in transit? **Yes.**
- Do you provide a way for users to request that their data is deleted? **Yes.** In the app (Settings, Delete my data) and by email. Deletion URL: https://sambulosenda.github.io/market-game/support/

| Data type | Collected | Shared | Processed ephemerally | Required | Purposes |
| --- | --- | --- | --- | --- | --- |
| Personal info: User IDs | Yes | No | No | Required | App functionality, Analytics |
| Financial info: Purchase history | Yes | No | No | Required | App functionality, Analytics |
| App activity: App interactions | Yes | No | No | Required | Analytics |
| App activity: Other user-generated content (the saved game) | Yes | No | No | Required | App functionality |
| App info and performance: Crash logs | Yes | No | No | Required | App functionality |
| App info and performance: Diagnostics | Yes | No | No | Required | App functionality |

"Shared" is No because Google does not count data sent to service providers that process it on the developer's behalf.

Other Play Console declarations:

- Ads: **No, the app does not contain ads.**
- Target audience: **13 and over.** Do not tick any age group under 13. That would put the game under the Families policy, which the analytics setup does not meet.
- Advertising ID: **No.** The Android manifest must not include `com.google.android.gms.permission.AD_ID`.
- App access: all functionality is available without special access.
- News app, health app, financial features, government app: **No.**

## Age rating

Apple: every content question is **None**, no gambling, no unrestricted web access, not in the Kids category. The newer in-app controls and capabilities questions: no messaging or chat, no user-generated content, no advertising, no parental controls, no age assurance. Result: **4+**. The content answers are in `store.config.json`.

Google (IARC questionnaire): category **Game**. Violence, fear, sexuality, gambling, language, controlled substances, crude humour: **No**. Users can interact or exchange content: **No**. Shares the user's location: **No**. Digital purchases: **Yes**. Random paid items (loot boxes): **No**. Expected result: **PEGI 3, Everyone**.

## Other compliance

| Question | Answer |
| --- | --- |
| Export compliance (Apple) | The app uses only standard HTTPS, which is exempt. `app.json` declares `usesNonExemptEncryption: false`, so App Store Connect does not ask on each build. |
| Content rights (Apple) | The app does not contain or access third-party content. All art, text and audio is original or licensed. Keep the licence for each audio file. |
| Advertising identifier (Apple) | Not used. |
| Digital Services Act trader status (Apple, for the EU) | The account holder declares this. Someone who earns money from an app is normally a trader, and Apple then shows a contact address, phone number and email on the EU listing. Without a declaration the app cannot be sold in the EU. |
| Government or regulated content | None. |
