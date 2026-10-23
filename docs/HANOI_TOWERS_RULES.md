# Hanoi Towers — canonical rules

2026-10-23. New Web beta title; no native release or Club House registration.

## Rules and difficulty

Three pegs and 3, 4 or 5 disks. All disks start on the left peg, largest below
smallest. Move one top disk at a time to another peg. A larger disk cannot be
placed on a smaller disk. Move the complete tower to the right peg to finish.
The minimum from the opening is 2^n − 1 moves (7, 15 or 31). This is a mathematical
reference, not a time limit or an obligation. There are no hidden or locked disks.

Each disk is represented by its peg, indexed smallest first. Rules and move
validation are pure TypeScript. Every arrangement has at most five disks and a
move checks at most five entries. There is no search, CPU, network, countdown,
automatic move or animation loop.

## Controls and help

Tap a peg to select its top disk, then another peg to move. Tap the selected peg
again to cancel. Valid destinations have a dashed frame and a downward arrow;
the selected top disk is lifted. An invalid destination explains the rule and
keeps the selection. Disk numbers, width and position distinguish the disks
without relying on colour. All three pegs are keyboard-focusable buttons. Left
and right arrows move focus; Enter or Space activates, and repeated activation
keys are ignored. Number keys 1–3 activate the corresponding peg. Escape cancels
selection. Ctrl/Cmd+Z is the same unlimited Undo available on screen.

Undo is the help for this completely visible puzzle. It is free during play and
on the result card; no hint solver completes the reasoning for the player. Undo
removes one move from the displayed count. Retry restores the same opening and
asks before replacing play in progress. Since each disk count has one opening,
there is no separate “new board” action. Choosing another disk count on Home
asks before replacing a suspended game.

First launch teaches three illustrated sentences and starts immediately. Later
launches show Home. A shortcut resumes a valid suspended game after the tutorial
has been completed. Home, statistics, Back, banner and result slots use existing
collection conventions. Result sharing includes only displayed disk count and
moves, never historical statistics.

## Persistence, statistics and lifecycle

Four version-1 independent records: `hn.saveGame`, `hn.stats`, `hn.flags`,
`hn.prefs`. One suspended slot. Save records contain size, a reserved unsigned
seed, action history, elapsedSeconds, cleared and savedAt. Restoring replays legal
actions from the initial tower, rejecting impossible moves, finished saves,
unknown versions and malformed data. A defensive cap of 100,000 saved actions
bounds corrupt-input work; validation is linear in action count. No search runs
on load. Unknown properties are stripped. Beta schemas are not yet frozen.

Statistics per disk count are games started, games completed and fewest moves.
Resume does not count a new start; retry does. Undoing a completed game preserves
a cleared marker, so finishing again does not count a second completion. There
is no loss count or ranking. Total visible play seconds are local only and are
not shown as a timer during play.

One one-second interval counts active play only, without rendering. It stops
while the restart dialog is open, on hidden pages, native pause, other screens,
completion and unmount. Visibility/native resume may restart this bookkeeping
clock, but never makes a game move. Background, home, exit and
`useOnUnmount(syncActiveGame)` book only previously unbooked seconds and save.
Mounting seeds both time refs from the saved elapsed time, even when opening
Home. Timers and listeners are released on unmount. Modal content is isolated
from the inert game board and game shortcuts are detached while a dialog is open.

## Text and verification provenance

English is source. Japanese and the other twelve locale catalogs are AI drafts;
no native reading, independent back-translation or separate-model language audit
is claimed. Shared product and data-loss messages are unchanged. The game name
is an English proper noun in every locale. Physical devices, enlarged OS text
and physical screen-reader use have not been checked in this implementation.

Verification on 2026-10-23: the focused suites for Hanoi Towers and Maze Escape
passed (32 checks initially, then three added pointer/dialog-clock checks passed
in focused reruns; 35 checks total). Scoped ESLint passed. Hanoi's engine tests
solve and fully undo every difficulty and verify inverse legality across all
243 five-disk arrangements. Storage checks replay 20,000 actions and reject
malformed histories. UI checks cover tutorial, shortcut resume, legal destination
cues, invalid moves, keyboard input, modal isolation, completion/Undo/recompletion
without double counting, hidden and dialog-paused time, and unmount bookkeeping.
Japanese browser simulation at 360×740 completed the 3-disk puzzle in seven moves
and verified the result card. The board and result were also seen in a desktop
viewport. These observations are not physical-device or linguistic review.
