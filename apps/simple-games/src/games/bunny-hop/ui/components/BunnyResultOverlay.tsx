/**
 * The end-of-run screen (docs/BUNNY_HOP_RULES.md §2, §8, §9). There is no
 * clear to celebrate — every run ends in a crash, sooner or later — so this
 * states the score and offers the next track, free, right there.
 *
 * There is nothing to buy: no continue, no second chance, no ad to watch for
 * one more jump (§13). A personal best is mentioned quietly rather than made
 * into an event.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import type { LastResult } from '../../state/GameContext';

export interface BunnyResultOverlayProps {
  result: LastResult | null;
  onRunAgain: () => void;
  onHome: () => void;
}

export function BunnyResultOverlay({ result, onRunAgain, onHome }: BunnyResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  return (
    <div className="overlay">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('bunnyOverTitle')}
      >
        <h2 className="dialog-title">{t('bunnyOverTitle')}</h2>
        <p className="dialog-body">{t('bunnyOverBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{result.score}</dd>
          </div>
          <div>
            <dt>{t('bunnyObstaclesPassed')}</dt>
            <dd>{result.obstaclesPassed}</dd>
          </div>
        </dl>

        {result.isNewBestScore && result.score > 0 ? (
          <p className="dialog-body">{t('bunnyNewBestScore')}</p>
        ) : (
          <p className="dialog-body">
            {t('bunnyBestScore')} {result.bestScore}
          </p>
        )}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRunAgain} autoFocus>
            {t('bunnyRunAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
      <ResultAdSlot />
    </div>
  );
}
