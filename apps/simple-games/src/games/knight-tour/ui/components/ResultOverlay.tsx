import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Session } from '../../game';
export function ResultOverlay({
  session,
  onUndo,
  onRetry,
  onNewBoard,
  onHome,
}: {
  session: Session;
  onUndo: () => void;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status === 'won');
  if (!revealed) return null;
  const details = [{ label: t('knightTourBoard'), value: `${session.mode} × ${session.mode}` }];
  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('knightTourWon')}
      >
        <h2 className="dialog-title">{t('knightTourWon')}</h2>
        <p className="dialog-body">
          {t('knightTourVisited', { count: session.path.length, total: session.mode ** 2 })}
        </p>
        <dl className="result-facts">
          <div>
            <dt>{details[0]!.label}</dt>
            <dd>{details[0]!.value}</dd>
          </div>
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={onNewBoard}>
            {t('knightTourNewBoard')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onUndo}>
            {t('undo')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="knight-tour" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
