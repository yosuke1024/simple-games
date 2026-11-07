import { PlayingCardFace, PlayingCardBack, PLAYING_CARD_SUITS } from '@/ui/cards/PlayingCardFace';
import { suit } from '../../game';
export function CardFace({ card }: { card: number }) {
  return <PlayingCardFace rank={(card % 13) + 1} suit={PLAYING_CARD_SUITS[suit(card)]} compact />;
}
export const CardBack = PlayingCardBack;

export function ExampleCard({ card }: { card?: number }) {
  return (
    <span
      className={`tp-example-card ${card === undefined ? 'tp-covered' : suit(card) === 1 || suit(card) === 2 ? 'tp-red' : ''}`}
    >
      {card === undefined ? <CardBack /> : <CardFace card={card} />}
    </span>
  );
}
