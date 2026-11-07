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
  detection. iOS also receives a Smart App Banner with this page's game URL.
- Safari same-domain navigation, embedded browsers, user link preferences and
  older app versions can retain the web page even when an app is installed.
  The LP keeps store links and explains opening in Safari/Chrome if needed.
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
  `8XR3LLAS54.com.pixapps.simplegames`, path `/simple-games/share/*` only.
- `/.well-known/assetlinks.json`: package `com.pixapps.simplegames`, Play app
  signing certificate SHA-256 supplied by the owner on 2026-11-08:
  `BF:0B:5A:52:D6:42:4E:74:5E:7A:76:10:45:D9:72:65:61:C5:C9:B3:5D:02:E3:F4:1E:AA:84:4D:09:7E:0A:7F`.
  This is the Play app signing certificate, not an upload or debug key.

1. Review both PRs together. Publish the landing and association files first.
2. Confirm both association files return HTTP 200 without redirects, the AASA
   has `application/json`, and a shared game page renders at its production URL.
3. Enable Associated Domains on the iOS App ID if needed and regenerate the
   release provisioning profile. The app already uses this capability for Club
   House; the new entitlement adds `pixapps.ai`.
4. Build and release updated iOS/Android apps through the existing release gates.
   Existing app binaries cannot gain these registrations from a website change.
5. After the landing is available, sync the updated Web build to change browser
   sharing too. The landing publish workflow refreshes its share catalog from
   the same source checkout. Do not ship new share URLs before their pages exist.

PR creation does not merge, publish, rotate signing keys or release a store build.

## Verification boundaries

Automated checks cover accepted/rejected URLs, cold/warm launch, replay, stale
IDs, unchanged shortcut behavior, Club House regression, manifests/entitlements
and localized share messages. Site checks cover generated HTML, metadata, QR
artifacts, mobile/desktop CTAs, language switching and no-JavaScript fallback.

Before a production release, verify with store-signed builds on actual iOS and
Android: link from Messages/Mail, cold and warm starts, no-install fallback,
Safari same-domain link, Chrome, and the messaging apps used for sharing. Check
Android domain verification with `adb shell pm get-app-links com.pixapps.simplegames`.
An unsigned build or simulated user agent does not prove OS domain verification.
