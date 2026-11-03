import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { useDialogDismiss } from '@/ui/useDialogDismiss';
import { resultPlace, type Session } from '../../game';
export function ResultOverlay(props: {
  session: Session;
  onRetry: () => void;
  onNewBoard: () => void;
  onNext: () => void;
  onHome: () => void;
}) {
  const revealed = useResultReveal(props.session.status !== 'playing');
  return revealed ? <ResultCard {...props} /> : null;
}
function ResultCard({
  session,
  onRetry,
  onNewBoard,
  onHome,
}: {
  session: Session;
  onRetry: () => void;
  onNewBoard: () => void;
  onNext: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  useDialogDismiss(onHome);
  const won = session.status === 'won',
    title = t(won ? 'oldMaidWon' : 'oldMaidLost'),
    details = [
      { label: t('oldMaidPlace'), value: t('oldMaidPlaceValue', { n: resultPlace(session) }) },
    ];
  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <dl className="result-facts">
          {details.map((d) => (
            <div key={d.label}>
              <dt>{d.label}</dt>
              <dd>{d.value}</dd>
            </div>
          ))}
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={onNewBoard}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="old-maid" outcome={won ? 'completed' : 'played'} details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
