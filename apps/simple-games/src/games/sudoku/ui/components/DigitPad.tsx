/**
 * The digit pad (docs/SUDOKU_RULES.md §3).
 *
 * Each key carries how many of that digit are still missing, and a digit that
 * is fully placed is disabled — bookkeeping the player would otherwise do by
 * counting across the grid. In notes mode the keys write pencil marks instead,
 * which the accent colour states without a caption.
 */
import { useSettings } from '@/state/SettingsContext';
import { digitCount, SIZE, type Board, type Digit } from '../../game';

export interface DigitPadProps {
  board: Board;
  notesMode: boolean;
  onDigit: (digit: Digit) => void;
}

export function DigitPad({ board, notesMode, onDigit }: DigitPadProps) {
  const { t } = useSettings();
  return (
    <div className="digit-pad" role="group" aria-label={t('sudokuPadLabel')}>
      {Array.from({ length: SIZE }, (_, slot) => {
        const digit = (slot + 1) as Digit;
        const left = SIZE - digitCount(board, digit);
        // In notes mode a placed-out digit can still be pencilled: the player
        // may be marking a cell they intend to correct.
        const disabled = !notesMode && left === 0;
        return (
          <button
            key={digit}
            type="button"
            className={`digit-key ${notesMode ? 'digit-key-notes' : ''}`}
            disabled={disabled}
            aria-label={
              notesMode
                ? t('sudokuPadNoteKey', { value: digit })
                : t('sudokuPadKey', { value: digit, n: left })
            }
            onClick={() => onDigit(digit)}
          >
            {digit}
            <span className="digit-key-left" aria-hidden="true">
              {left > 0 ? left : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
