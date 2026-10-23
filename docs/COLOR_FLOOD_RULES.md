# Color Flood — canonical rules

2026-10-23. New Web beta title. No native release or Club House registration.

## Rules and boards

Start with the contiguous region containing the top-left square. Choose one of
six colours to recolour that region and absorb every orthogonally connected
square of the chosen colour. Cover the entire board. Sizes are 6×6, 10×10 and
14×14. Every tile also carries a distinct symbol, matching the palette.
Only colours adjacent to the region are enabled; colours adding nothing are
no-ops. Every accepted move grows the region, so at most size²−1 accepted moves
are possible. This is a consequence of the rules, not a countdown or a move
allowance. There is no loss, arbitrary move limit or automatic solver. Planning
which region to absorb is the game; Undo and same-board replay are its help.

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

Four version-1 records: cf.saveGame, cf.stats,
cf.flags and cf.prefs. One suspended slot, no daily.
The save contains size, unsigned seed, played actions, elapsedSeconds, a cleared
flag and savedAt. Board state is reconstructed from seed plus validated legal
actions, with no solving on load. Finished and malformed saves are rejected.
All Undo history is retained on resume. The history maximum is naturally
size²−1, since every accepted move adds at least one cell. Unknown fields are stripped.
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

Calculated sRGB contrast for the six active symbols against their tile colours:
red 6.05:1, blue 6.10:1, yellow 9.57:1, green 5.36:1, purple 5.79:1 and orange
5.75:1. The symbol is repeated on its palette button; colour alone is never
required. Disabled colours are dimmed and do not accept moves.
