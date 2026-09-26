/**
 * The line of play (docs/DOMINOES_RULES.md §3, §11).
 *
 * One wrapping row, never a scroller: with all 28 tiles down the line simply
 * breaks onto more rows, read left to right and top to bottom, so it always
 * fits the phone's width. Tiles lie on their side as two halves; a double
 * stands upright, which is how it is told apart at a glance without relying
 * on its pips alone.
 *
 * Every tile is a direct child of the one `.dm-line` element, with no width
 * of its own beyond the stylesheet's tile size — the layout test holds the
 * component to that, because a wrapper or an inline width is exactly how a
 * row stops wrapping.
 *
 * The two open ends sit at the head and tail of the row as small markers
 * showing their pip value. When the tile in hand fits both ends and they
 * differ, the markers become the two buttons that choose where it goes; a
 * marker is the same size either way, so the choice appearing never moves a
 * tile.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { isDouble, lineEnds, tileId, type End, type Line } from '../../game';
import { TileFace } from './TileFace';

export interface DominoesLineProps {
  line: Line;
  /** True while the player is choosing an end: the markers are buttons (§3). */
  choosing: boolean;
  onChooseEnd: (end: End) => void;
  /** The index of the tile just played, marked so it can be found (§11). */
  freshIndex: number | null;
}

export const DominoesLine = memo(function DominoesLine({
  line,
  choosing,
  onChooseEnd,
  freshIndex,
}: DominoesLineProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const ends = lineEnds(line);

  const marker = (end: End) => {
    if (ends === null) return null;
    const value = end === 'left' ? ends.left : ends.right;
    if (choosing) {
      return (
        <button
          type="button"
          className="dm-end dm-end-live"
          aria-label={t(end === 'left' ? 'dominoesPlayLeft' : 'dominoesPlayRight', { value })}
          onClick={() => onChooseEnd(end)}
        >
          {value}
        </button>
      );
    }
    return (
      <span className="dm-end" aria-hidden="true">
        {value}
      </span>
    );
  };

  return (
    <div
      className={`dm-line ${reducedMotion ? 'dm-line-still' : ''}`}
      role="group"
      aria-label={
        ends === null
          ? undefined
          : t('dominoesLineLabel', { count: line.length, left: ends.left, right: ends.right })
      }
    >
      {marker('left')}
      {line.map((placed, index) => {
        const double = isDouble(placed.tile);
        return (
          <span
            key={tileId(placed.tile)}
            className={[
              'dm-tile',
              double ? 'dm-tile-double' : '',
              index === freshIndex ? 'dm-tile-fresh' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="img"
            aria-label={t('dominoesTileLabel', { a: placed.left, b: placed.right })}
          >
            <TileFace first={placed.left} second={placed.right} upright={double} />
          </span>
        );
      })}
      {marker('right')}
    </div>
  );
});
