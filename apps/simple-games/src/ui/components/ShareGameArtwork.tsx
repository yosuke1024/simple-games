/**
 * Share-only game introductions. These are fixed examples, never a player's
 * saved board or today's answer. Bigger scenes show the game's decisions at
 * feed size; the compact shelf artwork remains unchanged.
 */
import type { ReactNode } from 'react';
import type { GameId } from '../../app/registry';
import { GameArtwork } from './GameArtwork';

const PAPER = 'var(--surface)';
const INK = '#232a33';
const LINE = '#ddd7ca';

function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <rect x="89" y="35" width="304" height="304" rx="16" fill="currentColor" opacity=".08" />
      <rect
        x="88"
        y="28"
        width="304"
        height="304"
        rx="16"
        fill={PAPER}
        stroke={LINE}
        strokeWidth="2"
      />
      {children}
    </>
  );
}

function Crown({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(1.35) translate(-12 -12)`} fill={INK}>
      <path d="M3.4 19.5 2.3 8.4 8 12.6 12 5.4 16 12.6 21.7 8.4 20.6 19.5Z" />
      <rect x="2.9" y="17.2" width="18.2" height="3.4" rx="1.5" />
      <circle cx="2.5" cy="7.6" r="1.75" />
      <circle cx="12" cy="4.6" r="1.75" />
      <circle cx="21.5" cy="7.6" r="1.75" />
    </g>
  );
}

function CrownGridScene() {
  // An original, uniquely solvable 6×6 example. Its full placement by row is
  // [2, 0, 4, 1, 3, 5]; only three marks are shown, so the invitation has room
  // left for the viewer's own reasoning. No daily seed or engine is involved.
  const regions = ['bbaacc', 'bbbccc', 'ddcccc', 'dddccc', 'dddeee', 'ddddff'];
  const colors = ['#f3d6cf', '#f7e3c3', '#f1efb6', '#d3ebc7', '#c8e8e2', '#cfdff6'];
  const crowns = [2, 16, 27];
  const crosses = [0, 1, 7, 8, 14, 21, 26, 28];
  const cellSize = 48;
  return (
    <Frame>
      {regions.flatMap((row, r) =>
        [...row].map((region, c) => {
          const x = 96 + c * cellSize;
          const y = 36 + r * cellSize;
          const index = r * 6 + c;
          return (
            <g key={index}>
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={colors[region.charCodeAt(0) - 97]}
                stroke={LINE}
                strokeWidth=".7"
              />
              {c > 0 && row[c - 1] !== region ? (
                <path d={`M${x} ${y}v48`} stroke={INK} strokeWidth="2.4" />
              ) : null}
              {r > 0 && regions[r - 1]![c] !== region ? (
                <path d={`M${x} ${y}h48`} stroke={INK} strokeWidth="2.4" />
              ) : null}
              {crowns.includes(index) ? <Crown x={x + 24} y={y + 24} /> : null}
              {crosses.includes(index) ? (
                <path
                  d={`m${x + 18} ${y + 18} 12 12m0-12-12 12`}
                  stroke={INK}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity=".5"
                />
              ) : null}
            </g>
          );
        }),
      )}
      <rect
        x="96"
        y="36"
        width="288"
        height="288"
        rx="2"
        fill="none"
        stroke={INK}
        strokeWidth="2.4"
      />
    </Frame>
  );
}

function Wolf({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#46525a" strokeWidth="2.5" strokeLinejoin="round">
      <path
        d="M-28-13-30-43-9-28h18l21-15-2 30 8 15-9 4Q23 28 0 30-23 28-27 6l-9-4Z"
        fill="#9aaeb9"
      />
      <path d="m-25-33 4 17 9-10m37-7-4 17-9-10" fill="#e4b4ab" stroke="none" />
      <path d="M-26 2Q-12-4 0 12 12-4 26 2q-2 24-26 24T-26 2" fill="#fff9eb" stroke="none" />
      <ellipse cx="-13" cy="-5" rx="4.5" ry="5.5" fill="#33414a" stroke="none" />
      <ellipse cx="13" cy="-5" rx="4.5" ry="5.5" fill="#33414a" stroke="none" />
      <circle cx="-14" cy="-7" r="1.5" fill={PAPER} stroke="none" />
      <circle cx="12" cy="-7" r="1.5" fill={PAPER} stroke="none" />
      <ellipse cx="-22" cy="6" rx="5" ry="3" fill="#e4b4ab" stroke="none" />
      <ellipse cx="22" cy="6" rx="5" ry="3" fill="#e4b4ab" stroke="none" />
      <path d="M-5 9q5-4 10 0-1 5-5 5-4 0-5-5" fill="#46525a" stroke="none" />
      <path d="M0 14q-4 7-9 2m9-2q4 7 9 2" fill="none" strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function Goat({ x, y }: { x: number; y: number }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      stroke="#665c4c"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M-15-19Q-29-40-18-43q-3 15 12 22m21 2Q29-40 18-43q3 15-12 22" fill="#c8ad7a" />
      <path d="M-21-12Q-43-29-42-11q2 12 20 13m43-14q22-17 21 1Q40 1 22 2" fill="#fff6de" />
      <path d="m-5 27 5 13 6-13" fill="#fff6de" />
      <path d="M-24-8q0-23 24-23T24-8l-4 25Q17 32 0 32T-20 17Z" fill="#fff6de" />
      <path d="M-16-22q4-10 11-4 8-8 14-1 9-1 11 8" fill={PAPER} stroke="none" />
      <ellipse cx="0" cy="17" rx="12" ry="8" fill="#ead7b6" stroke="none" />
      <ellipse cx="-12" cy="1" rx="4" ry="5" fill="#423f38" stroke="none" />
      <ellipse cx="12" cy="1" rx="4" ry="5" fill="#423f38" stroke="none" />
      <circle cx="-13" cy="-1" r="1.5" fill={PAPER} stroke="none" />
      <circle cx="11" cy="-1" r="1.5" fill={PAPER} stroke="none" />
      <ellipse cx="-20" cy="10" rx="5" ry="2.5" fill="#eab7a7" stroke="none" />
      <ellipse cx="20" cy="10" rx="5" ry="2.5" fill="#eab7a7" stroke="none" />
      <path d="m-3 15 3 2 3-2m-3 2v4m-4 0q4 4 8 0" fill="none" strokeWidth="1.8" />
    </g>
  );
}

function Cabbage({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#5e8060" strokeWidth="2" strokeLinejoin="round">
      <path
        d="M0 30q-38 3-35-22-11-21 8-31 7-18 25-12 23-9 29 12 21 9 11 28Q34 31 0 30Z"
        fill="#89b17c"
      />
      <path d="M-24 7q-6-30 23-33 28 0 28 29 0 22-27 23T-24 7" fill="#c5dca8" />
      <path d="M-34 7q19 0 33 20Q25 21 33 4q7 28-32 29Q-35 34-34 7Z" fill="#a2c88a" />
      <path d="m-24 15 16 11m-8-6 2-8m26 15 13-13" fill="none" />
      <circle cx="-10" cy="0" r="3" fill="#354b3a" stroke="none" />
      <circle cx="10" cy="0" r="3" fill="#354b3a" stroke="none" />
      <path d="M-5 9q5 6 10 0" fill="none" stroke="#354b3a" strokeLinecap="round" />
    </g>
  );
}

function RiverScene() {
  // Legal first crossing in the basic puzzle: the goat travels with the
  // ferryman; wolf and cabbage can safely remain together on the left bank.
  return (
    <>
      <rect x="20" y="38" width="440" height="284" rx="24" fill="#dfedf0" />
      <path
        d="M44 38h72q24 37-2 77-14 27 4 69 18 46-6 81-17 26 0 57H44q-24 0-24-24V62q0-24 24-24Z"
        fill="#dce7cc"
      />
      <path
        d="M436 38h-66q-26 36-3 74 17 28-1 66-20 43 2 79 17 29 0 65h68q24 0 24-24V62q0-24-24-24Z"
        fill="#dce7cc"
      />
      <path
        d="m42 161 7-11 7 11m-13 2 5-6 5 6m338-47 6-9 6 9m8 154 6-10 6 10"
        fill="none"
        stroke="#9caf81"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M151 94q15-9 30 0t30 0m60 24q15-9 30 0t30 0M145 274q15-9 30 0t30 0m64 14q15-9 30 0t30 0"
        fill="none"
        stroke="#aacbd0"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Wolf x={70} y={112} />
      <Cabbage x={69} y={242} />
      <ellipse cx="245" cy="241" rx="88" ry="10" fill="#b9d5d9" />
      <Goat x={277} y={189} />
      <circle cx="211" cy="167" r="15" fill="#dfb892" />
      <path d="M192 166q-1-25 19-25 18 0 18 21l-14-5-16 9Z" fill="#665c4c" />
      <path d="M187 217q0-37 24-37t25 37" fill="currentColor" />
      <path
        d="m200 190 31 17 29-25"
        fill="none"
        stroke="#dfb892"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path d="m257 178-49 84" stroke="#95724c" strokeWidth="5" strokeLinecap="round" />
      <path d="m209 248-10 18q-4 10 7 11l9-21" fill="#95724c" />
      <path
        d="M160 215h168l-26 30H188Z"
        fill="#ad855b"
        stroke="#795d42"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M175 223h137" stroke="#d9b38a" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M343 192h46m-12-10 12 10-12 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".55"
      />
    </>
  );
}

function SudokuScene() {
  // Fixed illustrative givens, selected from a valid Latin-pattern solution.
  // This is not any daily board and does not expose a complete solution.
  const rows = [
    '120450089',
    '450089020',
    '789020406',
    '034507001',
    '507001034',
    '001034507',
    '345070012',
    '670012305',
    '012305670',
  ];
  return (
    <Frame>
      <rect x="96" y="36" width="288" height="288" fill={PAPER} />
      {rows.flatMap((row, r) =>
        [...row].map((value, c) =>
          value === '0' ? null : (
            <text
              key={r * 9 + c}
              x={112 + c * 32}
              y={53 + r * 32}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="20"
              fontWeight="700"
              fill={INK}
            >
              {value}
            </text>
          ),
        ),
      )}
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} stroke={i % 3 ? LINE : INK} strokeWidth={i % 3 ? 1 : 2.3}>
          <path d={`M${96 + i * 32} 36v288M96 ${36 + i * 32}h288`} />
        </g>
      ))}
    </Frame>
  );
}

function NumberPathScene() {
  // Original five-by-five example, with an unfinished, non-intersecting path
  // that visits 1, 2 and 3 in order. The remaining numbered checkpoints invite
  // the viewer to imagine how to continue; this is never a current daily seed.
  const anchors = [
    [0, 0, 1],
    [4, 0, 2],
    [0, 1, 3],
    [4, 2, 4],
    [0, 3, 5],
    [4, 4, 6],
  ] as const;
  return (
    <Frame>
      {Array.from({ length: 25 }, (_, i) => (
        <rect
          key={i}
          x={96 + (i % 5) * 57.6}
          y={36 + Math.floor(i / 5) * 57.6}
          width="57.6"
          height="57.6"
          fill={PAPER}
          stroke={LINE}
          strokeWidth="1"
        />
      ))}
      <path
        d="M124.8 64.8h230.4v57.6H124.8v57.6h57.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="17"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {anchors.map(([c, r, value]) => (
        <g key={value}>
          <circle
            cx={124.8 + c * 57.6}
            cy={64.8 + r * 57.6}
            r="18"
            fill={PAPER}
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <text
            x={124.8 + c * 57.6}
            y={64.8 + r * 57.6}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="22"
            fontWeight="800"
            fill="currentColor"
          >
            {value}
          </text>
        </g>
      ))}
      <circle cx="182.4" cy="180" r="11" fill={PAPER} stroke="currentColor" strokeWidth="5" />
      <path
        d="M268.8 151.2h57.6M211.2 266.4h57.6"
        fill="none"
        stroke={INK}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Frame>
  );
}

export function ShareGameArtwork({ id }: { id: GameId }) {
  let scene: ReactNode;
  switch (id) {
    case 'crown-grid':
      scene = <CrownGridScene />;
      break;
    case 'river-cargo':
      scene = <RiverScene />;
      break;
    case 'sudoku':
      scene = <SudokuScene />;
      break;
    case 'number-path':
      scene = <NumberPathScene />;
      break;
    default:
      scene = (
        <g transform="scale(4)">
          <GameArtwork id={id} />
        </g>
      );
  }
  return (
    <svg
      viewBox="0 0 480 360"
      width="480"
      height="360"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      {scene}
    </svg>
  );
}
