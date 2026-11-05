# Six card games and a unified playing-card design

Owner request, 2026-11-05: add Indian Rummy, Crazy Eights, Spades, Durak,
Poker and Blackjack, including nearby multiplayer; improve the existing card
games as well; explore landscape play. Poker was explicitly selected as Texas
Hold'em. This request supersedes the historical decision to omit Poker and
Blackjack in the 2026-08-08 plan.

## Working state

- Worktree: `simple-games-card-tables`, branch `codex/six-card-games`.
- Base: `0df3d397`, the existing 22-game Nearby implementation. `origin/main`
  remains `98b74a00` as checked on 2026-11-05; the nearby expansion is a
  dependency, not part of this task to recreate.
- New games use the existing offline CPU / native Nearby split. No remote
  matchmaking, account, purchase currency, cash-out or real stakes.
- Four seats for Indian Rummy, Crazy Eights, Spades, Hold'em and Blackjack;
  two for Durak. Blackjack has an automatic dealer in addition to player seats.
- All rules and interactions are turn based, without reaction-time contests or
  short clocks. CPU decisions receive only the acting seat's information.
- Landscape is a responsive layout, not an orientation lock. Rotation retains
  the game and selected cards. Portrait remains playable.

## Completion evidence required

- [x] Six documented rule sets with complete legal actions, scoring, end states,
  CPU play, malformed-save rejection and deterministic rule tests.
- [x] Six playable roots: collection entry, tutorial, CPU game, saved resumption,
  statistics, honest results, replay / new game, normal keyboard navigation.
- [x] Native nearby entry and discovery for all six; receiver-specific hidden
  hands; legal-action checks; human/CPU seats and interruption/reconnection.
- [x] Meaningful complete-game and privacy tests through the existing nearby
  controller/session infrastructure, including host and guest perspectives.
- [x] Registry, storage schemas/backup, title accents, artwork, translations,
  known unread-translation provenance and import boundaries updated.
- [x] Shared original card faces/backs adopted by all existing playing-card
  games (Solitaire, Spider, FreeCell, Three Peaks, Hearts, Gin Rummy, Scopa,
  Daifugo, Sevens, Old Maid), as well as the six additions.
- [x] Portrait/landscape visual QA for light/dark themes, phone widths, reduced
  motion, native banner reserve and nearby rooms. No clipped actions/hand ranks.
- [ ] Scoped tests, full typecheck/lint/tests, production native/web builds and
  bundle/isolation gates pass. Native builds checked where tools are available.
- [x] Current canonical docs and release preparation accurately distinguish
  local verification from physical Bluetooth/LAN and store distribution.
- [x] Poker/Blackjack simulated-gambling metadata reviewed against current store
  requirements. No claim that free chips avoid age classification.

Implementation is in progress. An unchecked item is not completed or waived.
The owner has requested implementation; this document does not authorize an
unrequested store upload or claim physical-device validation.

## 2026-11-05 implementation checkpoint

Checkpoint validation: app and build-config typecheck passed; scoped ESLint and
Prettier checks passed; 23 test files / 103 tests passed. The test selection
included all six new game folders, the three changed existing card-game root
tests, ref-leading-state checks and import-boundary checks. The full repository
test/build/native/bundle checks remain for the integrated change.

Implemented the six independent pure rule engines, legal actions, CPU decision
views, resumable v1 storage schemas, and lifecycle providers. Each has a pure
`game/view.ts` projection and validator for the eventual CPU and Nearby board.
Projection tests cover every receiver through a complete game and reject extra
secret fields, mismatched recipients and nested event fields. Other players'
hidden cards can change without changing the receiver's view. These are rule-
layer privacy tests, not yet transport/controller integration tests.

| Game ID | CPU storage prefix | Root/provider name |
| --- | --- | --- |
| `crazy-eights` | `ce` | `CrazyEights` |
| `durak` | `du` | `Durak` |
| `spades` | `sa` | `Spades` |
| `texas-holdem` | `th` | `TexasHoldem` |
| `blackjack` | `bj` | `Blackjack` |
| `indian-rummy` | `ir` | `IndianRummy` |

This first checkpoint covered providers, card-face adapters and initial layout
CSS. The next checkpoint below adds the six playable CPU roots and screens.
The six titles are now registered as `in-development`, with storage schema
loaders, and remain hidden from normal entry points until the integration is
complete. The existing 72 released games and two web-beta games remain offered.

Hold'em tests include side pots, uncalled returns, tied pots and odd chips,
short all-in reopening, cumulative reopening, heads-up/dead-button progression,
short blinds with only an all-in opponent left, and varied legal betting beyond
the CPU's policy. Spades and Hold'em pause completed hands on seat 0's turn for
explicit continuation; this is the host's seat in Nearby. Local providers also
stop CPU timers during those hand summaries.

