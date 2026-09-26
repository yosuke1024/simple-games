/**
 * The one thing this game has to say at the end (docs/DOMINOES_RULES.md §4,
 * §8): who won and how, the winner's points, and the pips each hand was left
 * holding. It mentions the standing record quietly and offers a new game. A
 * loss is stated, never scolded; there is no revival to buy and no ad to
 * watch for one more draw (ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import type { DominoesSession } from '../../game';
import type { Stats } from '../../storage/schemas';

export interface DominoesResultOverlayProps {
  session: DominoesSession;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function DominoesResultOverlay({
  session,
  stats,
  onRematch,
  onHome,
}: DominoesResultOverlayProps) {
  const { t } = useSettings();
  // The final line gets its beat before the card covers it (§11).
  const revealed = useResultReveal(session.status !== 'playing');
  if (!revealed) return null;

  const blocked = session.ending === 'blocked';
  const won = session.status === 'won';
  const title =
    session.status === 'won'
      ? t('dominoesWinTitle')
      : session.status === 'lost'
        ? t('dominoesLoseTitle')
        : t('dominoesDrawTitle');
  const body =
    session.status === 'won'
      ? t(blocked ? 'dominoesWinBodyBlocked' : 'dominoesWinBodyOut')
      : session.status === 'lost'
        ? t(blocked ? 'dominoesLoseBodyBlocked' : 'dominoesLoseBodyOut')
        : t('dominoesDrawBody');
  // The winner's points (§4). A draw has no winner, so it has no score line —
  // the pip totals below are the whole story.
  const scoreLine =
    session.status === 'won'
      ? t('dominoesScoreYou', { points: session.score })
      : session.status === 'lost'
        ? t('dominoesScoreCpu', { points: session.score })
        : null;
  const pipsLine = t('dominoesPipsLeft', { you: session.playerPips, cpu: session.cpuPips });

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        {scoreLine ? <p className="dm-result-score">{scoreLine}</p> : null}
        <p className="dialog-body">{pipsLine}</p>

        {/* The standing record, stated once — never a streak. */}
        <p className="dialog-body">
          {t('dominoesRecordNote', { wins: stats.wins, losses: stats.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        {/* The score line exactly as shown above — or, for a draw, the pip
            totals, which are then the whole result. The record note is not a
            fact of this game and is never repeated in a share. */}
        <ShareAction
          gameId="dominoes"
          outcome={won ? 'completed' : 'played'}
          details={[{ value: scoreLine ?? pipsLine }]}
        />
      </div>
      <ResultAdSlot />
    </div>
  );
}
