import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Session } from '../../game';
export function ResultOverlay({
  session,
  onNewGame,
  onHome,
}: {
  session: Session;
  onNewGame: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;
  const won = session.status === 'won',
    title = t(won ? 'paddleRallyWon' : 'paddleRallyLost');
  const details = [
    { label: t('paddleRallyScore'), value: `${session.playerScore} – ${session.cpuScore}` },
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
        <p className="dialog-body">{t('paddleRallyGoal')}</p>
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
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="paddle-rally"
          outcome={won ? 'completed' : 'played'}
          details={details}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