Indian Rummy searches required pure sequences first and reuses one memoized
search across possible discards. A ten-wild-card winning-hand case improved
from 1,250ms to 36ms in this machine's Vitest run. This is not a mobile benchmark.
Only CPU preference for a hand with at least five wilds and no pure sequence
uses a greedy grouping; declarations and penalty calculations remain exact.

Original SVG faces/backs are active in Daifugo, Sevens and Old Maid. Browser QA
on Sevens, dark theme, confirmed a legal card action and state preservation
when switching between 390×844 portrait and 844×390 landscape. The landscape
view showed table, hand and pass control together. Card corner indices were
enlarged after the initial narrow-screen inspection. Other themes, Nearby
rooms, ad reservations and the seven older card games remain to be checked.

Integration details to handle next:

- The six boards/roots, 14-language catalogs, artwork/accent/registry ownership
  and CPU UI tests are now implemented (checkpoint below). Keep them hidden
  until Nearby integration and remaining checks are complete.
- Reuse the pure projections in Nearby adapters; keep actions exact-key checked.
  `isGroupGameId` currently means capacity > 2; Durak needs the group controller
  with two seats, so its routing must be explicit and tested.
- Blackjack can end immediately on the initial dealer natural. GroupSession's
  `start()` currently does not freeze finished seat names/reset readiness for a
  terminal initial state; add coverage and handle that state during integration.
- Group results with `winner: null` already say “game finished”, not “draw”. Use
  that for Blackjack's independent outcomes and Spades' partnership outcome;
  their boards must explain the actual results, without a fictional sole winner.
- Indian Rummy's discard can temporarily be empty after picking its initial
  top card. Its view exposes `top: null`; don't render or enable an absent card.
- Shared card adoption remains pending for Solitaire, Spider Solitaire,
  FreeCell, Three Peaks, Hearts, Gin Rummy and Scopa. Read their RULES first.

## 2026-11-05 CPU screen integration checkpoint

Validation: app/build-config typecheck, scoped ESLint and Prettier passed.
All 29 selected test files / 302 tests passed: six complete game folders,
UI lifecycle/settlement, catalog consistency/wiring/provenance, registry key
ownership, ref-leading state and dependency boundaries. Full repository and
production build/native/bundle checks remain for the completed integration.

Added each game's home, three-step illustrated tutorial, statistics, resumable
CPU game screen, and result overlay. The interactive table takes only its own
pure `View`; there is no access to hidden opponent cards in the visual layer.
The same table is intended for the native Nearby adapters next. Hand controls
support arrows/Home/End and preserve focus after a removed card. Small portrait
screens use up to six columns; ordinary widths use up to seven, sized to the
actual hand rather than leaving empty columns for a short hand.

- Crazy Eights has explicit suit selection for an eight, draw and legal pass.
- Durak shows the face-up trump stock card, attacks/defenses, pickup and the
  attacker's explicit finish/pickup confirmation.
- Spades has 0–13 bidding, nil explanation, partnership totals/bags, last trick,
  per-hand deltas and manual continuation.
- Hold'em has check/call/fold/all-in, a validated total-raise input, visible
  blinds/button, community cards and hand ranks. Settlement shows returned
  uncalled chips, payouts and side pots; only showdown-live hands are revealed.
- Blackjack has hit/stand/double/split, per-hand totals and independent point
  settlements for every player. Immediate dealer-natural completion is covered
  in the CPU UI test as well as the rules. No invented table winner.
- Indian Rummy has both draw sources, selected discards, declaration validation
  and suggested pure/impure sequences and sets. An absent discard is supported.

The new catalogs cover all 14 locales. Their translations, including Japanese,
are AI-written and not approved by a human; I18N_POLICY and the unread catalog
test record that provenance. New storage keys are added to the registry's key
ownership test without editing old keys. Title accents also live in the shared
brand package. Registry entries remain `in-development`.

Browser checks used a temporary local preview that mounted the real roots,
SettingsProvider and memory-only game storage; the preview files were removed
before validation. These were CPU browser checks, not native Nearby tests:

- Hold'em: dark Japanese, 844×390 and 390×844; call to flop, same hand retained
  on viewport change, all betting controls visible. Long blind/button labels
  became accessible D/SB/BB markers, keeping narrow seat columns legible.
- Indian Rummy: light Japanese at both sizes; draw to fourteen, choose a
  discard, legal discard enabled, invalid declaration disabled.
