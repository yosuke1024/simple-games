# Light Grid — canonical rules

2026-10-23. New Web beta title. No native release or Club House registration.

## Rules and boards

Toggle a cell and its orthogonal neighbours. Extinguish every light. Board sizes
3×3, 4×4 and 5×5. A seeded, bounded constructor starts dark and toggles a subset
of cells; if it returns dark, toggle the centre once. Every opening is therefore
solvable. Several solutions can exist; neither the interface nor the hint claims
uniqueness or minimum moves. The exact GF(2) elimination hint marks one cell from
a valid solution of the current board and never plays it. It runs only on a Hint
tap, on a matrix at most 25×26, with no recursive search.

## Play, accessibility and lifecycle

All boards are local Pure TypeScript. No network, automatic moves, CPU player,
countdown or animation loop (the one-shot CSS transitions of the lamp lenses in
“Visual design” start no timer and never repeat). Unlimited Undo during play and
on the result card; retry starts the same seed, new board uses a fresh seed. New
board / retry during play require the shared RestartDialog; replacing a
suspended board also asks.
First launch shows Quick Rules in three steps then starts immediately. Later
launches show Home; a shortcut resumes a valid suspended game directly.
Touch and mouse use buttons. Arrow keys move the roving keyboard focus;
Enter or Space activates the focused cell.
Ctrl/Cmd+Z undoes. Repeated activation keys do not make repeated moves. Modals
make the board inert and detach game keys. Result sharing reports only the
completed board size and moves shown on the card. Shared BannerSlot and
ResultAdSlot own advertising; no game action depends on them.

The only interval counts visible play seconds in a ref, once a second without
rendering. Background, navigation, and useOnUnmount(syncActiveGame) save and book
only unbooked time; mounting on a saved game seeds elapsed and booked refs from
its elapsedSeconds, including when opening its home. Listeners and interval are
released on unmount. A hidden board does not advance gameplay.

## Persistence and statistics

Four version-1 records: lg.saveGame, lg.stats,
lg.flags and lg.prefs. One suspended slot, no daily.
The save contains size, unsigned seed, played actions, elapsedSeconds, a cleared
flag and savedAt. Board state is reconstructed from seed plus validated legal
actions, with no solving on load. Finished and malformed saves are rejected.
All Undo history is retained on resume. Light Grid's defensive input-length cap
is 100,000 actions (bounded corrupt-input work, not a gameplay limit). Unknown
fields are stripped.
Flags and preferences validate independently, and a corrupt slot cannot affect
another game. Schemas freeze at formal native release; beta notice is shown on
Home and Quick Rules before any save is written.

Per-size statistics: games started, boards cleared, and fewest moves in a clear.
Resume does not count as a new start; retry does. Abandonment is not a loss. Undo
from a clear retains the cleared flag so finishing it again cannot double count.
A replay is a new game. Best scores include games with hints (where available);
there is no ranking, streak, daily obligation or artificial target. Total play
time is local only, not displayed as a timer in play.

## Text and verification provenance

English is source. Japanese and the other twelve supported locales are AI drafts,
written 2026-10-23. The author has not reviewed Japanese; no native reader,
independent back-translation or separate-model language audit is claimed.
Game names remain English proper nouns in every locale. Shared data-loss,
advertising and product-promise strings are reused without changes.
Engine, persistence and UI checks: Vitest passed all 29 tests across both new
games (8 files) on 2026-10-23. Light Grid checks 500 seeds at each of its three
sizes and a 20,000-action linear restore. Color Flood completes 80 seeded boards
at each size, proving every accepted move grows the region. UI checks include
three-step tutorial, restart cancellation and inert board, save/resume, clear /
Undo / clear without double booking, visible versus hidden clock ticks, and
unmount / remount bookkeeping. Light Grid additionally checks keyboard focus and
the accessible hint. Additional checks assert Home confirmation isolation and
that every game CSS variable is defined by the shell (Light Grid's own --lg-*
tokens, by the two blocks at the top of its own stylesheet). The hardware Back
and shortcut-resume integration gates also passed (488 checks including the UI
rerun). Scoped ESLint passed. Whole-app TypeScript and structural checks belong
to the integration run. Real devices, enlarged OS text and physical
screen-reader interaction have not been checked in this implementation session.

## Visual design and actionable hints (2026-10-23 revision)

