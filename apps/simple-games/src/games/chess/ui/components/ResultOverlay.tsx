/**
 * The result card (docs/CHESS_RULES.md §3, §9): who won, as a plain fact, and
 * one line on why — the ending's own key, apart from the title, so a
 * mistranslated reason can never turn a draw into a win (§10). Three titles,
 * one per outcome; none praises and a loss is never scolded. Then the facts —
 * the difficulty, the side the player took, the moves played — as label–value
 * pairs. There is no revival to buy and no ad to watch for one more move
 * (docs/ADS_POLICY.md).
 *
 * The share carries exactly the facts the card shows, in the same words —
 * never the moves, the time or the board — and `completed` only for a win
 * (ShareAction's contract). It is the one place `ShareAction` belongs
 * (docs/ARCHITECTURE.md「結果画面の共有」).
 *
 * The final position gets its beat before the card covers it
 * (`useResultReveal`, about a second; at once under Reduced Motion).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { WHITE, isOver, type ChessSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface ChessResultOverlayProps {
  session: ChessSession;
  lastResult: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function ChessResultOverlay({
  session,
  lastResult,
  onNewGame,
  onHome,
}: ChessResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(isOver(session) && lastResult !== null);
  if (!revealed || !lastResult) return null;

  const title =
    lastResult.status === 'won'
      ? t('chessWinTitle')
      : lastResult.status === 'lost'
        ? t('chessLoseTitle')
        : t('chessDrawTitle');
  // The card's facts and the share's are one list, so they cannot disagree.
  const facts = [
    { label: t('difficulty'), value: t(`chessDifficulty_${session.difficulty}`) },
    {
      label: t('chessResultSide'),
      value: session.playerColor === WHITE ? t('chessSideWhite') : t('chessSideBlack'),
    },
    // Moves as chess counts them: one for each White move.
    { label: t('chessResultMoves'), value: String(Math.ceil(lastResult.plies / 2)) },
  ];

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${lastResult.status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{t(`chessReason_${lastResult.reason}`)}</p>

        <dl className="result-facts ch-result-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction
          gameId="chess"
          outcome={lastResult.status === 'won' ? 'completed' : 'played'}
          details={facts}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
