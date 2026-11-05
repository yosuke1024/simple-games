import { rankOf, suitOf, type Card } from '../../game';
import { PlayingCardFace, PlayingCardBack, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';
export const SUITS = ['♠', '♥', '♦', '♣'];
export const rankText = (card: Card) =>
  card === 52
    ? '★'
    : ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rankOf(card)]!;
export const cardClass = (card: Card) =>
  `df-card ${card === 52 ? 'df-joker' : suitOf(card) === 1 || suitOf(card) === 2 ? 'df-red' : 'df-black'}`;
export function CardFace({ card }: { card: Card }) {
  return (
    <PlayingCardFace
      rank={rankOf(card)}
      suit={PLAYING_CARD_SUITS[suitOf(card)]}
      joker={card === 52}
    />
  );
}
export function CardBack() {
  return <PlayingCardBack />;
}
