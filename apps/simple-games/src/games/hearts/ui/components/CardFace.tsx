/** Shared original artwork with the Hearts 2-through-ace encoding. */
import { isRed, suitOf, type Card } from '../../game';
import { PlayingCardFace, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';

export function CardFace({ card }: { card: Card }) {
  const value = (card % 13) + 2;
  return (
    <PlayingCardFace rank={value === 14 ? 1 : value} suit={PLAYING_CARD_SUITS[suitOf(card)]} />
  );
}

/**
 * The classes every drawn card shares: the card itself, and its ink. Red for
 * hearts and diamonds is game content rather than chrome — it is red in any
 * deck — which is the documented exception in docs/ARCHITECTURE.md.
 */
export const faceClass = (card: Card, ...extra: (string | false | null)[]): string =>
  ['ht-card', isRed(card) ? 'ht-card-red' : 'ht-card-black', ...extra].filter(Boolean).join(' ');
