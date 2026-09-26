/**
 * The five shape symbols of docs/SHAPE_REGIONS_RULES.md §2, drawn as tiny
 * cell diagrams in the current ink. Inline SVG rather than a glyph or an
 * emoji (§13): the same in every font, every locale and both themes, and a
 * screen reader gets the category's translated name from the cell's label
 * instead of a picture.
 *
 * Each figure is the smallest member of its family, laid on a 3×3 grid of
 * unit cells so the five read at the same weight next to a digit.
 */
import type { ShapeCategory } from '../../game';

const UNIT = 16 / 3;
const INSET = 0.7;

/** Cells as [row, col] on the 3×3 grid, fractional to centre the short ones. */
const FIGURES: Record<ShapeCategory, readonly (readonly [number, number])[]> = {
  line: [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  block: [
    [0.5, 0.5],
    [0.5, 1.5],
    [1.5, 0.5],
    [1.5, 1.5],
  ],
  corner: [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  tee: [
    [0.5, 0],
    [0.5, 1],
    [0.5, 2],
    [1.5, 1],
  ],
  step: [
    [0.5, 0],
    [0.5, 1],
    [1.5, 1],
    [1.5, 2],
  ],
};

export function ShapeIcon({ category }: { category: ShapeCategory }) {
  return (
    <svg className="sr-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {FIGURES[category].map(([row, col]) => (
        <rect
          key={`${row},${col}`}
          x={col * UNIT + INSET}
          y={row * UNIT + INSET}
          width={UNIT - INSET * 2}
          height={UNIT - INSET * 2}
          rx={0.9}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
