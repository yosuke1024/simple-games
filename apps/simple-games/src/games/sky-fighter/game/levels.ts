/**
 * The difficulty ladder. 100 levels, like the rest of the collection.
 *
 * The shape that matters is *inside* a level, not across the ladder: every
 * level starts the player at one barrel and ends on its hardest wave, so the
 * arc "weak → armed → just barely" happens once per level instead of once per
 * install. Power never carries over, which is what keeps that arc repeatable.
 *
 * Every lever here is continuous in `level` — nothing saturates before 100.
 * An earlier endless build capped enemy count at wave 9 and fall speed at
 * wave 18, after which the game stopped changing; that is the failure this
 * table exists to avoid.
 */
export const LEVEL_COUNT = 100;

function clampLevel(level: number): number {
  return Math.min(LEVEL_COUNT, Math.max(1, Math.floor(level)));
}

/** 0 at level 1, 1 at level 100. */
function progress(level: number): number {
  return (clampLevel(level) - 1) / (LEVEL_COUNT - 1);
}

/** The arc gets longer as well as sharper: 4 waves early, 6 by the end. */
export function wavesInLevel(level: number): number {
  return 4 + Math.floor((clampLevel(level) - 1) / 34);
}

export interface WaveSpec {
  /** Enemies entering this wave. */
  count: number;
  /**
   * Chance a enemy enters at the largest tier. A large enemy becomes seven
   * objects before it is gone (1 → 2 → 4), a medium one three — so this is the
   * lever that raises how crowded the screen gets, not just how fast.
   */
  bigChance: number;
  speedMin: number;
  speedMax: number;
}

export function waveSpec(level: number, waveInLevel: number): WaveSpec {
  const t = progress(level);
  const waves = wavesInLevel(level);
  const index = Math.min(waves - 1, Math.max(0, waveInLevel));
  const isFinal = index === waves - 1;
  // Within a level the waves tighten a little; the last one is the wall.
  const withinLevel = index * 3;
  return {
    count: 2 + Math.round(t * 3) + (isFinal ? 1 : 0),
    bigChance: 0.25 + t * 0.65,
    speedMin: 40 + t * 45 + withinLevel,
    speedMax: 62 + t * 58 + withinLevel,
  };
}
