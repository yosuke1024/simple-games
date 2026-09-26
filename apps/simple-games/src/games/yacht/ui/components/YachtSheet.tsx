/**
 * The score sheet (docs/YACHT_RULES.md §3, §9): twelve boxes as buttons, two
 * columns of six — the upper boxes on the left, the combinations on the
 * right. The DOM keeps the sheet's own order, so a screen reader reads the
 * left column and then the right.
 *
 * An open box previews, faintly, what the dice on the table would put in it —
 * the arithmetic is the game's to do, the choice is the player's (§5). A
 * filled box shows its points solidly and is disabled. Before the first throw
 * of a turn no box previews anything and none can be pressed (§2).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { CATEGORIES, scoreFor, type Category, type Dice, type Scores } from '../../game';
import { CATEGORY_KEY } from '../categoryKey';

export interface YachtSheetProps {
  scores: Scores;
  dice: Dice;
  /** False before the first throw of a turn: nothing to preview or score. */
  rolled: boolean;
  /** False while a dialog is up or the sheet is full. */
  playing: boolean;
  onScore: (category: Category) => void;
}

export const YachtSheet = memo(function YachtSheet({
  scores,
  dice,
  rolled,
  playing,
  onScore,
}: YachtSheetProps) {
  const { t } = useSettings();

  return (
    <div className="yt-sheet" role="group" aria-label={t('yachtSheetLabel')}>
      {CATEGORIES.map((category, index) => {
        const name = t(CATEGORY_KEY[category]);
        const taken = scores[index] ?? null;
        const preview = taken === null && rolled ? scoreFor(category, dice) : null;
        const label =
          taken !== null
            ? t('yachtBoxScored', { name, points: taken })
            : preview !== null
              ? t('yachtBoxPreview', { name, points: preview })
              : t('yachtBoxOpen', { name });
        return (
          <button
            key={category}
            type="button"
            className={`yt-box ${taken !== null ? 'yt-box-taken' : ''}`}
            aria-label={label}
            disabled={!playing || taken !== null || !rolled}
            onClick={() => onScore(category)}
          >
            <span className="yt-box-name" aria-hidden="true">
              {name}
            </span>
            <span
              className={`yt-box-points ${preview !== null ? 'yt-box-preview' : ''}`}
              aria-hidden="true"
            >
              {taken ?? preview ?? ''}
            </span>
          </button>
        );
      })}
    </div>
  );
});
