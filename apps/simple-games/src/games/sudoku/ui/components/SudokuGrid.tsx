/**
 * The 9x9 grid (docs/SUDOKU_RULES.md §1, §3, §4).
 *
 * Highlighting carries all the guidance, so nothing needs a caption: the
 * selected cell's row, column and box are tinted, every copy of the selected
 * digit is tinted a step stronger, a rule violation turns warn-coloured, and a
 * hint rings the cells that justify it. Notes sit in a 3x3 shadow of the pad so
 * a digit is always in the same corner.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  boxOf,
  colOf,
  conflictingCells,
  digitsOf,
  mistakenCells,
  rowOf,
  valueAt,
  type Board,
  type Grid,
} from '../../game';
import type { Hint } from '../../game';

export interface SudokuGridProps {
  board: Board;
  solution: Grid;
  selected: number | null;
  hint: Hint | null;
  /** Whether a wrong digit is shown as soon as it lands (§4, setting). */
  highlightMistakes: boolean;
  onCellTap: (index: number) => void;
}

const NO_CELLS: ReadonlySet<number> = new Set();

export const SudokuGrid = memo(function SudokuGrid({
  board,
  solution,
  selected,
  hint,
  highlightMistakes,
  onCellTap,
}: SudokuGridProps) {
  const { t } = useSettings();
  const conflicts = conflictingCells(board);
  const mistakes = highlightMistakes ? mistakenCells(board, solution) : NO_CELLS;
  const selectedValue = selected === null ? 0 : valueAt(board, selected);
  const hintCells = hint ? new Set(hint.focus) : NO_CELLS;

  return (
    <div className="sudoku-grid" role="group" aria-label={t('sudokuGridLabel')}>
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
          'sudoku-cell',
          given ? 'sudoku-cell-given' : '',
          isSelected ? 'sudoku-cell-selected' : '',
          isSame ? 'sudoku-cell-same' : isPeer ? 'sudoku-cell-peer' : '',
          isWrong ? 'sudoku-cell-conflict' : '',
          hintCells.has(index) ? 'sudoku-cell-hint' : '',
          hint?.target === index ? 'sudoku-cell-hint-target' : '',
        ]
          .filter(Boolean)
          .join(' ');

        const row = rowOf(index) + 1;
        const col = colOf(index) + 1;
        const label =
          value === 0
            ? t('sudokuCellEmpty', { row, col })
            : given
              ? t('sudokuCellGiven', { value, row, col })
              : t('sudokuCellEntry', { value, row, col });

        return (
          <button
            key={index}
            type="button"
            className={classes}
            data-seam-right={col === 3 || col === 6}
            data-seam-bottom={row === 3 || row === 6}
            aria-label={label}
            aria-pressed={isSelected}
            onClick={() => onCellTap(index)}
          >
            {value !== 0 ? (
              value
            ) : notes !== 0 ? (
              <span className="sudoku-notes" aria-hidden="true">
                {Array.from({ length: 9 }, (_, slot) => (
                  <span key={slot} className="sudoku-note">
                    {digitsOf(notes).includes((slot + 1) as never) ? slot + 1 : ''}
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
