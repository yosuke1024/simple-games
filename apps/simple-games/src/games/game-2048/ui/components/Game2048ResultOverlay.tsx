/**
 * The two moments a 2048 game stops for a breath (docs/GAME_2048_RULES.md §3).
 *
 * Reaching 2048 is congratulated and then got out of the way: the same game
 * carries on, because that is what the rules say and because ending it there
 * would be inventing a wall. Game over is stated plainly with the facts of the
 * run — score, highest tile, moves — and no scolding.
 *
 * The congratulation comes first when a single move does both, so a run that
 * ends on its 2048 still gets its moment.
 */
import { useSettings } from '@/state/SettingsContext';
import { maxTile, type Game2048Session } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface Game2048ResultOverlayProps {
  session: Game2048Session;
  lastResult: LastResult | null;
  onKeepPlaying: () => void;
  onRestart: () => void;
  onHome: () => void;
}

export function Game2048ResultOverlay({
  session,
  lastResult,
  onKeepPlaying,
  onRestart,
  onHome,
}: Game2048ResultOverlayProps) {
  const { t } = useSettings();

  const celebrating = session.won && !session.winAcknowledged;
  if (!celebrating && session.status !== 'over') return null;

  if (celebrating) {
    return (
      <div className="overlay">
        <div
          className="dialog result g2048-result-win"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('g2048WinTitle')}
        >
          <h2 className="dialog-title">{t('g2048WinTitle')}</h2>
          <p className="dialog-body">{t('g2048WinBody')}</p>
          <dl className="result-facts">
            <div>
              <dt>{t('score')}</dt>
              <dd>{session.score}</dd>
            </div>
          </dl>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={onKeepPlaying} autoFocus>
              {t('g2048KeepPlaying')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('gameOverTitle')}
      >
        <h2 className="dialog-title">{t('gameOverTitle')}</h2>
        <p className="dialog-body">{t('g2048OverBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{session.score}</dd>
          </div>
          <div>
            <dt>{t('g2048BestTile')}</dt>
            <dd>{maxTile(session.board)}</dd>
          </div>
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body g2048-newbest">{t('newBest')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('best')} {lastResult.bestScore}
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} autoFocus>
            {t('g2048Restart')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
