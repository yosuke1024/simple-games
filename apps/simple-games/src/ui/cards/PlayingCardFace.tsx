import './playing-cards.css';

/** Presentation-only values. Each game maps its own deck representation here. */
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
type Pip = readonly [number, number, boolean?];
const pips: Readonly<Record<number, readonly Pip[]>> = {
  1: [[50, 70]],
  2: [
    [50, 37],
    [50, 103, true],
  ],
  3: [
    [50, 37],
    [50, 70],
    [50, 103, true],
  ],
  4: [
    [33, 37],
    [67, 37],
    [33, 103, true],
    [67, 103, true],
  ],
  5: [
    [33, 37],
    [67, 37],
    [50, 70],
    [33, 103, true],
    [67, 103, true],
  ],
  6: [
    [33, 37],
    [67, 37],
    [33, 70],
    [67, 70],
    [33, 103, true],
    [67, 103, true],
  ],
  7: [
    [33, 37],
    [67, 37],
    [50, 53],
    [33, 70],
    [67, 70],
    [33, 103, true],
    [67, 103, true],
  ],
  8: [
    [33, 37],
    [67, 37],
    [50, 53],
    [33, 70],
    [67, 70],
    [50, 87, true],
    [33, 103, true],
    [67, 103, true],
  ],
  9: [
    [33, 35],
    [67, 35],
    [33, 58],
    [67, 58],
    [50, 70],
    [33, 82, true],
    [67, 82, true],
    [33, 105, true],
    [67, 105, true],
  ],
  10: [
    [33, 35],
    [67, 35],
    [50, 47],
    [33, 58],
    [67, 58],
    [33, 82, true],
    [67, 82, true],
    [50, 93, true],
    [33, 105, true],
    [67, 105, true],
  ],
};

function Suit({
  suit,
  x,
  y,
  scale = 1,
  inverted = false,
}: {
  suit: PlayingCardSuit;
  x: number;
  y: number;
  scale?: number;
  inverted?: boolean;
}) {
  return (
    <path
      d={paths[suit]}
      transform={`translate(${x} ${y}) scale(${scale})${inverted ? ' rotate(180)' : ''}`}
      fill="currentColor"
    />
  );
}

function Court({ rank, suit }: { rank: number; suit: PlayingCardSuit }) {
  return (
    <g>
      <rect className="sg-card-portrait-paper" x="25" y="24" width="50" height="92" rx="2" />
      {[false, true].map((flip) => (
        <g key={String(flip)} transform={flip ? 'rotate(180 50 70)' : undefined}>
          <path d="M27 70V56L40 48H58L73 59V70Z" fill="currentColor" />
          <path className="sg-card-brass" d="m28 65 20-11 22 13v3H28Z" />
          <path className="sg-card-portrait-paper" d="M42 33h17v8l-5 4v8l-9-3V42h-3Z" />
          <path d="M43 33v10l-5-4v-8l7-4h14v8h-6v-4h-7v4Z" fill="currentColor" />
          <path
            d="M54 37h2m-6 6 5 1"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
          {rank === 13 ? (
            <path className="sg-card-brass" d="m39 30-2-8 8 4 5-7 5 7 8-4-2 8Z" />
          ) : rank === 12 ? (
            <>
              <path className="sg-card-brass" d="m39 30 3-7 7 4 6-5 6 8Z" />
              <circle className="sg-card-brass" cx="59" cy="43" r="2" />
              <path
                d="M65 42v20m-4-17 4-4 4 4-4 4Z"
                stroke="currentColor"
                fill="none"
                strokeWidth="1.5"
              />
            </>
          ) : (
            <>
              <path className="sg-card-brass" d="M38 30q8-13 23-4l-2 5Z" />
              <path
                d="m63 31 4-13 3 5-7 8m2 17v18m-3-15h6"
                stroke="currentColor"
                fill="none"
                strokeWidth="1.5"
              />
            </>
          )}
          <path className="sg-card-portrait-line" d="m30 59 8 6 6-5 7 6 7-5 12 7" />
          <Suit suit={suit} x={34} y={46} scale={0.36} />
        </g>
      ))}
      <path className="sg-card-portrait-line" d="M26 70h48" />
    </g>
  );
}

function Joker() {
  return (
    <g>
      {[false, true].map((flip) => (
        <g key={String(flip)} transform={flip ? 'rotate(180 50 70)' : undefined}>
          <path d="m30 51-5-20 14 9 11-20 11 20 14-9-5 20Z" fill="currentColor" />
          <circle className="sg-card-brass" cx="25" cy="29" r="3" />
          <circle className="sg-card-brass" cx="50" cy="19" r="3" />
          <circle className="sg-card-brass" cx="75" cy="29" r="3" />
          <path className="sg-card-portrait-paper" d="M36 51h28v8q-14 18-28 0Z" />
          <path
            d="m40 56 4-2m12 0 4 2m-15 7q5 3 10-1"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      ))}
      <path className="sg-card-brass" d="m50 62 8 8-8 8-8-8Z" />
    </g>
  );
}

/** Decorative face; the enclosing button/image owns its translated accessible name. */
export function PlayingCardFace({
  rank,
  suit = 'spades',
  joker = false,
}: {
  rank?: number;
  suit?: PlayingCardSuit;
  joker?: boolean;
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
  return (
    <svg
      className="sg-playing-card-face"
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {[false, true].map((flip) => (
        <g key={String(flip)} transform={flip ? 'rotate(180 50 70)' : undefined}>
          <text className="sg-card-index" x="14" y="24" textAnchor="middle">
            {index}
          </text>
          {!joker && <Suit suit={suit} x={14} y={38} scale={0.5} />}
        </g>
      ))}
      {joker ? (
        <Joker />
      ) : rank && rank > 10 ? (
        <Court rank={rank} suit={suit} />
      ) : (
        (pips[rank ?? 0] ?? []).map(([x, y, inverted], i) => (
          <Suit
            key={i}
            suit={suit}
            x={x}
            y={y}
            inverted={inverted}
            scale={rank === 1 ? 2.05 : 0.78}
          />
        ))
      )}
    </svg>
  );
}

/** Intentionally accepts no card identity: every hidden card has exactly this back. */
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
      <g className="sg-card-back-engraving">
        <rect x="10" y="10" width="80" height="120" rx="2" />
        <path d="M50 18 84 70 50 122 16 70Z M50 30 76 70 50 110 24 70Z M50 45 66 70 50 95 34 70Z" />
        {Array.from({ length: 7 }, (_, i) => (
          <path
            key={i}
            d={`M${18 + i * 10} 12 12 ${24 + i * 14} M${82 - i * 10} 128 88 ${116 - i * 14}`}
          />
        ))}
        <circle cx="50" cy="70" r="8" />
        <path d="m50 63 5 7-5 7-5-7Z" />
      </g>
    </svg>
  );
}
