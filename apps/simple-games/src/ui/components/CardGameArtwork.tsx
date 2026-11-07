/**
 * Static shelf illustrations: each card game has its own silhouette, not a
 * shared fan with different ranks. Keep these independent of playable cards,
 * game rules and saved state; shortcuts also render this SVG without page CSS.
 */
import type { ReactNode } from 'react';

type CardGameId =
  | 'solitaire'
  | 'spider-solitaire'
  | 'freecell'
  | 'hearts'
  | 'gin-rummy'
  | 'scopa'
  | 'three-peaks'
  | 'daifugo'
  | 'sevens'
  | 'old-maid'
  | 'crazy-eights'
  | 'durak'
  | 'spades'
  | 'texas-holdem'
  | 'blackjack'
  | 'indian-rummy';

type Suit = 'heart' | 'spade' | 'diamond' | 'club';
const PAPER = 'var(--surface)';

function Mark({ suit, x, y, size = 14 }: { suit: Suit; x: number; y: number; size?: number }) {
  const paths: Record<Suit, string> = {
    heart: 'M0 9C-4 6-10 1-10-4C-10-10-3-12 0-6C3-12 10-10 10-4C10 1 4 6 0 9Z',
    spade: 'M0-10C-3-6-10-2-10 3C-10 8-4 10 0 5C4 10 10 8 10 3C10-2 3-6 0-10ZM0 2-4 11H4Z',
    diamond: 'M0-11 9 0 0 11-9 0Z',
    club: 'M-3-1A5 5 0 1 1 3-1A5 5 0 1 1 1 6L4 11H-4L-1 6A5 5 0 1 1-3-1Z',
  };
  return (
    <path
      d={paths[suit]}
      transform={`translate(${x} ${y}) scale(${size / 20})`}
      fill="currentColor"
    />
  );
}

function Label({
  x,
  y,
  size,
  children,
}: {
  x: number;
  y: number;
  size: number;
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      fontWeight="800"
      textAnchor="middle"
      dominantBaseline="central"
      fill="currentColor"
    >
      {children}
    </text>
  );
}

