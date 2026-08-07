/**
 * The one thing this game has to say at the end: who made four (§3). It
 * mentions the standing record against this opponent quietly and offers a
 * free rematch. A loss is stated, never scolded; there is no revival to buy
 * and no ad to watch for one more move (docs/CONNECT_FOUR_RULES.md §7,
 * ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import type { ConnectFourSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface ConnectFourResultOverlayProps {
  session: ConnectFourSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function ConnectFourResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: ConnectFourResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing') return null;

  const title =
    session.status === 'won'
      ? t('fourWinTitle')
      : session.status === 'lost'
        ? t('fourLoseTitle')
        : t('fourDrawTitle');
  const body =
    session.status === 'won'
      ? t('fourWinBody')
      : session.status === 'lost'
        ? t('fourLoseBody')
        : t('fourDrawBody');
  const record = stats[session.difficulty];

  return (
    <div className="overlay">
      <div
        className={`dialog result ${session.status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('fourRecordNote', { wins: record.wins, losses: record.losses })}
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
