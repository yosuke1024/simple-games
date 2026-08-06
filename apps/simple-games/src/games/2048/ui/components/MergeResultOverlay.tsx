/**
 * The two things this game has to say (docs/GAME_2048_RULES.md §2).
 *
 * Reaching 2048 is announced once and then the board carries on — the original
 * asks "continue?", but there is no other answer, so the question is a button
 * that says "Keep Going" and nothing is taken away if it is ignored (§13).
 *
 * Running out of moves is the only ending. It shows the run's facts, mentions
 * a personal best quietly, and offers a free new board. There is no revival to
 * buy and no ad to watch for one more move (§8, ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { largestTile, type Game2048Session } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface MergeResultOverlayProps {
  session: Game2048Session;
  lastResult: LastResult | null;
  announceReached: boolean;
  onKeepGoing: () => void;
  onNewGame: () => void;
  onHome: () => void;
}

export function MergeResultOverlay({
  session,
  lastResult,
  announceReached,
  onKeepGoing,
  onNewGame,
  onHome,
}: MergeResultOverlayProps) {
  const { t } = useSettings();
  const over = session.status === 'over';

  // Both at once is possible — the move that makes 2048 can also fill the
  // board. The ending wins: "Keep Going" would be an offer the board cannot
  // honour, and the reach is on the statistics screen either way (§9).
  if (over) {
    return (
      <div className="overlay">
        <div
          className="dialog result"
          role="alertdialog"
          aria-modal="true"
          aria-label={t('mergeOverTitle')}
        >
          <h2 className="dialog-title">{t('mergeOverTitle')}</h2>
          <p className="dialog-body">{t('mergeOverBody')}</p>

          <dl className="result-facts">
            <div>
              <dt>{t('score')}</dt>
              <dd>{session.score}</dd>
            </div>
            <div>
              <dt>{t('mergeBestTile')}</dt>
              <dd>{largestTile(session.board)}</dd>
            </div>
          </dl>

          {lastResult?.isNewBestScore ? (
            <p className="dialog-body">{t('mergeNewBestScore')}</p>
          ) : lastResult ? (
            <p className="dialog-body">
              {t('mergeBestScore')} {lastResult.bestScore}
            </p>
          ) : null}

          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
              {t('newGame')}
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

  if (!announceReached) return null;

  return (
    <div className="overlay">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('mergeReachedTitle')}
      >
        <h2 className="dialog-title">{t('mergeReachedTitle')}</h2>
        <p className="dialog-body">{t('mergeReachedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{session.score}</dd>
          </div>
        </dl>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onKeepGoing} autoFocus>
            {t('mergeKeepGoing')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNewGame}>
            {t('newGame')}
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
