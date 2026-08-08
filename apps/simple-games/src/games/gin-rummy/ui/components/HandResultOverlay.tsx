/**
 * A hand, settled and laid out (the plan: ハンド清算 overlay).
 *
 * This is the one screen in the game where both hands are face up, and it is
 * the reason the arithmetic is worth showing rather than only its answer: the
 * knock, the lay-offs and the undercut are the three things a new player gets
 * wrong, and each is a row here instead of a number that appeared from
 * nowhere. The lay-offs in particular are shown as cards, because "the CPU put
 * your 4♠ onto its own run" is invisible in a points total.
 *
 * It waits for a tap rather than a timer. Nothing takes the result off the
 * screen on its own (state/GameContext.tsx says the same from the other side).
 */
import { useSettings } from '@/state/SettingsContext';
import { CPU, YOU, type HandOutcome, type Meld, type Seat } from '../../game';
import { cardListLabel } from './cardText';

export interface HandResultOverlayProps {
  outcome: HandOutcome;
  /** Match points after this hand, indexed by seat — already moved. */
  scores: readonly [number, number];
  onNext: () => void;
}

const TITLE_KEYS = {
  gin: 'ginHandGinTitle',
  knock: 'ginHandKnockTitle',
  undercut: 'ginHandUndercutTitle',
  dead: 'ginHandDeadTitle',
} as const;

export function HandResultOverlay({ outcome, scores, onNext }: HandResultOverlayProps) {
  const { t } = useSettings();

  const title = t(TITLE_KEYS[outcome.kind]);
  const dead = outcome.kind === 'dead';

  /** The two splits, told from the player's side rather than the knocker's. */
  const meldsOf = (seat: Seat): readonly Meld[] =>
    outcome.knocker === seat ? outcome.knockerMelds : outcome.defenderMelds;
  const deadwoodOfSeat = (seat: Seat): number =>
    outcome.knocker === seat ? outcome.knockerDeadwood : outcome.defenderDeadwood;

  const meldLine = (seat: Seat): string =>
    meldsOf(seat)
      .map((meld) => cardListLabel(t, meld.cards))
      .join(' · ');

  /** The defender's deadwood that went onto the knocker's melds, as cards. */
  const laidOff = outcome.layoffs.map((layoff) => layoff.card);

  return (
    <div className="overlay">
      <div className="dialog result" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">
          {dead
            ? t('ginHandDeadBody')
            : outcome.winner === YOU
              ? t('ginHandYouTook', { points: outcome.points })
              : t('ginHandCpuTook', { points: outcome.points })}
        </p>

        {dead ? null : (
          <dl className="gr-settlement">
            <div className="gr-settlement-row">
              <dt>{t('ginYourMelds')}</dt>
              <dd>
                <span className="gr-settlement-melds">{meldLine(YOU)}</span>
                <span className="gr-settlement-deadwood">
                  {t('ginDeadwood')} {deadwoodOfSeat(YOU)}
                </span>
              </dd>
            </div>
            <div className="gr-settlement-row">
              <dt>{t('ginCpuMelds')}</dt>
              <dd>
                <span className="gr-settlement-melds">{meldLine(CPU)}</span>
                <span className="gr-settlement-deadwood">
                  {t('ginDeadwood')} {deadwoodOfSeat(CPU)}
                </span>
              </dd>
            </div>
            {laidOff.length > 0 ? (
              <div className="gr-settlement-row">
                <dt>{t('ginLaidOff')}</dt>
                <dd>
                  <span className="gr-settlement-melds">{cardListLabel(t, laidOff)}</span>
                </dd>
              </div>
            ) : null}
          </dl>
        )}

        <dl className="result-facts">
          <div>
            <dt>{t('ginYou')}</dt>
            <dd>{scores[YOU]}</dd>
          </div>
          <div>
            <dt>{t('ginCpu')}</dt>
            <dd>{scores[CPU]}</dd>
          </div>
        </dl>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNext} autoFocus>
            {t('ginNextHand')}
          </button>
        </div>
      </div>
    </div>
  );
}
