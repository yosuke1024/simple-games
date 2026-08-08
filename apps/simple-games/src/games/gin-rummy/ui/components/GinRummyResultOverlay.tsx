/**
 * The one thing this game has to say at the end of a match: who reached a
 * hundred. It shows the final score, names the hand that decided it, mentions
 * the standing record against this opponent quietly, and offers a free
 * rematch. A loss is stated, never scolded; there is no revival to buy and no
 * ad to watch for one more hand (docs/ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { YOU, type GinRummySession } from '../../game';
import type { LastResult } from '../../state/GameContext';
import type { Stats } from '../../storage/schemas';

export interface GinRummyResultOverlayProps {
  session: GinRummySession;
  lastResult: LastResult | null;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function GinRummyResultOverlay({
  session,
  lastResult,
  stats,
  onRematch,
  onHome,
}: GinRummyResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing' || !lastResult) return null;

  const won = session.status === 'won';
  const title = won ? t('ginWinTitle') : t('ginLoseTitle');
  const record = stats[session.difficulty];
  // The hand that carried the match past a hundred, said in one line so the
  // last settlement is not simply swallowed by the match's own result.
  const decider = session.lastHand;

  return (
    <div className="overlay">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{won ? t('ginWinBody') : t('ginLoseBody')}</p>

        {decider && decider.winner !== null ? (
          <p className="dialog-body">
            {decider.winner === YOU
              ? t('ginHandYouTook', { points: decider.points })
              : t('ginHandCpuTook', { points: decider.points })}
          </p>
        ) : null}

        <dl className="result-facts">
          <div>
            <dt>{t('ginYou')}</dt>
            <dd>{lastResult.mine}</dd>
          </div>
          <div>
            <dt>{t('ginCpu')}</dt>
            <dd>{lastResult.theirs}</dd>
          </div>
        </dl>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('ginRecordNote', { wins: record.wins, losses: record.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
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
