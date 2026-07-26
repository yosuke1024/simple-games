import type { GameSession } from '../../game';
import { useSettings } from '../../state/SettingsContext';
import { formatDuration } from '../format';

export interface ResultOverlayProps {
  session: GameSession;
  onRetry: () => void;
  onNewGame: () => void;
  onHome: () => void;
}

/** Shown at the natural break when a game ends (cleared or game over). */
export function ResultOverlay({ session, onRetry, onNewGame, onHome }: ResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing') return null;
  const cleared = session.status === 'cleared';
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
        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNewGame}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
