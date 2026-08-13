/**
 * The difficulty ladder. 100 levels, matching the rest of the collection.
 *
 * Three independent levers, not one: the starting stack grows (rows 5 → 9),
 * the color count grows (4 → 6, so same-color neighbors get rarer even
 * before anything is popped), and the ceiling gets impatient (a drop every
 * 8 shots down to every 5). A fourth, gentler lever, `scatterBias`, works
 * inside generator.ts to lean away from handing out free same-color
 * neighbor pairs — it climbs alongside the others so a board never reads as
 * "randomly happens to be easy" at the top of the ladder. It stays modest
 * (0.05 → 0.14) because the other three levers are already the real
 * difficulty, and LOSS_LINE_Y's margin is tight by design (constants.ts) —
 * an aggressively scattered board fights the player at matching *at all*,
 * which autoplay.test.ts caught directly, twice: an early curve (0.15 →
 * 0.70) made the top of the ladder fail a scripted shooter within a few
 * dozen shots outright, and even a much gentler one (0.08 → 0.30) left a
 * handful of the hardest levels short once LOSS_LINE_Y's margin was tuned
 * tight (constants.ts) — the two levers interact, so scatter had to come
 * down again once the runway did.
 *
 * Every lever is continuous in `level`; nothing saturates before 100 (the
 * plan's Phase 2 lesson: Brick Breaker's first prototype capped after 27
 * boards, and this collection tests every ladder for that shape now).
 */
export const LEVEL_COUNT = 100;

function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

/** 0 at level 1, 1 at level 100. */
function progress(level: number): number {
  return (clampLevel(level) - 1) / (LEVEL_COUNT - 1);
}

export interface LevelSpec {
  /** Starting rows filled with bubbles, 5 → 9. */
  rows: number;
  /** Distinct colors in play, 4 → 6 (a prefix of COLOR_ORDER). */
  colorCount: number;
  /** Shots between one ceiling drop and the next, 8 → 5. */
  descentEvery: number;
  /** 0..1: how hard the generator works to avoid handing out easy same-color neighbors. */
  scatterBias: number;
}

export function levelSpec(level: number): LevelSpec {
  const t = progress(level);
  return {
    rows: 5 + Math.round(t * 4),
    colorCount: 4 + Math.round(t * 2),
    descentEvery: 8 - Math.round(t * 3),
    scatterBias: 0.05 + t * 0.09,
  };
}
