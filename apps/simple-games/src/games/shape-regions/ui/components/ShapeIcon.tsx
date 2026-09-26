/**
 * The five shape symbols of docs/SHAPE_REGIONS_RULES.md §2, drawn as tiny
 * cell diagrams in the current ink. Inline SVG rather than a glyph or an
 * emoji (§13): the same in every font, every locale and both themes, and a
 * screen reader gets the category's translated name from the cell's label
 * instead of a picture.
 *
 * With no `cells`, the icon draws the smallest member of its category, laid
 * on a 3×3 grid of unit cells so the five read at the same weight next to a
 * digit — this is what an unfinished clue shows, since there is no single
 * region yet to draw.
 *
 * Once a region satisfies its clue (§5), the board passes that region's own
 * cells instead, already turned into (row, col) offsets normalized to the
 * region's own bounding box (`offsetsOf` + `normalize` in `game/shapes.ts`).
 * The icon then draws the shape actually placed, not a stand-in for its
 * category: the longer side of the bounding box fills the 16-unit viewBox
 * and the shorter side is centred in it.
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

/**
 * How far a real region's rects are pulled in from their unit cell, by
 * region size (§1: 2–6). A bigger region packs more units into the same
 * 16-unit viewBox, so the inset shrinks to keep every cell legible up to a
 * six-cell line — the same INSET as the category figures for the smallest
 * regions, easing down from there.
 */
const REAL_INSET_BY_SIZE: Record<number, number> = {
  2: 0.7,
  3: 0.7,
  4: 0.6,
  5: 0.5,
  6: 0.4,
};

export interface ShapeIconProps {
  readonly category: ShapeCategory;
  /**
   * The region's actual cells once it satisfies its clue (§5): (row, col)
   * pairs already normalized to their own bounding box (its top-left at
   * (0, 0)). When given, these replace the category's stock figure.
   */
  readonly cells?: readonly (readonly [number, number])[];
}

export function ShapeIcon({ category, cells }: ShapeIconProps) {
  if (cells === undefined) {
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

  const width = Math.max(...cells.map(([, col]) => col)) + 1;
  const height = Math.max(...cells.map(([row]) => row)) + 1;
  const span = Math.max(width, height);
  const unit = 16 / span;
  const inset = REAL_INSET_BY_SIZE[cells.length] ?? 0.4;
  // The shorter axis is centred in the square viewBox; the longer one
  // already fills it (offset 0).
  const offsetX = ((span - width) * unit) / 2;
  const offsetY = ((span - height) * unit) / 2;

  return (
    <svg
      className="sr-icon sr-icon-placed"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {cells.map(([row, col]) => (
        <rect
          key={`${row},${col}`}
          x={col * unit + offsetX + inset}
          y={row * unit + offsetY + inset}
          width={unit - inset * 2}
          height={unit - inset * 2}
          rx={0.9}
          fill="currentColor"
        />
      ))}
    </svg>
  );
}
