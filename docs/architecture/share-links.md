# Game sharing and native app links

Decision: 2026-11-08, product owner. Sharing should lead to an app download for a
new visitor and to the shared game for an existing user. This replaces the old
Web-only share destination, not the browser version or its ordinary links.

## URL contract

- Shared URL: `https://pixapps.ai/simple-games/share/<game-id>/`.
- Installed, supported app: iOS Universal Links / Android verified App Links
  deliver it to the app. An unavailable or retired game opens the collection.
  The site matches: it keeps a page for every id it ever published, and a
  retired id renders as the collection landing at its own address, without
  the game's name or artwork. An id that never had a page gets the same
  collection landing as `share/404.html` (HTTP 404). The landing repository's
  `docs/current/simple-games-share.md` owns those rules (pixapps-landing#239).
- A Web-only game (registry `channel: 'web-beta'`) is not in the app, and only
  the browser version can share it. Its share keeps the browser address
  `https://pixapps.ai/simple-games/play/?game=<game-id>` and the browser
  invitation (`shareInviteBrowser` / `shareChallengeBrowser`, the wording every
  share used until 1.8.3). The app's address would open an install landing for
  a game the app does not have. When the game graduates to the app, its shares
  switch to the share URL in the same build that offers it in the app.
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
  `8XR3LLAS54.com.pixapps.simplegames`, path `/simple-games/share/*` only.
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
   That includes the share landing gate below, for every release, not only this one.
5. After the landing is available, sync the updated Web build to change browser
   sharing too. The landing publish workflow refreshes its share catalog from
   the same source checkout. Do not ship new share URLs before their pages exist.

PR creation does not merge, publish, rotate signing keys or release a store build.

## Release gate

A native build shares the share URL for every registry game without a
`channel`. The site gets its pages from the landing's sync of the registry at
the ref the web was last published from, which can trail a release tag: a
game graduating from Web-only to the app is the usual case. Before a build is
installed anywhere (internal tracks and TestFlight included), run

```bash
pnpm --filter simple-games share:check --ref v<version>
```

`apps/simple-games/scripts/share-landing-check.mjs` reads `registry.ts` at the
tag with git and requests each game's production address as a recipient would.
Each must answer 200 itself, with no redirect, with that game's own page: HTML
carrying `data-game="<id>"` and no `class="availability"` sentence (the
landing's mark for "not in the app"). If it fails, publish the web build from
that tag first. It is release tooling outside `apps/*/src`, so the app's
no-network rule does not cover it, and the app never runs it.
`docs/RELEASE_CHECKLIST.md` §7 lists it.

## Coupling with the landing

The landing repository's `scripts/sync-simple-games-share.js` reads two things
in this repository at the published ref that no import graph shows:

- `apps/simple-games/src/app/registry.ts`, parsed with the TypeScript compiler
  and never executed. `GAMES` must be initialized with an array literal of
  object literals, and each entry's `id`, `title`, `glyph` and optional
  `channel` must be plain string literals. A spread, a computed title or a
  helper that builds entries would make the sync fail, or read a Web-only
  game as an app game.
- `apps/simple-games/src/services/gameArtworkImage.ts`, loaded through Vite with
  jsdom globals. It calls `gameArtworkSvg(id)` for every game that is not
  `in-development` and keeps the SVG only when it is self-contained: no
  `var(`, `currentColor`, scripts, `foreignObject`, event handlers or `href`.

`apps/simple-games/src/test/shareLanding.test.ts` pins both. It parses the
registry with the release gate's reader and compares the result with the
running `GAMES`, and it checks every published game's artwork against the
landing's rules. Change the landing's sync before changing either shape here.

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
