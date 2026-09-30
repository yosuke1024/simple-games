/**
 * The score sheet (docs/YACHT_RULES.md §3, §10): twelve boxes as buttons, two
 * columns of six — the upper boxes on the left, the combinations on the
 * right — with a header row above naming the sheet's two numbers, "You" and
 * "CPU", and a total row below saying what both sheets add up to. The DOM
 * keeps the sheet's own order, so a screen reader reads the left column and
 * then the right, then the totals.
 *
 * On the player's turn, an open box previews, faintly, what the dice on the
 * table would put in it — the arithmetic is the game's to do, the choice is
 * the player's (§6). A filled box — either seat's — shows its points solidly
 * and is disabled; the CPU's number never previews anything, since it is
 * never the thing being chosen right now. Before the first throw of a turn no
 * box previews anything and none can be pressed (§2).
 *
 * The number that just filled — the seat's own cell, not the whole box —
 * flashes once (Mancala's keyed shape, §10): `flash.key` is the total boxes
 * filled across both sheets, so a re-render of the same turn never repeats
 * it. The animation runs on the number's own background, so nothing is ever
 * drawn over the digits.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import { CATEGORIES, scoreFor, type Category, type Dice, type Scores, type Seat } from '../../game';
import { CATEGORY_KEY } from '../categoryKey';

export interface SheetFlash {
  /** Whose number filled — the flash lands on that seat's cell only (§10). */
  readonly seat: Seat;
  readonly category: Category;
  /** Total boxes filled across both sheets when this box was taken — re-keys once per fill. */
  readonly key: number;
}

export interface YachtSheetProps {
  scores: Scores;
  cpuScores: Scores;
  dice: Dice;
  /** False before the first throw of a turn: nothing to preview or score. */
  rolled: boolean;
  /** True only on the player's own turn, mid-game, with no dialog up. */
  playing: boolean;
  onScore: (category: Category) => void;
  flash: SheetFlash | null;
  /** Both sheets' sums, for the total row under the boxes (§10). */
  total: number;
  cpuTotal: number;
}

export const YachtSheet = memo(function YachtSheet({
  scores,
  cpuScores,
  dice,
  rolled,
  playing,
  onScore,
  flash,
  total,
  cpuTotal,
}: YachtSheetProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  return (
    <div className="yt-sheet-wrap">
      <div className="yt-sheet-head" aria-hidden="true">
        <span className="yt-sheet-head-col">
          <span>{t('yachtYou')}</span>
          <span>{t('yachtCpu')}</span>
        </span>
        <span className="yt-sheet-head-col">
          <span>{t('yachtYou')}</span>
          <span>{t('yachtCpu')}</span>
        </span>
      </div>
      <div className="yt-sheet" role="group" aria-label={t('yachtSheetLabel')}>
        {CATEGORIES.map((category, index) => {
          const name = t(CATEGORY_KEY[category]);
          const taken = scores[index] ?? null;
          const cpuTaken = cpuScores[index] ?? null;
          // A preview only on the player's own turn (§10): the dice on the
          // table during the CPU's turn are the CPU's, and what they would put
          // in the player's boxes is nobody's choice.
          const preview = playing && rolled && taken === null ? scoreFor(category, dice) : null;
          const yourLabel =
            taken !== null
              ? t('yachtBoxScored', { name, points: taken })
              : preview !== null
                ? t('yachtBoxPreview', { name, points: preview })
                : t('yachtBoxOpen', { name });
          const cpuLabel =
            cpuTaken !== null
              ? t('yachtBoxCpuPart_scored', { points: cpuTaken })
              : t('yachtBoxCpuPart_open');
          const label = `${yourLabel}; ${cpuLabel}`;
          const flashed = !reducedMotion && flash?.category === category ? flash.seat : null;
          return (
            <button
              key={category}
              type="button"
              className={`yt-box ${taken !== null ? 'yt-box-taken' : ''}`}
              aria-label={label}
              disabled={!playing || !rolled || taken !== null}
              onClick={() => onScore(category)}
            >
              <span className="yt-box-name" aria-hidden="true">
                {name}
              </span>
              {/* The seat's own cell is re-keyed by the fill count when it is
                  the one that just filled, so the flash plays once on arrival
                  and never again on a re-render of the same turn (§10). */}
              <span
                key={flashed === 'player' ? flash!.key : 'you'}
                className={`yt-box-points ${preview !== null ? 'yt-box-preview' : ''} ${
                  flashed === 'player' ? 'yt-box-flash' : ''
                }`}
                aria-hidden="true"
              >
                {taken ?? preview ?? ''}
              </span>
              <span
                key={flashed === 'cpu' ? flash!.key : 'cpu'}
                className={`yt-box-cpu ${flashed === 'cpu' ? 'yt-box-flash' : ''}`}
                aria-hidden="true"
              >
                {cpuTaken ?? ''}
              </span>
            </button>
          );
        })}
      </div>
      <div className="yt-sheet-foot">
        <span>{t('yachtTotal')}</span>
        <span className="game-score">{t('yachtScoreLine', { total, cpuTotal })}</span>
      </div>
    </div>
  );
});
