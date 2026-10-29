# Knight’s Tour — rules and implementation

Updated: 2026-10-29. Web early release. Canonical rules for this implementation.

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
baselines from saved elapsed time. There are no animation loops or solver timers (the
one-shot knight landing in “Visual refinement (2026-10-29)” plays once and ends).

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

## Visual refinement (2026-10-23)

The current knight, home mark and tutorial now use Chess's exact hand-drawn 40×40
SVG artwork through the shared, rule-free `ui/components/KnightArtwork.tsx`.
Chess retains its existing SVG wrapper, piece colours, classes and geometry. No
cross-game import is introduced. On Knight’s Tour the SVG box occupies 96% of a
cell, putting the drawn knight at about three quarters of its height. Contiguous
squares, a thin inset board frame, solid move dots and quiet visit numbers replace
the rounded button grid and Unicode knight. The board sizes against viewport height
as well as width, with a scroll fallback on short screens.

Measured WCAG relative-luminance contrast for the small visit numbers against the
two board squares is 7.81:1 / 5.71:1 in light mode and 4.62:1 / 7.24:1 in dark mode.
Dark-mode board ink is `#f8f7ee`; this changes only board marks and visit numbers,
not Chess's shared artwork or its ivory/ink piece colours. The minimum 4.5:1 text
contrast is checked from the actual stylesheet in `ui/contrast.test.ts`.

## Visual refinement (2026-10-29)

Owner decision, 2026-10-29: the knight and the marks on the board gain a little
physical weight. No element, word or piece of information is added to the board,
and the squares, their colours, the board frame and every geometry above (the 96%
knight box, the 4 px / 3 px frame padding, the 320 px fit) are unchanged. The figure of
a visit number is measured against its square exactly as above (the ink is unchanged);
against the 1 px lip drawn under it the light theme only goes up and the dark theme has
no lip, so the 4.5:1 promise holds there too (see “Letterpress marks”). No earlier
decision is reversed:
the knight is still Chess's artwork in the same ivory and ink, the numbers are
still quiet, the dots still solid, and there are still no animation loops.

- **The knight's colours are tokens.** The ivory fill and the ink edge were literals
  in the stylesheet; they are now `--kt-piece` (`#fbf7ee`) and `--kt-piece-edge`
  (`#2a241e`, also the eye) in the two colour blocks at the top of `ui/knight-tour.css`,
  with the same values in both themes. The knight is not swapped with the theme. Every
  colour the stylesheet writes is in those two blocks, and `ui/contrast.test.ts` fails
  on a colour literal anywhere else.
- **Contact shadow.** The current square draws a soft ellipse (`::before`,
  `--kt-contact`) just under the knight's pedestal: centred on the pedestal's lower
  edge (about 88% of the cell's height, stroke included) with radii of 33% (horizontal)
  and 9% (vertical) of the cell, so the strip that shows is the lower half, about 9% of
  the cell's height (the horizontal radius is at least the half-width of the base's
  straight part, and 88% + 9% stays inside the cell). On the 8×8 board the cells are
  about 33 to 39 px and the current square's frame (2 px in from the cell) crosses that
  strip, so the shadow is modest there — a thin line under the base; on 5×5 it is
  clearly visible. That was a judgement from a desktop render and is left to the owner's
  eye on a device. It paints behind the knight and the current-square frame, takes no
  pointer events and adds no DOM node. The test derives the pedestal's edge from the
  shared artwork's path and keeps the ellipse on it.
