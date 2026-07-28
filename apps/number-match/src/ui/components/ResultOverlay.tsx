import { MAX_LEVEL, type GameSession } from '../../game';
import type { LastResult } from '../../state/AppContext';
import { useSettings } from '../../state/SettingsContext';
import { formatDuration } from '../format';

export interface ResultOverlayProps {
  session: GameSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

/** Shown at the natural break when a game ends (cleared or game over). */
export function ResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: ResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing') return null;
  const cleared = session.status === 'cleared';
  const { score } = session;
  const hasNextLevel =
    cleared && session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;

  return (
    <div className="overlay">
      <div
        className={`dialog result ${cleared ? 'result-clear' : 'result-over'}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={cleared ? t('clearTitle') : t('gameOverTitle')}
      >
        <h2 className="dialog-title">{cleared ? t('clearTitle') : t('gameOverTitle')}</h2>
        <p className="dialog-body">{cleared ? t('clearBody') : t('gameOverBody')}</p>

        {cleared ? (
          <div className="score-summary">
            <div className="score-total-row">
              <span className="score-total">{score.total}</span>
              {lastResult?.isNewBest ? (
                <span className="score-newbest">{t('newBest')}</span>
              ) : lastResult ? (
                <span className="score-best-note">
                  {t('best')} {lastResult.bestScore}
                </span>
              ) : null}
            </div>
            <dl className="score-breakdown">
              <div>
                <dt>{t('scoreMatches')}</dt>
                <dd>{score.matchPoints}</dd>
              </div>
              {score.rowPoints > 0 ? (
                <div>
                  <dt>{t('scoreRows')}</dt>
                  <dd>{score.rowPoints}</dd>
                </div>
              ) : null}
              <div>
                <dt>{t('scoreClearBonus')}</dt>
                <dd>{score.clearBonus}</dd>
              </div>
              {score.noHintBonus > 0 ? (
                <div>
                  <dt>{t('scoreNoHint')}</dt>
                  <dd>{score.noHintBonus}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          {!cleared ? (
            <div>
              <dt>{t('score')}</dt>
              <dd>{score.total}</dd>
            </div>
          ) : null}
        </dl>

        <div className="result-actions">
          {hasNextLevel ? (
            <button type="button" className="btn btn-primary" onClick={onNextLevel} autoFocus>
              {t('nextLevel')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNextLevel ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNextLevel}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
