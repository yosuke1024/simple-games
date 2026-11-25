/**
 * The end of a game against the CPU: won or lost, in how many of the player's
 * moves, at which strength. A won game also goes to the Club House's
 * table for its strength; a loss is `played` and goes nowhere
 * (docs/CHAIN_TERRITORY_RULES.md「Club House」).
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
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
    title = t(won ? 'chainTerritoryWon' : 'chainTerritoryLost');
  // The game's figure, once: the share's string and the Club's number are read
  // from the same variable (docs/architecture/club.md §6-1).
  const moves = resultValue(session);
  const facts = useMemo(() => ({ moves }), [moves]);
  const details = [
    { label: t('movesLabel'), value: String(moves) },
    { label: t('difficulty'), value: t(`chainTerritoryMode_${session.mode}`) },
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
            {t('newGame')}
          </button>
          <button className="btn btn-secondary" type="button" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button className="btn btn-ghost" type="button" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="chain-territory"
          outcome={won ? 'completed' : 'played'}
          details={details}
        />
        <ClubResultAction
          gameId="chain-territory"
          // Only a win is ranked: a loss's moves measure how long the player
          // held on, not how well they played.
          outcome={won ? 'completed' : 'played'}
          details={details}
          facts={facts}
          seed={String(session.seed)}
          params={{ difficulty: session.mode }}
          boardDigest={null}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
