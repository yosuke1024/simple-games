/**
 * The five dice (docs/YACHT_RULES.md §2, §9).
 *
 * Each die is a toggle button: pressed means kept, and the next throw leaves
 * it alone. A kept die is lifted and framed as well as announced, so the hold
 * never rests on colour alone. Before the first throw of a turn the dice are
 * blank and disabled — there is nothing yet to keep — and after the third
 * they stay as they fell, disabled, because there is no throw left to keep
 * them from.
 *
 * The tumble is CSS only and capped at 220ms: the face of each die that took
 * a new value is keyed by the throw's `rollIndex`, so the keyframe plays once
 * when the throw lands and never on a re-render or a hold (Ludo §12's shape).
 * Reduced Motion drops the class and the face is simply there.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import type { Dice } from '../../game';
import type { LastRoll } from '../../state/GameContext';

/** Which of the nine pip positions each face lights, top-left to bottom-right. */
const PIPS: readonly (readonly number[])[] = [
  [4],
  [0, 8],
  [0, 4, 8],
  [0, 2, 6, 8],
  [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8],
];

/** A die's face as a 3×3 grid of pips; `face` null draws a blank die. */
export function DieFace({ face, className = '' }: { face: number | null; className?: string }) {
  const lit = face === null ? [] : (PIPS[face - 1] ?? []);
  return (
    <span className={`yt-die-face ${className}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, spot) => (
        <span key={spot} className={`yt-pip ${lit.includes(spot) ? 'yt-pip-on' : ''}`} />
      ))}
    </span>
  );
}

export interface YachtDiceProps {
  dice: Dice;
  held: readonly boolean[];
  /** False before the first throw of a turn: the dice have no faces yet. */
  rolled: boolean;
  /** False when keeping means nothing right now, or a dialog is up. */
  canHold: boolean;
  lastRoll: LastRoll | null;
  onToggle: (index: number) => void;
}

export const YachtDice = memo(function YachtDice({
  dice,
  held,
  rolled,
  canHold,
  lastRoll,
  onToggle,
}: YachtDiceProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  return (
    <div className="yt-dice" role="group" aria-label={t('yachtDiceLabel')}>
      {dice.map((face, index) => {
        const kept = held[index] === true;
        const label = !rolled
          ? t('yachtDieUnrolledLabel', { n: index + 1 })
          : kept
            ? t('yachtDieHeldLabel', { n: index + 1, face })
            : t('yachtDieLabel', { n: index + 1, face });
        const tumbled = rolled && lastRoll?.rolled[index] === true;
        return (
          <button
            key={index}
            type="button"
            className={`yt-die ${rolled ? '' : 'yt-die-blank'}`}
            aria-pressed={kept}
            aria-label={label}
            disabled={!canHold}
            onClick={() => onToggle(index)}
          >
            {/* Keyed by the throw that gave this die its face, so the tumble
                plays on arrival and never again (§9). The button itself keeps
                its identity, so focus stays where it was. */}
            <DieFace
              key={tumbled ? lastRoll.rollIndex : -1}
              face={rolled ? face : null}
              className={tumbled && !reducedMotion ? 'yt-die-tumble' : ''}
            />
          </button>
        );
      })}
    </div>
  );
});
