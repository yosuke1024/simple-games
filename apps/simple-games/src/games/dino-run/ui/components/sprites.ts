/**
 * Everything on the track, drawn as pictures.
 *
 * The shapes are written out as art rather than as coordinates: a dinosaur
 * made of `[x, y, w, h]` tuples is a dinosaur nobody can see while editing
 * it, and the first two versions of this file proved it — the numbers were
 * plausible and the result read as a duck, then as a horse. Here the source
 * shows what the screen shows, so a head that is too small is visible in the
 * diff.
 *
 * `#` is drawn, `.` is empty, and `o` is a hole punched through the shape —
 * the runner's eye, which the surface shows through (§12).
 *
 * One cell is PIXEL board pixels. Blocky on purpose (§12): at this size
 * squares read better than curves on a cheap phone, the whole board is a few
 * dozen `fillRect` calls per frame, and the shapes stay legible with the
 * accent inverted in dark mode. No sprite sheet, no image to load — an
 * offline game should not wait on bytes to draw its own hero.
 */

/** `[x, y, width, height]`, relative to the shape's own top-left corner. */
export type Rect = readonly [number, number, number, number];

/** Board pixels per cell of art. */
const PIXEL = 2;

/** One rectangle per horizontal run of `ch`; rows stack into solid shapes. */
function runs(rows: readonly string[], ch: string, rowOffset = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== ch) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < row.length && row[end] === ch) end += 1;
      out.push([x * PIXEL, (y + rowOffset) * PIXEL, (end - x) * PIXEL, PIXEL]);
      x = end;
    }
  });
  return out;
}

const drawn = (rows: readonly string[], rowOffset = 0): Rect[] => runs(rows, '#', rowOffset);
/** The eye: empty while the runner is alive, filled in when it crashes. */
const hole = (rows: readonly string[]): Rect[] => runs(rows, 'o');

// ---------- the runner ----------

/**
 * The runner from the hips up — 20×16 cells, so 40×32 board pixels. Big head,
 * short thick neck, a jaw with the mouth open underneath it, and a tail that
 * rises behind: the animal is all in those four things, and at 40px across
 * there is room for nothing else.
 */
const RUNNER_ART = [
  '...........########.',
  '...........##o######',
  '...........#########',
  '...........#########',
  '...........#########',
  '...........#########',
  '..........##########',
  '..........#####.####',
  '###......######.....',
  '#####...########....',
  '######.#########....',
  '.###############....',
  '..###############...',
  '...##############...',
  '...#############....',
  '....###########.....',
];

/** The legs pick up where the body stops, so the two line up by construction. */
const LEG_ROW = RUNNER_ART.length;

/** Two frames of stride, alternating on a beat read off the distance run. */
const RUNNER_LEG_ART: readonly (readonly string[])[] = [
  [
    '....###..#####......',
    '....###..#####......',
    '....###...###.......',
    '.....##...###.......',
    '....####..###.......',
  ],
  [
    '....###..#####......',
    '....###..#####......',
    '....###...###.......',
    '....###....##.......',
    '....###...####......',
  ],
];

/** In the air there is nothing to stride on: both legs straight. */
const RUNNER_LEGS_AIR_ART = [
  '....###..#####......',
  '....###..#####......',
  '....###...###.......',
  '....###...###.......',
  '....###...###.......',
];

export const RUNNER_BODY: readonly Rect[] = drawn(RUNNER_ART);
export const RUNNER_EYE: readonly Rect[] = hole(RUNNER_ART);
export const RUNNER_LEGS: readonly (readonly Rect[])[] = RUNNER_LEG_ART.map((art) =>
  drawn(art, LEG_ROW),
);
export const RUNNER_LEGS_AIR: readonly Rect[] = drawn(RUNNER_LEGS_AIR_ART, LEG_ROW);

// ---------- what stands in the way ----------

/** One saguaro, 9×18 cells — 18×36 board pixels. Two arms, at two heights. */
const CACTUS_SMALL_ART = [
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '.#.###...',
  '.#.###...',
  '.#.###.#.',
  '.#####.#.',
  '...###.#.',
  '...#####.',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
];

