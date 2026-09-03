/**
 * The one thing this game has to say at the end of a match: where the four
 * seats finished. It is a standing rather than a difference — you are not
 * playing one opponent, you are placed among three — so the final scores are
 * listed lowest first, which is winning order in Hearts.
 *
 * Three verdicts, not two. Four seats make a tie for lowest ordinary rather
 * than exotic, and a match the player shares the lowest score in is a draw
 * (game/session.ts `statusOf`); it is neither celebrated nor scolded, it is
 * stated. A loss is stated too; there is no revival to buy and no ad to watch
 * for one more hand (docs/ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import { SEATS, YOU, type HeartsSession, type Seat } from '../../game';
import type { LastResult } from '../../state/GameContext';
import type { Stats } from '../../storage/schemas';
import { seatLabel } from './cardText';

export interface HeartsResultOverlayProps {
  session: HeartsSession;
  lastResult: LastResult | null;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function HeartsResultOverlay({
  session,
  lastResult,
  stats,
  onRematch,
  onHome,
}: HeartsResultOverlayProps) {
  const { t } = useSettings();
  // The last settled hand gets its beat before the card covers it (§11.2).
  const revealed = useResultReveal(session.status !== 'playing' && lastResult !== null);
  if (!revealed || !lastResult) return null;

  const { status, scores } = lastResult;
  const title =
    status === 'won'
      ? t('heartsWinTitle')
      : status === 'lost'
        ? t('heartsLoseTitle')
        : t('heartsDrawTitle');
  const body =
    status === 'won'
      ? t('heartsWinBody')
      : status === 'lost'
        ? t('heartsLoseBody')
        : t('heartsDrawBody');
  const record = stats[session.difficulty];

  // Lowest first: in Hearts that is the order they finished in. Seats level on
  // points keep their seat order, which is stable and means nothing more.
  const standing = [...SEATS].sort((a, b) => scores[a] - scores[b] || a - b) as Seat[];

  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${status === 'won' ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body}</p>

        <table className="ht-scoreboard">
          <caption className="ht-scoreboard-caption">{t('heartsFinalScores')}</caption>
          <tbody>
            {standing.map((seat, place) => (
              <tr key={seat} className={seat === YOU ? 'ht-scoreboard-you' : ''}>
                <td className="ht-scoreboard-place">{place + 1}</td>
                <th scope="row" className="ht-scoreboard-seat">
                  {seatLabel(t, seat)}
                </th>
                <td className="ht-scoreboard-total">{scores[seat]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* The standing against these opponents, stated once — never a streak. */}
        <p className="dialog-body">
          {t('heartsRecordNote', {
            wins: record.wins,
            losses: record.losses,
            draws: record.draws,
          })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
      <ResultAdSlot />
    </div>
  );
}
