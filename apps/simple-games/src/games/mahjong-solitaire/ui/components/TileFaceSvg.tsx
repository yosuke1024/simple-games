/**
 * The 42 tile faces, drawn in code (docs/MAHJONG_SOLITAIRE_RULES.md §12).
 *
 * Every face carries its own count, the way a real tile does: dots and
 * bamboo show it as pips (nine dots read as nine, the way five dice pips
 * do — no numeral needed), and characters show it as the numeral-over-萬
 * pair, both drawn. There is no separate corner index — an index is what a
 * playing card needs because a suit alone does not say rank; a mahjong face
 * already says its own count or its own character, so a second label would
 * only repeat it.
 *
 * Dots and bamboo are procedural; every kanji — the character numerals, 萬,
 * the winds and the dragons — is stroke PATH DATA, deliberately not text. A
 * CJK glyph rendered as <text> depends on the device having a CJK font, and
 * the floor devices this series ships to may not: a missing font would turn
 * half the tile set into tofu. Path data sidesteps that entirely — legibility
 * rides the stroke shapes themselves, checked on the static mock (§12).
 *
 * Faces are paper-on-paper in both themes, like the card games (mahjong.css
 * explains the exception); the colours here are game content — the red and
 * green a mahjong set has always had — not chrome, so they are constants
 * rather than theme tokens (the Water Sort / Memory Match arrangement).
 * No real manufacturer's face art is imitated: these are original drawings.
 */
import type { TileFace } from '../../game';

const INK = '#232a33';
const RED = '#b0483f';
const GREEN = '#33702e';
const BLUE = '#3f5b8f';
/** The face itself — same paper as the cards, in both themes. */
export const TILE_PAPER = '#fffdf8';

type Stroke = string;

/** Simplified stroke kanji in a 0..100 box. */
const KANJI: Record<string, readonly Stroke[]> = {
  n1: ['M12,50 H88'],
  n2: ['M20,32 H80', 'M12,68 H88'],
  n3: ['M20,25 H80', 'M24,50 H76', 'M12,75 H88'],
  n4: ['M15,25 H85 V75 H15 Z', 'M40,25 L36,52', 'M62,25 L62,50'],
  n5: ['M15,20 H85', 'M40,20 L36,74', 'M38,46 H64 L66,74', 'M12,74 H88'],
  n6: ['M50,12 V26', 'M12,38 H88', 'M36,52 L22,76', 'M64,52 L78,76'],
  n7: ['M12,42 L88,34', 'M46,14 V62 Q46,74 58,74 H80'],
  n8: ['M42,20 Q34,52 14,76', 'M58,20 Q70,52 86,76'],
  n9: ['M38,16 Q36,52 18,76', 'M26,38 H56 Q64,38 62,52 Q60,70 74,72 L82,64'],
  wan: [
    'M30,8 V22',
    'M70,8 V22',
    'M14,16 H86',
    'M26,32 H74 V56 H26 Z',
    'M26,44 H74',
    'M40,56 L28,80',
    'M60,56 Q64,74 82,76',
  ],
  east: [
    'M18,18 H82',
    'M30,32 H70 V56 H30 Z',
    'M30,44 H70',
    'M50,10 V88',
    'M40,60 L24,82',
    'M60,60 L76,82',
  ],
  south: [
    'M50,6 V16',
    'M12,16 H88',
    'M24,30 V82',
    'M76,30 V82',
    'M24,30 H76',
    'M38,48 H62',
    'M38,62 H62',
    'M50,42 V76',
  ],
  west: [
    'M14,20 H86',
    'M24,34 H76 V78 H24 Z',
    'M40,34 V50 Q40,58 32,60',
    'M60,34 V50 Q60,58 68,60',
  ],
  north: [
    'M34,16 V62 Q34,74 18,76',
    'M18,44 H34',
    'M66,12 V80',
    'M66,38 L84,30',
    'M66,80 Q76,80 84,72',
  ],
  chun: ['M25,28 H75 V58 H25 Z', 'M50,10 V88'],
  hatsu: [
    'M30,12 L18,26',
    'M40,14 V26',
    'M70,12 L82,26',
    'M60,14 V26',
    'M12,32 H88',
    'M30,42 H54 Q58,52 38,56 H58 Q62,66 46,70',
    'M30,80 Q44,74 50,62',
    'M66,42 Q70,58 84,60',
    'M72,66 L82,80',
  ],
};

