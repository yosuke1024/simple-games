/**
 * Everything on the track, drawn as pictures.
 *
 * The shapes are written out as art rather than as coordinates: a dinosaur
 * made of `[x, y, w, h]` tuples is a dinosaur nobody can see while editing
 * it, and the first version of this file proved it — the numbers were
 * plausible and the result did not read as an animal. Here the source shows
 * what the screen shows, so a head that is too small is visible in the diff.
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
function runs(rows: readonly string[], ch: string): Rect[] {
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
      out.push([x * PIXEL, y * PIXEL, (end - x) * PIXEL, PIXEL]);
      x = end;
    }
  });
  return out;
}

const drawn = (rows: readonly string[]): Rect[] => runs(rows, '#');
/** The eye: empty while the runner is alive, filled in when it crashes. */
const hole = (rows: readonly string[]): Rect[] => runs(rows, 'o');

// ---------- the runner ----------

/**
 * Standing: head, jaw, neck, body, tail and the one small arm — 19×20 cells,
 * so 38×40 board pixels. Everything above the hips; the legs are separate
 * because they are the only part that moves.
 */
const RUNNER_ART = [
  '..........########.',
  '..........#########',
  '..........###o#####',
  '..........#########',
  '..........#####.###',
  '..........#####....',
  '.........######....',
  '..##.....######....',
  '..####..#######....',
  '..#####.########...',
  '..###############..',
  '...##############..',
  '....#############..',
  '....###########....',
  '....##########.....',
];

export const RUNNER_BODY: readonly Rect[] = drawn(RUNNER_ART);
export const RUNNER_EYE: readonly Rect[] = hole(RUNNER_ART);

/**
 * The stride, two frames: one leg planted, the other lifted, then swapped.
 * They start at row 15 of the same picture, so they line up with the body
 * without any offset arithmetic.
 */
const LEG_ROWS = 15;

const RUNNER_LEG_ART: readonly (readonly string[])[] = [
  [
    '....##...##........',
    '....##...##........',
    '....##...###.......',
    '....##.............',
    '...###.............',
  ],
  [
    '....##...##........',
    '....##...##........',
    '...###...##........',
    '.........##........',
    '.........###.......',
  ],
];

/** In the air there is nothing to stride on: both legs tucked, no feet. */
const RUNNER_LEGS_AIR_ART = [
  '....##...##........',
  '....##...##........',
  '....##...##........',
  '....##...##........',
  '...................',
];

const withLegOffset = (rects: readonly Rect[]): Rect[] =>
  rects.map(([x, y, w, h]) => [x, y + LEG_ROWS * PIXEL, w, h] as Rect);

export const RUNNER_LEGS: readonly (readonly Rect[])[] = RUNNER_LEG_ART.map((art) =>
  withLegOffset(drawn(art)),
);

export const RUNNER_LEGS_AIR: readonly Rect[] = withLegOffset(drawn(RUNNER_LEGS_AIR_ART));

/**
 * Ducking: the same animal flattened — 22×11 cells, so 44×22 board pixels.
 * The head drops to the height a bird flies over, which is the whole point of
 * the pose, and the legs keep striding underneath.
 */
const DUCK_ART = [
  '..............########',
  '.###..........########',
  '.####.........#####o##',
  '..####################',
  '...###################',
  '....#################.',
  '....###############...',
];

export const DUCK_BODY: readonly Rect[] = drawn(DUCK_ART);
export const DUCK_EYE: readonly Rect[] = hole(DUCK_ART);

const DUCK_LEG_ROWS = 7;

const DUCK_LEG_ART: readonly (readonly string[])[] = [
  [
    '....##....##..........',
    '....##....##..........',
    '...###....##..........',
    '......................',
  ],
  [
    '....##....##..........',
    '....##....##..........',
    '....##...###..........',
    '......................',
  ],
];

export const DUCK_LEGS: readonly (readonly Rect[])[] = DUCK_LEG_ART.map((art) =>
  drawn(art).map(([x, y, w, h]) => [x, y + DUCK_LEG_ROWS * PIXEL, w, h] as Rect),
);

// ---------- what stands in the way ----------

/** One saguaro, 9×15 cells — 18×30 board pixels. Two arms, at two heights. */
const CACTUS_SMALL_ART = [
  '...###...',
  '...###...',
  '...###...',
  '##.###...',
  '##.###.##',
  '##.###.##',
  '######.##',
  '...###.##',
  '...######',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
];

/** The tall one, 9×21 cells — 18×42. The same plant, a jump's worth taller. */
const CACTUS_TALL_ART = [
  '...###...',
  '...###...',
  '...###...',
  '##.###...',
  '##.###.##',
  '##.###.##',
  '##.###.##',
  '######.##',
  '...###.##',
  '...######',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
  '...###...',
];

/** Shifts a shape sideways, which is all a cluster of cacti is. */
const shifted = (rects: readonly Rect[], dx: number): Rect[] =>
  rects.map(([x, y, w, h]) => [x + dx, y, w, h] as Rect);

const CACTUS_SMALL = drawn(CACTUS_SMALL_ART);

/** Two side by side, 40×30. */
const CACTUS_PAIR: readonly Rect[] = [...CACTUS_SMALL, ...shifted(CACTUS_SMALL, 22)];

/** Three side by side, 58×30 — the widest thing a single jump has to clear. */
const CACTUS_WIDE: readonly Rect[] = [
  ...CACTUS_SMALL,
  ...shifted(CACTUS_SMALL, 20),
  ...shifted(CACTUS_SMALL, 40),
];

/**
 * The bird, 14×9 cells — 28×18. Two frames and no more: a wing up and a wing
 * down is a beat, and a beat is enough to say "this one is flying".
 */
const BIRD_ART: readonly (readonly string[])[] = [
  [
    '...##.........',
    '..####........',
    '.######.......',
    '.#######......',
    '..###########.',
    '..############',
    '...########...',
    '..............',
    '..............',
  ],
  [
    '..............',
    '..............',
    '..............',
    '..#####.......',
    '..###########.',
    '..############',
    '.#########....',
    '.########.....',
    '..#####.......',
  ],
];

export const BIRD_FRAMES: readonly (readonly Rect[])[] = BIRD_ART.map(drawn);

export const OBSTACLE_SHAPES = {
  'cactus-small': CACTUS_SMALL,
  'cactus-tall': drawn(CACTUS_TALL_ART),
  'cactus-pair': CACTUS_PAIR,
  'cactus-wide': CACTUS_WIDE,
  // The birds are drawn from BIRD_FRAMES instead — they are the only thing on
  // the track with more than one frame.
  'bird-low': [],
  'bird-mid': [],
  'bird-high': [],
} as const;

// ---------- the scenery ----------

/** A cloud, 13×5 cells — 26×10. Three blocks; a soft edge would cost a blur. */
export const CLOUD: readonly Rect[] = drawn([
  '...#######...',
  '..#########..',
  '#############',
  '.###########.',
  '..#######....',
]);
