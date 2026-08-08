/**
 * A hand, scored and laid out (docs/HEARTS_RULES.md §3.2, §11.2).
 *
 * Four seats, so the settlement is a small table rather than a sentence: what
 * each seat took this hand, and what that made its match total. Both columns
 * are needed — the hand is what just happened, the total is what it means, and
 * in Hearts the second is the one that decides the match.
 *
 * A moon gets a line of its own. It is the one place the arithmetic is not
 * "what you took": the seat that took all twenty-six scores nothing and the
 * other three take twenty-six each (game/engine.ts), and a player who watched
 * their own score stay still while everybody else's jumped deserves to be told
 * why rather than left to work it out.
 *
 * It waits for a tap rather than a timer. Nothing takes the result off the
 * screen on its own (state/GameContext.tsx says the same from the other side).
 */
import { useSettings } from '@/state/SettingsContext';
import { SEATS, YOU, type BySeat, type HandOutcome } from '../../game';
import { seatLabel } from './cardText';

export interface HandResultOverlayProps {
  outcome: HandOutcome;
  /** Match points after this hand, indexed by seat — already moved. */
  scores: BySeat<number>;
  onNext: () => void;
}

export function HandResultOverlay({ outcome, scores, onNext }: HandResultOverlayProps) {
  const { t } = useSettings();

  const moon = outcome.moonShooter;
  const title = moon === null ? t('heartsHandTitle') : t('heartsMoonTitle');

  return (
    <div className="overlay">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>

        {moon === null ? null : (
          <p className="dialog-body">
            {moon === YOU ? t('heartsMoonYou') : t('heartsMoonCpu', { n: moon })}
          </p>
        )}

        <table className="ht-scoreboard">
          <thead>
            <tr>
              <th scope="col" className="ht-scoreboard-seat" />
              <th scope="col">{t('heartsThisHand')}</th>
              <th scope="col">{t('heartsMatchTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {SEATS.map((seat) => (
              <tr key={seat} className={seat === YOU ? 'ht-scoreboard-you' : ''}>
                <th scope="row" className="ht-scoreboard-seat">
                  {seatLabel(t, seat)}
                </th>
                <td>{outcome.delta[seat]}</td>
                <td className="ht-scoreboard-total">{scores[seat]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
            {t('heartsNextHand')}
          </button>
        </div>
      </div>
    </div>
  );
}
