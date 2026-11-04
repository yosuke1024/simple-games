import { rankOf, suitOf, type Card } from '../../game';
export const SUITS = ['♠', '♥', '♦', '♣'];
export const rankText = (card: Card) =>
  card === 52
    ? '★'
    : ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rankOf(card)]!;
export const cardClass = (card: Card) =>
  `sv-card ${card === 52 ? 'sv-joker' : suitOf(card) === 1 || suitOf(card) === 2 ? 'sv-red' : 'sv-black'}`;
export function CardFace({ card }: { card: Card }) {
  const joker = card === 52;
  const rank = rankOf(card);
  return (
    <>
      <span className="sv-card-corner" aria-hidden="true">
        <b>{rankText(card)}</b>
        <span>{joker ? '' : SUITS[suitOf(card)]}</span>
      </span>
      {joker ? (
        <svg className="sv-card-symbol" viewBox="0 0 40 48" aria-hidden="true">
          <path d="M8 22 5 7l11 8 4-12 5 12 10-8-3 15Z" fill="currentColor" />
          <circle cx="20" cy="31" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="16" cy="29" r="1.5" />
          <circle cx="24" cy="29" r="1.5" />
          <path d="M15 34q5 5 10 0" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="5" cy="7" r="2.5" />
          <circle cx="20" cy="3" r="2.5" />
          <circle cx="35" cy="7" r="2.5" />
        </svg>
      ) : rank > 10 ? (
        <svg className="sv-card-court" viewBox="0 0 60 80" aria-hidden="true">
          <path d="M10 26 6 10l16 9 8-15 8 15 16-9-4 16Z" fill="currentColor" />
          <path d="M12 32h36v35H12Z M17 72h26" fill="none" stroke="currentColor" strokeWidth="2" />
          <text
            x="30"
            y="59"
            textAnchor="middle"
            fill="currentColor"
            fontSize="25"
            fontWeight="700"
          >
            {rankText(card)}
          </text>
        </svg>
      ) : (
        <span className={`sv-card-pips sv-pips-${rank}`} aria-hidden="true">
          {Array.from({ length: rank }, (_, i) => (
            <span key={i}>{SUITS[suitOf(card)]}</span>
          ))}
        </span>
      )}
      <span className="sv-card-corner sv-card-bottom" aria-hidden="true">
        <b>{rankText(card)}</b>
        <span>{joker ? '' : SUITS[suitOf(card)]}</span>
      </span>
    </>
  );
}
export function CardBack() {
  return (
    <span className="sv-card-back" aria-hidden="true">
      <svg viewBox="0 0 40 56">
        <path d="M20 7 34 28 20 49 6 28Z M20 16 28 28 20 40 12 28Z" />
        <circle cx="20" cy="28" r="3" />
      </svg>
    </span>
  );
}
