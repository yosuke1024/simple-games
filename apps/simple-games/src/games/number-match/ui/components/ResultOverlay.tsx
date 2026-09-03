/**
 * The card at the natural break when a game ends — cleared, or out of moves.
 * It states the score and its parts, the time and the moves, and mentions a
 * personal best quietly rather than celebrating it at length.
 */
import { MAX_LEVEL, type GameSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import type { ShareDetail } from '@/services/share/message';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';

export interface ResultOverlayProps {
  session: GameSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  /** Free play's "next": another board at the same tier (§11). */
  onNewFree: () => void;
  onHome: () => void;
}

/** Shown at the natural break when a game ends (cleared or game over). */
export function ResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onNewFree,
  onHome,
}: ResultOverlayProps) {
  const { t } = useSettings();
  // The emptied board — or the one that ran out of room — gets its beat
  // before the card covers it (§12).
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;
  const cleared = session.status === 'cleared';
  const { score } = session;
  const hasNextLevel =
    cleared && session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;
  // A free board's "next" is another board at the same tier, after a clear
  // and a dead end alike; a level's is the next level; a daily has neither,
  // and the retry leads.
  const hasNext = hasNextLevel || session.mode === 'free';

  // Score total, time, moves — the same trio either way. The cleared card
  // shows the total as a bare number under its own heading; away from that
  // heading, in a message, it needs the same caption the game-over card uses.
  const details: ShareDetail[] = [
    { label: t('score'), value: String(score.total) },
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('movesLabel'), value: String(session.moveCount) },
  ];

  return (
    <div className="overlay overlay-result">
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
                <span className="score-newbest">
                  {t('newBest')}
                  <BestDelta
                    value={score.total}
                    previous={lastResult.previousBestScore}
                    kind="count"
                    lowerIsBetter={false}
                  />
                </span>
              ) : lastResult ? (
                <span className="score-best-note">
                  {t('best')} {lastResult.bestScore}
                  <BestDelta
                    value={score.total}
                    previous={lastResult.previousBestScore}
                    kind="count"
                    lowerIsBetter={false}
                  />
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
          ) : session.mode === 'free' ? (
            <button type="button" className="btn btn-primary" onClick={onNewFree} autoFocus>
              {t('newGame')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNext ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNext}
          >
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="number-match"
          outcome={cleared ? 'completed' : 'played'}
          details={details}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
