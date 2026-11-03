import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { useDialogDismiss } from '@/ui/useDialogDismiss';
import { resultValue, type Session } from '../../game';
export function ResultOverlay({
  session,
  onRetry,
  onNewBoard,
  onHome,
}: {
  session: Session;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}) {
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;
  return <ResultCard session={session} onRetry={onRetry} onNewBoard={onNewBoard} onHome={onHome} />;
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
  onHome: () => void;
}) {
  const { t } = useSettings();
  useDialogDismiss(onHome);
  const won = session.status === 'won',
    title = t(won ? 'marbleWeaveWon' : 'marbleWeaveLost');
  const details = [
    {
      label: t(session.rulesVersion === 1 ? 'score' : 'movesLabel'),
      value: String(resultValue(session)),
    },
    { label: t('difficulty'), value: t(`marbleWeaveMode_${session.mode}`) },
    ...(session.puzzleId
      ? [
          {
            label: t('marbleWeavePuzzleLabel'),
            value: session.puzzleId.split('-')[1]!,
          },
        ]
      : []),
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
          <button className="btn btn-primary" type="button" autoFocus onClick={onNewBoard}>
            {t('marbleWeaveNextPuzzle')}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="marble-weave"
          outcome={won ? 'completed' : 'played'}
          details={details}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
