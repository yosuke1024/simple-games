# Playing-card design

2026-11-05 owner direction: improve both new and existing playing-card games,
including landscape play. The shared artwork is in `src/ui/cards/`; it is a
presentation component, not shared game rules or a game registry.

## Cards

The owner reviewed the first illustrated design on 2026-11-05 and explicitly
chose: no people, a simpler design overall. This is the current direction and
supersedes the initial pip/court-portrait proposal.

- Paper stays light in both themes. Each game's existing dark ink and red suit
  tokens remain authoritative; shapes identify suits without colour.
- Two mirrored corner indices and a single central suit mark on number cards.
  J/Q/K use a large central letter with a smaller suit below. No people, metallic
  accents, repeated pips or decorative illustration. Joker uses a star and label.
- Solitaire, FreeCell, Spider and Three Peaks use a horizontal rank/suit index so
  both remain visible when cards overlap vertically.
- Back: a muted green field, paper margin and one thin inner frame. No dense pattern.
- SVG scales against the actual card. Do not use viewport/container units for the
  indices. Buttons retain translated labels, keyboard focus and selection semantics.
- Backs accept no rank, suit or identity. Hidden information never enters artwork
  props, labels, data attributes or markup.
- A dev-only comparison with the previous Hearts face is available at
  `apps/simple-games/prototypes/card-design/index.html` via the local Vite server.

## Table and orientation

Landscape layouts place the public table and private hand in space that respects
the screen height, safe areas and reserved advertising. Use CSS breakpoints;
do not remount the game or mutate its state on rotation. Portrait remains usable.
Selections need a visible border/lift/check, not colour alone. Keep unplayable
ranks readable. Nearby and CPU play use the same visual components.

## Verification

Use rendered game screens, not only CSS checks. Inspect small portrait and
landscape phones, wide screens, light/dark themes and nearby layouts. Record
the exact scope in the implementation plan. Shared artwork is adopted by all 16 playing-card games. Solitaire, FreeCell, Spider and Three Peaks
use a horizontal rank/suit index for overlapping columns. Visual evidence and its limits
are recorded in the implementation plan.
