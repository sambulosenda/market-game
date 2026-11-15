# Screenshot plan

## What the stores need

| Store | Size | Count |
| --- | --- | --- |
| App Store, iPhone 6.9 inch | 1320 x 2868, portrait, PNG or JPEG with no transparency | 3 to 10. Plan: 6 |
| Google Play, phone | 1080 x 1920, 9:16, PNG or JPEG. The long side may be at most twice the short side. | 2 to 8. Plan: the same 6 scenes, captured again |
| Google Play, feature graphic | 1024 x 500 | 1 |

The iPhone 17 Pro Max takes screenshots at exactly 1320 x 2868, so screenshots taken on the test phone can be uploaded as they are. Apple scales the 6.9 inch set down for smaller iPhones. The app does not support iPad (`supportsTablet: false`), so no iPad screenshots are needed.

The iPhone captures cannot be reused for Google Play as they are: 1320 x 2868 is taller than Play's 2:1 limit. Take the Play set on an Android phone or emulator at 1080 x 1920, or place each iPhone capture on a 1080 x 1920 framed canvas.

## The six shots

The first three show in search results before anyone opens the page, so they carry the pitch: what you do, what you build, and that it is calm.

| # | Caption | What is on screen | How to set it up |
| --- | --- | --- | --- |
| 1 | Grow a street of cozy shops | The street with all five shops open at level 2 or 3, customers walking and queuing, a restored fountain in view | A late-game save, around level 20 |
| 2 | Bake, make and collect | The bakery sheet open with a full queue, one batch ready to collect | Any save with the bakery upgraded |
| 3 | Fill orders for the whole town | The order board with three orders, one ready to fill | Stock the pantry first so a Fill button is lit |
| 4 | Bring the square back to life | The clock tower sheet half restored, or the moment a landmark stage completes | Level 12 or later |
| 5 | Come back to full shelves | The welcome back pop-up listing what was made while away | Queue goods, close the game for an hour, reopen |
| 6 | Little goals every day | The daily goals sheet with the login calendar, two goals ticked | Any save, mid-day |

Rules for every shot:

- Take them from the production build, not a development build, so no debug overlay or developer menu shows.
- Status bar: full battery, full signal, time 9:41. On a simulator: `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4`.
- Hide the tutorial arrow and any toast.
- Show only things the build has. A screenshot of a feature that is not in the build is a rejection.
- Do not show prices in screenshots. They differ by country.

## Framing

Version 1.0 can ship with plain full-screen captures: the game's art is the selling point and it fills the screen. If there is time, put each capture on the game's cream background (`#FBE3B5`) with the caption above it in the game's heading font, phone at about 85 percent width. The captions above are written to fit one line at that size.

## Feature graphic for Google Play

1024 x 500: the street background with the bakery, the café and the fountain, and the words "Market Street" on the left third. Keep the outer 15 percent clear of text, because Play crops it on some screens. It can be composed from the 1024px art originals with a script like `scripts/build-art.mjs`.

## In-app purchase review screenshot

Apple asks for one screenshot per in-app product, used only by the reviewer. One capture of the gem shop showing all four products works for all of them.
