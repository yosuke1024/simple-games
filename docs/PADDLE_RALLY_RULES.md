# Paddle Rally

**2026-10-29 更新(正式収録、v1.7.0):** 製品オーナーの判断で Web 先行公開(ベータ)から正式収録した(registry の `channel` を外した — アプリのホーム・検索・ショートカットにも出る)。保存スキーマはこの収録で凍結し、以後は移行だけで変える — 公開中の Web ビルドが実際に書いた保存を `storage/releasedRecords.test.ts` が今の読み込み経路へ通す([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §0 と 2026-10-29 の節)。以下の「正式収録まで凍結しない」「アプリには出ない」などのベータ段階の記述は当時の記録である。収録は 2 週間の安定稼働・滞在時間の確認・実機での確認を満たしたという意味ではない。

2026-10-23. Canonical rules for the Web beta.

A single-player paddle match against a local CPU. The player controls the lower
paddle and the CPU the upper one; side walls reflect the ball. Missing a paddle
awards the opponent one point. First to five wins. There is no time limit.
Three difficulties change the CPU movement speed, not the rules. The ball's exit
angle depends on where it hits the paddle. Each point waits for an explicit serve.

Drag horizontally, hold the left/right buttons, or use arrow/A-D keys. Serve and
pause have visible buttons and Space/P keyboard equivalents. All help takes the
form of free immediate replay. No hint or undo replaces a real-time rally.

## Visual presentation

The board uses simple original SVG shapes and the game's shared accent.
The paper-toned court has a fine inner boundary, quiet service lines and subtle
static depth. Paddle edges, a grouped scoreboard and tactile control surfaces
use the same shared palette; the player's score carries the title accent.
These details add no animation and do not change the court or hit geometry.

Added 2026-10-29. The light on the board comes from above, and the moving
shapes take it. None of this adds a mark, a number or a motion, and every
colour is a shared token: `paddle-rally.css` writes no colour literal, so there
is no game-content colour block (`ui/contrast.test.ts` reads the pairs below
from `ui/styles.css` and the stylesheet, and fails on any literal).

- The ball is an object: a contact shadow (`.pr-ball-shade`, offset 0.7 right and
  2 down, same radius, drawn under the paddles) and a short arc of top light
  inside its upper left (`.pr-ball-glint`, half opaque). The body keeps r=6 and
  the shadow and arc are drawn from the same ball position, so the hit
  geometry is unchanged. The shadow is `--accent-ring` in light and `--paper`
  in dark; the arc is `--surface` in light and `--ink` in dark. Dark cannot go
  darker than `--paper` (1.2:1 on the court), so there the arc does the work.
  Neither carries meaning: the ball is the accent disc on both themes.
- Paddle edge line: in light it is the lit top edge (`--surface` at 0.45). In
  dark `--surface` is darker than the paddles and the same line would read as
  a groove cut into the top, so there it moves down 4px (2px above the bottom)
  and is the shade along the lower edge (`--paper` at 0.7; 3.36:1 on the
  player's paddle and 3.60:1 on the CPU's). It is decoration, not measured as
  meaning.
- The CPU's paddle is `--ink` in light and `--ink-soft` in dark; the Quick Rules
  figure carries the same class. In dark `--ink` is the cream, 12.1:1 on the
  court against the player's 4.3:1, which made the opponent the loudest thing
  on the board. `--ink-soft` puts the two at the same weight as in light
  (player against CPU 1.16:1 in dark, 1.15:1 in light); position (top and
  bottom) and hue still tell them apart, so colour is not the only carrier.
- The left/right keys use the shared key surface (`.action-btn` in
  `ui/styles.css`): a lit top edge and a 2px lip, recessed while held, flat when
  disabled. Their arrows are the shell's `IconBack`, the right one turned half a
  turn, instead of the text glyphs `←` `→`. The held key no longer tints to
  `--accent-soft`; the recess is the shared key's pressed state.
- Contrast, measured from the tokens (light / dark): the ball and the player's
  paddle on the court's two ends 12.35 and 11.03 / 4.29 and 5.13; the CPU's
  paddle 14.24 and 12.72 / 4.96 and 5.92; all clear 3:1. The ball's arc against
  the ball is 4.28 in light and 1.72 in dark (decoration); the shadow against
  the court is 2.17 in light and 1.20 in dark.
- The board's frame is the collection's recipe, in this order: the 3px lift, a
  3px paper ring with its 1px hairline, then the title-tinted glow (18px). It
  replaces the two-layer shadow this title had until now (a lift and a 20px
  glow), so the board sits on the page like the others; the court, the viewBox and the hit geometry are untouched.
- The Home artwork and the Quick Rules figure stay flat pictograms; only the
  board is lit. The serve does not set the ball down with a motion: the board
  still adds no animation.

## Persistence, lifecycle and shell

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
