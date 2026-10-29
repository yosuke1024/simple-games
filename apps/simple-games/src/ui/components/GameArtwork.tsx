/**
 * Small, original still-life drawings for the collection shelf. These are
 * illustrations, not live previews: importing a tile must never load a game's
 * engine, saved position, or catalog. Shared paper and the title's currentColor
 * keep the whole shelf in the same visual family in both themes.
 */
import type { ReactNode } from 'react';
import type { GameId } from '../../app/registry';

const PAPER = 'var(--surface)';

function Number({
  x,
  y,
  children,
  size = 11,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontWeight="800"
      fill="currentColor"
      stroke="none"
    >
      {children}
    </text>
  );
}

function Board({ children, tilt = -5 }: { children: ReactNode; tilt?: number }) {
  return (
    <g transform={`rotate(${tilt} 60 45)`}>
      <rect x="29" y="17" width="64" height="64" rx="9" fill="currentColor" opacity=".13" />
      <rect x="28" y="12" width="64" height="64" rx="9" fill={PAPER} />
      <rect
        x="28"
        y="12"
        width="64"
        height="64"
        rx="9"
        fill="none"
        stroke="currentColor"
        strokeOpacity=".24"
      />
      {children}
    </g>
  );
}

function Grid({
  numbers,
  tones,
  count = 3,
}: {
  numbers?: readonly string[];
  tones?: readonly number[];
  count?: number;
}) {
  const step = 54 / count;
  return (
    <Board>
      {Array.from({ length: count * count }, (_, i) => {
        const x = 33 + (i % count) * step;
        const y = 17 + Math.floor(i / count) * step;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={step - 1}
              height={step - 1}
              rx="2"
              fill="currentColor"
              opacity={tones?.[i] ?? 0.07}
            />
            {numbers?.[i] && (
              <Number
                x={x + (step - 1) / 2}
                y={y + (step - 1) / 2}
                size={count > 4 ? 6.5 : count > 3 ? 9 : 12}
              >
                {numbers[i]}
              </Number>
            )}
          </g>
        );
      })}
    </Board>
  );
}

function Heart({ x = 60, y = 43, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M0 9C-4 6-10 1-10-4C-10-10-3-12 0-6C3-12 10-10 10-4C10 1 4 6 0 9Z"
      fill="currentColor"
    />
  );
}

function Suit({ kind }: { kind: 'heart' | 'spade' | 'diamond' | 'club' | 'coin' }) {
  if (kind === 'heart') return <Heart x={14} y={23} scale={0.7} />;
  if (kind === 'diamond') return <path d="M14 14 21 23 14 32 7 23Z" fill="currentColor" />;
  if (kind === 'coin')
    return (
      <g fill="none" stroke="currentColor">
        <circle cx="14" cy="23" r="7" strokeWidth="2" />
        <circle cx="14" cy="23" r="3" />
      </g>
    );
  if (kind === 'club')
    return (
      <g fill="currentColor">
        <circle cx="14" cy="18" r="4" />
        <circle cx="10" cy="24" r="4" />
        <circle cx="18" cy="24" r="4" />
        <path d="m14 22-4 10h8Z" />
      </g>
    );
  return (
    <path
      d="M14 13C12 17 6 20 6 25C6 30 12 31 14 27C16 31 22 30 22 25C22 20 16 17 14 13Zm0 11-4 9h8Z"
      fill="currentColor"
    />
  );
}

