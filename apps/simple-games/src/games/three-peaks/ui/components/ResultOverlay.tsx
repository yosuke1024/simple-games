import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import { remaining, type Session } from '../../game';
export function ThreePeaksResultOverlay({
  session,
  onUndo,
  onNewDeal,
  onRetry,
  onHome,
}: {
  session: Session;
  onUndo: () => void;
  onNewDeal: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;
  const won = session.status === 'won';
  const title = t(won ? 'threePeaksWon' : 'threePeaksStuck');
  const label = t('threePeaksCardsLeft');
  const count = remaining(session);
  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDownCapture={(event) => {
          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        }}
      >
        <h2 className="dialog-title">{title}</h2>
        {!won && <p className="dialog-body">{t('threePeaksStuckBody')}</p>}
        <dl className="result-facts">
          <div>
            <dt>{label}</dt>
            <dd>{count}</dd>
          </div>
        </dl>
        <div className="result-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onUndo}
            disabled={!session.actions.length}
            autoFocus
          >
            {t('undo')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNewDeal}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="three-peaks"
          outcome={won ? 'completed' : 'played'}
          details={[{ label, value: String(count) }]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