- **Landing.** Each move mounts a new knight in its square (the knight is a child of
  that square's button), and a CSS animation plays once: the knight drops 4% of its own
  height over 140 ms while the shadow fades in. Transform and opacity only, on two
  small elements, with no script and no timer. It is not a loop, a re-render that
  moves nothing does not replay it, and Undo plays it on the square it returns to.
  Reduced Motion, both the OS setting and the app's, turns both animations off: the
  knight is simply where it landed. The tutorial's figure is not animated.
- **Letterpress marks.** In the light theme a visit number has a 1 px lip of light under
  the figure (`text-shadow: 0 1px 0 var(--kt-number-lip)`, no blur, so the glyph is not
  softened). The dark theme has no lip under a number: its figures are light on a dark
  board, and a light lip directly under a light figure would take the figure from 4.62:1
  to 3.42:1 on the lighter square, below the 4.5:1 a small number is held to.
  `--kt-number-lip` is therefore `var(--kt-lit)` in light and `transparent` in dark. A
  move dot has the lip below it in both themes (`0 1px 0 var(--kt-lit)`) and a 1 px shade
  inside its top edge (`inset 0 1px 1px var(--kt-shade)`); its size and ink are
  unchanged, so it is still a solid dot, and it holds 3:1 against its lip. This is
  decoration: a number or a dot means the same without it, and the contrast above is
  measured on the ink.

| Token             | Light                       | Dark                        | Role                              |
| ----------------- | --------------------------- | --------------------------- | --------------------------------- |
| `--kt-piece`      | `#fbf7ee`                   | `#fbf7ee`                   | the knight's fill                 |
| `--kt-piece-edge` | `#2a241e`                   | `#2a241e`                   | the knight's edge and eye         |
| `--kt-lit`        | `rgba(255, 253, 248, 0.55)` | `rgba(248, 247, 238, 0.16)` | the lit lip under a mark          |
| `--kt-shade`      | `rgba(35, 42, 51, 0.3)`     | `rgba(0, 0, 0, 0.18)`       | the shade inside a dot's top edge |
| `--kt-contact`    | `rgba(42, 36, 30, 0.32)`    | `rgba(0, 0, 0, 0.45)`       | the knight's contact shadow       |
| `--kt-number-lip` | `var(--kt-lit)`             | `transparent`               | the lip under a visit number      |

The three alpha-only values are written as `rgba()` in the colour blocks because
`color-mix()` is not available on Chromium 88 and an alpha cannot be written on an
alias. In the light theme they are the shell's surface (`--kt-lit`), the shell's ink
(`--kt-shade`) and the knight's ink (`--kt-contact`) at an alpha; in the dark theme they
are the board ink (`--kt-lit`) and black (`--kt-shade`, `--kt-contact`) at an alpha. In
the dark theme the marks are light on a dark board, so the lip is a faint light and the
dot's shade stays below 0.19: at 0.19 the top row of a dot falls under 3:1 on the
lighter square.

Measured by `ui/contrast.test.ts` from the stylesheet (WCAG relative-luminance
contrast; the squares are `#e4dfd3` / `#c5c0b1` in light and `#677368` / `#46564d` in
dark, listed lighter square first). The knight is a fill inside an edge, and the test
pins which of the two carries it on each theme, at 3:1 on both squares: light, fill
1.24:1 / 1.70:1 and edge 11.53:1 / 8.43:1, so the ink edge carries it; dark, fill
4.64:1 / 7.28:1 and edge 3.09:1 / 1.97:1, so the ivory fill carries it. Fill against
edge is 14.34:1. A visit number's figure is 7.81:1 / 5.71:1 against the squares
in light and 4.62:1 / 7.24:1 in dark (the 4.5:1 floor); against the lip directly under
it, it is 9.08:1 / 7.98:1 in light and, with no lip, unchanged in dark. A move dot's
shaded top row, measured at the shade's full alpha, is 8.67:1 / 6.34:1 in light and
3.04:1 / 4.76:1 in dark against the squares (the dot itself is 7.81:1 / 5.71:1 and
4.62:1 / 7.24:1), and the dot against its 1 px lip is 9.08:1 / 7.98:1 in light and
3.42:1 / 4.85:1 in dark. The lip, the shade and the contact shadow have no 3:1 to
clear; the test pins that the lip is lighter, and the shade and the shadow darker, than
both squares in both themes, which is the light coming from above.

Rendering was inspected only in a desktop browser, on a static page assembled from
this stylesheet and the board's markup (5×5 in both themes, 8×8 in the light theme,
and the landing's first frame and the app-setting Reduced Motion switch read back
from the computed styles). A 5× zoom of an 8×8 board in both themes showed the contact
shadow thin there, and the vertical radius was raised from 7% to 9% on that account; the
9% was not rendered again. No device, emulator or Chromium 88 check is claimed, the
140 ms landing was not watched as motion, and the OS-level Reduced Motion media query
is covered by the stylesheet test and the shell's pseudo-element test, not by a run.
