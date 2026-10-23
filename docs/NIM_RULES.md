# Nim — rules and implementation

Updated: 2026-10-23. Web early release. Canonical rules for this implementation.

## Play

Four visible heaps contain stones. You move first. Select exactly one nonempty row,
choose a number from 1 to all its stones, then confirm. The CPU does the same.
Taking the last stone wins (normal play, not misère). There is no timer or score.
Each seeded starting position has 2–8 stones per heap (one may become 1 to remove
an xor-zero position). Its xor is nonzero: every game has a winning strategy for
the human, including Hard. This is a puzzle-like strategic game against a CPU,
not a claim of equal winning chances under perfect play.

## CPU and undo

Easy chooses a seeded legal move. Normal chooses the optimal xor move on 70% of
turns when one exists; otherwise a seeded legal move. Hard always chooses an xor-zero
reply when available. There is no tree search; at most 32 legal removals are considered.
The reply uses one 450 ms effect-owned timer. Leaving, restarting, undoing, opening
the restart confirmation, hiding the page or native pause cancels it. A backgrounded
CPU turn requires Resume after returning, rather than resuming automatically.
Undo returns to the previous human decision, including both human and CPU moves,
and remains available after either result. No cost or quota.

## Screens, accessibility, and persistence

Home, three illustrated Quick Rules, game and statistics. Home remembers difficulty;
replacing an unfinished game asks first. The game has labelled row buttons and a
number control, with native keyboard activation and Ctrl/Cmd+Z for Undo. Selection
alone never removes stones. Result offers Undo, new game, home, optional ShareAction,
and the shared result ad placement. Reduced motion follows shared UI.

The `ni.` namespace has `saveGame`, `stats`, `flags`, `prefs` schema version 1.
The saved move list replays from seed and difficulty; illegal moves, out-of-range
values, oversized lists and finished saves are rejected. Undo history survives reload.
Only one slot exists; no daily. Statistics count starts and the first completed result
of each match by difficulty, plus total active seconds. Undo after a result permits
exploration but never counts the same match twice; that marker survives a saved undo.
A resumed match's elapsed and booked clocks share the saved baseline. Writes use
shared serialized persistence, including hide, native pause and unmount.

## Release evidence

English source copy plus Japanese and all 12 additional app locales are AI-authored
drafts on 2026-10-23. No human linguistic approval is claimed. Tests cover rules,
optimal play, deterministic CPU decisions, save replay and corruption, actual UI
controls, shortcut resume, hide/resume and timer cleanup. Physical device and human
translation review remain unperformed. Title/store/trademark review is not claimed.

Automated local check on 2026-10-23: the scoped Nim + Knight’s Tour run passed
6 test files / 31 tests. Nim includes 1,000 starting seeds solved by optimal human
play against Hard, all three CPU modes over 200 seeds, storage isolation, live CPU
cancellation/resume, terminal undo, clock booking at save/unmount, and resource cleanup.
These Node/jsdom checks are not a physical-device performance measurement.

## Visual refinement (2026-10-23)

The heaps are four flat rows of uniform slim counters, without bevels or shadows.
Selected removals become outlined, struck counters; the control tray also shows
`before − taken = after`. Eight count choices stay in a fixed two-by-four grid;
counts beyond the selected row are disabled. Take and Undo share one compact row.
The title, turn/difficulty strip, board and controls fit above the Web ad reserve on
360×740, while short screens retain scrolling. This changes presentation, not rules,
CPU choices or the persisted schema.
