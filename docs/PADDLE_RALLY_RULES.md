# Paddle Rally

2026-10-23. Canonical rules for the Web beta.

A single-player paddle match against a local CPU. The player controls the lower
paddle and the CPU the upper one; side walls reflect the ball. Missing a paddle
awards the opponent one point. First to five wins. There is no time limit.
Three difficulties change the CPU movement speed, not the rules. The ball's exit
angle depends on where it hits the paddle. Each point waits for an explicit serve.

Drag horizontally, hold the left/right buttons, or use arrow/A-D keys. Serve and
pause have visible buttons and Space/P keyboard equivalents. All help takes the
form of free immediate replay. No hint or undo replaces a real-time rally.
The board uses simple original SVG shapes and the game's shared accent.
The paper-toned court has a fine inner boundary, quiet service lines and subtle
static depth. Paddle edges, a grouped scoreboard and tactile control surfaces
use the same shared palette; the player's score carries the title accent.
These details add no animation and do not change the court or hit geometry.

One `pr.saveGame` slot stores a validated version-1 snapshot, including scores,
ball and paddles. `pr.stats`, `pr.flags`, `pr.prefs` own statistics, tutorial status
and preferred difficulty. Existing games' keys are untouched. Resuming always
waits for the player; hidden page, blur, dialogs, native pause and unmount stop
simulation. Frame work runs only during a live rally, with a bounded timestep;
saves occur at serve/score/pause/exit, never per frame. Active time is booked on
pause/exit/unmount with the same baseline to avoid duplicate accounting.

Home, three illustrated Quick Rules, game, result and statistics use existing
shell contracts. An interrupted match may resume from a shortcut. Results offer
optional sharing using only the displayed score. No Club House, daily mode,
network, paid features, or new dependency is added.

Copy in English, Japanese and the other twelve locales is AI-authored; human
language review and physical-device verification are not claimed. Automated and
browser evidence will be recorded in the batch publication plan.
