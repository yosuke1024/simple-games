/**
 * The table above the hand: the three CPU seats round the outside, and the
 * middle — which is the trick during play, and the pass's direction while the
 * four seats are still choosing.
 *
 * SEATS ARE DIRECTIONS. You are at the bottom, CPU 1 on your left, CPU 2
 * across, CPU 3 on your right (game/types.ts numbers them in that order), and
 * a card played by a seat lands on the side of the table that seat sits on.
 * That is the whole reason the trick is drawn as a cross rather than a row:
 * "who played the queen" has to be readable without a caption.
 *
 * WHAT A SEAT SHOWS. How many cards it is still holding, and what it has taken
 * this hand — the two facts about another seat that are public at a real
 * table. Its match total rides along, because in Hearts the standing is what
 * decides whether a seat is chasing points or dodging them. The cards
 * themselves are never shown, and the seat draws one card back rather than
 * one per card held: three seats and a column 18% of the table wide have no
 * room for thirteen backs apiece, and the count is the whole of what is known
 * anyway (Gin Rummy's single opponent, in a full-width row, can afford the
 * literal picture; this one cannot).
 *
 * The trick that has just been taken folds towards whoever took it. It is
 * drawn from the event rather than from the hand, because by the time the
 * screen hears about it the four cards are already gone from the table — the
 * fold is a picture of the beat that just happened, and it is over before the
 * next beat lands (state/GameContext.tsx: `CPU_DELAY_MS`).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import {
  passDirectionOf,
  penaltiesTakenIn,
  seatAt,
  type BySeat,
  type Card,
  type HandState,
  type PassDirection,
  type Seat,
  type TrickOutcome,
} from '../../game';
import { CardFace, faceClass } from './CardFace';
import { cardLabel, PASS_ARROWS, PASS_WORD_KEYS, seatLabel } from './cardText';

/**
 * Which way round the table each seat lies, from the player's chair. The
 * player is south; the array is indexed by seat, so seat 1 (to your left) is
 * west and the same word places its card in the trick and its fold-away.
 */
const COMPASS = ['south', 'west', 'north', 'east'] as const;

/** The three seats the CPU takes, in the order they sit round the table. */
const CPU_SEATS: readonly Seat[] = [1, 2, 3];

export interface HeartsTableProps {
  hand: HandState;
  /** Match points, indexed by seat — the standing, not this hand's take. */
  scores: BySeat<number>;
  /** The trick being folded away right now, or null between beats. */
  folding: TrickOutcome | null;
  /** Who took the last completed trick, for the small mark on their seat. */
  lastTrickWinner: Seat | null;
}

export const HeartsTable = memo(function HeartsTable({
  hand,
  scores,
  folding,
  lastTrickWinner,
}: HeartsTableProps) {
  const { t } = useSettings();
  const taken = penaltiesTakenIn(hand);
  const passing = hand.phase === 'passing';
  const direction: PassDirection = passDirectionOf(hand.passOffset);

  // The cards on the table, by the seat that played them. The fold shows the
  // trick that has just left; both are drawn in the same four places.
  const onTable: (Card | null)[] = [null, null, null, null];
  if (folding !== null && hand.played.length === 0) {
    folding.cards.forEach((card, index) => {
      onTable[seatAt(folding.leader, index)] = card;
    });
  } else {
    hand.played.forEach((card, index) => {
      onTable[seatAt(hand.leader, index)] = card;
    });
  }
  const foldingTo = folding !== null && hand.played.length === 0 ? COMPASS[folding.winner] : null;

  return (
    <div className="ht-table" role="group" aria-label={t('heartsTableLabel')}>
      {CPU_SEATS.map((seat) => (
        <div
          key={seat}
          className={`ht-seat ht-seat-${COMPASS[seat]} ${
            lastTrickWinner === seat ? 'ht-seat-took' : ''
          }`}
          role="group"
          aria-label={t('heartsSeatLabel', {
            n: seat,
            cards: hand.hands[seat].length,
            hand: taken[seat],
            total: scores[seat],
          })}
        >
          {/* The chip is compact to the eye and spelled out to a reader: the
              group's label above is the whole of it, so the drawn version is
              hidden rather than read out a second time in pieces. */}
          <span className="ht-seat-name" aria-hidden="true">
            {seatLabel(t, seat)}
          </span>
          <span className="ht-seat-holding" aria-hidden="true">
            <span className="ht-seat-back" />
            <span className="ht-seat-count">{hand.hands[seat].length}</span>
          </span>
          <span className="ht-seat-scores" aria-hidden="true">
            <span className="ht-seat-total">{scores[seat]}</span>
            <span className="ht-seat-taken">+{taken[seat]}</span>
          </span>
          {/* The small mark the board shelf puts on the last piece moved: here
              it says which seat is on lead, which is the one fact a player
              loses track of between beats. Labelled rather than hidden — it is
              the one thing the chip says that its own numbers do not. */}
          {lastTrickWinner === seat ? (
            <span className="ht-seat-mark" role="img" aria-label={t('heartsTookLastTrick')} />
          ) : null}
        </div>
      ))}

      {passing ? (
        <div className="ht-pass-panel">
          <span className="ht-pass-arrow" aria-hidden="true">
            {PASS_ARROWS[direction]}
          </span>
          <span className="ht-pass-word">{t(PASS_WORD_KEYS[direction])}</span>
        </div>
      ) : (
        <div
          className={`ht-trick ${foldingTo === null ? '' : `ht-folding ht-fold-${foldingTo}`}`}
          role="group"
          aria-label={t('heartsTrickLabel')}
        >
          {onTable.map((card, index) =>
            card === null ? null : (
              <div
                key={index}
                data-card={card}
                className={faceClass(card, 'ht-trick-card', `ht-at-${COMPASS[index]}`)}
                role="img"
                aria-label={t('heartsTrickCard', {
                  card: cardLabel(t, card),
                  seat: seatLabel(t, index),
                })}
              >
                <CardFace card={card} />
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
});
