/**
 * How a match ends, said in one of three ways.
 *
 * Three verdicts and no draw. A Ludo match stops the instant one seat gets its
 * fourth pawn home (docs/LUDO_RULES.md §2.8), so a tie for first is not rare
 * here — it is unreachable. What Ludo does have instead is an ending with no
 * result at all: the roll cap (§2.7) stops a match nobody has won, and that is
 * stated as what it is rather than rounded into a loss. It counts as played
 * and as nothing else (§9).
 *
 * A loss is stated too; there is no revival to buy and no ad to watch for one
 * more throw (docs/ADS_POLICY.md).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { HOME_PROGRESS, SEATS, YOU, type LudoSession, type Seat } from '../../game';
import type { LastResult } from '../../state/GameContext';
import type { Stats } from '../../storage/schemas';
import { seatLabel } from './seatText';

export interface LudoResultOverlayProps {
  session: LudoSession;
  lastResult: LastResult | null;
  stats: Stats;
  onRematch: () => void;
  onHome: () => void;
}

export function LudoResultOverlay({
  session,
  lastResult,
  stats,
  onRematch,
  onHome,
}: LudoResultOverlayProps) {
  const { t } = useSettings();
  // The final board gets its beat before the card covers it (§12).
  const revealed = useResultReveal(session.status !== 'playing' && lastResult !== null);
  if (!revealed || !lastResult) return null;

  const result = session.state.result;
  const winner: Seat | null = result !== null && result.kind === 'win' ? result.winner : null;
  const { status } = lastResult;

  const title =
    status === 'won'
      ? t('ludoWinTitle')
      : status === 'lost'
        ? t('ludoLoseTitle', { n: winner ?? 1 })
        : t('ludoNoContestTitle');
  const body =
    status === 'won'
      ? t('ludoWinBody')
      : status === 'lost'
        ? t('ludoLoseBody')
        : t('ludoNoContestBody');
  const record = stats[session.difficulty];

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

        {/* Where the four seats got to, in pawns home. It is a standing rather
            than a difference: you are not playing one opponent, you are placed
            among three. */}
        <ul className="ld-standing">
          {SEATS.map((seat) => (
            <li key={seat} className={seat === YOU ? 'ld-standing-you' : ''}>
              <span className={`ld-chip ld-seat-${seat}`} aria-hidden="true" />
              <span className="ld-standing-name">{seatLabel(t, seat)}</span>
              <span className="ld-standing-home">
                {t('ludoSeatHome', {
                  home: session.state.pawns[seat].filter((progress) => progress === HOME_PROGRESS)
                    .length,
                })}
              </span>
            </li>
          ))}
        </ul>

        {/* The standing against these opponents, stated once — never a streak. */}
        <p className="dialog-body">
          {t('ludoRecordNote', { wins: record.wins, losses: record.losses })}
        </p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRematch} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        {/* No per-run figure is worth sending here — pawns home is a standing
            among three, not a summary, and the record note is history. */}
        <ShareAction
          gameId="ludo"
          outcome={status === 'won' ? 'completed' : 'played'}
          details={[]}
        />
      </div>
      {/* Shared with Hearts, Mahjong and Bubble Pop: the every-third-result
          cadence is one counter across the whole session, so a game that
          leaves this out would knock every other game's turn out of step
          (docs/ADS_POLICY.md). */}
      <ResultAdSlot />
    </div>
  );
}
