# Knight’s Tour — rules and implementation

Updated: 2026-10-23. Web early release. Canonical rules for this implementation.

## Play

Visit every square exactly once with a chess knight. A move is two squares in one
axis and one in the other. The starting square is already visited. Highlighted dots
are legal destinations; visited cells display their visit number. An open tour is
enough: returning to the first square is not required. Sizes are 5×5, 6×6 and 8×8.
There is no clock on screen, time limit, score penalty, forced loss, hint, or daily.
If there is no legal move before completion, the board remains playable through
unlimited Undo or Retry same board. The message explains this reversible state.

## Proven starting positions

Development-generated complete tours are bundled in `game/tours.ts`. A seed selects
a tour, a board symmetry and its direction. The first square of that proven route
is the start. Every bundled route and every symmetry is tested for unique coverage
and legal knight moves. Creation is a bounded array transform (at most 64 cells),
with no runtime solving or background search. The route is never revealed as a hint.
Only the start constrains the puzzle; any legal complete route wins.

## Interaction and screens

Home offers three board sizes, a saved game resumes on its matching button, and
replacing another unfinished board asks first. Three illustrated Quick Rules lead
directly into play. Game header restart offers the same board or a new seeded start.
The board uses one roving tab stop; arrow keys navigate cells, Enter/Space plays a
legal cell, and Ctrl/Cmd+Z undoes. Dots and numbers supplement color. At 320 px the
8×8 grid scales to available width. Results offer Undo, retry, new board, Home,
optional ShareAction with the visible board size, and ResultAdSlot.

## Persistence and statistics

`kt.saveGame`, `kt.stats`, `kt.flags`, `kt.prefs`, all schema version 1. Save stores
size, seed and path with bounded metadata, not a trusted solved board. Replay rejects
out-of-range, duplicate and non-knight steps or a start that differs from seed.
Finished saves are rejected. The last selected size is a preference. Played and
completed counts are per size; a completed board is booked once even if undone and
completed again. That marker survives saving after undo. Active play seconds are
booked on exit, hide, native pause, completion and unmount; restore seeds both clock
baselines from saved elapsed time. There are no animation loops or solver timers.

## Release evidence

English source plus Japanese and the other 12 app locales are AI-authored drafts
on 2026-10-23; none has human linguistic approval. Automated evidence covers every
bundled tour and transformed route, move legality, completion, undo, save validation,
UI interaction, shortcut resume and lifecycle cleanup. No physical-device, human
linguistic, store or trademark review is claimed.

Automated local check on 2026-10-23: the scoped Nim + Knight’s Tour run passed
6 test files / 31 tests. A further focused Knight engine run passed 5 tests after
adding an explicit coverage assertion: 512 seeds per board size exercise all
6 bundled routes × 8 symmetries × 2 directions (96 combinations for each size),
and all 1,536 resulting tours complete through the same move engine as the UI.
These Node/jsdom checks are not a physical-device performance measurement.
