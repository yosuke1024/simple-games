# Game sharing and native app links

Decision: 2026-11-08, product owner. Sharing should lead to an app download for a
new visitor and to the shared game for an existing user. This replaces the old
Web-only share destination, not the browser version or its ordinary links.

## URL contract

- Shared URL: `https://pixapps.ai/simple-games/share/<game-id>/`.
- Installed, supported app: iOS Universal Links / Android verified App Links
  deliver it to the app. An unavailable or retired game opens the collection.
- Otherwise: pixapps-landing serves a static install landing. Game names come
  from the registry, illustrations from the app's existing collection artwork,
  and one template generates the HTML and QR codes. The initial language is
  Japanese for a Japanese preferred browser language, English otherwise. There is
  no screenshot upload, per-request server, personal result, seed or sender ID.
- The collection fallback is `https://pixapps.ai/simple-games/share/`.
- Ordinary `/simple-games/`, `/play/`, guides and policy URLs stay in the browser.
  Existing launcher shortcuts continue using their private `/play/?game=` data.
- The LP's explicit **Open in app** fallback is
  `com.pixapps.simplegames://share/<game-id>` on iOS. Android uses an intent for
  the canonical HTTPS URL, restricted to `com.pixapps.simplegames`, falling back
  to Google Play. No automatic scheme probes, timer redirects or installed-app
  detection. iOS also receives a Smart App Banner with this page's game URL
  (except on the pages of titles the iOS app does not offer — see below).
- Safari same-domain navigation, embedded browsers, user link preferences and
  older app versions can retain the web page even when an app is installed.
  The LP keeps store links and explains opening in Safari/Chrome if needed.
- App versions up to 1.8.3 register neither the share paths nor the custom
  scheme. On such an iPhone, **Open in app** ends in Safari's invalid-address
  alert, so the LP's help text also says to update the app from the store.
- Install → first launch does **not** automatically remember the shared game.
  Reopening the original link after installing is the first-version behavior.

## App behavior

`nativeGameLink.ts` validates the exact scheme, authority and path before the
native startup / `appUrlOpen` handler navigates. Arbitrary hosts, credentials,
ports, malformed paths, fragments and conflicting game parameters are ignored.
A valid but unavailable game target is distinct from an unrelated URL: only the
former navigates to the collection. This applies to warm and cold starts.

The existing game entry is reused, including its normal resume behavior. The
link does not restart a board, load a sender's position, join a club, send
telemetry or grant anything. A replay of the same link while its game is visible
is a no-op. Club House `/join` associations and handling are preserved.

## Website association and rollout

The site PR adds the following to existing files, preserving PixWork entries:

- `/.well-known/apple-app-site-association`: app ID
  `8XR3LLAS54.com.pixapps.simplegames`, path `/simple-games/share/*` only
  (from 2026-11-11 minus the share paths of titles the iOS app does not offer — below).
- `/.well-known/assetlinks.json`: package `com.pixapps.simplegames`, Play app
  signing certificate SHA-256 supplied by the owner on 2026-11-08:
  `BF:0B:5A:52:D6:42:4E:74:5E:7A:76:10:45:D9:72:65:61:C5:C9:B3:5D:02:E3:F4:1E:AA:84:4D:09:7E:0A:7F`,
  and the upload key that signs the CI release APK:
  `B8:D4:B9:44:09:76:F2:93:85:95:3F:B3:AF:5F:6F:58:99:C3:AC:03:62:4F:F5:64:5F:45:57:E6:96:76:08:C6`.
  The same two fingerprints as club.pixapps.ai's file, so every build that
  verifies one host verifies the other. Never a debug key.

