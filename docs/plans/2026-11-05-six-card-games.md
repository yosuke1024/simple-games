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
- [ ] Six playable roots: collection entry, tutorial, CPU game, saved resumption,
  statistics, honest results, replay / new game, normal keyboard navigation.
- [ ] Native nearby entry and discovery for all six; receiver-specific hidden
  hands; legal-action checks; human/CPU seats and interruption/reconnection.
- [ ] Meaningful complete-game and privacy tests through the existing nearby
  controller/session infrastructure, including host and guest perspectives.
- [ ] Registry, storage schemas/backup, title accents, artwork, translations,
  known unread-translation provenance and import boundaries updated.
- [ ] Shared original card faces/backs adopted by all existing playing-card
  games (Solitaire, Spider, FreeCell, Three Peaks, Hearts, Gin Rummy, Scopa,
  Daifugo, Sevens, Old Maid), as well as the six additions.
- [ ] Portrait/landscape visual QA for light/dark themes, phone widths, reduced
  motion, native banner reserve and nearby rooms. No clipped actions/hand ranks.
- [ ] Scoped tests, full typecheck/lint/tests, production native/web builds and
  bundle/isolation gates pass. Native builds checked where tools are available.
- [ ] Current canonical docs and release preparation accurately distinguish
  local verification from physical Bluetooth/LAN and store distribution.
- [ ] Poker/Blackjack simulated-gambling metadata reviewed against current store
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
