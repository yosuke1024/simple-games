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
Touch and mouse use buttons. Light Grid additionally has arrow-key roving focus;
Color Flood has six keyboard-accessible palette buttons and 1–6 shortcuts.
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

Light faces use yellow (#f9da67) with a dark star, dark faces use navy (#233348)
with a pale dot. These distinguish board states independently of the rose game
accent. The hint uses a dashed outline and appends the localized Hint label to
the marked cell’s accessible name; colour alone never identifies a hint.

Calculated sRGB contrast: lit symbol against its tile 10.30:1; dark symbol 6.41:1.