function Card({
  x,
  y,
  width = 26,
  height = width * 1.45,
  angle = 0,
  rank,
  suit = 'spade',
  children,
}: {
  x: number;
  y: number;
  width?: number;
  height?: number;
  angle?: number;
  rank?: string;
  suit?: Suit;
  children?: ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle} ${width / 2} ${height / 2})`}>
      <rect x=".6" y="2" width={width} height={height} rx="3.5" fill="currentColor" opacity=".12" />
      <rect
        width={width}
        height={height}
        rx="3.5"
        fill={PAPER}
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {rank && (
        <Label x={width * 0.24} y={height * 0.23} size={width * 0.32}>
          {rank}
        </Label>
      )}
      {children ?? <Mark suit={suit} x={width / 2} y={height * 0.64} size={width * 0.49} />}
    </g>
  );
}

function Joker() {
  return (
    <g fill="currentColor">
      <path d="M6 27C4 16 10 14 15 23C13 7 22 8 22 15C18 12 18 20 20 24C25 14 32 18 29 28C25 22 23 26 21 32H13C11 26 9 23 6 27Z" />
      <circle cx="5" cy="28" r="2.5" />
      <circle cx="22" cy="14" r="2" />
      <circle cx="30" cy="28" r="2.5" />
      <path d="M13 35Q17 38 21 35V38Q17 41 13 38Z" />
    </g>
  );
}

export function CardGameArtwork({ id }: { id: CardGameId }) {
  switch (id) {
    case 'daifugo':
      return (
        <>
          <g fill="currentColor">
            <path d="M31 20Q45 35 60 10Q75 35 89 20L83 37Q60 30 37 37Z" />
            <circle cx="30" cy="19" r="4" />
            <circle cx="60" cy="9" r="4.5" />
            <circle cx="90" cy="19" r="4" />
            <path d="M38 40Q60 34 82 40L81 45Q60 39 39 45Z" />
          </g>
          <Card x={46} y={46} width={27} height={34} angle={-9} rank="2" />
        </>
      );
    case 'sevens':
      return (
        <>
          <Card x={9} y={29} width={17} rank="5" suit="heart" />
          <Card x={30} y={26} width={17} rank="6" suit="heart" />
          <Card x={73} y={26} width={17} rank="8" suit="heart" />
          <Card x={94} y={29} width={17} rank="9" suit="heart" />
          <Card x={49} y={21} width={22} height={36} rank="7" suit="heart" />
          <path
            d="M50 72H25m4-3-4 3 4 3M70 72h25m-4-3 4 3-4 3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".5"
          />
        </>
      );
    case 'old-maid':
      return (
        <>
          <Card x={15} y={34} width={26} rank="8" suit="heart" angle={-12} />
          <Card x={32} y={38} width={26} rank="8" angle={8} />
          <Card x={72} y={17} width={35} height={57}>
            <Joker />
          </Card>
        </>
      );
    case 'blackjack':
      return (
        <>
          <Card x={12} y={33} width={23} rank="A" angle={-12} />
          <Card x={28} y={26} width={24} rank="K" angle={8} />
          <Label x={86} y={48} size={44}>
            21
          </Label>
        </>
      );
    case 'crazy-eights':
      return (
        <>
          <Label x={60} y={44} size={65}>
            8
          </Label>
          <Mark suit="spade" x={27} y={23} size={17} />
          <Mark suit="heart" x={93} y={23} size={17} />
          <Mark suit="club" x={27} y={64} size={17} />
          <Mark suit="diamond" x={93} y={64} size={17} />
        </>
      );
    case 'durak':
      return (
        <>
          <Card x={23} y={30} width={32} height={45} rank="6" angle={-13} />
          <Card x={42} y={15} width={32} height={45} rank="K" angle={13} />
          <g transform="rotate(90 91 59)">
            <Card x={81} y={44} width={20} height={30} rank="A" suit="diamond" />
          </g>
          <rect
            x="78"
            y="23"
            width="23"
            height="34"
            rx="3"
            fill={PAPER}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="82" y="27" width="15" height="26" rx="1.5" fill="currentColor" opacity=".25" />
        </>
      );
    case 'spades':
      return (
        <>
          <Mark suit="spade" x={44} y={42} size={52} />
          <Card x={78} y={41} width={23} rank="A" angle={12} />
          <Card x={74} y={36} width={23} rank="K" angle={5} />
          <Card x={70} y={31} width={23} rank="Q" angle={-2} />
        </>
      );
    case 'texas-holdem':
      return (
        <>
          {(['10', 'J', 'Q', 'K', 'A'] as const).map((rank, i) => (
            <Card
              key={rank}
              x={12 + i * 20}
              y={15}
              width={16}
              height={24}
              rank={rank}
              suit={i % 2 ? 'heart' : 'spade'}
            />
          ))}
          <path d="M32 46h56" stroke="currentColor" strokeWidth="1.5" opacity=".3" />
          <Card x={35} y={52} width={21} height={28} rank="A" suit="heart" angle={-7} />
          <Card x={64} y={52} width={21} height={28} rank="K" suit="club" angle={7} />
        </>
      );
    case 'indian-rummy':
      return (
        <>
          {[0, 1].map((group) => (
            <g key={group}>
              {['4', '5', '6'].map((rank, i) => (
                <Card
                  key={rank}
                  x={13 + group * 53 + i * 11}
                  y={23 + i * 8}
                  width={20}
                  height={31}
                  rank={rank}
                  suit={group === 0 ? 'heart' : 'club'}
                />
              ))}
              <path
                d={`M${12 + group * 53} 76v3h43v-3`}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity=".5"
              />
            </g>
          ))}
        </>
      );
    case 'three-peaks':
      return (
        <>
          {[15, 47, 79].map((x) => (
            <g key={x}>
              <Card x={x + 7} y={17} width={16} height={23}>
                <rect x="3" y="3" width="10" height="17" rx="1" fill="currentColor" opacity=".2" />
              </Card>
              <Card x={x} y={31} width={16} height={23}>
                <rect x="3" y="3" width="10" height="17" rx="1" fill="currentColor" opacity=".2" />
              </Card>
              <Card x={x + 14} y={31} width={16} height={23}>
                <rect x="3" y="3" width="10" height="17" rx="1" fill="currentColor" opacity=".2" />
              </Card>
            </g>
          ))}
          {['4', '5', '6', '7', '8', '9'].map((rank, i) => (
            <Card key={rank} x={8 + i * 17.5} y={48} width={16} height={24} rank={rank} />
          ))}
        </>
      );
    case 'solitaire':
      return (
        <>
          <Card x={23} y={17} width={27} rank="K" />
          <Card x={40} y={31} width={27} rank="Q" suit="heart" />
          <Card x={57} y={45} width={27} rank="J" suit="club" />
          <Card x={82} y={12} width={18} height={26} rank="A" suit="diamond" />
          <path
            d="M58 16h17m-4-4 4 4-4 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity=".5"
          />
        </>
      );
    case 'spider-solitaire':
      return (
        <>
          <path d="M36 10v19" stroke="currentColor" strokeWidth="1.5" opacity=".4" />
          <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m30 37-11-9-5 5m16 10-15-4-5 6m20 4-15 5v7m17-7-11 9 1 7m20-33 11-9 5 5M42 43l15-4 5 6m-20 4 15 5v7m-17-7 11 9-1 7" />
          </g>
          <ellipse cx="36" cy="47" rx="9" ry="12" fill="currentColor" />
          <circle cx="36" cy="33" r="6" fill="currentColor" />
          <Card x={73} y={14} width={28} rank="K" />
          <Card x={73} y={28} width={28} rank="Q" />
          <Card x={73} y={42} width={28} rank="J" />
        </>
      );
    case 'freecell':
      return (
        <>
          {[17, 40, 63, 86].map((x) => (
            <rect
              key={x}
              x={x}
              y="12"
              width="17"
              height="25"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.8"
            />
          ))}
          <Card x={43} y={46} width={27} height={35} rank="A" />
          <path
            d="M79 66h8q8 0 8-8V44m-4 4 4-4 4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'hearts':
      return (
        <>
          <Mark suit="heart" x={43} y={43} size={54} />
          <Card x={77} y={32} width={27} rank="Q" angle={10} />
        </>
      );
    case 'gin-rummy':
      return (
        <>
          {['7', '8', '9'].map((rank, i) => (
            <Card
              key={rank}
              x={23 + i * 26}
              y={12}
              width={22}
              height={29}
              rank={rank}
              suit="club"
            />
          ))}
          {(['heart', 'spade', 'diamond'] as const).map((suit, i) => (
            <Card key={suit} x={23 + i * 26} y={49} width={22} height={29} rank="5" suit={suit} />
          ))}
        </>
      );
    case 'scopa':
      return (
        <>
          <Card x={17} y={39} width={24} rank="3" suit="club" angle={-5} />
          <Card x={47} y={39} width={24} rank="4" suit="heart" angle={5} />
          <Card x={81} y={14} width={25} rank="7" suit="diamond" />
          <path
            d="M24 30Q46 4 72 21m-7-1 7 1-2-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
  const unhandled: never = id;
  return unhandled;
}
