# Maze Escape — canonical rules

**2026-10-29 更新(正式収録、v1.7.0):** 製品オーナーの判断で Web 先行公開(ベータ)から正式収録した(registry の `channel` を外した — アプリのホーム・検索・ショートカットにも出る)。保存スキーマはこの収録で凍結し、以後は移行だけで変える — 公開中の Web ビルドが実際に書いた保存を `storage/releasedRecords.test.ts` が今の読み込み経路へ通す([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §0 と 2026-10-29 の節)。以下の「正式収録まで凍結しない」「アプリには出ない」などのベータ段階の記述は当時の記録である。収録は 2 週間の安定稼働・滞在時間の確認・実機での確認を満たしたという意味ではない。

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
ringed dot (a ball, with no mark in its centre), the start is a dashed ring, the
goal is a flag, and visited cells have small trail dots; the distinctions do not
depend on colour alone.

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

The maze is drawn on warm paper with a shallow frame, and the floor sits one step
below it: a shallow shadow falls inward from the frame's upper and left edges, an
`::after` overlay that takes no pointer event (the swipe and tap mapping stay on
the board) and reaches 5px, short of the start ring, whose outer stroke is about
6.7px in from the edge on the smallest board (the compact 9×9, 188px wide).
Walls have thickness. Each wall is one path stroked three times, back to front: a
cast shadow on the floor, a darker side face offset down and right, and the lit top
face (.1 wide, so a passage is still .9 clear for a token about .5 across). The
light comes from the upper left in both themes. The player is a solid raised ball:
an accent disc ringed in the floor colour, a light gloss arc at its upper left, and
a shadow cast down and right like the walls'; it has no centre mark. The gloss is
the lightest neutral of the theme (`--surface` in the light theme, `--ink` in the
dark one), never the accent ink, which is dark in the dark theme and would draw a
dark crescent on a light disc. The flag is a filled cloth on a pole, on a circular
field, so the goal stays distinct from visited dots and the dashed start ring and
does not collapse to a 1.5px outline on the smallest boards. The title's green
accent is reserved for the token, goal, hint, available direction controls and move
count. Dark mode uses warm dark paper and lighter neutral walls. The direction keys
use the shared control-key recipe (the `.action-btn` face, lit top edge and foot;
pressed keys are inset; unavailable keys are flat) with SVG arrow icons in the
shared icon voice (24 grid, 1.75 stroke, round caps) instead of text arrows. The
home mark depicts a maze rather than a font glyph. Visual depth does not animate or
change the board's viewBox, border width, tap mapping or control dimensions; the
compact-height layout retains its four 44px direction buttons in one row.

Owner's decision, 2026-10-29: this replaces the earlier wording ("subtle wall
shadows": one thin wall line with an offset copy that was almost invisible; a token
with a centre dot and a gloss drawn in the accent ink; an outline-only flag; text
arrows on the direction keys). The board stays warm paper rather than wood or
stone, and the accent still carries no depth cue: the frame's outer shadow is a
translucent brown, not the shared `--accent-ring-soft`, so the 2px border, the 3px
lift and that shadow keep their earlier form with their colours moved to tokens.
The tutorial figure takes the same frame, lift and shade as the board in both
themes (before, only the dark theme gave it the lift).

The board's colours are game content, so they are declared only in the two blocks
at the top of `ui/maze-escape.css` (`--me-*`, light and dark), as docs/architecture/css-split.md
allows; `ui/contrast.test.ts` measures them and fails on a colour literal anywhere
else (a hex colour, a colour function or a named colour; `transparent` and
`currentColor` are allowed). Light / dark values (an alpha is a separate number so the test can lay it over
the floor):

| Token                                 | Light                  | Dark                  | Role                                       |
| ------------------------------------- | ---------------------- | --------------------- | ------------------------------------------ |
| `--me-floor`                          | `#faf5e9`              | `#302d26`             | floor, board background, token ring        |
| `--me-rim` / `--me-rim-lift`          | `#b7a486` / `#d7c7ad`  | `#786b53` / `#4c4232` | frame border / the 3px lift under it       |
| `--me-wall-top`                       | `#706249`              | `#c8bba1`             | lit top face of a wall                     |
| `--me-wall-side`                      | `#4a3f2b`              | `#8f836c`             | side face, down and right of the top       |
| `--me-cast` + `--me-cast-alpha`       | `#705c3e` at .2        | `#000000` at .45      | shadow of a wall and of the token          |
| `--me-start` / `--me-trail`           | `#8e7f64` / `#8e7f64`  | `#8e7f64` / `#84775e` | dashed start ring / visited-cell dots      |
| `--me-tray-shade` + `--me-tray-alpha` | `#3d2b19` at .18       | `#000000` at .35      | the floor's inner shadow                   |
| `--me-gloss` + `--me-gloss-alpha`     | `var(--surface)` at .6 | `var(--ink)` at .6    | the token's gloss                          |
| `--me-drop`                           | `rgb(61 43 25 / 10%)`  | `rgb(0 0 0 / 15%)`    | the board's soft outer shadow (decorative) |

2026-10-29 sRGB contrast calculation (light / dark), printed by `ui/contrast.test.ts`:
walls against paper 5.46 / 7.25:1 (the top face is unchanged; with the tray's shade
laid over wall and floor at full strength, the worst case, 4.54 / 3.96:1; against the
floor where the cast shadow darkens it, laid at its whole alpha, the top face 4.12 /
9.28:1 and the side face 7.14 / 4.72:1); player
9.67 / 6.25:1; goal/hint stroke against its fill 7.53 / 5.60:1 (the filled flag cloth
is the same accent on the same field); start ring 3.59 / 3.51:1; trail 3.59 / 3.13:1;
HUD text minimum 5.07 / 4.96:1 (carried over from 2026-10-23; the HUD is untouched)
(required graphics 3:1, text 4.5:1). Texture, with no ratio to clear: side face against
top face 1.73 / 1.97:1, cast shadow on the floor 1.33 / 1.28:1, the tray's shade at full
strength 1.39 / 1.23:1, gloss over the token 4.89 / 1.42:1; the test requires each to be
visible at all and the light to come from above (side darker than top, gloss lighter
than the token in both themes). Decorative shadows and unavailable controls are
excluded from the 3:1.

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

Verification on 2026-10-29 (depth cues, token and direction keys): the Maze Escape
suites, `ui/contrast.test.ts` included, and ESLint and the type check on the files
touched passed. A static HTML rendering of the board in both themes (5×5, 9×9, the
compact 9×9 width and the tutorial figure, with the direction keys) was looked at in
a desktop browser pane; the game itself, the real compact-height layout, a phone and
a physical device were not, and neither was the effect of the Android WebView 88
floor on these rules. After review, the tray's shade was tightened from a 5px to a
4px blur (reach 6px to 5px) so that the 1px margin the test asks for, for the blur's
faint tail, is held by the geometry rather than by the shade being faint: the
ring's outer stroke is 6.7px in, read by the test from the stylesheet and
`Board.tsx` rather than assumed. In the dark theme the shade at full strength
would take the start ring to 2.22:1 and the trail to 2.02:1 (light: 3.18:1 for both),
so the ring and trail clear 3:1 because the shade does not reach them, not
because of its alpha. `pnpm size:check` (the lazy chunk's size budget) was not run.