- Spades: dark German at 844×390; shortened unused table space so both score
  totals and bag counts remain in view while bidding.
- Durak: light German at 844×390; legal attack and CPU response.
- Crazy Eights: dark German at 320×640; legal draw, hand count updates.
- Blackjack: light Japanese at 320×640 and 844×390; stand through settlement.
  Long results initially scrolled to the primary button on focus. All six
  result overlays now focus their heading without scrolling so the result is
  read from the top, with the remaining hands/actions reachable by scrolling.

These checks do not cover every theme/size combination, reduced motion or
native banner reservations yet. Hold'em reference screenshots are local QA
artifacts at `/tmp/simple-games-holdem-landscape.png` and
`/tmp/simple-games-holdem-portrait.png`; they are not production/store assets.

The next work is the six native Nearby adapters/controller wiring and privacy
integration tests, followed by the seven remaining existing card-art migrations
and the full integration/release-preparation checks above.

## 2026-11-05 integrated Nearby and design review checkpoint

All six Nearby adapters and lazy boards are connected. The protocol keeps
receiver-specific hands, rejects malformed/stale/out-of-turn actions, and uses
2 seats for Durak and 4 for the other five. Blackjack uses compact wire tuples
and sends the receiver's own settled hands only once, preserving the 2800-byte
plain / 4096-byte encrypted limits. Initial-deal settlement now freezes final
seat names and resets readiness. History validates each game's capacity and
allows negative scores only for Spades/Blackjack. A 175-test scoped run across
six Nearby files passed before the subsequent copy and integration-test import
adjustments. The signed-history cases were added afterwards.

The registry now offers the six games in native and browser builds (78 released,
28 Nearby); this remains a local implementation, not a publication. The current
inventory, Nearby contracts, CSS inventory and release preparation have been
updated. Store rating requirements were checked against official Apple/Google
sources and recorded in RELEASE_CHECKLIST; no store settings were submitted.

The owner reviewed an actual old/new card comparison and chose **no people and
a simpler design overall**. The shared face now has a single central suit on
number cards, a large J/Q/K on court cards, mirrored indices, and a simple green
back with a thin frame. It is used by all 16 playing-card games. Spider and Three
Peaks use a larger horizontal corner index. The old portrait/pip proposal above
is historical. The current authority is CARD_DESIGN.md. A dev-only comparison is
at `apps/simple-games/prototypes/card-design/index.html` (Vite). Screenshots:
`/tmp/simple-games-card-simple.png` and `/tmp/simple-games-hearts-simple.png`.
The owner has selected the direction, not reviewed every game/orientation.

Browser checks since that choice: Hearts dark, 390×844, reduced-motion setting,
13-card passing hand; Solitaire light 390×844 with a simulated 90px banner
reservation and 844×390. Portrait ranks/actions are clear. Existing short-screen
Solitaire uses its scrollable table; the whole deal does not fit above controls
with a 90px reserve. Spider's earlier 320×640 and 844×390 check verified a legal
move and rotation retention, but used the pre-simplification artwork.

Verification still underway, not complete:

- App/build-config typecheck completed successfully before the simplification.
- Full lint found six prohibited direct pure-engine imports in the encrypted
  integration test. Those imports were removed; the test now uses its adapters'
  real host entropy and chooses an ongoing opening deal. Lint needs rerunning.
- Two full-suite attempts encountered widespread existing timing failures under
  heavy local memory pressure (load average >20), and were cancelled. A serial
  run is in progress with CLI-only 30s test/hook timeouts; repository timeouts
  and product timing were not changed. Log `/tmp/cards-full-serial.log`, JSON
  `/tmp/cards-full-results.json`. Do not claim the full suite passed yet.
- Actual regressions found during those runs: the discovery test's old 21-peer
  literal (now derived from supported count), CSS inventory missing six entries,
  and the direct test imports above. All are edited; reruns pending.
- Native-mode Vite and web Vite builds are running sequentially, logs
  `/tmp/cards-native-build.log` and `/tmp/cards-web-build.log`. Bundle, isolation,
  final types/lint, native compilation and remaining visual checks are pending.
- Temporary `.qa/cards.html` / `.qa/cards.tsx` inside the app are a local screen
  harness, outside src. Remove them after QA and before final lint/commit.
- Do not mark the goal complete or publish while this verification is pending.

## Simplified-card visual pass and build gates

The current shared SVG has no people. Solitaire and FreeCell also use the
horizontal rank/suit index: the vertical suit was hidden by FreeCell's 36%-width
cascade strip. The compact index is 36 SVG units at baseline 28, keeping the Q
tail inside that strip. Spider/Three Peaks share this compact version.

