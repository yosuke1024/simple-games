import { rankOf, suitOf, type Card } from '../../game';
import { PlayingCardFace, PlayingCardBack, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';
export const SUITS = ['♠', '♥', '♦', '♣'] as const;
export const isJoker = (_card: Card) => false;
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
  return `ce-card${isJoker(card) ? ' ce-card-joker' : suitOf(card) === 1 || suitOf(card) === 2 ? ' ce-card-red' : ''}`;
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
