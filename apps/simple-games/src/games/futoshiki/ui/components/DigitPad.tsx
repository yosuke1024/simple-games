/**
 * The digit pad (docs/FUTOSHIKI_RULES.md §4).
 *
 * The pad follows the board: four keys on a 4×4, seven on a 7×7. A digit this
 * size has not got never gets a key at all.
 *
 * Each key carries how many of that digit are still to be placed, and a digit
 * fully placed is disabled. That counter is a fact rather than an estimate:
 * every row holds each digit exactly once (§3), so a finished board holds it
 * exactly N times and "N minus what is on the board" means the same thing from
 * the first move to the last. Kakuro's pad has no such counter because Kakuro
 * has no such invariant — the same part is not owed to every game.
 *
 * In notes mode the keys write pencil marks instead, which the accent states
 * without a caption.
 */
import type { CSSProperties } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { remainingOf, type Digit, type FutoshikiSession } from '../../game';

export interface DigitPadProps {
  session: FutoshikiSession;
  notesMode: boolean;
  onDigit: (digit: Digit) => void;
}

export function DigitPad({ session, notesMode, onDigit }: DigitPadProps) {
  const { t } = useSettings();
  const { size } = session;
  return (
    <div
      className="futoshiki-pad"
      role="group"
      aria-label={t('futoshikiPadLabel')}
      style={{ '--futoshiki-size': size } as CSSProperties}
    >
      {Array.from({ length: size }, (_, slot) => {
        const digit = (slot + 1) as Digit;
        const left = remainingOf(session, digit);
        // In notes mode a placed-out digit can still be pencilled: the player
        // may be marking a square they intend to correct.
        const disabled = !notesMode && left <= 0;
        return (
          <button
            key={digit}
            type="button"
            className={`futoshiki-key ${notesMode ? 'futoshiki-key-notes' : ''}`}
            disabled={disabled}
            aria-label={
              notesMode
                ? t('futoshikiPadNoteKey', { value: digit })
                : t('futoshikiPadKey', { value: digit, n: left })
            }
            onClick={() => onDigit(digit)}
          >
            {digit}
            <span className="futoshiki-key-left" aria-hidden="true">
              {left > 0 ? left : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
