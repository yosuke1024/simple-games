/**
 * The clear screen (docs/TAKUZU_RULES.md §10). Time and hints — the facts of
 * the run. The time appears only here, because showing it while playing would
 * be a clock counting up at someone doing a puzzle. There is no losing screen,
 * because there is no losing (§2).
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { boardDigestOf, MAX_LEVEL, type TakuzuSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface TakuzuResultOverlayProps {
  session: TakuzuSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  /** Free play's "next": another board at the same tier (§7). */
  onNewFree: () => void;
  onHome: () => void;
}

export function TakuzuResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onNewFree,
  onHome,
}: TakuzuResultOverlayProps) {
  const { t } = useSettings();
  // The filled board gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;
  // A free board's "next" is another board at the same tier; a level's is the
  // next level; a daily has neither, and the retry leads.
  const hasNext = hasNextLevel || session.mode === 'free';

  const details = [
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('takuzuHintsUsed'), value: String(session.hintCount) },
  ];
  // The same session fields as `details`: the Club's figures and the share's strings
  // never disagree (docs/architecture/club.md §6-1).
  const facts = {
    elapsedSeconds: session.elapsedSeconds,
    hints: session.hintCount,
  };

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('takuzuSolvedTitle')}
      >
        <h2 className="dialog-title">{t('takuzuSolvedTitle')}</h2>
        <p className="dialog-body">{t('takuzuSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('takuzuHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">
            {t('takuzuNewBestTime')}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
            <BestDelta
              value={lastResult.seconds}
              previous={lastResult.previousBestSeconds}
              kind="time"
            />
          </p>
        ) : null}

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
        <ShareAction gameId="takuzu" outcome="completed" details={details} />
        <ClubResultAction
          gameId="takuzu"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ size: session.size }}
          boardDigest={session.mode === 'daily' ? boardDigestOf(session) : null}
          daily={session.mode === 'daily' ? session.dailyDate : null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
