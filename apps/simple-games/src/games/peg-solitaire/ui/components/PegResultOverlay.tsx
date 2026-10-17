/**
 * The end of a game (docs/PEG_SOLITAIRE_RULES.md §3, §5, §6): three headings
 * for the three ways it can end — a perfect clear, one peg left elsewhere, or
 * several pegs with no jump between them — and the number left. A personal
 * record is mentioned only when this game beat one (§10); there is no score,
 * no rating, and nothing that grades the player by the pegs left (§16).
 *
 * Every card offers Undo — it is free and unlimited, after a perfect clear
 * too (§6). After a one-peg or stuck finish it is the first offer: thinking
 * again from the jump before the end is the centre of this game. After a
 * perfect clear the first offer is the next game — a new board on the
 * Triangle, the same board again on English — and Undo follows it, there for
 * a player who wants to look back. "New board" is the Triangle's alone —
 * English deals one problem — and it is the same offer the ↻ dialog makes
 * (GameScreen.tsx, src/test/restartDialogWiring.test.ts).
 *
 * The card waits the shared beat after the last jump (ui/useResultReveal.ts),
 * so the finished board is seen before it is covered.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { PegSolitaireSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface PegResultOverlayProps {
  session: PegSolitaireSession;
  lastResult: LastResult | null;
  onUndo: () => void;
  onRetry: () => void;
  /** Another problem on the same board — absent on English (§8). */
  onNewBoard?: () => void;
  onHome: () => void;
}

export function PegResultOverlay({
  session,
  lastResult,
  onUndo,
  onRetry,
  onNewBoard,
  onHome,
}: PegResultOverlayProps) {
  const { t } = useSettings();
  const outcome = session.status === 'over' ? session.outcome : null;
  const revealed = useResultReveal(outcome !== null);
  if (!revealed || outcome === null) return null;

  const perfect = outcome.kind === 'perfect';
  const title =
    outcome.kind === 'perfect'
      ? t('pegSolitairePerfectTitle')
      : outcome.kind === 'single'
        ? t('pegSolitaireSingleTitle')
        : t('pegSolitaireStuckTitle');
  const body =
    outcome.kind === 'perfect'
      ? t('pegSolitairePerfectBody')
      : outcome.kind === 'single'
        ? t('pegSolitaireSingleBody')
        : t('pegSolitaireStuckBody');
  const boardName = t(`pegSolitaireBoard_${session.problem.kind}`);
  // The facts this card shows, headline first — and nothing it does not.
  const details = [
    { label: t('pegSolitairePegsLeftLabel'), value: String(outcome.remaining) },
    { label: t('pegSolitaireBoardFact'), value: boardName },
  ];
  const best = lastResult?.kind === session.problem.kind ? lastResult : null;

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${perfect ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('pegSolitairePegsLeftLabel')}</dt>
            <dd>{outcome.remaining}</dd>
          </div>
          {best ? (
            <div>
              <dt>{t('pegSolitaireFewestLabel')}</dt>
              <dd>{best.best}</dd>
            </div>
          ) : null}
        </dl>

        {best?.improved ? (
          <p className="dialog-body pg-new-fewest">{t('pegSolitaireNewFewest')}</p>
        ) : null}

        <div className="result-actions">
          {perfect ? null : (
            <button type="button" className="btn btn-primary" onClick={onUndo} autoFocus>
              {t('undo')}
            </button>
          )}
          {perfect && onNewBoard ? (
            <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
              {t('pegSolitaireNewBoard')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${perfect && !onNewBoard ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onRetry}
            autoFocus={perfect && !onNewBoard}
          >
            {t('tryAgain')}
          </button>
          {!perfect && onNewBoard ? (
            <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
              {t('pegSolitaireNewBoard')}
            </button>
          ) : null}
          {perfect ? (
            <button type="button" className="btn btn-secondary" onClick={onUndo}>
              {t('undo')}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="peg-solitaire"
          outcome={perfect ? 'completed' : 'played'}
          details={details}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