The board is a dark tray with a fine frame and a rim of light along its upper
edge, holding lamp lenses with 6 px corners: warm ivory lit faces (#f0dfa6 in the
light theme, #e4d29a in the dark theme) and charcoal-blue unlit faces (#2c3c43).
Small sun/ring marks show state without relying on colour. There are no looping
effects or new dependencies. Tutorial diagrams reuse the board's lamp glyphs and
the same lens and tray styles.

### Lamp lenses, tray and transitions (2026-10-29)

Owner's decision, 2026-10-29: this reverses the 2026-10-23 wording “flat dark
tabletop … no gradients, bevels”. A lit lamp read as a yellow square and an unlit
one as a hole in the tray; the cells are now lamp lenses with a physical edge.
Kept from before: no looping effect, no new dependency, no information added to
the board (no element, text or mark is new — only thickness, contact shadow,
recess and one consistent light from above), and the board's geometry (padding
10 px, gap 6 px, 6 px corners, cell size, 44 px touch targets) does not move.

- Lit lens: a gloss over its upper half (a gradient of the lighter of the shared
  --surface / --ink tokens, 40% at the top edge, on the cell's ::before and under
  the mark), a 1 px specular line along the top, a 3 px thicker amber lower edge, a
  2 px bezel ring warmed by the lamp, and a soft glow (0 0 6px 1px) that fades out
  inside the 6 px gap and does not reach a neighbour's mark.
- Unlit lens: the same lens, recessed — the gloss at 6%, a 2 px shadow along the
  upper edge, a 1 px lip below, a dark bezel and a frame of #6a7f88 (the earlier
  #53656d on the flat tray was 2.48:1 and under the 3:1 floor).
- Both states list the same four shadows in the same order so that they
  interpolate; the unlit glow is the lit glow at no opacity.
- Tray: a slate gradient (#22323a to #1c282e) with an inner rim light and lower
  shade, inside the collection's board frame (lift first, paper edge, line ring,
  soft ring). The coordinate labels are cut into it with a text-shadow. The Quick
  Rules figure has the same tray thickness.
- Press: a lens sinks 1 px while pressed (0.06 s).
- Transitions: a cell comes on in 0.1 s and cools in 0.22 s (ease-out on its
  colour, frame, shadow and gloss opacity, chosen by the state it is changing to).
  They are one-shot CSS transitions — no loop, no timer, no JavaScript. Under
  Reduced Motion (the OS setting and the in-app setting alike) the shared rules in
  ui/styles.css end every transition and every pseudo-element's, so this game
  writes no exception of its own; ui/contrast.test.ts pins that those rules exist.
  The mark's colour moves with the face while its shape (sun or ring) swaps at
  once, so for about a tenth of a second the mark sits close to the face in
  brightness; that is the filament's afterglow, accepted. If up to 25 lenses
  changing together (Retry, a new board, Undo) prove heavy on a low-spec device,
  the fallback is to drop box-shadow and color from the transition and keep the
  face, the frame and the gloss opacity; the text pins in ui/contrast.test.ts and
  this list change in the same commit.
- Marks: the sun is clamp(24px, 40%, 40px) wide and the ring clamp(20px, 33%,
  34px), so a 3×3 board (cells about 89 px) shows them at about 35 and 29 px, a 4×4
  board at about 25 and 21 px, and a 5×5 board stays at the 24 and 20 px floor. The
  stroke is in viewBox units and scales with the mark.

