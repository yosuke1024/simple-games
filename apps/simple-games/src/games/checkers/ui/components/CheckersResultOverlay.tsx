/**
 * The one thing this game has to say at the end: who still had somewhere to
 * go (§3). It shows what each side has left, mentions the standing record
 * against this opponent quietly, and offers a free rematch. A loss is stated,
 * never scolded; there is no revival to buy and no ad to watch for one more
 * move (docs/CHECKERS_RULES.md §7, ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { countPieces, type CheckersSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface CheckersResultOverlayProps {
  session: CheckersSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function CheckersResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: CheckersResultOverlayProps) {
  const { t } = useSettings();
  // The final position gets its beat before the card covers it (§10).
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;

  const title =
    session.status === 'won'
      ? t('checkersWinTitle')
      : session.status === 'lost'
        ? t('checkersLoseTitle')
        : t('checkersDrawTitle');
  const body =
    session.status === 'won'
      ? t('checkersWinBody')
      : session.status === 'lost'
        ? t('checkersLoseBody')
        : t('checkersDrawBody');
  const record = stats[session.difficulty];
  const counts = countPieces(session.board);

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${session.status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('checkersYou')}</dt>
            <dd>{counts.player}</dd>
          </div>
          <div>
            <dt>{t('checkersCpu')}</dt>
            <dd>{counts.cpu}</dd>
          </div>
        </dl>

        {/* The standing against this opponent, stated once — never a streak. */}
        <p className="dialog-body">
          {t('checkersRecordNote', { wins: record.wins, losses: record.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="checkers"
          outcome={session.status === 'won' ? 'completed' : 'played'}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
