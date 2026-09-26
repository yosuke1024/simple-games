/**
 * The crown mark (docs/CROWN_GRID_RULES.md §1, §13), drawn as inline SVG
 * instead of the `♛` glyph: a font can substitute the character for a
 * different weight, a different tilt, or drop it to a fallback font entirely,
 * so the same board reads differently depending on what happens to be
 * installed. A plain silhouette — a band, three peaks and a bead on each
 * peak, no jewels — reads the same on every device and every theme, the same
 * reasoning as `ShapeIcon` (`src/games/shape-regions/ui/components/ShapeIcon.tsx`).
 * The beads are what keep it a crown rather than a row of spikes at 15px.
 *
 * `currentColor` so the ink follows `.cg-glyph`'s own colour (`--ink`, or
 * `--cg-warn-ink` on a crown that breaks a rule) without knowing about either.
 */
export function CrownGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M3.4 19.5 L2.3 8.4 L8 12.6 L12 5.4 L16 12.6 L21.7 8.4 L20.6 19.5 Z" />
      <rect x="2.9" y="17.2" width="18.2" height="3.4" rx="1.5" />
      <circle cx="2.5" cy="7.6" r="1.75" />
      <circle cx="12" cy="4.6" r="1.75" />
      <circle cx="21.5" cy="7.6" r="1.75" />
    </svg>
  );
}
