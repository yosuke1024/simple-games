/**
 * The digit pad (docs/SUDOKU_6X6_RULES.md §3, §13): six keys in one row.
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
    <div className="s6-pad" role="group" aria-label={t('sudoku6x6PadLabel')}>
      {Array.from({ length: SIZE }, (_, slot) => {
        const digit = (slot + 1) as Digit;
        const left = SIZE - digitCount(board, digit);
        // In notes mode a placed-out digit can still be pencilled: the player
        // may be marking a cell they intend to correct.
        const disabled = !notesMode && left <= 0;
        return (
          <button
            key={digit}
            type="button"
            className={`s6-key ${notesMode ? 's6-key-notes' : ''}`}
            disabled={disabled}
            aria-label={
              notesMode
                ? t('sudoku6x6PadNoteKey', { value: digit })
                : t('sudoku6x6PadKey', { value: digit, n: Math.max(0, left) })
            }
            onClick={() => onDigit(digit)}
          >
            {digit}
            <span className="s6-key-left" aria-hidden="true">
              {left > 0 ? left : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
