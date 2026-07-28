import { memo } from 'react';
import { COLS, type Board } from '../../game';
import { useSettings } from '../../state/SettingsContext';

export interface BoardViewProps {
  board: Board;
  selected: number | null;
  hintPair: readonly [number, number] | null;
  invalidPair: readonly [number, number] | null;
  /** Live numbers that blocked the last rejected pair ("these are in the way"). */
  blockedCells: readonly number[];
  onCellTap: (index: number) => void;
}

export const BoardView = memo(function BoardView({
  board,
  selected,
  hintPair,
  invalidPair,
  blockedCells,
  onCellTap,
}: BoardViewProps) {
  const { t } = useSettings();
  return (
    <div className="board" role="group" aria-label={t('boardLabel')}>
      {board.map((cell, index) => {
        // A hole in the board's shape: empty space, not a playable slot.
        if (cell === null) {
          return <div key={index} className="cell cell-hole" aria-hidden="true" />;
        }
        const row = Math.floor(index / COLS) + 1;
        const col = (index % COLS) + 1;
        if (cell.cleared) {
          return (
            <div key={index} className="cell cell-cleared" aria-hidden="true">
              <span className="cell-dot" />
            </div>
          );
        }
        const isSelected = selected === index;
        const isHint = hintPair !== null && (hintPair[0] === index || hintPair[1] === index);
        const isInvalid =
          invalidPair !== null && (invalidPair[0] === index || invalidPair[1] === index);
        const isBlocking = blockedCells.includes(index);
        const className = [
          'cell',
          'cell-live',
          isSelected ? 'cell-selected' : '',
          isHint ? 'cell-hint' : '',
          isInvalid ? 'cell-invalid' : '',
          isBlocking ? 'cell-blocking' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={index}
            type="button"
            className={className}
            aria-label={t('cellLabel', { value: cell.value, row, col })}
            aria-pressed={isSelected}
            onClick={() => onCellTap(index)}
          >
            {cell.value}
          </button>
        );
      })}
    </div>
  );
});
