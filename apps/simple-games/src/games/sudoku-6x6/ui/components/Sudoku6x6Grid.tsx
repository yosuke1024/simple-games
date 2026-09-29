/**
 * The 6×6 grid (docs/SUDOKU_6X6_RULES.md §1, §3, §4, §5, §13).
 *
 * Highlighting carries all the guidance, so nothing needs a caption: the
 * selected cell's row, column and box are tinted, every copy of the selected
 * digit is tinted a step stronger, a rule violation turns warn-coloured with
 * a ring (never colour alone), and a hint rings the cells that justify it
 * inside the tinted unit that makes them matter. Notes sit in a 3×2 shadow of
 * a box, so a digit is always in the same corner.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  BOXES,
  boxOf,
  colOf,
  COLS,
  conflictingCells,
  hasBit,
  mistakenCells,
  rowOf,
  ROWS,
  SIZE,
  valueAt,
  type Board,
  type Grid,
  type Hint,
  type UnitRef,
} from '../../game';

export interface Sudoku6x6GridProps {
  board: Board;
  solution: Grid;
  selected: number | null;
  hint: Hint | null;
  /** Cells of the units the last digit finished, while they glow (§3). */
  completed?: ReadonlySet<number> | null;
  /** Whether a wrong digit is shown as soon as it lands (§4, setting). */
  highlightMistakes: boolean;
  onCellTap: (index: number) => void;
}

const NO_CELLS: ReadonlySet<number> = new Set();

const unitCells = (unit: UnitRef): readonly number[] =>
  (unit.kind === 'row' ? ROWS : unit.kind === 'col' ? COLS : BOXES)[unit.index] ?? [];

export const Sudoku6x6Grid = memo(function Sudoku6x6Grid({
  board,
  solution,
  selected,
  hint,
  completed = null,
  highlightMistakes,
  onCellTap,
}: Sudoku6x6GridProps) {
  const { t } = useSettings();
  const conflicts = conflictingCells(board);
  const mistakes = highlightMistakes ? mistakenCells(board, solution) : NO_CELLS;
  const selectedValue = selected === null ? 0 : valueAt(board, selected);
  const hintCells = hint ? new Set(hint.focus) : NO_CELLS;
  const hintUnit = hint?.unit ? new Set(unitCells(hint.unit)) : NO_CELLS;

  return (
    <div className="s6-grid" role="group" aria-label={t('sudoku6x6GridLabel')}>
      {board.givens.map((_, index) => {
        const value = valueAt(board, index);
        const given = board.givens[index] !== 0;
        const notes = value === 0 ? board.notes[index]! : 0;

        const isSelected = selected === index;
        const isPeer =
          selected !== null &&
          !isSelected &&
          (rowOf(selected) === rowOf(index) ||
            colOf(selected) === colOf(index) ||
            boxOf(selected) === boxOf(index));
        const isSame = !isSelected && value !== 0 && value === selectedValue;
        const isWrong = conflicts.has(index) || mistakes.has(index);

        const classes = [
          's6-cell',
          given ? 's6-cell-given' : '',
          isSelected ? 's6-cell-selected' : '',
          isSame ? 's6-cell-same' : isPeer ? 's6-cell-peer' : '',
          hintUnit.has(index) ? 's6-cell-hint-unit' : '',
          isWrong ? 's6-cell-conflict' : '',
          hintCells.has(index) ? 's6-cell-hint' : '',
          hint?.target === index ? 's6-cell-hint-target' : '',
          completed?.has(index) ? 's6-cell-complete' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const row = rowOf(index) + 1;
        const col = colOf(index) + 1;
        const label =
          value === 0
            ? t('sudoku6x6CellEmpty', { row, col })
            : given
              ? t('sudoku6x6CellGiven', { value, row, col })
              : t('sudoku6x6CellEntry', { value, row, col });

        return (
          <button
            key={index}
            type="button"
            className={classes}
            data-seam-right={col === 3}
            data-seam-bottom={row === 2 || row === 4}
            aria-label={label}
            aria-pressed={isSelected}
            onClick={() => onCellTap(index)}
          >
            {value !== 0 ? (
              value
            ) : notes !== 0 ? (
              <span className="s6-notes" aria-hidden="true">
                {Array.from({ length: SIZE }, (_, slot) => (
                  <span key={slot} className="s6-note">
                    {hasBit(notes, slot + 1) ? slot + 1 : ''}
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
});
