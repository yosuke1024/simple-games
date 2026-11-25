/**
 * The clear screen (docs/LOOP_PUZZLE_RULES.md §10). Time and hints — the
 * facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle. There is no
 * losing screen, because there is no losing (§3).
 *
 * The one place `ShareAction` belongs (docs/ARCHITECTURE.md「結果画面の共有」),
 * and beside it the Club House result (§17): the daily goes to Today's
 * challenge with its board digest, a Free Play clear to the difficulty's table.
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import { boardDigestOf, type LoopPuzzleSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface LoopPuzzleResultOverlayProps {
  session: LoopPuzzleSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function LoopPuzzleResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: LoopPuzzleResultOverlayProps) {
  const { t } = useSettings();
  // The finished loop gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  const { elapsedSeconds, hintCount } = session;
  // The same session fields as `details` below: the Club's figures and the
  // share's strings never disagree (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ elapsedSeconds, hints: hintCount }), [elapsedSeconds, hintCount]);
  if (!revealed) return null;

  // A daily is one board a day: there is no other board to offer (§9).
  const canStartNew = session.mode === 'difficulty';

  const details = [
    { label: t('timeLabel'), value: formatDuration(elapsedSeconds) },
    { label: t('loopPuzzleHintsUsed'), value: String(hintCount) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('loopPuzzleSolvedTitle')}
      >
        <h2 className="dialog-title">{t('loopPuzzleSolvedTitle')}</h2>
        <p className="dialog-body">{t('loopPuzzleSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('loopPuzzleHintsUsed')}</dt>
            <dd>{hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('loopPuzzleNewBestTime')}
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

        {/* A key held down from the board's last tap reaches the focused Retry
            as repeats the moment the card is up (at once under Reduced
            Motion): a repeat is not a new press, so it starts nothing (§4). */}
        <div
          className="result-actions"
          onKeyDown={(event) => {
            if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
            }
          }}
        >
          {/* Retry leads and New board follows (§9): the same board again is the
              first offer, a fresh one the second, and the daily has no second. */}
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('loopPuzzleNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="loop-puzzle" outcome="completed" details={details} />
        <ClubResultAction
          gameId="loop-puzzle"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ difficulty: session.difficulty }}
          boardDigest={session.mode === 'daily' ? boardDigestOf(session) : null}
          daily={session.mode === 'daily' ? session.dailyDate : null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
