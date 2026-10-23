import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Session } from '../../game';
export function ResultOverlay({
  session,
  onUndo,
  onNewGame,
  onHome,
}: {
  session: Session;
  onUndo: () => void;
  onNewGame: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;
  const won = session.status === 'won',
    title = t(won ? 'nimWon' : 'nimLost');
  const details = [{ label: t('nimOpponent'), value: t(`nimMode_${session.mode}`) }];
  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{t('nimGoal')}</p>
        <dl className="result-facts">
          <div>
            <dt>{details[0]!.label}</dt>
            <dd>{details[0]!.value}</dd>
          </div>
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={onNewGame}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onUndo}>
            {t('undo')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="nim" outcome={won ? 'completed' : 'played'} details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
