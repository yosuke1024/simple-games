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
countdown or animation loop. The only motion is CSS (2026-10-29): a tile's
background and ink ease together over 140 ms when the board changes colour, and
the progress bar eases its width over 180 ms. Neither is a loop, a timer or a
listener, so nothing is released on unmount, and Reduced Motion (the OS
preference or the in-app setting) turns both off. Unlimited Undo during play and
on the result card; retry starts the same seed, new board uses a fresh seed. New
board / retry during play require the shared RestartDialog; replacing a
suspended board also asks. First launch shows Quick Rules in three steps then
starts immediately. Later launches show Home; a shortcut resumes a valid
suspended game directly.
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

Calculated sRGB contrast for the six active symbols against their tile colours
in the light theme: red 6.05:1, blue 6.10:1, yellow 9.57:1, green 5.36:1, purple
5.79:1 and orange 5.75:1. The contour of a flooded region and the origin mark are
drawn in the same ink and so carry the same ratios. The dark theme has its own
tile colours and its own ratios (Visual follow-up, 2026-10-29). The symbol is
repeated on its palette button; colour alone is never required. Disabled colours
are dimmed and do not accept moves.

## Visual follow-up (2026-10-23)

The six symbols are now vector artwork shared by the board, palette and tutorial,
so their appearance does not depend on the device font. A thin framed board and
continuous white boundary mark the connected region; a progress bar repeats the
visible connected-cell count. The palette uses matching round colour swatches
with the existing 1–6 shortcuts. Short Web viewports scroll within the game area
above the reserved ad space. Rules, palette colours, storage and scoring are
unchanged. The scoped 13 tests pass after this presentation change.
Desktop-browser checks at phone widths are recorded in the implementation plan;
no physical-device or screen-reader session is claimed. Two lines of this
section were reversed on 2026-10-29 (the white boundary and the unchanged palette
colours); they are listed once, under "Decisions reversed" below.

## Visual follow-up (2026-10-29)

Owner's decision, 2026-10-29: the board should read as one sheet of paint on a
framed tile, lit from above, without anything being added to it. Rules, symbols,
palette shortcuts, storage and scoring are unchanged, and no element, text or
information joins the board. Five things change, all of them presentation:

1. The dark theme gets its own six tile colours.
2. The contour of the flooded region is drawn in the tile's own ink instead of
   white. Its 2 px width does not change.
3. The seams between flooded tiles are gone.
4. The frame, the board's light and the palette keys gain thickness and a
   contact shadow, all static.
5. A tile's colour and the progress bar ease over 140 ms and 180 ms.

The symbol on every tile, the origin mark and the width of the contour are what
carry the meaning, and they stay as they were.

Decisions reversed (owner, 2026-10-29), recorded once here:

- 2026-10-23, "continuous white boundary": the boundary is the tile's own ink.
- 2026-10-23, "palette colours unchanged": the dark theme used the light values;
  it now has its own six.
- Until now the game had no motion at all: it has the two transitions above, and
  nothing else.

