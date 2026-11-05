import { PlayingCardFace, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';
/**
 * The printed parts of a card, shared by the table, the hand, the line, the
 * primiera tally and the Quick Rules figures — so a figure cannot drift from
 * what the table actually draws (docs/SCOPA_RULES.md §10). Nothing printed on
 * a card depends on the language: the face is ASCII and the suit is a shape.
 */
import { faceOf, suitOf, type Card } from '../../game/cards';
import { isRed } from './cardText';
import { SuitIcon } from './suits';

/** The colour class a card prints in — an aid; the suit's shape is the identity. */
export const inkOf = (card: Card): string => (isRed(card) ? 'sc-red' : 'sc-black');

/** Scopa's 8/9/10 values are printed as jack/queen/king. */
export function CardFace({ card }: { card: Card }) {
  const value = (card % 10) + 1;
  return (
    <PlayingCardFace rank={value > 7 ? value + 3 : value} suit={PLAYING_CARD_SUITS[suitOf(card)]} />
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
