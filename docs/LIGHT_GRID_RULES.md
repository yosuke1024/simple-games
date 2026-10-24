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
countdown or animation loop. Unlimited Undo during play and on the result card;
retry starts the same seed, new board uses a fresh seed. New board / retry during
play require the shared RestartDialog; replacing a suspended board also asks.
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
that every game CSS variable is defined by the shell. The hardware Back and
shortcut-resume integration gates also passed (488 checks including the UI
rerun). Scoped ESLint passed. Whole-app TypeScript and structural checks belong to the
integration run. Real devices, enlarged OS text and physical screen-reader
interaction have not been checked in this implementation session.

## Visual design and actionable hints (2026-10-23 revision)

The board is a flat dark tabletop with a fine frame, 6 px cell corners, warm ivory
lit faces (#f0dfa6) and charcoal unlit faces (#2c3c43). Small sun/ring marks show
state without relying on colour. There are no gradients, bevels, looping effects
or new dependencies. Tutorial diagrams reuse the board's lamp glyphs.

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

Calculated sRGB contrasts: lamp marks on lit faces 6.52:1, on dark faces 5.47:1,
numbered markers 8.04:1, and coordinate labels on the board 9.02:1.

Revision verification: all 16 Light Grid tests (4 files) passed after the redesign,
including the explicit next-tap instruction, exact affected-neighbour preview,
focus preservation, repeated Hint without moves, and preview removal after the
actual tap. Scoped ESLint and Prettier passed. No extra timers or animations were
introduced; reduced-motion behavior is unchanged.
