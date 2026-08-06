/**
 * Everything on the track, as lists of rectangles.
 *
 * Blocky on purpose (docs/DINO_RUN_RULES.md §12): a runner at 24×38 px on a
 * cheap phone reads better as a handful of squares than as a curve, the whole
 * board is a few dozen `fillRect` calls per frame, and the shapes stay legible
 * with the accent inverted in dark mode. No sprite sheet, no image to load —
 * an offline game should not wait on bytes to draw its own hero.
 *
 * Coordinates are `[x, y, width, height]` inside the shape's own box, with y
 * measured **down** from the top of that box. The board places the box; the
 * shapes never know where they are.
 */
export type Rect = readonly [number, number, number, number];

// ---------- the runner ----------

/** Head, neck, body, tail and arm — the parts that never move. */
export const RUNNER_BODY: readonly Rect[] = [
  [12, 0, 12, 12],
  [12, 12, 7, 6],
  [3, 18, 16, 11],
  [0, 16, 4, 7],
  [19, 19, 4, 3],
];

/** Punched out of the head in the surface colour, so the runner has an eye. */
export const RUNNER_EYE: Rect = [19, 3, 3, 3];

/** The two strides, alternating on a fixed beat while the runner is grounded. */
export const RUNNER_LEGS: readonly (readonly Rect[])[] = [
  [
    [5, 29, 4, 9],
    [12, 29, 4, 6],
    [12, 35, 7, 3],
  ],
  [
    [5, 29, 4, 6],
    [5, 35, 7, 3],
    [12, 29, 4, 9],
  ],
];

/** Both legs tucked: the pose in the air, where there is nothing to stride on. */
export const RUNNER_LEGS_AIR: readonly Rect[] = [
  [5, 29, 4, 7],
  [12, 29, 4, 7],
];

/** Ducking: the same animal, flattened. Box is 34×21. */
export const DUCK_BODY: readonly Rect[] = [
  [22, 0, 12, 10],
  [3, 5, 20, 11],
  [0, 3, 4, 7],
];

export const DUCK_EYE: Rect = [29, 2, 3, 3];

export const DUCK_LEGS: readonly (readonly Rect[])[] = [
  [
    [7, 16, 4, 5],
    [15, 16, 4, 5],
  ],
  [
    [9, 16, 4, 5],
    [17, 16, 4, 5],
  ],
];

// ---------- what stands in the way ----------

/**
 * One cactus, 15×30 — trunk and two arms. The arms are long: at this size an
 * arm that only pokes out reads as a stray pixel, and the silhouette is the
 * whole warning the player gets.
 */
const CACTUS_SMALL: readonly Rect[] = [
  [5, 0, 5, 30],
  [1, 6, 4, 12],
  [1, 14, 5, 4],
  [10, 3, 4, 12],
  [9, 11, 5, 4],
];

/** The tall one, 18×42. Same plant, a jump's worth taller. */
const CACTUS_TALL: readonly Rect[] = [
  [6, 0, 6, 42],
  [1, 8, 4, 16],
  [1, 20, 6, 4],
  [13, 4, 4, 16],
  [11, 16, 6, 4],
];

/** Shifts a shape sideways, which is all a cluster of cacti is. */
const shifted = (rects: readonly Rect[], dx: number): Rect[] =>
  rects.map(([x, y, w, h]) => [x + dx, y, w, h] as Rect);

/** Two side by side, 32×30. */
const CACTUS_PAIR: readonly Rect[] = [...CACTUS_SMALL, ...shifted(CACTUS_SMALL, 17)];

/** Three side by side, 47×30 — the widest thing a single jump has to clear. */
const CACTUS_WIDE: readonly Rect[] = [
  ...CACTUS_SMALL,
  ...shifted(CACTUS_SMALL, 16),
  ...shifted(CACTUS_SMALL, 32),
];

/** The bird, 28×18, without its wing. */
const BIRD_BODY: readonly Rect[] = [
  [7, 6, 14, 6],
  [19, 4, 7, 6],
  [25, 6, 3, 2],
  [4, 5, 4, 4],
];

/** Wing up, then wing down: two frames are a beat, and a beat is enough. */
export const BIRD_WINGS: readonly Rect[] = [
  [9, 0, 10, 6],
  [9, 12, 10, 6],
];

export const OBSTACLE_SHAPES = {
  'cactus-small': CACTUS_SMALL,
  'cactus-tall': CACTUS_TALL,
  'cactus-pair': CACTUS_PAIR,
  'cactus-wide': CACTUS_WIDE,
  'bird-low': BIRD_BODY,
  'bird-mid': BIRD_BODY,
  'bird-high': BIRD_BODY,
} as const;

// ---------- the scenery ----------

/** A cloud, 26×10. Three blocks, because a soft edge would cost a gradient. */
export const CLOUD: readonly Rect[] = [
  [6, 0, 14, 4],
  [0, 4, 26, 4],
  [4, 8, 16, 2],
];
