/**
 * Everything on the track, drawn as pictures.
 *
 * The shapes are written out as art rather than as coordinates: an animal
 * made of `[x, y, w, h]` tuples is an animal nobody can see while editing it,
 * and three drawings of an earlier runner proved it — the numbers were
 * plausible every time and the result read as a duck, then as a horse. Here
 * the source shows what the screen shows, so a head that is too small is
 * visible in the diff.
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
 * The rabbit from the hips up — 20×18 cells, so 40×36 board pixels.
 *
 * A silhouette this small can carry one identifying feature, and the ears are
 * it: two bars standing clear of everything else, readable at 40px, in one
 * flat colour, in both themes. Everything else — round head, snout, rounded
 * back, tail — only has to not fight them.
 */
const RUNNER_ART = [
  '............##.##...',
  '............##.##...',
  '............##.##...',
  '............##.##...',
  '............##.##...',
  '............#####...',
  '...........#######..',
  '...........########.',
  '...........#####o###',
  '...........#########',
  '..........##########',
  '......#############.',
  '...################.',
  '###################.',
  '##################..',
  '.#################..',
  '..###############...',
  '...#############....',
];

/** The legs pick up where the body stops, so the two line up by construction. */
const LEG_ROW = RUNNER_ART.length;

/**
 * The bound, two frames: gathered, then pushed off. A rabbit does not run,
 * it hops — so the beat is the hop, and the pose in the air is the stretch
 * between the two.
 */
const RUNNER_LEG_ART: readonly (readonly string[])[] = [
  ['...#####....####....', '...#####....####....', '..#######..#####....'],
  ['..#####......####...', '..#####......####...', '.#######....######..'],
];

/** Mid-hop: hind legs trailing, front paws reaching. */
const RUNNER_LEGS_AIR_ART = [
  '.######......#####..',
  '.#####........#####.',
  '....................',
];

export const RUNNER_BODY: readonly Rect[] = drawn(RUNNER_ART);
export const RUNNER_EYE: readonly Rect[] = hole(RUNNER_ART);
export const RUNNER_LEGS: readonly (readonly Rect[])[] = RUNNER_LEG_ART.map((art) =>
  drawn(art, LEG_ROW),
);
export const RUNNER_LEGS_AIR: readonly Rect[] = drawn(RUNNER_LEGS_AIR_ART, LEG_ROW);

// ---------- what stands in the way ----------

/** A bush, 9×18 cells — 18×36 board pixels. Leaves on a short stem, with the
    edge broken in two places so it reads as foliage and not as a balloon. */
const BUSH_ART = [
  '...###...',
  '..#####..',
  '.#######.',
  '#########',
  '#########',
  '#########',
  '########.',
  '#########',
  '#########',
  '#########',
  '.########',
  '#########',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '...###...',
  '...###...',
];

/**
 * A hedge, 13×25 cells — 26×50. The same leaves as the bush, grown into a
 * wall: at a glance it is "the tall one", which is the only thing about it
 * the player has to read while running at it.
 */
const HEDGE_ART = [
  '....#####....',
  '..#########..',
  '.###########.',
  '#############',
  '#############',
  '############.',
  '#############',
  '#############',
  '.############',
  '#############',
  '#############',
  '#############',
  '############.',
  '#############',
  '#############',
  '.############',
  '#############',
  '#############',
  '#############',
  '.###########.',
  '..#########..',
  '....#####....',
  '.....###.....',
  '.....###.....',
  '.....###.....',
];

/**
 * Shifts a shape sideways, which is all a row of bushes is. `cells`, not
 * pixels: everything else in this file is written in cells, and mixing the
 * two units here once drew clusters narrower than their own hitboxes.
 */
const shifted = (rects: readonly Rect[], cells: number): Rect[] =>
  rects.map(([x, y, w, h]) => [x + cells * PIXEL, y, w, h] as Rect);

const BUSH = drawn(BUSH_ART);
const HEDGE = drawn(HEDGE_ART);

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
    '....###############....',
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
    '....###############....',
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

/**
 * Where to draw a bird relative to its box (§7). The box is the body — the
 * part both frames always draw — because the wing is up in one frame and down
 * in the other, and a box around the whole picture would kill a runner that
 * visibly cleared the bird by ten pixels. The wing hangs outside the box, and
 * never hits anything.
 */
export const BIRD_DRAW_OFFSET_X = -4 * PIXEL;
export const BIRD_DRAW_OFFSET_Y = -8 * PIXEL;

export const OBSTACLE_SHAPES = {
  bush: BUSH,
  // The offsets put the last shape's right edge exactly on the kind's
  // declared width (game/obstacles.ts): 9 + 13 + 9 cells is 62px, and so on.
  'bush-pair': [...BUSH, ...shifted(BUSH, 22)],
  'bush-trio': [...BUSH, ...shifted(BUSH, 22), ...shifted(BUSH, 44)],
  hedge: HEDGE,
  'hedge-pair': [...HEDGE, ...shifted(HEDGE, 30)],
  // The birds have two frames, so the board draws them from BIRD_FRAMES.
  'bird-low': [] as readonly Rect[],
  'bird-high': [] as readonly Rect[],
} as const;

// ---------- the carrot ----------

/**
 * The carrot, 7×11 cells — 14×22 board pixels, exactly the box
 * (game/constants.ts, CARROT_WIDTH/CARROT_HEIGHT). A leafy top, spread wide
 * enough to reach both edges of the box, over a root that tapers to a point
 * at the bottom edge: the two features that read as "carrot" and not "orange
 * rectangle" at this size, in one flat colour.
 */
const CARROT_ART = [
  '#.....#',
  '.#...#.',
  '..#.#..',
  '.#####.',
  '#######',
  '.#####.',
  '.#####.',
  '..###..',
  '..###..',
  '...#...',
  '...#...',
];

export const CARROT: readonly Rect[] = drawn(CARROT_ART);

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

/**
 * The personal-best post (§6): a pennant on a stick, planted on the track at
 * the distance the best run reached. Drawn in soft ink, like the clouds and
 * the pebbles — a landmark on the course, not a hazard and not a prize.
 */
const BEST_FLAG_ART = [
  '#....',
  '####.',
  '#####',
  '#####',
  '####.',
  '#....',
  '#....',
  '#....',
  '#....',
  '#....',
  '#....',
  '#....',
];
export const BEST_FLAG: readonly Rect[] = drawn(BEST_FLAG_ART);
export const BEST_FLAG_WIDTH = 5 * PIXEL;
export const BEST_FLAG_HEIGHT = BEST_FLAG_ART.length * PIXEL;
