# Contributing to Simple Games

Thanks for your interest in Simple Games by PixApps — a collection of simple,
fully offline games in one Android app.

日本語での Issue / Pull Request も歓迎します。

## Running the project

Requirements: Node.js >= 20 and pnpm (see `packageManager` in `package.json`).

```bash
pnpm install
pnpm --filter simple-games dev    # run the app in a browser
pnpm --filter simple-games test   # unit tests
pnpm lint
pnpm typecheck
pnpm build
```

Android build instructions are in
[apps/simple-games/README.md](apps/simple-games/README.md).

## Translations

The full policy (in Japanese) is [docs/I18N_POLICY.md](docs/I18N_POLICY.md).
All translations are bundled with the app; there is no external translation
service.

Strings live in two kinds of places, split by who uses them: strings shared by
the shell or by more than one game are in
`apps/simple-games/src/i18n/locales/<code>.ts`; strings only one game uses are
in that game's own `apps/simple-games/src/games/<game-id>/i18n/<code>.ts`, so
they ship in that game's lazy-loaded chunk instead of the app's startup
bundle. To **fix** an existing translation, search for the string in English
first (`grep` across both `src/i18n/locales/en.ts` and
`src/games/*/i18n/en.ts` finds it) and edit the matching key in every other
locale file next to it.

To **add** a language:

1. Copy `apps/simple-games/src/i18n/locales/en.ts` to a new
   `apps/simple-games/src/i18n/locales/<code>.ts` and translate the values.
2. Do the same for every game: copy each
   `apps/simple-games/src/games/<game-id>/i18n/en.ts` to
   `apps/simple-games/src/games/<game-id>/i18n/<code>.ts` and translate it.
3. Register the shell catalog in `apps/simple-games/src/i18n/index.ts`: add
   the code to the `Locale` type, the catalog to `catalogs`, and the
   language's name — written in that language itself — to `LANGUAGE_NAMES`.
4. Register the new locale file in each game's
   `apps/simple-games/src/games/<game-id>/i18n/index.ts` (one import, one
   entry in that file's `catalogs`).

That is the whole procedure. The `MessageKey` type (the shell's keys plus
every game's) makes the build fail until every key exists in your locale,
wherever it lives, and `pnpm --filter simple-games test` verifies — across
both the shell and every game catalog — that every string is non-empty, that
placeholder names (`{var}`) match English exactly, and that no markup or
control characters slipped in.

Guidelines:

- Keep strings short. The UI is deliberately text-minimal (tutorials are at
  most 3 steps, one sentence each); long translations break layouts.
- Translate whole sentences — never assume strings will be concatenated.
  Variables are passed via `{var}` placeholders; keep their names unchanged.
- Strings about purchases, purchase restore, data deletion, privacy, the
  destructive-action confirmations, and the free/offline/no-paywall promises
  are **high-risk keys**: a mistranslation there costs a player money, data, or
  a promise the app then cannot keep. They are listed in
  `apps/simple-games/src/i18n/highRiskKeys.ts` and go through a release gate —
  someone other than the translator back-translates them, and the author reads
  the back-translation before the release ships. Say in your PR which of these
  keys you touched, so the gate can be re-run for them.

  Nobody is asked to supply a native review: this is a one-person project and
  that gate would never open. Every locale except `en` and `ja` is provenance
  `machine`, the app says so, and naturalness comes back from readers — so
  reports about wording are welcome and are not a lesser kind of contribution.

## Bugs and game suggestions

Please use GitHub issues:
[https://github.com/yosuke1024/simple-games/issues](https://github.com/yosuke1024/simple-games/issues)

- Bug reports: include device/OS, app or commit version, and steps to reproduce.
- Game suggestions are welcome. Note that games must work fully offline with
  puzzles generated on-device — games that need a content server are out of
  scope.

## License and brand

The source code is licensed under [Apache-2.0](LICENSE). The "Simple Games"
and "PixApps" names, logos, icons, and store-listing brand assets are **not**
covered by that license (Apache-2.0 §6). You may build from source, but you
may not present your build as the official app.