function Card({
  x,
  y,
  angle = 0,
  suit = 'spade',
  rank = 'A',
}: {
  x: number;
  y: number;
  angle?: number;
  suit?: 'heart' | 'spade' | 'diamond' | 'club' | 'coin';
  rank?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle} 14 21)`}>
      <rect x="1" y="3" width="28" height="42" rx="4" fill="currentColor" opacity=".13" />
      <rect width="28" height="42" rx="4" fill={PAPER} stroke="currentColor" strokeOpacity=".3" />
      <Number x={6} y={8} size={7}>
        {rank}
      </Number>
      <Suit kind={suit} />
      <path d="M21 36h3" stroke="currentColor" strokeOpacity=".5" strokeLinecap="round" />
    </g>
  );
}

function Cards({
  kind,
}: {
  kind:
    | 'solitaire'
    | 'spider-solitaire'
    | 'freecell'
    | 'hearts'
    | 'gin-rummy'
    | 'scopa'
    | 'three-peaks';
}) {
  if (kind === 'three-peaks')
    return (
      <>
        {[29, 47, 65].map((x) => (
          <g key={x} transform={`translate(${x} 13) scale(.6)`}>
            <Card x={0} y={0} rank="K" />
          </g>
        ))}
        <Card x={27} y={34} angle={-9} rank="5" />
        <Card x={47} y={30} rank="6" />
        <Card x={67} y={34} angle={9} rank="7" />
      </>
    );
  if (kind === 'freecell')
    return (
      <>
        {[27, 45, 63, 81].map((x) => (
          <rect
            key={x}
            x={x}
            y="14"
            width="13"
            height="17"
            rx="3"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".3"
          />
        ))}
        <Card x={30} y={31} angle={-9} />
        <Card x={48} y={27} suit="diamond" />
        <Card x={67} y={32} angle={10} suit="club" />
      </>
    );
  const ranks =
    kind === 'gin-rummy' ? ['7', '8', '9'] : kind === 'scopa' ? ['3', '6', '7'] : ['K', 'Q', 'A'];
  return (
    <>
      <Card x={27} y={23} angle={-16} suit={kind === 'scopa' ? 'coin' : 'club'} rank={ranks[0]} />
      <Card
        x={46}
        y={18}
        angle={-1}
        suit={kind === 'hearts' ? 'heart' : kind === 'scopa' ? 'coin' : 'diamond'}
        rank={ranks[1]}
      />
      <Card
        x={65}
        y={24}
        angle={14}
        suit={kind === 'hearts' ? 'heart' : kind === 'scopa' ? 'coin' : 'spade'}
        rank={ranks[2]}
      />
      {kind === 'spider-solitaire' && (
        <path
          d="M16 19h14m-7-7v14m-5-12 10 10m0-10L18 24"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          opacity=".55"
        />
      )}
    </>
  );
}

function DiscBoard({ kind }: { kind: 'reversi' | 'checkers' | 'gomoku' | 'connect-four' }) {
  const filled = kind === 'gomoku' ? [4, 5, 6, 7, 8, 10] : [5, 6, 8, 9, 10, 13, 14];
  return (
    <Board>
      {Array.from({ length: 16 }, (_, i) => {
        const x = 39 + (i % 4) * 14;
        const y = 23 + Math.floor(i / 4) * 14;
        const active = filled.includes(i);
        return (
          <g key={i}>
            {kind === 'checkers' ? (
              <rect
                x={x - 6.5}
                y={y - 6.5}
                width="13"
                height="13"
                rx="1"
                fill="currentColor"
                opacity={(i + Math.floor(i / 4)) % 2 ? 0.16 : 0.03}
              />
            ) : kind === 'gomoku' ? (
              <path
                d={`M${x - 7} ${y}h14M${x} ${y - 7}v14`}
                stroke="currentColor"
                strokeOpacity=".25"
              />
            ) : (
              <circle cx={x} cy={y} r="4.5" fill="currentColor" opacity=".1" />
            )}
            {active && (
              <>
                <circle cx={x} cy={y + 1.5} r="5" fill="currentColor" opacity=".2" />
                <circle
                  cx={x}
                  cy={y}
                  r="5"
                  fill={i % 3 ? 'currentColor' : PAPER}
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                {kind === 'checkers' && (
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill="none"
                    stroke={i % 3 ? PAPER : 'currentColor'}
                    strokeOpacity=".5"
                  />
                )}
              </>
            )}
          </g>
        );
      })}
    </Board>
  );
}

/**
 * Peg Solitaire's own board: the 15-hole triangle (rows of 1 to 5), a peg
 * standing in every hole but the middle one. Holes are the board's recess, the
 * pegs are the title's one colour with a small light from above. Only
 * currentColor and the paper token are used (no other var()): the Android
 * shortcut rasterizer resolves exactly those two.
 */
function PegTriangle() {
  return (
    <Board>
      {[0, 1, 2, 3, 4].map((r) =>
        Array.from({ length: r + 1 }, (_, c) => {
          const x = 60 + (c - r / 2) * 11;
          const y = 25 + r * 9.5;
          const empty = r === 2 && c === 1;
          return (
            <g key={`${r}-${c}`}>
              {empty ? (
                <circle
                  cx={x}
                  cy={y}
                  r="4.6"
                  fill="currentColor"
                  opacity=".18"
                  stroke="currentColor"
                  strokeOpacity=".35"
                />
              ) : (
                <>
                  <circle cx={x} cy={y} r="4.6" fill="currentColor" opacity=".1" />
                  <circle cx={x} cy={y + 1} r="3.8" fill="currentColor" opacity=".22" />
                  <circle cx={x} cy={y} r="3.8" fill="currentColor" />
                  <circle cx={x - 1.2} cy={y - 1.4} r="1.1" fill={PAPER} opacity=".5" />
                </>
              )}
            </g>
          );
        }),
      )}
    </Board>
  );
}

/**
 * Three of Gem Swap's real cuts, copied from `PATHS` in
 * games/gem-swap/ui/components/GemIcon.tsx (100 x 100 boxes; the shell may not
 * import a game, so the path data is duplicated on purpose). `pear` is the drop.
 */
const GEM_CUTS = [
  {
    outline: 'M50 7 L87 28.5 L87 71.5 L50 93 L13 71.5 L13 28.5 Z',
    facet: 'M50 24 L72 37 L72 63 L50 76 L28 63 L28 37 Z',
  },
  {
    outline: 'M50 5 C61 24 83 42 83 62 A33 33 0 0 1 17 62 C17 42 39 24 50 5 Z',
    facet: 'M50 30 C56 42 66 52 66 62 A16 16 0 0 1 34 62 C34 52 44 42 50 30 Z',
  },
  {
    outline: 'M14 9 L86 9 L86 54 L50 93 L14 54 Z',
    facet: 'M30 23 L70 23 L70 50 L50 72 L30 50 Z',
  },
] as const;

/**
 * A Bounce Up platform cloud in miniature: the same construction as
 * `cloudPath` in games/bounce-up/ui/draw.ts (flat top with rounded corners,
 * two shallow bumps below), drawn `w` wide from its top-left corner.
 */
function cloudD(x: number, y: number, w: number): string {
  const r = 2.5;
  const lip = y + 4.2;
  const sag = y + 9;
  const mid = x + w / 2;
  const end = x + w;
  return (
    `M${x + r} ${y}H${end - r}Q${end} ${y} ${end} ${y + r}V${lip}` +
    `Q${(mid + end) / 2} ${sag} ${mid} ${lip}Q${(x + mid) / 2} ${sag} ${x} ${lip}` +
    `V${y + r}Q${x} ${y} ${x + r} ${y}Z`
  );
}

/**
 * The invaders' three silhouettes and the ship, copied from Invader / Ship in
 * games/invaders/ui/components/Shapes.tsx (the shell may not import a game).
 * `eyes` is the paper stroke each one carries.
 */
const INVADER_SHAPES = [
  {
    body: 'M-10 2-7-5H-3L0-9 3-5H7L10 2 6 8H2V4H-2V8H-6Z',
    eyes: 'M-5-1h2m6 0h2',
  },
  {
    body: 'M-11-3-6-7H6L11-3 8 4 11 8H6L3 4H-3L-6 8H-11L-8 4Z',
    eyes: 'M-5-1h3m4 0h3',
  },
  {
    body: 'M0-9 5-5 9-6 11 1 7 7 3 5 0 8-3 5-7 7-11 1-9-6-5-5Z',
    eyes: 'M-5 0h3m4 0h3',
  },
] as const;
const INVADER_SHIP = 'M0-13 4-6 4-2 12 5 12 10H5L0 7-5 10H-12V5L-4-2V-6Z';

function Knight({ x = 60, y = 46, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} fill="currentColor">
      <path d="M-15 18h30v5h-30zM-12 14c1-7 8-10 7-19l-8 5-6-6 11-16 10-2 4-6 3 9c9 7 10 19 3 35Z" />
      <circle cx="-4" cy="-15" r="1.5" fill={PAPER} />
      <path d="m-12-5 5-2" fill="none" stroke={PAPER} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function Arcade({ children }: { children: ReactNode }) {
  return (
    <g>
      <rect x="25" y="14" width="70" height="66" rx="11" fill="currentColor" opacity=".13" />
      <rect
        x="25"
        y="10"
        width="70"
        height="66"
        rx="11"
        fill={PAPER}
        stroke="currentColor"
        strokeOpacity=".23"
      />
      <rect x="30" y="15" width="60" height="56" rx="7" fill="currentColor" opacity=".055" />
      {children}
    </g>
  );
}

function Block({
  x,
  y,
  opacity = 0.8,
  size = 10,
}: {
  x: number;
  y: number;
  opacity?: number;
  size?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y + 1.5}
        width={size}
        height={size}
        rx="2"
        fill="currentColor"
        opacity={opacity * 0.3}
      />
      <rect x={x} y={y} width={size} height={size} rx="2" fill="currentColor" opacity={opacity} />
      <path
        d={`M${x + 2} ${y + 2}h${size - 4}`}
        stroke={PAPER}
        strokeOpacity=".35"
        strokeLinecap="round"
      />
    </g>
  );
}

function Motif({ id }: { id: GameId }): ReactNode {
  switch (id) {
    case 'sudoku':
      return (
        <Grid
          numbers={['5', '', '8', '', '3', '', '6', '', '1']}
          tones={[0.06, 0.06, 0.06, 0.06, 0.2, 0.06, 0.06, 0.06, 0.06]}
        />
      );
    case 'sudoku-6x6':
      return (
        <Grid
          count={6}
          numbers={[
            '1',
            '',
            '3',
            '',
            '',
            '6',
            '',
            '5',
            '',
            '1',
            '2',
            '',
            '2',
            '',
            '',
            '5',
            '',
            '1',
            '',
            '6',
            '1',
            '',
            '3',
            '',
            '3',
            '',
            '5',
            '',
            '',
            '2',
            '',
            '1',
            '',
            '3',
            '4',
            '',
          ]}
        />
      );
    case 'number-match':
      return (
        <Grid
          numbers={['2', '8', '7', '4', '4', '3', '6', '1', '9']}
          tones={[0.2, 0.2, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06]}
        />
      );
    case 'sliding-puzzle':
      return (
        <Grid
          numbers={['1', '2', '3', '4', '5', '6', '7', '8', '']}
          tones={[0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0.18, 0]}
        />
      );
    case '2048':
      return (
        <Grid
          numbers={['2', '4', '', '', '8', '16', '2', '', '4']}
          tones={[0.08, 0.16, 0, 0, 0.23, 0.34, 0.08, 0, 0.16]}
        />
      );
    case 'takuzu':
      return <Grid numbers={['0', '1', '', '1', '', '0', '', '0', '1']} />;
    case 'binary-balance':
      return (
        <Grid
          numbers={['0', '1', '0', '', '', '0', '1', '', '0', '1', '', '1', '', '0', '1', '']}
          count={4}
        />
      );
    case 'schulte-table':
      return (
        <Grid
          numbers={['7', '2', '9', '4', '1', '6', '8', '5', '3']}
          tones={[0.06, 0.06, 0.06, 0.06, 0.23, 0.06, 0.06, 0.06, 0.06]}
        />
      );
    case 'number-recall':
      return (
        <Board>
          <Number x={60} y={37} size={22}>
            482
          </Number>
          <path
            d="M39 57h10m6 0h10m6 0h10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".4"
          />
        </Board>
      );
    case 'quick-math':
      return (
        <Board>
          <Number x={60} y={34} size={17}>
            7 + 5
          </Number>
          <rect x="39" y="48" width="42" height="18" rx="4" fill="currentColor" opacity=".13" />
          <Number x={60} y={57} size={14}>
            12
          </Number>
        </Board>
      );
    case 'make-the-target':
      return (
        <Board>
          <circle cx="60" cy="32" r="13" fill="currentColor" opacity=".14" />
          <Number x={60} y={32} size={16}>
            24
          </Number>
          <Number x={42} y={58}>
            6
          </Number>
          <Number x={60} y={58}>
            ×
          </Number>
          <Number x={78} y={58}>
            4
          </Number>
        </Board>
      );
    case 'futoshiki':
      return (
        <Board>
          <Number x={42} y={28}>
            1
          </Number>
          <Number x={76} y={28}>
            3
          </Number>
          <Number x={42} y={60}>
            4
          </Number>
          <Number x={76} y={60}>
            2
          </Number>
          <path
            d="m61 24-5 4 5 4m-4 24 5 4-5 4m-18-13 4-5 4 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Board>
      );
    case 'kakuro':
      return (
        <Board>
          <path d="M33 17h54v54H33Z" fill="currentColor" opacity=".07" />
          <path
            d="M33 17h18v18H33Zm18 0h18v18H51ZM33 35h18v18H33Z"
            fill="currentColor"
            opacity=".6"
          />
          <path d="m33 17 18 18m0-18 18 18M33 35l18 18" stroke={PAPER} strokeWidth="1.2" />
          <Number x={60} y={44}>
            7
          </Number>
          <Number x={78} y={44}>
            2
          </Number>
          <Number x={60} y={62}>
            1
          </Number>
        </Board>
      );
    case 'nonogram':
      return (
        <Grid
          count={5}
          tones={[
            0.06, 0.06, 0.8, 0.06, 0.06, 0.06, 0.8, 0.8, 0.8, 0.06, 0.8, 0.8, 0.8, 0.8, 0.8, 0.06,
            0.8, 0.8, 0.8, 0.06, 0.06, 0.06, 0.8, 0.06, 0.06,
          ]}
        />
      );
    case 'minesweeper':
      return (
        <Board>
          <g fill="currentColor" opacity=".1">
            {[0, 1, 2, 3, 5, 6, 7, 8].map((i) => (
              <rect
                key={i}
                x={33 + (i % 3) * 18}
                y={17 + Math.floor(i / 3) * 18}
                width="16"
                height="16"
                rx="2"
              />
            ))}
          </g>
          <path
            d="M57 51V33l14 5-14 5m-5 9h11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <Number x={41} y={43}>
            1
          </Number>
          <Number x={78} y={61}>
            2
          </Number>
        </Board>
      );
    case 'crown-grid':
      return (
        <Board>
          <path
            d="M34 18h52v52H34ZM51 18v52m18-52v52M34 35h52M34 52h52"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".18"
          />
          <path d="m46 41 4 16h20l4-16-8 6-6-11-6 11Z" fill="currentColor" />
          <path d="M51 62h18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </Board>
      );
    case 'number-path':
      return (
        <Board>
          <path
            d="M41 26h36v18H41v18h36"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {(
            [
              [41, 26, 1],
              [77, 26, 3],
              [41, 44, 6],
              [77, 62, 9],
            ] as const
          ).map(([x, y, n]) => (
            <g key={n}>
              <circle cx={x} cy={y} r="7" fill={PAPER} />
              <Number x={x} y={y} size={10}>
                {n}
              </Number>
            </g>
          ))}
        </Board>
      );
    case 'shape-regions':
      return (
        <Board>
          <path d="M34 18h34v17H51v35H34Z" fill="currentColor" opacity=".65" />
          <path d="M72 18h14v34H55V39h17Z" fill="currentColor" opacity=".28" />
          <path d="M55 56h31v14H55Z" fill="currentColor" opacity=".14" />
        </Board>
      );
    case 'box-regions':
      return (
        <Board>
          <rect x="34" y="18" width="32" height="24" rx="2" fill="currentColor" opacity=".24" />
          <rect x="70" y="18" width="16" height="52" rx="2" fill="currentColor" opacity=".12" />
          <rect x="34" y="46" width="32" height="24" rx="2" fill="currentColor" opacity=".4" />
          <Number x={50} y={30}>
            6
          </Number>
          <Number x={78} y={44}>
            4
          </Number>
          <Number x={50} y={58}>
            6
          </Number>
        </Board>
      );
    case 'loop-puzzle':
      return (
        <Board>
          <path
            d="M39 23h42v28H67v14H39Z"
            fill="currentColor"
            fillOpacity=".09"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <Number x={53} y={37}>
            3
          </Number>
          <Number x={53} y={57}>
            2
          </Number>
          {[39, 53, 67, 81].map((x) => (
            <circle key={x} cx={x} cy="23" r="1.8" fill="currentColor" />
          ))}
        </Board>
      );
    case 'bridges':
      return (
        <Board>
          <path
            d="M41 26h36M41 29h36M40 28v34m3-34v34m34-34v34M42 62h35"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          {(
            [
              [41, 27, 4],
              [77, 27, 3],
              [41, 62, 3],
              [77, 62, 2],
            ] as const
          ).map(([x, y, n]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="8" fill={PAPER} stroke="currentColor" strokeWidth="1.5" />
              <Number x={x} y={y} size={10}>
                {n}
              </Number>
            </g>
          ))}
        </Board>
      );
    case 'light-grid':
      return (
        <Board>
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <rect
                x={34 + (i % 3) * 18}
                y={18 + Math.floor(i / 3) * 18}
                width="15"
                height="15"
                rx="4"
                fill="currentColor"
                opacity={[1, 3, 4, 5, 7].includes(i) ? 0.55 : 0.07}
              />
              <circle
                cx={41.5 + (i % 3) * 18}
                cy={25.5 + Math.floor(i / 3) * 18}
                r="2"
                fill={PAPER}
                opacity={[1, 3, 4, 5, 7].includes(i) ? 0.8 : 0}
              />
            </g>
          ))}
        </Board>
      );
    case 'color-flood':
      return (
        <Grid
          count={4}
          tones={[
            0.7, 0.7, 0.7, 0.15, 0.7, 0.7, 0.3, 0.15, 0.7, 0.3, 0.3, 0.5, 0.15, 0.15, 0.5, 0.5,
          ]}
        />
      );
    case 'maze-escape':
      return (
        <Board>
          <path
            d="M34 18h52v52H34V30m12-12v16h16V18m12 0v30H58v12H46V44H34m12 26V58m16 12V58h24M74 58v12M34 34h12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <circle cx="39" cy="24" r="3.5" fill="currentColor" />
          <path d="m78 63 3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </Board>
      );
    case 'solitaire':
    case 'spider-solitaire':
    case 'freecell':
    case 'hearts':
    case 'gin-rummy':
    case 'scopa':
    case 'three-peaks':
      return <Cards kind={id} />;
    case 'memory-match':
      return (
        <>
          <g transform="rotate(-12 45 45)">
            <Card x={26} y={24} suit="heart" rank="" />
          </g>
          <g transform="rotate(11 76 45)">
            <Card x={64} y={21} suit="heart" rank="" />
          </g>
          <path
            d="m55 44 3 3 5-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    case 'mahjong-solitaire':
      return (
        <>
          {(
            [
              [28, 35, -9],
              [64, 35, 9],
              [46, 17, 0],
            ] as const
          ).map(([x, y, a], i) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${a} 14 19)`}>
              <rect x="0" y="4" width="28" height="38" rx="5" fill="currentColor" opacity=".32" />
              <rect
                width="28"
                height="38"
                rx="5"
                fill={PAPER}
                stroke="currentColor"
                strokeOpacity=".3"
              />
              {i === 2 ? (
                <path
                  d="M9 9v20m10-20v20M7 14h4m6 10h4"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ) : (
                <g fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="14" cy="12" r="4" />
                  <circle cx="14" cy="26" r="4" />
                </g>
              )}
            </g>
          ))}
        </>
      );
    case 'reversi':
    case 'checkers':
    case 'gomoku':
    case 'connect-four':
      return <DiscBoard kind={id} />;
    case 'peg-solitaire':
      return <PegTriangle />;
    case 'chess':
      return (
        <Board>
          <path d="M33 58h54v13H33Z" fill="currentColor" opacity=".1" />
          <Knight scale={0.8} x={61} y={45} />
        </Board>
      );
    case 'knight-tour':
      return (
        <Board>
          <path
            d="M38 24h44v40H38Zm15 0v40m14-40v40M38 37h44M38 51h44"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".15"
          />
          <path
            d="M43 58h27V31"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="3 3"
            opacity=".5"
          />
          <Knight x={50} y={40} scale={0.57} />
        </Board>
      );
    case 'ludo':
      return (
        <Board>
          {(
            [
              [35, 19],
              [67, 19],
              [35, 51],
              [67, 51],
            ] as const
          ).map(([x, y], i) => (
            <g key={`${x}-${y}`}>
              <rect
                x={x}
                y={y}
                width="18"
                height="18"
                rx="4"
                fill="currentColor"
                opacity={0.18 + i * 0.1}
              />
              <circle cx={x + 9} cy={y + 9} r="3.5" fill={PAPER} />
            </g>
          ))}
          <path d="M58 20h4v50h-4ZM35 42h50v4H35Z" fill="currentColor" opacity=".2" />
        </Board>
      );
    case 'nested-tic-tac-toe':
      return (
        <Board>
          <path
            d="M50 18v52m20-52v52M34 34h52M34 54h52"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity=".4"
          />
          <path
            d="m38 22 8 8m0-8-8 8m26 26-8 8m0-8 8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="60" cy="44" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M74 56v12m5-12v12m-7-8h12m-12 5h12" stroke="currentColor" strokeOpacity=".45" />
        </Board>
      );
    case 'dots-and-boxes':
      return (
        <Board>
          <rect x="42" y="26" width="18" height="18" fill="currentColor" opacity=".2" />
          <path
            d="M42 26h36v18H42V26m18 0v36H42m18 0h18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              cx={42 + (i % 3) * 18}
              cy={26 + Math.floor(i / 3) * 18}
              r="2.4"
              fill="currentColor"
            />
          ))}
        </Board>
      );
    case 'mancala':
      return (
        <g transform="rotate(-8 60 45)">
          <rect x="18" y="24" width="84" height="45" rx="19" fill="currentColor" opacity=".17" />
          <rect
            x="18"
            y="20"
            width="84"
            height="45"
            rx="19"
            fill={PAPER}
            stroke="currentColor"
            strokeOpacity=".3"
          />
          <g fill="currentColor" opacity=".18">
            <rect x="24" y="29" width="10" height="27" rx="5" />
            <rect x="86" y="29" width="10" height="27" rx="5" />
            {[42, 60, 78].map((x) => (
              <g key={x}>
                <ellipse cx={x} cy="33" rx="6" ry="6" />
                <ellipse cx={x} cy="51" rx="6" ry="6" />
              </g>
            ))}
          </g>
          {[42, 60, 78].map((x) => (
            <g key={x} fill="currentColor">
              <circle cx={x - 1} cy="32" r="2" />
              <circle cx={x + 1} cy="51" r="2" />
              <circle cx={x - 2} cy="54" r="1.5" />
            </g>
          ))}
        </g>
      );
    case 'yacht':
      return (
        <>
          {(
            [
              [30, 30, -16],
              [62, 36, 13],
              [49, 14, 5],
            ] as const
          ).map(([x, y, a], i) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${a} 13 13)`}>
              <rect x="0" y="3" width="27" height="27" rx="6" fill="currentColor" opacity=".17" />
              <rect
                width="27"
                height="27"
                rx="6"
                fill={PAPER}
                stroke="currentColor"
                strokeOpacity=".3"
              />
              <circle cx="8" cy="8" r="2.3" fill="currentColor" />
              <circle cx="19" cy="19" r="2.3" fill="currentColor" />
              {i !== 0 && <circle cx="13.5" cy="13.5" r="2.3" fill="currentColor" />}
              {i === 2 && (
                <g fill="currentColor">
                  <circle cx="19" cy="8" r="2.3" />
                  <circle cx="8" cy="19" r="2.3" />
                </g>
              )}
            </g>
          ))}
        </>
      );
    case 'dominoes':
      return (
        <>
          {(
            [
              [34, 19, -13],
              [62, 28, 12],
            ] as const
          ).map(([x, y, a], i) => (
            <g key={x} transform={`translate(${x} ${y}) rotate(${a} 12 24)`}>
              <rect x="0" y="3" width="24" height="46" rx="5" fill="currentColor" opacity=".18" />
              <rect
                width="24"
                height="46"
                rx="5"
                fill={PAPER}
                stroke="currentColor"
                strokeOpacity=".3"
              />
              <path d="M4 23h16" stroke="currentColor" strokeOpacity=".4" />
              <g fill="currentColor">
                <circle cx="8" cy="9" r="2" />
                <circle cx="16" cy="16" r="2" />
                <circle cx="8" cy="30" r="2" />
                <circle cx="16" cy="39" r="2" />
                {i === 0 && <circle cx="12" cy="34.5" r="2" />}
              </g>
            </g>
          ))}
        </>
      );
    case 'nim':
      return (
        <Board>
          {[3, 5, 7].map((n, row) =>
            Array.from({ length: n }, (_, i) => (
              <g key={`${row}-${i}`}>
                <path
                  d={`M${60 - (n - 1) * 3.5 + i * 7} ${24 + row * 17}v10`}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity=".6"
                />
                <circle
                  cx={60 - (n - 1) * 3.5 + i * 7}
                  cy={24 + row * 17}
                  r="2"
                  fill="currentColor"
                />
              </g>
            )),
          )}
        </Board>
      );
    case 'hit-and-blow':
      return (
        <Board>
          {Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              cx={40 + (i % 3) * 15}
              cy={27 + Math.floor(i / 3) * 17}
              r="5"
              fill="currentColor"
              opacity={[0.2, 0.7, 0.4][i % 3]}
            />
          ))}
          <path
            d="M80 25h3m-3 5h3m-3 12h3m-3 5h3m-3 12h3m-3 5h3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Board>
      );
    case 'water-sort':
      return (
        <g transform="rotate(-5 60 45)">
          {[34, 54, 74].map((x, i) => (
            <g key={x}>
              <rect
                x={x}
                y="23"
                width="13"
                height="43"
                rx="6"
                fill={PAPER}
                stroke="currentColor"
                strokeOpacity=".4"
              />
              <path
                d={`M${x + 3} 54v5a3.5 3.5 0 0 0 7 0v-5Z`}
                fill="currentColor"
                opacity={0.3 + i * 0.2}
              />
              <path d={`M${x + 3} 43h7v10h-7Z`} fill="currentColor" opacity={0.8 - i * 0.2} />
              {i !== 2 && (
                <path d={`M${x + 3} 32h7v10h-7Z`} fill="currentColor" opacity={0.15 + i * 0.2} />
              )}
              <path
                d={`M${x - 1} 22h15`}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          ))}
        </g>
      );
    case 'bubble-pop':
      return (
        <>
          {(
            [
              [42, 28],
              [59, 28],
              [76, 28],
              [34, 44],
              [51, 44],
              [68, 44],
              [43, 60],
              [60, 60],
              [77, 60],
            ] as const
          ).map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y + 2} r="8" fill="currentColor" opacity=".12" />
              <circle cx={x} cy={y} r="8" fill="currentColor" opacity={i % 3 ? 0.3 : 0.7} />
              <path
                d={`M${x - 4} ${y - 3}q2-3 5-2`}
                fill="none"
                stroke={PAPER}
                strokeWidth="1.5"
                strokeLinecap="round"
                opacity=".65"
              />
            </g>
          ))}
        </>
      );
    case 'gem-swap':
      return (
        <Board>
          {Array.from({ length: 9 }, (_, i) => {
            // Hexagon, drop, shield: a 3 x 3 Latin square, so no cut repeats in a row or column.
            const cut = GEM_CUTS[(Math.floor(i / 3) + (i % 3)) % 3]!;
            return (
              <g
                key={i}
                transform={`translate(${41 + (i % 3) * 19} ${25 + Math.floor(i / 3) * 19}) scale(.15) translate(-50 -50)`}
              >
                <path d={cut.outline} fill="currentColor" opacity={i % 3 ? 0.35 : 0.8} />
                <path
                  d={cut.facet}
                  fill="none"
                  stroke={PAPER}
                  strokeOpacity=".6"
                  strokeWidth="6"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </Board>
      );
    case 'block-puzzle':
      return (
        <Board>
          {(
            [
              [35, 57],
              [47, 57],
              [59, 57],
              [71, 57],
              [71, 45],
              [35, 45],
              [47, 45],
            ] as const
          ).map(([x, y]) => (
            <Block key={x + y * 10} x={x} y={y} opacity={0.45} />
          ))}
          {(
            [
              [48, 21],
              [60, 21],
              [60, 33],
            ] as const
          ).map(([x, y]) => (
            <Block key={x + y * 10} x={x} y={y} />
          ))}
        </Board>
      );
    case 'unblock-puzzle':
      return (
        <Board>
          <rect x="35" y="19" width="13" height="32" rx="3" fill="currentColor" opacity=".3" />
          <rect x="52" y="19" width="32" height="13" rx="3" fill="currentColor" opacity=".2" />
          <rect x="52" y="37" width="32" height="13" rx="3" fill="currentColor" opacity=".8" />
          <rect x="35" y="56" width="32" height="13" rx="3" fill="currentColor" opacity=".2" />
          <path
            d="m89 39 5 4-5 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Board>
      );
    case 'pipe-link':
      return (
        <Board>
          <path
            d="M40 24h20v20h20v20H60"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity=".22"
          />
          <path
            d="M40 24h20v20h20v20H60"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="40" cy="24" r="6" fill={PAPER} stroke="currentColor" strokeWidth="2" />
          <circle cx="60" cy="64" r="6" fill="currentColor" />
        </Board>
      );
    case 'tangram':
      return (
        <g transform="rotate(-8 60 45)" stroke={PAPER} strokeWidth="2" strokeLinejoin="round">
          <path d="M32 20h56L60 48Z" fill="currentColor" opacity=".75" />
          <path d="M32 20v56l28-28Z" fill="currentColor" opacity=".45" />
          <path d="m60 48 14-14 14 14-14 14Z" fill="currentColor" opacity=".28" />
          <path d="m32 76 28-28v28Z" fill="currentColor" opacity=".6" />
          <path d="m60 76 14-14 14 14Z" fill="currentColor" opacity=".35" />
          <path d="M88 20v28L74 34Zm0 28v28L74 62Z" fill="currentColor" opacity=".5" />
        </g>
      );
    case 'hanoi-towers':
      return (
        <>
          <ellipse cx="60" cy="75" rx="43" ry="4" fill="currentColor" opacity=".1" />
          <path
            d="M21 70h78M34 68V28m27 40V21m25 47V33"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            opacity=".4"
          />
          {(
            [
              [18, 61, 32],
              [21, 51, 26],
              [24, 41, 20],
              [52, 61, 18],
            ] as const
          ).map(([x, y, w], i) => (
            <g key={i}>
              <rect x={x} y={y + 2} width={w} height="8" rx="4" fill="currentColor" opacity=".25" />
              <rect
                x={x}
                y={y}
                width={w}
                height="8"
                rx="4"
                fill="currentColor"
                opacity={0.45 + i * 0.14}
              />
              <path
                d={`M${x + 4} ${y + 2}h${w - 8}`}
                stroke={PAPER}
                strokeOpacity=".35"
                strokeLinecap="round"
              />
            </g>
          ))}
        </>
      );
    case 'invaders':
      return (
        <Arcade>
          {(
            [
              [42, 26, 1],
              [60, 26, 0],
              [78, 26, 1],
              [51, 40, 2],
              [69, 40, 2],
            ] as const
          ).map(([x, y, kind]) => (
            <g key={x + y} transform={`translate(${x} ${y}) scale(.6)`}>
              <path d={INVADER_SHAPES[kind].body} fill="currentColor" />
              <path d={INVADER_SHAPES[kind].eyes} stroke={PAPER} strokeWidth="2" />
            </g>
          ))}
          <path d="M60 47v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path transform="translate(60 62) scale(.6)" d={INVADER_SHIP} fill="currentColor" />
        </Arcade>
      );
    case 'falling-blocks':
      return (
        <Arcade>
          <path d="M40 19v47h38" fill="none" stroke="currentColor" strokeOpacity=".22" />
          {(
            [
              [43, 55],
              [53, 55],
              [63, 55],
              [73, 55],
              [63, 45],
              [73, 45],
              [43, 45],
            ] as const
          ).map(([x, y]) => (
            <Block key={x + y * 10} x={x} y={y} size={9} opacity={0.4} />
          ))}
          {(
            [
              [53, 22],
              [63, 22],
              [63, 32],
            ] as const
          ).map(([x, y]) => (
            <Block key={x + y * 10} x={x} y={y} size={9} opacity={0.85} />
          ))}
        </Arcade>
      );
    case 'paddle-rally':
      return (
        <Arcade>
          <path d="M35 43h50" stroke="currentColor" strokeOpacity=".3" strokeDasharray="3 4" />
          <rect x="40" y="22" width="22" height="4" rx="2" fill="currentColor" opacity=".4" />
          <rect x="59" y="62" width="22" height="4" rx="2" fill="currentColor" />
          <circle cx="63" cy="46" r="3.5" fill="currentColor" />
          <path
            d="m51 35 7 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".25"
          />
        </Arcade>
      );
    case 'brick-breaker':
      return (
        <Arcade>
          {Array.from({ length: 9 }, (_, i) => (
            <rect
              key={i}
              x={35 + (i % 3) * 17}
              y={22 + Math.floor(i / 3) * 8}
              width="15"
              height="5"
              rx="1.5"
              fill="currentColor"
              opacity={0.8 - Math.floor(i / 3) * 0.2}
            />
          ))}
          <circle cx="67" cy="51" r="3" fill="currentColor" />
          <path
            d="m59 59 5-5"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="47" y="64" width="23" height="3" rx="1.5" fill="currentColor" />
        </Arcade>
      );
    case 'snake':
      return (
        <Arcade>
          <path
            d="M41 58h21V43H47V28h26"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="74" cy="26" r="1.3" fill={PAPER} />
          <circle cx="78" cy="58" r="4" fill="currentColor" opacity=".4" />
        </Arcade>
      );
    case 'sky-fighter':
      return (
        <Arcade>
          <path d="m60 39 5 13 12 8v4l-14-4-3 7-3-7-14 4v-4l12-8Z" fill="currentColor" />
          <path
            d="M60 22v6m-16-6v4m32-4v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".35"
          />
          <path d="m43 35-6-8h12Zm34 0-6-8h12Z" fill="currentColor" opacity=".45" />
        </Arcade>
      );
    case 'bunny-hop':
      return (
        <>
          <path
            d="M23 69h74M77 69V56h10v13"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".3"
          />
          <path
            d="M31 59q13-42 39-21"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeDasharray="2 4"
            strokeLinecap="round"
          />
          <g transform="rotate(13 58 45)" fill="currentColor">
            <ellipse cx="53" cy="46" rx="13" ry="11" />
            <circle cx="63" cy="39" r="9" />
            <ellipse cx="60" cy="27" rx="3" ry="11" transform="rotate(-12 60 27)" />
            <ellipse cx="68" cy="28" rx="3" ry="10" transform="rotate(9 68 28)" />
            <circle cx="40" cy="46" r="4" />
            <circle cx="67" cy="38" r="1.5" fill={PAPER} />
            <path d="M51 53h18v5H51Z" />
          </g>
        </>
      );
    case 'bounce-up':
      return (
        <Arcade>
          <path
            d={cloudD(35, 61, 20) + cloudD(67, 44, 18) + cloudD(36, 27, 17)}
            fill="currentColor"
            opacity=".45"
          />
          <path
            d="M47 57q5-26 27-18"
            fill="none"
            stroke="currentColor"
            strokeOpacity=".25"
            strokeWidth="1.5"
            strokeDasharray="2 3"
          />
          <g transform="translate(63 37.5)">
            <path
              d="M-1.1-13H1.1Q6.5-13 6.5-7.6V-1.9Q6.5 0 4.6 0H-4.6Q-6.5 0-6.5-1.9V-7.6Q-6.5-13-1.1-13Z"
              fill="currentColor"
            />
            <circle cx="-2.5" cy="-7.8" r="1.3" fill={PAPER} />
            <circle cx="2.5" cy="-7.8" r="1.3" fill={PAPER} />
          </g>
        </Arcade>
      );
    case 'overtake':
      return (
        <Arcade>
          <path d="M41 18v51m38-51v51" stroke="currentColor" strokeOpacity=".2" />
          <path
            d="M60 18v12m0 21v17"
            stroke="currentColor"
            strokeOpacity=".3"
            strokeDasharray="4 4"
          />
          <g fill="currentColor">
            <rect x="45" y="43" width="11" height="20" rx="4" />
            <rect x="66" y="22" width="10" height="18" rx="4" opacity=".4" />
          </g>
          <path
            d="M47 48h7m-6 11h5m15-32h6"
            stroke={PAPER}
            strokeWidth="2"
            strokeLinecap="round"
            opacity=".7"
          />
        </Arcade>
      );
    case 'echo-pads':
      return (
        <g transform="rotate(-7 60 45)">
          {(
            [
              [33, 18],
              [63, 18],
              [33, 48],
              [63, 48],
            ] as const
          ).map(([x, y], i) => (
            <g key={i}>
              <rect
                x={x}
                y={y + 3}
                width="25"
                height="25"
                rx="8"
                fill="currentColor"
                opacity=".14"
              />
              <rect
                x={x}
                y={y}
                width="25"
                height="25"
                rx="8"
                fill="currentColor"
                opacity={i === 1 ? 0.85 : 0.23}
              />
              <circle
                cx={x + 12.5}
                cy={y + 12.5}
                r="4"
                fill={PAPER}
                opacity={i === 1 ? 0.8 : 0.4}
              />
            </g>
          ))}
        </g>
      );
  }
  // A newly registered game needs artwork too; keep that omission a type error.
  const unhandled: never = id;
  return unhandled;
}

export function GameArtwork({ id }: { id: GameId }) {
  return (
    <svg
      className="game-artwork"
      viewBox="0 0 120 90"
      width="120"
      height="90"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <ellipse cx="60" cy="78" rx="34" ry="4" fill="currentColor" opacity=".06" />
      <Motif id={id} />
    </svg>
  );
}
