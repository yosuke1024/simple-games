/**
 * The printed parts of a card, shared by the table, the hand, the line, the
 * primiera tally and the Quick Rules figures — so a figure cannot drift from
 * what the table actually draws (docs/SCOPA_RULES.md §10). Nothing printed on
 * a card depends on the language: the face is ASCII and the suit is a shape.
 */
import { faceOf, suitOf, type Card } from '../../game';
import { isRed } from './cardText';
import { SuitIcon } from './suits';

/** The colour class a card prints in — an aid; the suit's shape is the identity. */
export const inkOf = (card: Card): string => (isRed(card) ? 'sc-red' : 'sc-black');

/** A full card face: the index in the corner and one large suit in the middle. */
export function CardFace({ card }: { card: Card }) {
  const suit = suitOf(card);
  return (
    <>
      <span className="sc-card-index" aria-hidden="true">
        <span className="sc-card-face">{faceOf(card)}</span>
        <SuitIcon suit={suit} />
      </span>
      <span className="sc-card-middle" aria-hidden="true">
        <SuitIcon suit={suit} />
      </span>
    </>
  );
}

/** A card named inline — in the line, the tally and the figures. Decorative. */
export function MiniCard({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <span className={`sc-mini ${inkOf(card)} ${className}`.trim()} aria-hidden="true">
      {faceOf(card)}
      <SuitIcon suit={suitOf(card)} />
    </span>
  );
}

/**
 * The scopa mark: a shape, not a word, so it needs no translation and does not
 * rely on colour (§11.2). The sentence on the line says what it means.
 */
export function ScopaMark() {
  return (
    <span className="sc-scopa-mark" aria-hidden="true">
      ✶
    </span>
  );
}
