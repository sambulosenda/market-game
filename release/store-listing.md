# Store listing

The App Store text is in `store.config.json`. This file holds the rest.

## Name

The game is "Market Street" on the home screen. The store name is **Market Street: Cozy Shops**, because App Store names must be unique and "Market Street" alone is unlikely to be free. The name is reserved when the app record is created in App Store Connect, so that is the moment to find out. Fallbacks, in order: "Market Street: Idle Bakery", "Market Street: Cozy Idle Town".

The keywords use "cosy" because the name already covers "cozy" and "shop", and Apple indexes the name, subtitle and keywords together. Repeating a word wastes the 100 characters.

## Google Play

| Field | Limit | Text |
| --- | --- | --- |
| App name | 30 | Market Street: Cozy Shops |
| Short description | 80 | Bake, fill orders and grow one bread stall into a whole street of cozy shops. |
| Full description | 4000 | The App Store description from `store.config.json`, unchanged. |
| Category | | Games, Simulation |
| Tags | | Idle, Casual, Tycoon |
| Contact email | | The support address from `docs/_config.yml` |
| Privacy policy | | https://sambulosenda.github.io/market-game/privacy/ |

Google Play also needs a 512x512 icon (export `assets/images/icon.png` at half size) and a 1024x500 feature graphic (see `screenshots.md`).

## In-app products

All four are consumable or one-time purchases through RevenueCat. Create them with these IDs in App Store Connect and in Google Play so the app can use one set of IDs.

| Product ID | Type | Reference name | UK price | Display name | Description |
| --- | --- | --- | --- | --- | --- |
| `marketstreet.starter_bundle` | Non-consumable | Starter bundle | £2.99 | Starter Bundle | A one-time welcome pack of gems and coins. |
| `marketstreet.gems_small` | Consumable | Gems small | £1.99 | Pouch of Gems | A small pouch of gems. |
| `marketstreet.gems_medium` | Consumable | Gems medium | £4.99 | Jar of Gems | A jar of gems. Better value. |
| `marketstreet.gems_large` | Consumable | Gems large | £9.99 | Chest of Gems | A chest of gems. Best value. |

The gem amounts are balance values and belong in `src/content/data`, so the store text does not state them.

The starter bundle is non-consumable so that Restore purchases can bring it back. The gem packs are consumable and are not restored: gems already granted come back with the saved game.

Each product needs, in App Store Connect: the display name and description above, a price, and one review screenshot showing the product in the gem shop. The first products must be attached to the version when it is submitted for review, or they stay in "Ready to submit" and purchases fail in the live app.

## Claims the build must keep true

The listing says these things. If one stops being true, change the listing first.

- 5 shops, 40 goods, 3 landmarks, 25 levels
- Customers who tip when tapped
- Daily goals and a login calendar where a missed day does not reset progress
- Notifications are optional, at most two a day, none at night
- Plays offline
- No adverts
- Everything can be earned by playing
