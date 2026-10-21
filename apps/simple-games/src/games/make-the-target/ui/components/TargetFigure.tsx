/**
 * The Quick Rules pictures (docs/MAKE_THE_TARGET_RULES.md §11): a few tiles
 * drawn with the board's own classes, still, and hidden from a screen reader
 * — each step's sentence carries the meaning. Every picture is a position the
 * game could be in.
 */
import { OPERATOR_SYMBOLS, type Operator } from '../../game';
import { TargetMark } from './TargetMark';

export interface TargetFigureProps {
  /** The target to draw above the tiles, or none. */
  target?: number;
  /** True when the target is made (§4): its frame wears the accent. */
  made?: boolean;
  /** The slots: a number, or null for one used up. */
  tiles: readonly (number | null)[];
  /** The slot drawn as chosen first. */
  selected?: number;
  /** The operator drawn as chosen. */
  operator?: Operator;
}

export function TargetFigure({
  target,
  made = false,
  tiles,
  selected,
  operator,
}: TargetFigureProps) {
  return (
    <div className="tg-figure" aria-hidden="true">
      {target === undefined ? null : (
        <div className={`tg-target tg-figure-target${made ? ' tg-target-made' : ''}`}>
          <TargetMark />
          <span className="tg-target-value">{target}</span>
        </div>
      )}
      <div className="tg-board tg-figure-board">
        {tiles.map((value, slot) =>
          value === null ? (
            <span key={slot} className="tg-slot-empty" />
          ) : (
            <span
              key={slot}
              className={`tg-tile${slot === selected ? ' tg-tile-selected' : ''}`}
              data-digits={String(value).length}
            >
              {value}
            </span>
          ),
        )}
      </div>
      {operator === undefined ? null : (
        <div className="tg-figure-ops">
          {(['+', '-', '*', '/'] as const).map((op) => (
            <span key={op} className={`tg-op${op === operator ? ' tg-op-selected' : ''}`}>
              {OPERATOR_SYMBOLS[op]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