Current artwork was inspected in FreeCell light 390×844, Gin Rummy dark German
390×844, Scopa light 390×844, Three Peaks dark 390×844, and Spider dark 320×640.
Spider's 8→9 move succeeded and both the newly exposed J and the covered 9 stayed
readable. Short landscape FreeCell/Solitaire retain their existing scrollable
table; the whole deal does not fit above the action bar. No claim of a complete
physical-device matrix is made.

Hearts CPU play now uses a two-column short-landscape layout (600px+ width,
600px or less height): table/pass tray left, 280–300px hand right. At 844×390
the 13-card hand, tray and pass control are visible together. Three cards were
selected and passed successfully. Minimum card width is 56px and exposed row
pitch is 50.4px, preserving the documented 48px touch floor. This layout is
scoped to CPU GameScreen; Nearby Hearts retains its existing layout.

The actual Nearby Board components were inspected through a disposable local
projection harness (not the native transport or full GroupRoot chrome): all six
new games, plus Daifugo/Sevens/Old Maid. Hold'em dark, Blackjack light, Durak dark,
Spades German light, and the three existing games were checked at 844×390.
Crazy Eights light was checked at 320×640. Indian Rummy dark was checked in both
orientations, with a successful draw at 320×640; its long portrait content is
scrollable. All boards use current artwork. The temporary .qa harness was
removed after inspection. The dev-only comparison remains under prototypes.

Final app/build-config typecheck and src ESLint passed. Both production modes
built; size gate passed without changing the baseline. Prototype Nearby's 40
tests, Android Java's 358 checks, and Android artifact guard's 19 tests passed.
The isolation guard was updated from 22 to 28 selected views and passed for both
artifacts; it still checks no Nearby in the initial/native entry or Web, no
provider/storage/Club reachability and no eager loading of other game views.
Ad separation and brand-principle guards passed; iOS version pair is unchanged
at 1.7.2 / 10702. These build checks preceded the final compact-index position
adjustment; final asset rebuild is pending.

The full serial test suite and Android/iOS native compilations are still
running. Typecheck/lint success does not imply these have passed. Android uses
installed JDK 21, offline Gradle and one worker. iOS uses the simulator SDK,
signing disabled and one build job. Initial sandbox cache/network restrictions
were retried through the approved execution mechanism; no device install or
store action was performed.

Final-art checkpoint (17:15 JST): both production asset builds, the unchanged
size baseline, selected-view isolation, ad separation and changed-source
Prettier checks passed after the compact-index adjustment. I18N gate status
reports all existing high-risk approval records complete; this does not approve
the newly drafted game/Nearby translations. Android's first debug compilation
passed (264 tasks); final assets were then copied and an incremental debug build
is running. iOS simulator compilation is progressing through its dependencies.
The 1,011-file full serial suite and full workspace lint are also still running;
no successful result is claimed for either. Logs remain under /tmp/cards-*.log.

The selected no-people card direction is implemented and visually reviewed.
Current comparison and example images are also retained under the task's Codex
visualizations directory. Remaining integration checks must finish before the
overall six-game goal is marked complete; no commit or publication was made at
this checkpoint.

## Native compilation and full-room layout verification

Both native compilations now pass with the final web assets copied in:
Android debug (JDK 21, offline Gradle, 264 tasks; final incremental run 3 executed
and 261 up-to-date), and iOS Debug simulator arm64/x86_64 with signing disabled.
Logs: `/tmp/cards-android-build-final.log`, `/tmp/cards-ios-build-final.log`.
Full workspace lint also completed successfully; app/build-config typecheck,
changed-source Prettier, final production builds, bundle size, ad separation and
Nearby isolation are green. No package baseline, app version or signing settings
were changed.

A second disposable browser harness rendered the actual GroupRoot and
GroupController, with real host game state and CPU scheduling but an in-memory
no-radio NativePlugin implementation. Hold'em dark at 844×390 with a simulated
60px banner reserve was hosted, readied and started through the real controls.
Native scrolling reached the action panel and a call changed the pot from 70 to
80. Durak light correctly described and rendered two seats; its host defended
a club 6 with a club 10, the next bout replenished both hands, and rotation to
390×844 retained the same round with 22 stock cards. All actions stayed outside
the reserved banner region. Short full rooms use vertical page scrolling.
This is not a radio test or a native banner SDK measurement.

The temporary room harness was removed after verification. The full serial
Vitest suite remains running; it is the remaining automated completion check.
Its process was observed creating an active worker (CPU work, not only a stale
log), and canvas warnings are expected from unrelated canvas games under jsdom.
No full-suite pass is claimed before the JSON result is inspected.