Colours. The six tile colours and their ink are tokens, `--cf-0`…`--cf-5` and
`--cf-0-ink`…`--cf-5-ink`, in the two blocks at the top of `ui/color-flood.css`
(light, dark). They are game content, the exception listed in
`architecture/css-split.md` and BRAND.md, and `ui/contrast.test.ts` reads the two
blocks and fails on any colour literal outside them. Tile 0 to 5 is circle, diamond,
triangle, square, star, cross. The light values are unchanged. The dark theme had
the light values until now; against `--surface` (#212730) they measured red 2.48,
blue 2.46, green 2.80 and purple 2.59 (all under 3:1) while yellow measured 9.01
and glared. It now has its own:

| Tile   | Light tile | Dark tile | Ink (both) | Light: on surface / paper / ink | Dark: on surface / paper / ink |
| ------ | ---------- | --------- | ---------- | ------------------------------- | ------------------------------ |
| red    | `#ad394e`  | `#c14a60` | `#ffffff`  | 5.95 / 5.31 / 6.05              | 3.16 / 3.78 / 4.76             |
| blue   | `#2564a5`  | `#3b74b4` | `#ffffff`  | 6.00 / 5.36 / 6.10              | 3.11 / 3.72 / 4.84             |
| yellow | `#edc446`  | `#d1a838` | `#292107`  | 1.64 / 1.47 / 9.57              | 6.70 / 8.01 / 7.13             |
| green  | `#327758`  | `#3a8260` | `#ffffff`  | 5.28 / 4.71 / 5.36              | 3.25 / 3.89 / 4.62             |
| purple | `#7954a5`  | `#8a65b4` | `#ffffff`  | 5.70 / 5.09 / 5.79              | 3.29 / 3.94 / 4.56             |
| orange | `#d87d30`  | `#cc762f` | `#23170b`  | 2.996 / 2.68 / 5.75             | 4.44 / 5.30 / 5.17             |

Calculated sRGB (WCAG relative luminance) and re-run by `ui/contrast.test.ts`.
Every dark tile clears 3:1 on both `--surface` and `--paper`, and every ink clears
4.5:1 on its tile in both themes. The dark yellow is dimmed on purpose and the four
saturated colours sit close in lightness: a tile that must clear 3:1 on `--surface`
and still carry white ink at 4.5:1 has a relative luminance between about 0.160 and
0.183, and these four are 0.167 to 0.180. They are told apart by hue and, always, by
symbol, as the light red and blue already are (1.01:1 apart).

Known exception. The light yellow (1.64:1 on `--surface`, 1.47:1 on `--paper`)
and the light orange (2.996:1 on `--surface`, a hair under, and 2.68:1 on
`--paper`) stay under 3:1; the light values are not darkened, because a yellow
that reaches 3:1 is no longer yellow. What carries their edge, and what does not:

- Inside the flooded region the ink contour does, at 9.57:1 on yellow and 5.75:1
  on orange. The symbol on every tile and on every palette key is at those same
  ratios.
- A yellow or orange tile that is not yet in the region has no contour, and the
  frame's line ring is not against it: it sits 5 px outside the outermost tile,
  and the `--surface` in between stays. At the rim of the board the edge of such a
  tile is therefore only its own lightness against `--surface` (1.64:1, 2.996:1).
  Between neighbours it is the difference in lightness (yellow against orange is
  1.83:1, for one) and the symbols. This is accepted.
- The light yellow palette key (1.47:1 on `--paper`) has its lower edge from the
  cast shadow, `--cf-drop` below.

`ui/contrast.test.ts` names exactly these two colours (light only) and fails if
the list gains or loses a member.

Flooded region. Inside the region the 0.5 px seam between tiles is gone
(`.cf-connected { box-shadow: none }`), so the painted area is one sheet; tiles not
yet flooded keep their seam. The contour is drawn in the tile's own ink instead of
a fixed white: on yellow it is 9.57:1 where white was 1.67:1, on orange 5.75:1 where
white was 3.05:1. The contour's 2 px width, the origin mark and the symbols are
unchanged. When the board is cleared every tile is in the region, all seams are
gone and only the outer contour remains.

Frame and light. The board frame is the collection's: the lift first, then a paper
edge, a line ring and a soft glow in the title's accent.

```css
box-shadow:
  0 3px 0 var(--line),
  0 0 0 3px var(--paper),
  0 0 0 4px var(--line),
  0 8px 18px var(--accent-ring-soft);
```

One static layer over the whole mosaic (`.cf-board::after`) adds a 1 px lit top edge
(`--cf-light`) and a 2 px shaded bottom edge (`--cf-shade`). A bevel on each tile is
not used: it would draw a second grid over the single sheet. The Quick Rules figure
is built the same way (no gap between tiles, corners rounded like the board's,
and the frame's 10 px radius so they nest the way the board's do).
The texture tokens are rgba values in the two blocks; they carry no meaning, so
they have no 3:1 to clear, and the test only requires the lit side to be lighter
than the shaded one and each cue to show on all six tiles:

| Token        | Light                   | Dark                    |
| ------------ | ----------------------- | ----------------------- |
| `--cf-light` | `rgba(255,255,255,.34)` | `rgba(255,255,255,.12)` |
| `--cf-shade` | `rgba(35,42,51,.16)`    | `rgba(0,0,0,.28)`       |
| `--cf-drop`  | `rgba(35,42,51,.22)`    | `var(--line)`           |
| `--cf-seam`  | `rgba(255,255,255,.19)` | `rgba(255,255,255,.19)` |

Measured as contrast of the veil laid over each tile, against that tile: the lit
edge 1.19 (yellow) to 2.04 in the light theme and 1.11 (yellow) to 1.26 in the dark;
the shaded edge 1.15 to 1.32 and 1.62 to 1.85; the key's drop shadow on `--paper`
1.53 and 1.59.

The light `--cf-drop` is a value of its own, not `--line` as it is on the shared
action keys (`--line` on `--paper` is 1.26:1, against 1.53:1 here). The reason is
the light yellow key: at 1.47:1 on `--paper` its lower edge has only this shadow to
rest on, so the shadow is a little firmer than the shared keys'. In the dark theme
every key is far from `--paper` (the yellow one 8.01:1), so `--cf-drop` is
`var(--line)`, the shared keys' own.

Palette keys. Each round key is an enamel key like the shared action keys: lit top,
shaded bottom and a 2 px lift.

```css
box-shadow:
  inset 0 1px 0 var(--cf-light),
  inset 0 -2px 0 var(--cf-shade),
  0 2px 0 var(--cf-drop);
```

Pressing sinks it with the shadow only (`inset 0 1px 2px var(--cf-shade)`); there
is no transform, so a finger on the lower edge never leaves the key and the click
is kept. The colour the board already
is stays pressed in and keeps its 1 px outline, which is the cue that does not
rely on the shadow. A colour that cannot be played is flat and dimmed as before.
Round colour swatches, 1–6 shortcuts, labels and focus order are unchanged.

Motion. A tile's background and ink ease together over 140 ms (so yellow never shows
white ink for a frame) and the progress bar eases over 180 ms. The contour is a
pseudo-element and does not transition: it follows the tile's ink as that eases.
`ui/color-flood.css` ends both transitions itself under the OS Reduced Motion
preference and under the app's own setting, in addition to the shared rules. A
diagonal stagger from the origin was considered and is not adopted: it needs a
delay that Reduced Motion's shared rule does not cancel, and a timing measurement
on the low-spec floor that has not been made.

Checks run on 2026-10-29: the scoped Vitest run for this game passed (5 files, 41
tests, of which the new `ui/contrast.test.ts` is 28 and `ui/styles.test.ts` now
also accepts the game's own `--cf-*` tokens), as did the shared
`src/test/styles.test.ts` (11 tests), ESLint on the files touched and the
whole-app TypeScript check. A static page made of the game's own stylesheet and
the board's markup (6×6, a yellow region touching the top edge, six keys; not the
app itself) was looked at in the browser pane, light and dark, at device pixel
ratio 2: the frame, the seamless region, the ink contour on yellow, the lit and
shaded edges and the keys looked as designed. The lit line of a key sits a pixel
inside its rim and reads as a rim light; where the region meets the board's top
edge the contour's top row is lightly veiled by the lit edge, and stays legible. Not
checked by eye: the app itself, the transitions (that page had Reduced Motion
on), a 14×14 board and its possible hairlines between flooded tiles where tile
widths are fractional (about 24.4 px) at device pixel ratios of 2 to 3, the
contour on orange, and any device, emulator or screen-reader session.
