/**
 * The clear screen (docs/BINARY_BALANCE_RULES.md §10). Time and hints — the
 * facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle. There is no
 * losing screen, because there is no losing (§2).
 *
 * The first button is the same board again; the second, for a difficulty
 * game, a new board at the same difficulty (§10). A daily is one board a day,
 * so it has no second board to offer.
 */
import { useSettings } from '@/state/SettingsContext';
import { BestDelta } from '@/ui/components/BestDelta';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { formatDuration } from '@/ui/format';
import { useResultReveal } from '@/ui/useResultReveal';
import type { BinaryBalanceSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface BinaryBalanceResultOverlayProps {
  session: BinaryBalanceSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}

export function BinaryBalanceResultOverlay({
  session,
  lastResult,
  onRetry,
  onNewBoard,
  onHome,
}: BinaryBalanceResultOverlayProps) {
  const { t } = useSettings();
  // The finished board gets its beat before the card covers it (§13).
  const revealed = useResultReveal(session.status === 'solved');
  if (!revealed) return null;

  const canStartNew = session.mode === 'difficulty';

  const details = [
    { label: t('timeLabel'), value: formatDuration(session.elapsedSeconds) },
    { label: t('binaryBalanceHintsUsed'), value: String(session.hintCount) },
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
        aria-label={t('binaryBalanceSolvedTitle')}
      >
        <h2 className="dialog-title">{t('binaryBalanceSolvedTitle')}</h2>
        <p className="dialog-body">{t('binaryBalanceSolvedBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('binaryBalanceHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBest ? (
          <p className="dialog-body">
            {t('binaryBalanceNewBestTime')}
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
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          {canStartNew ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('binaryBalanceNewBoard')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="binary-balance" outcome="completed" details={details} />
        <ClubResultAction
          gameId="binary-balance"
          outcome="completed"
          details={details}
          facts={facts}
          seed={session.seed}
          params={{ difficulty: session.difficulty }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
