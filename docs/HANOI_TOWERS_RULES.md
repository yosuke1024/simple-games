# Hanoi Towers — canonical rules

**2026-10-29 更新(正式収録、v1.7.0):** 製品オーナーの判断で Web 先行公開(ベータ)から正式収録した(registry の `channel` を外した — アプリのホーム・検索・ショートカットにも出る)。保存スキーマはこの収録で凍結し、以後は移行だけで変える — 公開中の Web ビルドが実際に書いた保存を `storage/releasedRecords.test.ts` が今の読み込み経路へ通す([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §0 と 2026-10-29 の節)。以下の「正式収録まで凍結しない」「アプリには出ない」などのベータ段階の記述は当時の記録である。収録は 2 週間の安定稼働・滞在時間の確認・実機での確認を満たしたという意味ではない。

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
automatic move or animation loop (the one-shot lift and settle of a disk are
transitions, described under Visual presentation).

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

## Visual presentation

The board is a warm wooden tray seen as a plank. Its wood gradient carries two
faint grain layers (repeating gradients with periods of 9 px and 23 px, set a
degree or two off the horizontal and off each other so that no repeat shows
across the tray; one shared tint of at most 5% alpha), a lit line on the top
edge, a shade at the bottom and an opaque front, darker than the tray, so the
thickness reads on the paper. The tray's own 1 px edge keeps the existing tray
colours. Its outer shadows run the lift first (the opaque front), then the
collection's ambient glow (`0 8px 18px var(--accent-ring-soft)`); the paper and
line rings of the collection's board frame are not drawn, because the plank
carries its own edge and an opaque front. This is a deliberate difference from the
collection's board frame recipe (`0 3px 0 var(--line), 0 0 0 3px var(--paper),
0 0 0 4px var(--line), 0 8px 18px …`): a 3 to 4 px ring would sit beside the
front's flat sides and cut it at the corners. It is judged from the geometry, not
from a rendering, and recorded here; the plank's colours are in the game-content
exception table of `docs/BRAND.md` (2026-10-29). The tutorial's small tray is the
same plank.

Pegs, bases and disks are turned wood with individually drawn peg bases and disk
edges. Light comes from above throughout: a lit line on the left of each peg, on
the top of each disk and on the top of each base, and the opposite side shaded
(the right of the peg, and a line near the lower edge of each disk and of each
base, kept clear of the printed number). The cast shadows are darker than the
tray in both themes; in dark mode they are black, because the light theme's
brown would shine on a dark tray. These highlights and shades are restrained and
add nothing a player has to read: disk widths and printed numbers remain the
primary identifiers, and the selected, lifted disk uses the title's plum accent.
The same accent marks the move count, destination frame and final-peg flag. The
selected column is tinted with `--accent-ring-soft` over the wood (2026-10-29;
it replaces the opaque `--accent-soft` sheet, which hid the tray under a grey
square), so the grain keeps showing through; its border, the dashed destination
frame, the arrows and the lift are unchanged. Dark mode uses a darker wooden tray
while retaining the readable physical disk colours. The home mark is a drawn
stack of disks, matching the actual board. Compact-height layouts retain the
existing board and control footprint and scrollable ad-safe content.

App banner (2026-10-29): the reserved `BannerSlot` is now the last child of the
`.screen`, after the scrolling `.game-content` (as in Color Flood), so on a short
screen the play area scrolls above the native strip instead of the strip
scrolling with it. Measured on the Android emulator, nothing sat under the strip before or
after at 360×640 or 411×914 with a 64 px or 90 px slot; at 360×640 with a 90 px
slot the play area now scrolls by 3 px. The web build is
unchanged (`BannerSlot` renders nothing there).

Lifting and placing is the one motion on the board. This is the owner's decision
of 2026-10-29, and it reverses the 2026-10-23 sentence "Small shadows give the
pieces depth without movement or extra animation". Selecting a peg lifts its top
disk 12 user units over 140 ms; cancelling lowers it the same way; a disk carried
to another peg by a move or by Undo settles onto it from the same height over
140 ms, once (a restart or a new board, which moves several disks at once,
settles none). Only `transform` is transitioned: the disk's group rises, and its
shadow, offset back down inside the group, stays nearer the tray so that a gap
opens. The shadow is also fainter while the disk is lifted; that tint switches at
once and is not animated (inside 140 ms the step is not noticed). No filter, no
loop, and one small SVG at a time. Under Reduced Motion, by the OS
setting or by the in-app switch, the transition and the settle are removed and
the disk simply is where it is. The timing is not tied to any game state: nothing
waits for it, and input is never ignored while it runs.

Every colour of the tray, pegs, bases and disks is game content, declared once in
the two blocks at the top of `hanoi-towers.css` (`--ht-*`, light and dark, as
listed in `docs/architecture/css-split.md`) and nowhere else; a custom property
written with eight hex digits carries its own alpha. The tokens are
`--ht-tray-top` / `--ht-tray-bottom` (light `#f2e8d7` / `#e9ddc8`, dark
`#39332c` / `#302a24`), `--ht-tray-edge` (`#c2af91` / `#695943`),
`--ht-tray-face` (`#c8b490` / `#241f1a`), `--ht-tray-lit` (`#fff9ed` /
`#514739`), `--ht-tray-shade` (`#765b3817` / `#00000026`), `--ht-grain`
(`#765b380c` / `#fff0d70a`), `--ht-peg` (`#7d5f3f` / `#b89d77`), `--ht-peg-lit`,
`--ht-peg-shade`, `--ht-peg-ink` for the peg numbers (`#574632` / `#e4d4ba`),
`--ht-base` and `--ht-base-edge` (`#b49368` and `#7a5d3d`), `--ht-cast` with
`--ht-cast-alpha` and `--ht-cast-lifted-alpha` (`#6b4d30`, 0.18 and 0.12 / `#000000`,
0.32 and 0.21), `--ht-disk-0` to `--ht-disk-4` (`#f0dfbf`, `#e9d2aa`, `#dfc398`,
`#d5b587`, `#cbaa7c` in both themes), `--ht-disk-edge`, `--ht-disk-lit`,
`--ht-disk-shade`, `--ht-disk-ink` and `--ht-valid` (the destination wash). The
peg, the peg numbers and the base edge were darkened from `#8c6c49`, `#5f4d39`
and `#8d6f4e` so that they still clear their floors under the translucent
selection wash and the grain; the tray colours are unchanged.

