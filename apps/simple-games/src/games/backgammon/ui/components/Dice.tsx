/**
 * The two dice (docs/BACKGAMMON_RULES.md §2.1, §11): faces drawn as pips, no
 * numerals beside them, a "?" face while nothing has been thrown. While the
 * throw is the player's, the pair is one button; the rest of the time it is
 * a picture of what was thrown, with the dice already played drawn dimmer.
 */
import { useSettings } from '@/state/SettingsContext';
import type { Roll } from '../../game/dice';

const PIPS: Record<number, readonly [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 28],
    [72, 28],
    [28, 50],
    [72, 50],
    [28, 72],
    [72, 72],
  ],
};

function Face({ value, spent, spin }: { value: number | null; spent: boolean; spin: boolean }) {
  return (
    <svg
      className={['bk-die', spent ? 'bk-die-spent' : '', spin ? 'bk-die-spin' : '']
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="92" height="92" rx="20" className="bk-die-body" />
      {value === null ? (
        <text x="50" y="66" textAnchor="middle" className="bk-die-unknown">
          ?
        </text>
      ) : (
        (PIPS[value] ?? []).map(([cx, cy], index) => (
          <circle key={index} cx={cx} cy={cy} r="9" className="bk-die-pip" />
        ))
      )}
      {spent ? <path d="M22 78 78 22" className="bk-die-used-mark" /> : null}
    </svg>
  );
}

export interface DiceProps {
  roll: Roll | null;
  /** How many of each face are still to be played this turn; empty outside a turn. */
  remaining: readonly number[];
  /** True while the pair is the player's to throw: it becomes the one button. */
  canRoll: boolean;
  /** The opening is thrown from the same place, with its own label (§1). */
  opening: boolean;
  /** Changes with every throw, so the spin runs once per throw. */
  rollKey: number;
  onRoll: () => void;
}

export function Dice({ roll, remaining, canRoll, opening, rollKey, onRoll }: DiceProps) {
  const { t } = useSettings();
  // Four playable faces make doubles' four steps visible, including after undo.
  // Before a fresh throw, show unrolled faces rather than the previous side's dice.
  const doubles = !canRoll && roll !== null && roll[0] === roll[1];
  const faces: (number | null)[] =
    canRoll || !roll
      ? [null, null]
      : doubles
        ? [roll[0], roll[0], roll[0], roll[0]]
        : [roll[0], roll[1]];
  const left = [...remaining];
  const spent = faces.map((face) => {
    if (face === null) return false;
    const index = left.indexOf(face);
    if (index === -1) return true;
    left.splice(index, 1);
    return false;
  });
  const label = roll
    ? `${t('backgammonDiceLabel', { a: roll[0], b: roll[1] })} · ${t('backgammonDiceLeft', { count: remaining.length })}`
    : t('backgammonDiceUnrolled');

  if (canRoll) {
    return (
      <button
        type="button"
        className="bk-dice bk-dice-button"
        onClick={onRoll}
        aria-label={opening ? t('backgammonRollOpening') : t('backgammonRoll')}
      >
        <span className="bk-dice-pair" key={rollKey}>
          <Face value={faces[0]!} spent={false} spin={false} />
          <Face value={faces[1]!} spent={false} spin={false} />
        </span>
        <span className="bk-dice-caption">
          {opening ? t('backgammonRollOpening') : t('backgammonRoll')}
        </span>
      </button>
    );
  }

  return (
    <div className={`bk-dice ${doubles ? 'bk-dice-double' : ''}`} role="img" aria-label={label}>
      <span className="bk-dice-pair" key={rollKey}>
        {faces.map((face, index) => (
          <Face key={index} value={face} spent={spent[index]!} spin={roll !== null} />
        ))}
      </span>
    </div>
  );
}
