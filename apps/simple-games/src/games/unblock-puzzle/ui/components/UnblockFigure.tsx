/**
 * A small, still picture of part of a board, drawn with the board's own
 * classes (ui/unblock-puzzle.css) — the Quick Rules figures (§13). Decorative:
 * every figure sits beside a sentence that carries its meaning, so the whole
 * figure is hidden from assistive technology.
 *
 * Arrows and marks are drawn in an SVG laid over the grid in cell units, so a
 * figure is written as "a block here, an arrow from there to there" and
 * scales with the cell size like the board does.
 */
import type { CSSProperties } from 'react';

export interface FigureBlock {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly kind: 'target' | 'h' | 'v';
  /**
   * Drawn as a dashed outline in the wood's edge colour (--ub-edge), never
   * the accent: where a block was. The board's accent dashes are the Hint's
   * "slide it here" (§6, §13).
   */
  readonly was?: boolean;
}

export interface FigureArrow {
  /** From and to, in cell units over the grid (cell centres are at .5). */
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface UnblockFigureProps {
  cols: number;
  rows: number;
  /** The row the exit is on, or null for a figure with no exit. */
  exitRow: number | null;
  blocks: readonly FigureBlock[];
  arrows?: readonly FigureArrow[];
  /** One ASCII number shown in a badge, in cell units — the move count of step 3. */
  badge?: { readonly x: number; readonly y: number; readonly value: number };
}

/** An arrow head at (x2, y2), pointing away from (x1, y1). */
function head(arrow: FigureArrow): string {
  const angle = Math.atan2(arrow.y2 - arrow.y1, arrow.x2 - arrow.x1);
  const size = 0.22;
  const spread = Math.PI / 5;
  const a = {
    x: arrow.x2 - size * Math.cos(angle - spread),
    y: arrow.y2 - size * Math.sin(angle - spread),
  };
  const b = {
    x: arrow.x2 - size * Math.cos(angle + spread),
    y: arrow.y2 - size * Math.sin(angle + spread),
  };
  return `M${a.x} ${a.y}L${arrow.x2} ${arrow.y2}L${b.x} ${b.y}`;
}

export function UnblockFigure({
  cols,
  rows,
  exitRow,
  blocks,
  arrows = [],
  badge,
}: UnblockFigureProps) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div
        className={`ub-board ub-figure${exitRow === null ? ' ub-figure-closed' : ''}`}
        style={
          {
            '--ub-cols': cols,
            '--ub-rows': rows,
            '--ub-exit-row': exitRow ?? 0,
          } as CSSProperties
        }
      >
        <div className="ub-grid">
          {Array.from({ length: cols * rows }, (_, cell) => (
            <div key={cell} className="ub-cell" />
          ))}
          {blocks.map((block, index) => (
            <span
              key={index}
              className={[
                block.was ? 'ub-figure-was' : 'ub-block',
                block.was
                  ? ''
                  : block.kind === 'target'
                    ? 'ub-block-target'
                    : `ub-block-${block.kind}`,
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  '--ub-x': block.x,
                  '--ub-y': block.y,
                  '--ub-w': block.w,
                  '--ub-h': block.h,
                } as CSSProperties
              }
            >
              {block.was ? null : block.kind === 'target' ? (
                <svg className="ub-target-mark" viewBox="0 0 24 24">
                  <path d="M6 12h11M12 6l6 6-6 6" />
                </svg>
              ) : (
                <span className="ub-groove" />
              )}
            </span>
          ))}
          {arrows.length > 0 || badge ? (
            <svg
              className="ub-figure-marks"
              viewBox={`0 0 ${cols} ${rows}`}
              preserveAspectRatio="none"
            >
              {arrows.map((arrow, index) => (
                <g key={index}>
                  <path d={`M${arrow.x1} ${arrow.y1}L${arrow.x2} ${arrow.y2}`} />
                  <path d={head(arrow)} />
                </g>
              ))}
              {badge ? (
                <g className="ub-figure-badge">
                  <circle cx={badge.x} cy={badge.y} r={0.3} />
                  <text x={badge.x} y={badge.y} dy="0.12">
                    {badge.value}
                  </text>
                </g>
              ) : null}
            </svg>
          ) : null}
        </div>
        {exitRow !== null ? (
          <>
            <span className="ub-exit" />
            <svg className="ub-exit-mark" viewBox="0 0 24 24">
              <path d="M8 5l7 7-7 7" />
            </svg>
          </>
        ) : null}
      </div>
    </div>
  );
}
