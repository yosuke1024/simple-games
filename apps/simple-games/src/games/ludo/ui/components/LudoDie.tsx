/**
 * The die (docs/LUDO_RULES.md §8, §12).
 *
 * One control, and it is a button only while the throw is the player's to
 * make; the rest of the time it is a picture of the face on the table. There
 * is no timer on it and nothing counts down — a player may look at the board
 * for as long as they like before throwing (§8).
 *
 * The tumble is capped at 220ms and Reduced Motion skips it outright, showing
 * the face the instant it exists (§12). The animation is keyed on the throw's
 * own number, so a re-render never replays it and two throws in a row — a six
 * earns another (§2.1) — each get their own.
 */
import { memo, useEffect, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { useTransientTimeout } from '@/ui/useTransientTimeout';

/** The ceiling on the tumble (§12). Nothing here is ever slower than this. */
export const DIE_SPIN_MS = 220;

/** Which of the nine pip positions each face lights, top-left to bottom-right. */
const PIPS: readonly (readonly number[])[] = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

export interface LudoDieProps {
  /** The face on the table, or null before the first throw of a match. */
  face: number | null;
  /**
   * The throw this face came from — `rollIndex`, which advances by one on
   * every throw and never goes back. Identity for the tumble, not a count.
   */
  rollSerial: number;
  canRoll: boolean;
  onRoll: () => void;
}

export const LudoDie = memo(function LudoDie({ face, rollSerial, canRoll, onRoll }: LudoDieProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();
  const spinTimeout = useTransientTimeout();
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    if (reducedMotion || rollSerial === 0) return;
    setSpinning(true);
    spinTimeout(() => setSpinning(false), DIE_SPIN_MS);
  }, [rollSerial, reducedMotion, spinTimeout]);

  const label = face === null ? t('ludoDieUnrolled') : t('ludoDieLabel', { die: face });
  const pips = face === null ? [] : (PIPS[face - 1] ?? []);
  const body = (
    <span className={`ld-die-face ${spinning ? 'ld-die-spin' : ''}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, spot) => (
        <span key={spot} className={`ld-pip ${pips.includes(spot) ? 'ld-pip-on' : ''}`} />
      ))}
    </span>
  );

  if (!canRoll) {
    return (
      <div className="ld-die" role="img" aria-label={label}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="ld-die ld-die-live"
      aria-label={t('ludoRollLabel')}
      onClick={onRoll}
    >
      {body}
      <span className="ld-die-hint" aria-hidden="true">
        {t('ludoRollAction')}
      </span>
    </button>
  );
});
