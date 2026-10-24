/**
 * A small still board for Quick Rules (docs/BRIDGES_RULES.md §12), drawn with
 * the live board's own classes and strokes so a figure looks exactly like the
 * game it teaches. Decorative: the sentence beside it carries the meaning, so
 * the whole figure is hidden from assistive technology and nothing in it can
 * be pressed or focused.
 */
import type { CSSProperties } from 'react';
import { colOf, rowOf, type IslandState } from '../../game';
import { BridgeLines, WaterDots, centerOf } from './BridgeStrokes';

export interface FigureIsland {
  /** The cell, row-major. */
  readonly index: number;
  readonly value: number;
  readonly state: IslandState;
  readonly selected?: boolean;
  readonly partner?: boolean;
}

export interface FigureLink {
  readonly from: number;
  readonly to: number;
}

export interface BridgesFigureProps {
  width: number;
  height: number;
  islands: readonly FigureIsland[];
  bridges: readonly (FigureLink & { readonly count: number })[];
  /** Dashed lines from a selected island to its partners. */
  candidates?: readonly FigureLink[];
  /** A bridge that may not be built (it would cross), struck through where it crosses. */
  blocked?: readonly (FigureLink & { readonly at: number })[];
}

export function BridgesFigure({
  width,
  height,
  islands,
  bridges,
  candidates = [],
  blocked = [],
}: BridgesFigureProps) {
  const occupied = new Set(islands.map((island) => island.index));
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div
        className="bg-board bg-figure"
        style={{ '--bg-cols': width, '--bg-rows': height } as CSSProperties}
      >
        <div className="bg-field">
          <svg className="bg-lines" viewBox={`0 0 ${width} ${height}`} focusable="false">
            <WaterDots width={width} height={height} occupied={occupied} />
            {blocked.map((link) => {
              const from = centerOf(link.from, width);
              const to = centerOf(link.to, width);
              const at = centerOf(link.at, width);
              const d = 0.16;
              return (
                <g key={`${link.from}-${link.to}`} className="bg-blocked">
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                  <line
                    className="bg-blocked-mark"
                    x1={at.x - d}
                    y1={at.y - d}
                    x2={at.x + d}
                    y2={at.y + d}
                  />
                  <line
                    className="bg-blocked-mark"
                    x1={at.x - d}
                    y1={at.y + d}
                    x2={at.x + d}
                    y2={at.y - d}
                  />
                </g>
              );
            })}
            {candidates.map((link) => {
              const from = centerOf(link.from, width);
              const to = centerOf(link.to, width);
              return (
                <line
                  key={`${link.from}-${link.to}`}
                  className="bg-candidate"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                />
              );
            })}
            {bridges.map((link) => (
              <BridgeLines
                key={`${link.from}-${link.to}`}
                from={centerOf(link.from, width)}
                to={centerOf(link.to, width)}
                count={link.count}
              />
            ))}
          </svg>
          {islands.map((island) => (
            <span
              key={island.index}
              className={[
                'bg-island',
                `bg-island-${island.state}`,
                island.selected ? 'bg-island-selected' : '',
                island.partner ? 'bg-island-partner' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={
                {
                  '--bg-r': rowOf(island.index, width),
                  '--bg-c': colOf(island.index, width),
                } as CSSProperties
              }
            >
              <span className="bg-ring" />
              <span className="bg-disc">{island.value}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
