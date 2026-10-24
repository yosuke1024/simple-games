/**
 * The result card (docs/NESTED_TIC_TAC_TOE_RULES.md §7, §10): who won, as a
 * plain fact, and the facts behind it — the small boards each side took and
 * the difficulty, as label–value pairs. Three titles, one per outcome; none
 * praises and a loss is never scolded. There is no revival to buy and no ad
 * to watch for one more move (docs/ADS_POLICY.md).
 *
 * The share carries exactly the facts the card shows, in the same words —
 * never the moves, the time or the board — and `completed` only for a win
 * (ShareAction's contract). It is the one place `ShareAction` belongs
 * (docs/ARCHITECTURE.md「結果画面の共有」).
 *
 * The finished board gets its beat before the card covers it
 * (`useResultReveal`, about a second; at once under Reduced Motion).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { NestedSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface NestedTicTacToeResultOverlayProps {
  session: NestedSession;
  lastResult: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function NestedTicTacToeResultOverlay({
  session,
  lastResult,
  onNewGame,
  onHome,
}: NestedTicTacToeResultOverlayProps) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status !== 'playing' && lastResult !== null);
  if (!revealed || !lastResult) return null;

  const title =
    lastResult.status === 'won'
      ? t('nestedTicTacToeWinTitle')
      : lastResult.status === 'lost'
        ? t('nestedTicTacToeLoseTitle')
        : t('nestedTicTacToeDrawTitle');
  const body =
    lastResult.status === 'won'
      ? t('nestedTicTacToeWinBody')
      : lastResult.status === 'lost'
        ? t('nestedTicTacToeLoseBody')
        : t('nestedTicTacToeDrawBody');
  // The card's facts and the share's are one list, so they cannot disagree.
  const facts = [
    { label: t('nestedTicTacToeBoardsYou'), value: String(lastResult.mine) },
    { label: t('nestedTicTacToeBoardsCpu'), value: String(lastResult.theirs) },
    { label: t('difficulty'), value: t(`nestedTicTacToeDifficulty_${session.difficulty}`) },
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
        <p className="dialog-body">{body}</p>

        <dl className="result-facts nt-result-facts">
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
          gameId="nested-tic-tac-toe"
          outcome={lastResult.status === 'won' ? 'completed' : 'played'}
          details={facts}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
