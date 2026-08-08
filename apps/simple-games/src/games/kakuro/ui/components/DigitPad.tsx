/**
 * The digit pad (docs/KAKURO_RULES.md §4).
 *
 * Nine keys at every board size, because the digits are 1–9 at every size
 * (§3) — this pad does not follow the board the way Futoshiki's does.
 *
 * NO REMAINING COUNT, AND NO GREYING OUT (§4, §14). Sudoku and Futoshiki print
 * a count on each key because their answers hold every digit a fixed number of
 * times, so "N minus what is on the board" is a fact about the solution that
 * means the same thing from the first move to the last. Kakuro has no such
 * constant: how often a digit appears is decided by the layout and the answer,
 * and the same row may legally hold it twice (§3). A counter with nothing to
 * subtract from would still be read as an invariant, and it would not be one.
 *
 * Greying out the digits the selected square cannot take is refused for a
 * different reason: that is techniques 1 and 2 of §7 run for the player, which
 * is the puzzle itself. When the next move is genuinely hard to find there is
 * a hint (§6), and it explains rather than removes.
 *
 * In notes mode the keys write pencil marks instead, which the accent states
 * without a caption.
 */
import { useSettings } from '@/state/SettingsContext';
import { DIGITS, type Digit } from '../../game';

export interface DigitPadProps {
  notesMode: boolean;
  onDigit: (digit: Digit) => void;
}

export function DigitPad({ notesMode, onDigit }: DigitPadProps) {
  const { t } = useSettings();
  return (
    <div className="kakuro-pad" role="group" aria-label={t('kakuroPadLabel')}>
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={`kakuro-key ${notesMode ? 'kakuro-key-notes' : ''}`}
          // In digit mode the key's own text is its whole name — there is no
          // count to read out, so there is nothing a label could add.
          aria-label={notesMode ? t('kakuroPadNoteKey', { value: digit }) : undefined}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
    </div>
  );
}