2026-10-29 sRGB contrast, measured by `ui/contrast.test.ts` from the stylesheets
(replacing the 2026-10-23 hand calculation); light / dark, each pair taken
against both ends of the tray gradient, bare, under both grain layers crossing,
and under the selected and the destination wash on top, so the figures are the
worst case: peg numbers 4.87 / 5.54:1 (text target 4.5:1); disk numbers on every
disk 5.78 / 5.78; the number on the lifted disk 13.59 / 8.67; the disk edge
against every disk fill 3.06 / 3.06; pegs 3.16 / 3.12; the base by its fill or
its edge, against the bottom of the tray, 3.27 / 3.13; accent marks and the
lifted disk 7.33 / 3.89 (required graphics 3:1). The test also fails on a colour
literal outside the two blocks. The lit and shade lines, the grain, the tray's
front and the cast shadows are decorative and excluded from the floors; the test
pins only their direction (the lit line is lighter than what it lies on, the
shade and the cast shadow are darker, the front is opaque and darker than the
tray, the grain stays at or below 5% alpha) and the motion's 140 ms,
transform-only form with its Reduced Motion removal. It also pins the wiring the
figures above depend on: the selected column's `--accent-ring-soft` wash, the
destination's `--ht-valid`, and which rule reads which token (the peg numbers,
pegs, base, disk fills, edges and numbers, the accent marks, the lifted disk's
number, the lit and shade lines and the cast shadows), so a rule that is pointed
at another token fails instead of leaving these numbers describing a different
picture.

## Persistence, statistics and lifecycle

Four version-1 independent records: `hn.saveGame`, `hn.stats`, `hn.flags`,
`hn.prefs`. One suspended slot. Save records contain size, a reserved unsigned
seed, action history, elapsedSeconds, cleared and savedAt. Restoring replays legal
actions from the initial tower, rejecting impossible moves, finished saves,
unknown versions and malformed data. Saved action count has no fixed limit,
matching unlimited play and Undo; validation checks every action in linear time.
No search runs on load. Unknown properties are stripped. Beta schemas are not
yet frozen.

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
243 five-disk arrangements. Follow-up storage regressions cover a legal
100,001-action save/load roundtrip, Undo and another save/load, plus rejection of
an illegal action after 100,000 legal actions. UI checks cover tutorial, shortcut resume, legal destination
cues, invalid moves, keyboard input, modal isolation, completion/Undo/recompletion
without double counting, hidden and dialog-paused time, and unmount bookkeeping.
Japanese browser simulation at 360×740 completed the 3-disk puzzle in seven moves
and verified the result card. The board and result were also seen in a desktop
viewport. These observations are not physical-device or linguistic review.

2026-10-29 visual refinement (plank grain, turned-wood shading, lift and settle,
selection wash): checked by the Hanoi suites (the new `ui/contrast.test.ts`, the
`Board` motion tests and the existing screen tests), scoped ESLint and a
typecheck. The rendering itself was not seen when it was written, so the grain
periods and alphas, the look of the shade lines and the 140 ms motion are
unobserved, in a browser and on a device; Chromium 88 behaviour of CSS
transforms on SVG groups is likewise unverified.
