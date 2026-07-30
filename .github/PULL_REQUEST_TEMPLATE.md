<!--
日本語で書いていただいて構いません / Japanese is welcome.
This app is already installed on real devices, and its promises are meant to be
verifiable in the source. Please confirm the boxes below rather than assuming.
-->

## What this changes

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- What problem does it solve for a player? -->

## Checks

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
- [ ] `bash .github/scripts/check-principles.sh` passes
- [ ] Behaviour matches the game's rule document (`docs/*_RULES.md`), or that
      document is updated in this PR

## Promises this touches

Tick only what applies, and say how you verified it. **Leave unverified boxes
unticked** — an unverified check is worse than a missing one
([docs/PRODUCT_PRINCIPLES.md](../docs/PRODUCT_PRINCIPLES.md)).

- [ ] **Saved data** — existing players keep their progress and personal bests
      (schema version bumped and migrated; `compatibility.test.ts` untouched, or
      the change to it is explained below)
- [ ] **Offline** — everything still works with no network, and no request is
      made while offline ([docs/OFFLINE_POLICY.md](../docs/OFFLINE_POLICY.md))
- [ ] **Ads** — still one banner and nothing else; no feature is behind an ad
      ([docs/ADS_POLICY.md](../docs/ADS_POLICY.md))
- [ ] **Purchases** — still exactly one product (ad removal); no game feature
      differs between paying and non-paying players
- [ ] **New persisted key** — registered in `app/registry.ts` `storageKeys`, so
      "Reset Local Data" really deletes it
- [ ] **i18n** — all 14 locales have the key; purchase / restore / deletion /
      privacy strings are not machine-translated
      ([docs/I18N_POLICY.md](../docs/I18N_POLICY.md))
- [ ] **Low-spec floor** — no API or syntax above the supported floor
      (es2018 / Chromium 88): no `structuredClone`, no reliance on `inert` alone
- [ ] **Android** — permissions unchanged; signing material and production ad
      unit IDs are not in the diff

## Device check

<!--
Say what you actually ran on. "Not run" is an acceptable answer; a wrong claim
is not. Releases additionally require a low-spec pass
(docs/RELEASE_CHECKLIST.md).
-->

- Device / emulator:
- What you played:

## Screenshots

<!-- For UI changes. Dark mode too, if the change touches colours. -->
