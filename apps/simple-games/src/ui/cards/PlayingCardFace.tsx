import './playing-cards.css';

/** Presentation only: each game maps its own rank/suit encoding here. */
export type PlayingCardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export const PLAYING_CARD_SUITS: readonly PlayingCardSuit[] = [
  'spades',
  'hearts',
  'diamonds',
  'clubs',
];
const paths: Record<PlayingCardSuit, string> = {
  spades: 'M0-10C-3-6-9-3-9 2C-9 7-3 8-1 4L-3 10H3L1 4C3 8 9 7 9 2C9-3 3-6 0-10Z',
  hearts: 'M0 9C-3 6-10 1-10-4C-10-10-3-12 0-6C3-12 10-10 10-4C10 1 3 6 0 9Z',
  diamonds: 'M0-11 8 0 0 11-8 0Z',
  clubs:
    'M0-10C-6-10-6-3-3-1C-10-4-12 5-7 7C-4 9-1 6-1 4L-3 10H3L1 4C1 6 4 9 7 7C12 5 10-4 3-1C6-3 6-10 0-10Z',
};
function Suit({
  suit,
  x,
  y,
  scale = 1,
}: {
  suit: PlayingCardSuit;
  x: number;
  y: number;
  scale?: number;
}) {
  return (
    <path d={paths[suit]} transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor" />
  );
}
/** Decorative face; the enclosing control owns its translated accessible name. */
export function PlayingCardFace({
  rank,
  suit = 'spades',
  joker = false,
  compact = false,
}: {
  rank?: number;
  suit?: PlayingCardSuit;
  joker?: boolean;
  compact?: boolean;
}) {
  const index = joker
    ? '★'
    : rank === 1
      ? 'A'
      : rank === 11
        ? 'J'
        : rank === 12
          ? 'Q'
          : rank === 13
            ? 'K'
            : String(rank ?? '');
  const court = !joker && rank !== undefined && rank > 10;
  return (
    <svg
      className={`sg-playing-card-face${compact ? ' sg-playing-card-compact' : ''}`}
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {[false, true].map((flip) => (
        <g key={String(flip)} transform={flip ? 'rotate(180 50 70)' : undefined}>
          <text
            className="sg-card-index"
            x={compact ? 28 : 14}
            y={compact ? 28 : 24}
            textAnchor="middle"
          >
            {index}
          </text>
          {!joker && (
            <Suit
              suit={suit}
              x={compact ? 72 : 14}
              y={compact ? 22 : 38}
              scale={compact ? 0.65 : 0.5}
            />
          )}
        </g>
      ))}
      {joker ? (
        <>
          <text className="sg-card-symbol" x="50" y="79" textAnchor="middle">
            ★
          </text>
          <text className="sg-card-joker-label" x="50" y="96" textAnchor="middle">
            JOKER
          </text>
        </>
      ) : court ? (
        <>
          <text className="sg-card-court-rank" x="50" y="77" textAnchor="middle">
            {index}
          </text>
          <Suit suit={suit} x={50} y={96} scale={0.72} />
        </>
      ) : (
        <Suit suit={suit} x={50} y={70} scale={compact ? 1.7 : 2.05} />
      )}
    </svg>
  );
}
/** No card identity is accepted, so every hidden card has the same back. */
export function PlayingCardBack() {
  return (
    <svg
      className="sg-playing-card-back"
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="sg-card-back-paper" x="1" y="1" width="98" height="138" rx="7" />
      <rect className="sg-card-back-field" x="6" y="6" width="88" height="128" rx="3" />
      <rect className="sg-card-back-frame" x="11" y="11" width="78" height="118" rx="2" />
    </svg>
  );
}