/** The big one, 13×25 cells — 26×50. The same plant, half a jump taller. */
const CACTUS_LARGE_ART = [
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '..##.###.....',
  '..##.###.....',
  '..##.###.##..',
  '..######.##..',
  '.....###.##..',
  '.....######..',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
];

/** Shifts a shape sideways, which is all a cluster of cacti is. */
const shifted = (rects: readonly Rect[], dx: number): Rect[] =>
  rects.map(([x, y, w, h]) => [x + dx, y, w, h] as Rect);

const CACTUS_SMALL = drawn(CACTUS_SMALL_ART);
const CACTUS_LARGE = drawn(CACTUS_LARGE_ART);

/**
 * The bird, 23×20 cells — 46×40. Two frames: a wing up and a wing down. That
 * is a beat, and a beat is all it takes to say "this one is flying".
 */
const BIRD_ART: readonly (readonly string[])[] = [
  [
    '.......................',
    '........###............',
    '.......#####...........',
    '.......######..........',
    '......#######..........',
    '......########.........',
    '.....#########.........',
    '.....#############.....',
    '....###############....',
    '...###################.',
    '.....#############.....',
    '.......#######.........',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
  ],
  [
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.......................',
    '.....#############.....',
    '....###############....',
    '...###################.',
    '.....#############.....',
    '.......#######.........',
    '......#######..........',
    '......#######..........',
    '.......#####...........',
    '.......#####...........',
    '........###............',
    '.......................',
    '.......................',
    '.......................',
  ],
];

export const BIRD_FRAMES: readonly (readonly Rect[])[] = BIRD_ART.map((art) => drawn(art));

export const OBSTACLE_SHAPES = {
  'cactus-small': CACTUS_SMALL,
  'cactus-pair': [...CACTUS_SMALL, ...shifted(CACTUS_SMALL, 22)],
  'cactus-trio': [...CACTUS_SMALL, ...shifted(CACTUS_SMALL, 22), ...shifted(CACTUS_SMALL, 44)],
  'cactus-large': CACTUS_LARGE,
  'cactus-large-pair': [...CACTUS_LARGE, ...shifted(CACTUS_LARGE, 30)],
  // The birds have two frames, so the board draws them from BIRD_FRAMES.
  'bird-low': [] as readonly Rect[],
  'bird-high': [] as readonly Rect[],
} as const;

// ---------- the score ----------

/**
 * Digits, 4×6 cells — 8×12 board pixels, drawn on the track itself the way a
 * scoreboard is (§6). Numbers need no translation, and a font would need
 * loading; these are the same rectangles as everything else on the board.
 */
const GLYPH_ART: Record<string, readonly string[]> = {
  '0': ['####', '#..#', '#..#', '#..#', '#..#', '####'],
  '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '####'],
  '2': ['####', '...#', '####', '#...', '#...', '####'],
  '3': ['####', '...#', '.###', '...#', '...#', '####'],
  '4': ['#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '####', '...#', '...#', '####'],
  '6': ['####', '#...', '####', '#..#', '#..#', '####'],
  '7': ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['####', '#..#', '####', '#..#', '#..#', '####'],
  '9': ['####', '#..#', '####', '...#', '...#', '####'],
  H: ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  I: ['###.', '.#..', '.#..', '.#..', '.#..', '###.'],
  ' ': ['....', '....', '....', '....', '....', '....'],
};

export const GLYPHS: Record<string, readonly Rect[]> = Object.fromEntries(
  Object.entries(GLYPH_ART).map(([char, art]) => [char, drawn(art)]),
);

/** One glyph's width, and the gap the board leaves between two of them. */
export const GLYPH_WIDTH = 4 * PIXEL;
export const GLYPH_GAP = PIXEL;

// ---------- the scenery ----------

/** A cloud, 13×5 cells — 26×10. Three blocks; a soft edge would cost a blur. */
export const CLOUD: readonly Rect[] = drawn([
  '...#######...',
  '..#########..',
  '#############',
  '.###########.',
  '..#######....',
]);
