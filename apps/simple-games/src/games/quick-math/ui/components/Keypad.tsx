/**
 * The keypad (docs/QUICK_MATH_RULES.md §3, §12).
 *
 * Ten digits and one backspace. There is no minus sign and no decimal point,
 * and that is the same decision as the generator's invariants seen from the
 * other side (§5): no question this game asks can have an answer the keypad
 * cannot express.
 *
 * There is no "OK" key either. The answer is judged when the digits reach the
 * answer's length — one tap per digit and no more, because the pleasure of a
 * drill is its tempo. The cost is stated plainly in the rules: a one-digit
 * answer is judged the instant it is mistyped. It is affordable only because a
 * wrong answer costs nothing but a tally and the question comes straight back.
 */
import { useSettings } from '@/state/SettingsContext';
import { IconUndo } from '@/ui/components/icons';

export interface KeypadProps {
  onDigit: (digit: number) => void;
  onBackspace: () => void;
  /** Nothing typed yet — there is nothing to take back. */
  backspaceDisabled: boolean;
}

const ROWS: readonly (readonly number[])[] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
];

export function Keypad({ onDigit, onBackspace, backspaceDisabled }: KeypadProps) {
  const { t } = useSettings();

  return (
    <div className="qmath-keypad" role="group" aria-label={t('qmathKeypadLabel')}>
      {ROWS.flat().map((digit) => (
        <button key={digit} type="button" className="qmath-key" onClick={() => onDigit(digit)}>
          {digit}
        </button>
      ))}
      {/* Zero sits under the 8, where a phone dial puts it, with backspace to
          its right; the empty slot on the left keeps the grid honest. */}
      <span className="qmath-key-gap" aria-hidden="true" />
      <button type="button" className="qmath-key" onClick={() => onDigit(0)}>
        0
      </button>
      <button
        type="button"
        className="qmath-key qmath-key-back"
        aria-label={t('qmathBackspace')}
        onClick={onBackspace}
        disabled={backspaceDisabled}
      >
        <IconUndo />
      </button>
    </div>
  );
}