1. Review both PRs together. Publish the landing and association files first.
2. Confirm both association files return HTTP 200 without redirects, the AASA
   has `application/json`, and a shared game page renders at its production URL
   for every game id the native build can share. Then confirm Apple's CDN copy,
   `https://app-site-association.cdn-apple.com/a/v1/pixapps.ai`, contains
   `8XR3LLAS54.com.pixapps.simplegames`: devices read that copy, not the origin,
   and Apple caches it for hours.
   **No build with these registrations may be installed anywhere — internal test
   tracks and TestFlight included — before this step passes.** Android verifies
   App Links only at install and update (background re-verification starts with
   Android 15). On Android 11 and lower the app counts as verified only when
   every autoVerify host verifies, so an install made while pixapps.ai lacks the
   entry also loses the Club House `club.pixapps.ai/join` links, until the next
   app update.
3. Enable Associated Domains on the iOS App ID if needed and regenerate the
   release provisioning profile. The app already uses this capability for Club
   House; the new entitlement adds `pixapps.ai`.
4. Build and release updated iOS/Android apps through the existing release gates.
   Existing app binaries cannot gain these registrations from a website change.
5. After the landing is available, sync the updated Web build to change browser
   sharing too. The landing publish workflow refreshes its share catalog from
   the same source checkout. Do not ship new share URLs before their pages exist.

PR creation does not merge, publish, rotate signing keys or release a store build.

## Titles the iOS app does not offer

Decision: 2026-11-11, product owner, from iOS 1.8.5. App Review rejected iOS
1.8.4 on 2026-11-10 under guideline 2.3.6: simulated-gambling apps are accepted
only from organisation accounts, and this app is published from an individual
one. While that holds, the iOS app leaves out simulated-gambling titles — today
Blackjack and Texas Hold'em, marked `unavailableOn: 'ios'` in the registry
([PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「iOS で出さないタイトル」).
The Android app and the browser version keep them, so Android and Web users
still share `/simple-games/share/blackjack/` and `/simple-games/share/texas-holdem/`.

- **Landing.** These two pages carry, for every visitor, a static note that the
  game is in the Android app and the browser version but not in the iPhone/iPad
  app, a link to play it in the browser version, and a title and description
  that name the Android app or the browser rather than "the app". This is the one
  exception to "no browser play button on a share page". They carry no Smart App
  Banner. On iPhone and iPad the page also hides the store badges, **Open in
  app** and the app pitch, and the browser link becomes the primary action.
  Android visitors keep Google Play as the primary badge and **Open in app**.
- **Association.** The AASA stops claiming these two share paths, so an iPhone
  with the app installed opens the page in Safari instead of the app. Apple's
  CDN copy must show the change before the iOS build goes to review.
  `assetlinks.json` is unchanged: Android still opens these links in the app.
- **Catalog.** The landing's share sync reads `unavailableOn` from the
  registry entry (a string literal there) into `availableOnIos`. It is never a
  `channel` value: that would mark the title unavailable in every app, including
  Android.
- **Order.** The app change reaches main first; the landing PR then re-syncs its
  catalog from that commit, is published from its branch and merged; Apple's CDN
  is checked; only then does the iOS build go to review. The landing derives the
  AASA exclusions it expects from the catalog, so a publish from an app ref
  without the field fails its tests instead of silently restoring the two titles
  on iOS.
- **App.** If such a link still reaches the iOS app (an association cached on the
  device, or the custom scheme `com.pixapps.simplegames://share/<id>`),
  `nativeGameLink.ts` resolves it through the same availability gate and opens the
  collection, as for any unavailable game. Nothing in-app names the title.

## Verification boundaries

Automated checks cover accepted/rejected URLs, cold/warm launch, replay, stale
IDs, unchanged shortcut behavior, Club House regression, manifests/entitlements
and localized share messages. Site checks cover generated HTML, metadata, QR
artifacts, mobile/desktop CTAs, language switching and no-JavaScript fallback.

Before a production release, verify with store-signed builds on actual iOS and
Android: link from Messages/Mail, cold and warm starts, no-install fallback,
Safari same-domain link, Chrome, and the messaging apps used for sharing. Check
Android domain verification with `adb shell pm get-app-links com.pixapps.simplegames`
(Android 12 and later) or `adb shell dumpsys package d` (Android 11 and lower), for
both pixapps.ai and club.pixapps.ai.
An unsigned build or simulated user agent does not prove OS domain verification.
