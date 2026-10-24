# Maze Escape — canonical rules

2026-10-23. New Web beta title; no native release or Club House registration.

## Rules and generation

Move the dot from the upper-left cell to the flag in the lower-right cell.
Choose a 5×5, 7×7 or 9×9 maze. Walls block movement; each action moves exactly one
cell along an orthogonal passage. Visiting a dead end does not lose the game.
There is no time limit, enemy, move limit, automatic movement or failure state.

A seeded iterative depth-first generator visits each cell once, carving one
edge whenever it visits a new cell. Consequently the passages form a connected
tree: all cells are reachable and there is one simple path between any two cells.
The generator's stack is bounded by 81 cells and its traversal terminates after
at most 161 stack iterations for the largest size. Seed plus size reproduces
the same maze locally. Rules, generation and hints are pure TypeScript with no
network or dependency on another game.

## Controls, help and presentation

Use visible up/left/down/right buttons, keyboard arrow keys or WASD. Swipe on the
board for one step in the dominant direction, or tap an adjacent connected cell.
Repeated keyboard arrows are allowed; a wall is a no-op. Buttons expose wall
availability using aria-disabled while retaining stable keyboard focus. The
live position text gives row and column after each step. The player is a filled
ringed dot, the start is a dashed ring, the goal is a flag, and visited cells have
small trail dots; the distinctions do not depend on colour alone.

Undo is free and unlimited, including on the result card. Ctrl/Cmd+Z is the same
action. Hint marks the next step along the unique simple path from the current
cell to the goal; it also states row and column. It never moves the player or
changes the move count. A breadth-first traversal runs only when Hint is pressed,
visits at most 81 nodes and examines at most four edges per node. Any move or
Undo clears the hint. Undo removes the last step from the count and trail.

Retry restores the same seed. New game uses a fresh seed. Both are available in
the shared restart dialog while playing, and on completion. Switching sizes on
Home asks before replacing a suspended game. First launch teaches three
illustrated sentences and begins immediately. Later launches show Home; a
shortcut resumes a valid saved game after the tutorial. Results share only the
completed maze size and move count shown on the card.

## Visual presentation

The maze is drawn on warm paper with a shallow frame and subtle wall shadows.
The player is a solid raised token, and the flag has a circular field so the goal
stays distinct from visited dots and the dashed start ring. The title's green
accent is reserved for the token, goal, hint, available direction controls and
move count. Dark mode uses warm dark paper and lighter neutral walls. The home
mark depicts a maze rather than a font glyph. Visual depth does not animate or
change the board's viewBox, border width, tap mapping or control dimensions; the
compact-height layout retains its four 44px direction buttons in one row.

2026-10-23 sRGB contrast calculation (light / dark): walls against paper 5.46 / 7.25:1 (light wall against composited shadow 4.40:1); player 9.67 / 6.25:1; goal/hint stroke against its fill 7.53 / 5.60:1; start ring 3.59 / 3.51:1; trail 3.59 / 3.13:1; HUD text minimum 5.07 / 4.96:1 (required graphics 3:1, text 4.5:1; decorative shadows and unavailable controls excluded).

## Storage, statistics and lifecycle

Four isolated version-1 records: `me.saveGame`, `me.stats`, `me.flags`, `me.prefs`.
One suspended slot, no daily. Saved data contains size, unsigned seed, steps,
elapsedSeconds, cleared and savedAt. Loading deterministically reconstructs the
maze and checks every step against its passages; it does not solve the maze.
Finished, malformed and future-version saves are rejected, unknown fields
stripped. Saved action count has no fixed limit, matching unlimited play and
Undo; replay checks every action in linear time. Undo history survives resuming.
Beta schemas are not yet frozen.

Per-size statistics count starts and completed mazes, and record fewest moves in
a completed maze of that size. This is a personal record across different mazes,
not a claim of equal difficulty. A retry is a fresh start; resume is not. Undo
from a clear retains a cleared flag, preventing duplicate completion counts.
Total play seconds are local only and never appear as a countdown or in-play timer.

The sole interval ticks once a second only during visible active play. It stops
on hidden/native pause, restart dialogs, other screens, completion and unmount.
Visibility/native resume restarts only time bookkeeping, never movement.
Background, Home, exit and `useOnUnmount(syncActiveGame)` save and book unbooked
seconds. Restored sessions seed elapsed and booked refs identically, including
when opened on Home. Every listener and interval is released on unmount. Modals
make underlying controls inert and detach game shortcuts.

## Text and verification provenance

English is source. Japanese and the other twelve catalogs are AI drafts. No
native reading, independent back-translation or separate-model language audit
is claimed. Game names remain English proper nouns; shared product and data-loss
copy is reused unchanged. Physical devices, enlarged OS text and physical
screen-reader operation have not been checked in this implementation.

Verification on 2026-10-23: the focused suites for Hanoi Towers and Maze Escape
passed (32 checks initially, then three added pointer/dialog-clock checks passed
in focused reruns; 35 checks total). Scoped ESLint and the pointer-contract gate
passed. Maze checks cover 150 seeds at each size for connected, reciprocal,
bounded tree passages; 30 detour/solve/Undo cases per size; corrupt saves;
tutorial, shortcut resume, hints, directional control, canceled swipes, new
swipes and adjacent taps; completion bookkeeping and clock cleanup. Follow-up
regressions cover a legal 100,001-step save/load roundtrip, Undo and another
save/load, rejection of an illegal step after 100,000 legal steps, and a secondary
finger's release preserving the primary swipe.

Japanese browser simulation completed a 5×5 maze in 12 steps using the actual
Hint and direction buttons at 360×740. A 9×9 board, movement, restart cancellation
and resume were also checked at 320×568. Compact-height layouts reduce board width
and put the four 44px direction buttons in one row; content remains scrollable,
including with the Web ad reservation. In the regular mobile layout, the board,
position/hint text and all controls fit above that reservation. Screenshots were
visually inspected; these are simulated viewports, not physical-device tests.
