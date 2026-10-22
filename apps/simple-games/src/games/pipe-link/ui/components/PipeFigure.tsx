/**
 * The Quick Rules figures (docs/PIPE_LINK_RULES.md §9): a few tiles drawn by
 * the board's own `PipeGlyph`, at a fixed size, so a figure is the game,
 * smaller. Hidden from a screen reader — the step's one sentence beside it
 * carries the words.
 */
import type { CSSProperties } from 'react';
import type { TileType } from '../../game';
import { PipeGlyph, SourceMark } from './PipeGlyph';

export interface FigureTile {
  readonly type: TileType;
  readonly orientation: number;
  readonly lit: boolean;
  readonly source?: boolean;
}

export function PipeFigure({ width, tiles }: { width: number; tiles: readonly FigureTile[] }) {
  return (
    <div className="pn-figure" aria-hidden="true" style={{ '--pn-cols': width } as CSSProperties}>
      {tiles.map((tile, index) => (
        <span key={index} className={`pn-tile pn-figure-tile ${tile.lit ? 'pn-tile-lit' : ''}`}>
          <PipeGlyph type={tile.type} turns={tile.orientation} lit={tile.lit} />
          {tile.source ? <SourceMark /> : null}
        </span>
      ))}
    </div>
  );
}

/**
 * One elbow before and after a tap, with a clockwise arrow between them — the
 * arrow is a shape, not a word (§9, step 1).
 */
export function TurnFigure() {
  return (
    <div className="pn-figure pn-figure-turn" aria-hidden="true">
      <span className="pn-tile pn-figure-tile">
        <PipeGlyph type="elbow" turns={0} lit={false} />
      </span>
      <svg className="pn-figure-arrow" viewBox="0 0 48 48" focusable="false">
        <path d="M10 30 A15 15 0 1 1 36 34" />
        <path d="M43 32 L36 34 L36 27" />
      </svg>
      <span className="pn-tile pn-figure-tile">
        <PipeGlyph type="elbow" turns={1} lit={false} />
      </span>
    </div>
  );
}