function KanjiGlyph({
  glyph,
  color,
  x,
  y,
  size,
  width,
}: {
  glyph: string;
  color: string;
  x: number;
  y: number;
  size: number;
  width: number;
}) {
  return (
    <g transform={`translate(${x},${y}) scale(${size / 100})`}>
      {KANJI[glyph]!.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}

// ---------- dots ----------

const DOT_GRIDS: Record<number, readonly (readonly [number, number, number])[]> = {
  1: [[30, 46, 13]],
  2: [
    [30, 32, 8],
    [30, 60, 8],
  ],
  3: [
    [18, 28, 7],
    [30, 46, 7],
    [42, 64, 7],
  ],
  4: [
    [21, 33, 7],
    [39, 33, 7],
    [21, 59, 7],
    [39, 59, 7],
  ],
  5: [
    [19, 31, 6],
    [41, 31, 6],
    [30, 46, 6],
    [19, 61, 6],
    [41, 61, 6],
  ],
  6: [
    [21, 28, 6],
    [39, 28, 6],
    [21, 46, 6],
    [39, 46, 6],
    [21, 64, 6],
    [39, 64, 6],
  ],
  7: [
    [16, 26, 5],
    [30, 30, 5],
    [44, 34, 5],
    [21, 50, 5],
    [39, 50, 5],
    [21, 66, 5],
    [39, 66, 5],
  ],
  8: [
    [21, 25, 5],
    [39, 25, 5],
    [21, 39, 5],
    [39, 39, 5],
    [21, 53, 5],
    [39, 53, 5],
    [21, 67, 5],
    [39, 67, 5],
  ],
  9: [
    [17, 28, 5],
    [30, 28, 5],
    [43, 28, 5],
    [17, 46, 5],
    [30, 46, 5],
    [43, 46, 5],
    [17, 64, 5],
    [30, 64, 5],
    [43, 64, 5],
  ],
};

const DOT_COLORS = [RED, GREEN, BLUE];

function Dots({ n }: { n: number }) {
  const color = DOT_COLORS[(n - 1) % 3]!;
  return (
    <>
      {DOT_GRIDS[n]!.map(([cx, cy, r], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3} />
          <circle cx={cx} cy={cy} r={Math.max(1.6, r - 5)} fill={color} />
        </g>
      ))}
    </>
  );
}

// ---------- bamboo ----------

const BAMBOO_GRIDS: Record<number, readonly (readonly [number, number])[]> = {
  2: [
    [30, 32],
    [30, 60],
  ],
  3: [
    [30, 28],
    [21, 60],
    [39, 60],
  ],
  4: [
    [21, 32],
    [39, 32],
    [21, 60],
    [39, 60],
  ],
  5: [
    [19, 30],
    [41, 30],
    [30, 46],
    [19, 62],
    [41, 62],
  ],
  6: [
    [19, 32],
    [30, 32],
    [41, 32],
    [19, 60],
    [30, 60],
    [41, 60],
  ],
  7: [
    [30, 26],
    [19, 46],
    [30, 46],
    [41, 46],
    [19, 66],
    [30, 66],
    [41, 66],
  ],
  8: [
    [19, 26],
    [30, 26],
    [41, 26],
    [25, 46],
    [35, 46],
    [19, 66],
    [30, 66],
    [41, 66],
  ],
  9: [
    [19, 28],
    [30, 28],
    [41, 28],
    [19, 46],
    [30, 46],
    [41, 46],
    [19, 64],
    [30, 64],
    [41, 64],
  ],
};

function Rod({ cx, cy, color }: { cx: number; cy: number; color: string }) {
  return (
    <g>
      <rect x={cx - 3.4} y={cy - 8} width={6.8} height={16} rx={3} fill={color} />
      <line x1={cx - 3.4} y1={cy} x2={cx + 3.4} y2={cy} stroke={TILE_PAPER} strokeWidth={1.6} />
    </g>
  );
}

function Bamboo({ n }: { n: number }) {
  if (n === 1) {
    // The one bamboo: a single ornamental sprout, our drawing — not the
    // traditional bird, which is manufacturer-specific art.
    return (
      <path
        d="M30,24 Q42,36 30,50 Q18,64 30,72 M30,50 Q40,58 30,72 M22,32 Q30,38 38,32"
        fill="none"
        stroke={GREEN}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  return (
    <>
      {BAMBOO_GRIDS[n]!.map(([cx, cy], i) => (
        <Rod
          key={i}
          cx={cx}
          cy={cy}
          color={n === 5 && i === 2 ? RED : n >= 7 && i % 3 === 1 ? RED : GREEN}
        />
      ))}
    </>
  );
}

// ---------- flowers & seasons ----------

/** Four rosettes told apart by petal count: 4 / 5 / 6 / 8. */
function Flower({ n }: { n: number }) {
  const petals = [4, 5, 6, 8][n - 1]!;
  const items = [];
  for (let i = 0; i < petals; i++) {
    const a = (Math.PI * 2 * i) / petals - Math.PI / 2;
    items.push(
      <circle
        key={i}
        cx={30 + Math.cos(a) * 11}
        cy={48 + Math.sin(a) * 11}
        r={6}
        fill="none"
        stroke={RED}
        strokeWidth={3}
      />,
    );
  }
  return (
    <>
      {items}
      <circle cx={30} cy={48} r={4} fill={RED} />
    </>
  );
}

/** Four seasons as weather marks: sun, leaf, snow, sprout. */
function Season({ n }: { n: number }) {
  if (n === 1) {
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * i) / 4;
      rays.push(
        <line
          key={i}
          x1={30 + Math.cos(a) * 14}
          y1={48 + Math.sin(a) * 14}
          x2={30 + Math.cos(a) * 19}
          y2={48 + Math.sin(a) * 19}
          stroke={GREEN}
          strokeWidth={3.5}
          strokeLinecap="round"
        />,
      );
    }
    return (
      <>
        <circle cx={30} cy={48} r={9} fill="none" stroke={GREEN} strokeWidth={3.5} />
        {rays}
      </>
    );
  }
  if (n === 2) {
    return (
      <path
        d="M30,28 Q46,42 30,68 Q14,42 30,28 Z M30,32 V64"
        fill="none"
        stroke={GREEN}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (n === 3) {
    const arms = [];
    for (const deg of [0, 60, 120]) {
      const dx = 17 * Math.cos((deg * Math.PI) / 180);
      const dy = 17 * Math.sin((deg * Math.PI) / 180);
      arms.push(
        <line
          key={deg}
          x1={30 - dx}
          y1={48 - dy}
          x2={30 + dx}
          y2={48 + dy}
          stroke={GREEN}
          strokeWidth={3.5}
          strokeLinecap="round"
        />,
      );
    }
    return (
      <>
        {arms}
        <circle cx={30} cy={48} r={3.5} fill={GREEN} />
      </>
    );
  }
  return (
    <path
      d="M14,54 Q30,30 46,54 M30,38 V70"
      fill="none"
      stroke={GREEN}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ---------- the face ----------

const WIND_GLYPHS: Record<string, string> = {
  e: 'east',
  s: 'south',
  w: 'west',
  n: 'north',
};

function FaceBody({ face }: { face: TileFace }) {
  const suit = face[0];
  const n = Number(face.slice(1));
  if (suit === 'c') {
    return (
      <>
        <KanjiGlyph glyph={`n${n}`} color={INK} x={8} y={8} size={44} width={9} />
        <KanjiGlyph glyph="wan" color={RED} x={8} y={40} size={44} width={8} />
      </>
    );
  }
  if (suit === 'o') return <Dots n={n} />;
  if (suit === 'b') return <Bamboo n={n} />;
  if (suit === 'w') {
    return (
      <KanjiGlyph glyph={WIND_GLYPHS[face[1]!]!} color={INK} x={8} y={14} size={46} width={8} />
    );
  }
  if (face === 'dr')
    return <KanjiGlyph glyph="chun" color={RED} x={8} y={12} size={46} width={9} />;
  if (face === 'dg')
    return <KanjiGlyph glyph="hatsu" color={GREEN} x={8} y={12} size={46} width={7} />;
  if (face === 'dw') {
    return (
      <rect x={12} y={16} width={36} height={52} rx={3} fill="none" stroke={BLUE} strokeWidth={4} />
    );
  }
  if (suit === 'f') return <Flower n={n} />;
  return <Season n={n} />;
}

/** One face, filling its tile. Decorative: the tile button carries the label. */
export function TileFaceSvg({ face }: { face: TileFace }) {
  return (
    <svg className="mj-face" viewBox="0 0 60 80" aria-hidden="true" focusable="false">
      <FaceBody face={face} />
    </svg>
  );
}
