/**
 * One printed card face, and the class list that colours it. Both the trick in
 * the middle of the table and the fan along the bottom draw cards, so the face
 * lives in its own file rather than inside whichever of them happened to need
 * it first.
 *
 * The face is a corner index plus one large suit in the middle. The corner is
 * the only part an overlapped card shows — in this game's fan that is its
 * top-left, covered on the right by the next card and below by the next row —
 * so the corner carries the identity and the middle is what a card that is
 * fully visible gets.
 */
import { isRed, suitOf, type Card } from '../../game';
import { rankText } from './cardText';
import { SuitIcon } from './suits';

export function CardFace({ card }: { card: Card }) {
  const suit = suitOf(card);
  return (
    <>
      <span className="ht-card-index" aria-hidden="true">
        <span className="ht-card-rank">{rankText(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="ht-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

/**
 * The classes every drawn card shares: the card itself, and its ink. Red for
 * hearts and diamonds is game content rather than chrome — it is red in any
 * deck — which is the documented exception in docs/ARCHITECTURE.md.
 */
export const faceClass = (card: Card, ...extra: (string | false | null)[]): string =>
  ['ht-card', isRed(card) ? 'ht-card-red' : 'ht-card-black', ...extra].filter(Boolean).join(' ');