Colours are game content (docs/architecture/css-split.md): every one is a --lg-*
token in the two blocks at the top of ui/light-grid.css, light and dark, and no
colour literal is written below them (ui/contrast.test.ts asserts this). The
gloss is an alias of a shared token, not a colour of its own. The two themes
differ only where the light does: the lit face and its edge a step down in the
dark theme (#e4d29a, edge #f0e6c7) so it does not glare in a dark room, its glow
stronger there (opacity 0.52 against 0.40), and the tray's edge lifted (#76868d
against #647279) because the tray is 1.19:1 to the dark paper.

| Token group                         | Light                     | Dark                      |
| ----------------------------------- | ------------------------- | ------------------------- |
| tray (lower stop), upper stop, edge | #1c282e, #22323a, #647279 | #1c282e, #22323a, #76868d |
| lit face, edge, mark                | #f0dfa6, #f8edcd, #544b30 | #e4d29a, #f0e6c7, #544b30 |
| unlit face, edge, mark              | #2c3c43, #6a7f88, #a6b6bc | #2c3c43, #6a7f88, #a6b6bc |
| bezel, bezel of a lit lamp          | #121b20, #3b3d31          | #0e1519, #37392d          |
| coordinate labels                   | #c0cacc                   | #c0cacc                   |
| hint marker, its ink, frame         | #86344d, #ffffff, #ffffff | #86344d, #ffffff, #ffffff |
| gloss                               | --surface                 | --ink                     |

The alpha tokens (tray rim and shade, label cut, specular line, lower edge,
glow, recess, lip) and the gloss opacities (0.40 lit, 0.06 unlit) are in the CSS
and carry no meaning, so no ratio is promised for them.

A hint gives one explicit next action: “Tap row {row}, column {col}.” The board
shows matching row and column coordinates. The destination has a numbered “1”
marker and a solid white frame; its orthogonal neighbours have inner dashed
outlines. The instruction's matching “1” badge ties it to the destination, and
its second line explains that the outlined neighbours also switch. Only the
numbered cell is the suggested tap: neighbouring outlines show the effect, not
additional moves. The solver still returns a valid solution, never claims a
minimum, never plays automatically and runs only on the Hint tap.

Keyboard focus stays with the player. The destination's accessible name contains
Hint and aria-describedby links it to the complete live instruction, including
row and column. Affected neighbours have a localized affected-state description.
A move or Undo clears both the suggestion and its preview. All fourteen catalogues
contain the revised instructions; Japanese and the other translations remain AI
drafts without a claim of human linguistic review.

The board frame is at most 320 px wide. Short viewports (up to 680 px high)
reduce it to at most 280 px with tighter spacing, leaving 5×5 cells approximately
44 px wide on a 320 px phone. The instruction reserves space so the board does
not jump when Hint is pressed. The player's chosen 3×3, 4×4 or 5×5 size never
changes to fit the screen. Game content scrolls within the viewport; the web ad
reservation stays outside that scroll area so actions remain reachable above
the fixed ad, including at 320×568 or with enlarged text. The standard header,
action bar and ad slot remain in place. Layout is awaiting the parent browser
pass for this revision.

Calculated sRGB contrasts, light / dark theme, printed by ui/contrast.test.ts
(2026-10-29; the gate is 4.5:1 for marks and 3:1 for frames): the sun on a lit
face 6.52 / 5.76 (7.27 / 6.21 under the gloss at its strongest), the ring on an
unlit face 5.47 / 5.47 (4.54 / 4.68 under the gloss), lit face against unlit face
8.62 / 7.62, the unlit frame on the tray 3.59 at the lower stop and 3.16 at the
upper in both themes (4.16 / 4.39 on its bezel), the lit face on the tray 11.36 /
10.04 (9.97 / 8.82 at the upper stop), the tray's edge on the paper 4.37 / 4.76,
the numbered marker 8.04 in both themes (6.05 / 5.35 against a lit face), the
hint and focus frame on the tray 15.08 and 13.25 at the upper stop (11.07 / 11.76
on a lit lamp's bezel), and the coordinate labels 9.02 on the lower tray stop and
7.92 on the upper in both themes. The 2026-10-23 figures were measured on the
flat tray: the marks and the numbered marker are unchanged in the light theme and
the labels keep their 9.02 at the lower stop. The tray against the dark paper
stays 1.19:1, which the collection's paper and line rings outline.

Revision verification: all 16 Light Grid tests (4 files) passed after the redesign,
including the explicit next-tap instruction, exact affected-neighbour preview,
focus preservation, repeated Hint without moves, and preview removal after the
actual tap. Scoped ESLint and Prettier passed. No extra timers or animations were
introduced in that revision.

Lens revision verification (2026-10-29): checks added and run on this machine,
not on a device. ui/contrast.test.ts (25 tests) measures the pairs above from the
stylesheets in both themes, asserts that no colour literal is written outside the
two token blocks, pins which token each part is drawn with (so a measured pair is
the pair on screen), pins the lens, tray and transition rules as text and pins
that the shared Reduced Motion rules exist; ui/styles.test.ts now also accepts the
game's own --lg-* tokens (their aliases are still checked against the shell). All
Light Grid tests (5 files, 41 tests), scoped ESLint, Prettier on the touched files
and whole-app TypeScript passed. The appearance was looked at only in a static
page rendered by desktop Chrome with this stylesheet (light and dark, 3×3, 4×4 and
5×5, the hint and the Quick Rules figure). It has not been seen in the app, on
Chromium 88 or any Android WebView, or on a device. Still unchecked: that the
mark's percentage width resolves inside a grid cell on the old WebView's grid
implementation, how heavy 25 lenses transitioning their shadows together are on a
low-spec phone, the transitions and the press running at all (a static render
shows no time), and whether the glow stays readable beside a neighbour's mark on
a 320 px phone.
