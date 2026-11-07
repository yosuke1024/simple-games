import { rankOf, suitOf, type Card } from '../../game';
import { PlayingCardFace, PlayingCardBack, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const isJoker = (card: Card) => card >= 104;
export function rankText(card: Card): string {
  const rank = rankOf(card);
  return isJoker(card)
    ? '★'
    : rank === 1
      ? 'A'
      : rank === 11
        ? 'J'
        : rank === 12
          ? 'Q'
          : rank === 13
            ? 'K'
            : String(rank);
}
export function cardClass(card: Card): string {
  return `ir-card${isJoker(card) ? ' ir-card-joker' : suitOf(card) === 1 || suitOf(card) === 2 ? ' ir-card-red' : ''}`;
}
export function CardFace({ card }: { card: Card }) {
  return (
    <PlayingCardFace
      rank={rankOf(card)}
      suit={PLAYING_CARD_SUITS[suitOf(card)]}
      joker={isJoker(card)}
    />
  );
}
export function CardBack() {
  return <PlayingCardBack />;
}
