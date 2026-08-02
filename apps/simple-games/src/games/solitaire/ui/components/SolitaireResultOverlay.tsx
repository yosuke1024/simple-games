/**
 * The win screen (docs/SOLITAIRE_RULES.md §4, §8, §9). Moves, time, and hints
 * — the facts of the run. The time appears only here, because showing it
 * while playing would be a clock counting up at someone thinking. Hints are
 * a fact, never a deduction: they were free (§8).
 */
import { useSettings } from '@/state/SettingsContext';
import { formatDuration } from '@/ui/format';
import type { SolitaireSession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';

export interface SolitaireResultOverlayProps {
  session: SolitaireSession;
  lastResult: LastResult | null;
  onNewDeal: () => void;
  onRetry: () => void;
  onHome: () => void;
}

export function SolitaireResultOverlay({
  session,
  lastResult,
  onNewDeal,
  onRetry,
  onHome,
}: SolitaireResultOverlayProps) {
  const { t } = useSettings();
  if (session.status !== 'won') return null;

  return (
    <div className="overlay">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('solWonTitle')}
      >
        <h2 className="dialog-title">{t('solWonTitle')}</h2>
        <p className="dialog-body">{t('solWonBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('movesLabel')}</dt>
            <dd>{session.moveCount}</dd>
          </div>
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          {session.hintCount > 0 ? (
            <div>
              <dt>{t('solHintsUsed')}</dt>
              <dd>{session.hintCount}</dd>
            </div>
          ) : null}
        </dl>

        {lastResult?.isNewBestMoves ? (
          <p className="dialog-body">{t('solNewBestMoves')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('solBestMoves')} {lastResult.bestMoves}
          </p>
        ) : null}

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">{t('solNewBestTime')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
          </p>
        ) : null}

        <div className="result-actions">
          {session.mode === 'free' ? (
            <button type="button" className="btn btn-primary" onClick={onNewDeal} autoFocus>
              {t('solNewDeal')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${session.mode === 'free' ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={session.mode !== 'free'}
          >
            {t('tryAgain')}
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
