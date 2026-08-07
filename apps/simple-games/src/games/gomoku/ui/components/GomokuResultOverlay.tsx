/**
 * The one thing this game has to say at the end: who lined five up (§3). It
 * mentions the standing record against this opponent quietly and offers a
 * free rematch. A loss is stated, never scolded; there is no revival to buy
 * and no ad to watch for one more move (docs/GOMOKU_RULES.md §7,
 * ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import type { GomokuSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface GomokuResultOverlayProps {
  session: GomokuSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function GomokuResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: GomokuResultOverlayProps) {
  const { t } = useSettings();
  if (session.status === 'playing') return null;

  const title =
    session.status === 'won'
      ? t('gomokuWinTitle')
      : session.status === 'lost'
        ? t('gomokuLoseTitle')
        : t('gomokuDrawTitle');
  const body =
    session.status === 'won'
      ? t('gomokuWinBody')
      : session.status === 'lost'
        ? t('gomokuLoseBody')
        : t('gomokuDrawBody');
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
          {t('gomokuRecordNote', { wins: record.wins, losses: record.losses })}
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
