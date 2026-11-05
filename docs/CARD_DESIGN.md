# Playing-card design

2026-11-05 owner direction: improve both new and existing playing-card games,
including landscape play. The shared artwork is in `src/ui/cards/`; it is a
presentation component, not shared game rules or a game registry.

## Cards

- Warm paper, dark navy/green ink and burgundy red. Keep paper light in the dark
  theme; do not invert the suits into neon. Existing per-game contrast palettes
  continue to control the card surface and selection state.
- Original vector suits, conventional pip layouts, mirrored corner indices,
  distinct double-ended jack/queen/king illustrations and a distinct joker.
  No fetched artwork, fonts or sprite sheets. Decorative brass and cream are
  part of the illustration, not additional UI accent colours.
- SVG viewBox scales the entire face against the actual card, including in
  narrow nearby rooms. It must not size indices using viewport or container
  query units. Existing card buttons retain their labels, focus, selection and
  touch targets; artwork is aria-hidden and never supplies interaction semantics.
- Backs receive no rank/suit/card ID. Hidden hands must never be passed to the
  artwork layer or leaked through labels, React keys, data attributes or markup.

## Table and orientation

Landscape layouts place the public table and private hand in space that respects
the screen height, safe areas and reserved advertising. Use CSS breakpoints;
do not remount the game or mutate its state on rotation. Portrait remains usable.
Selections need a visible border/lift/check, not colour alone. Keep unplayable
ranks readable. Nearby and CPU play use the same visual components.

## Verification

Use rendered game screens, not only CSS checks. Inspect small portrait and
landscape phones, wide screens, light/dark themes and nearby layouts. Record
the exact scope in the implementation plan. Card artwork adoption and landscape
work are in progress, not yet collection-wide.
