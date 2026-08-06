/**
 * What the track is made of, and how it is drawn from a seed
 * (docs/DINO_RUN_RULES.md §5).
 *
 * Seven shapes, and each one asks exactly one question:
 *
 *   the four cacti — jump, and the wide one asks whether you jumped early
 *     enough rather than whether you jumped at all;
 *   the low bird — jump, because ducking still leaves the runner in its path;
 *   the mid bird — duck, because it flies at head height;
 *   the high bird — do nothing, because it only ever hits a runner in the
 *     air. It is the one obstacle that punishes a reflex.
 *
 * The stream is a pure function of (seed, index): the same run replays the
 * same track, which is what the golden test in compatibility.test.ts pins.
 */
import {
  BIRD_FROM_SCORE,
  HIGH_BIRD_MIN_GAP_SECONDS,
  MAX_GAP_SECONDS,
  MIN_GAP_SECONDS,
  WIDE_CACTUS_FROM_SCORE,
} from './constants';
import { createRng } from './rng';
import type { ObstacleKind, ObstacleKindId } from './types';

export const OBSTACLE_KINDS: Record<ObstacleKindId, ObstacleKind> = {
  'cactus-small': { id: 'cactus-small', width: 15, height: 30, bottom: 0, flying: false },
  'cactus-tall': { id: 'cactus-tall', width: 18, height: 42, bottom: 0, flying: false },
  'cactus-pair': { id: 'cactus-pair', width: 32, height: 30, bottom: 0, flying: false },
  'cactus-wide': { id: 'cactus-wide', width: 47, height: 30, bottom: 0, flying: false },
  // The three birds are the same bird at three heights — the only thing that
  // differs is what it asks of the runner, and that is exactly what its
  // height on screen says.
  //
  // Low: a ducking runner (21px tall) is still inside it, so this one has to
  // be jumped. It is the reason ducking is not a free answer to everything.
  'bird-low': { id: 'bird-low', width: 28, height: 18, bottom: 4, flying: true },
  // Head height for a standing runner (38px), clear of a ducking one.
  'bird-mid': { id: 'bird-mid', width: 28, height: 18, bottom: 26, flying: true },
  // Above a standing runner entirely. Only a jump can reach it.
  'bird-high': { id: 'bird-high', width: 28, height: 18, bottom: 52, flying: true },
};

export const obstacleKind = (id: ObstacleKindId): ObstacleKind => OBSTACLE_KINDS[id];

interface Weighted {
  id: ObstacleKindId;
  weight: number;
  /** The score from which this shape may appear at all. */
  from: number;
}

/**
 * Weights, not a rotation: a track that cycles through the shapes teaches its
 * own order within three runs. The openings stay the most common thing on the
 * track at every speed — the run gets faster, not more crowded (§5).
 */
const TABLE: readonly Weighted[] = [
  { id: 'cactus-small', weight: 3, from: 0 },
  { id: 'cactus-tall', weight: 2, from: 0 },
  { id: 'cactus-pair', weight: 2, from: 0 },
  { id: 'cactus-wide', weight: 2, from: WIDE_CACTUS_FROM_SCORE },
  { id: 'bird-low', weight: 1.5, from: BIRD_FROM_SCORE },
  { id: 'bird-mid', weight: 2, from: BIRD_FROM_SCORE },
  { id: 'bird-high', weight: 1, from: BIRD_FROM_SCORE },
];

export interface Draw {
  kindId: ObstacleKindId;
  /**
   * Seconds of running between this obstacle's trailing edge and the next
   * obstacle's leading edge. Seconds rather than pixels, so the same gap
   * stays the same choice at every speed (§5).
   */
  gapSeconds: number;
}

/**
 * The `index`-th obstacle of `seed`'s track, and the room after it.
 * `score` is the run's score when it enters, and only ever unlocks shapes.
 */
export function drawObstacle(seed: string, index: number, score: number): Draw {
  const rng = createRng(`${seed}:obstacle:${index}`);
  const available = TABLE.filter((entry) => score >= entry.from);
  const total = available.reduce((sum, entry) => sum + entry.weight, 0);

  let roll = rng() * total;
  let kindId: ObstacleKindId = available[0]!.id;
  for (const entry of available) {
    roll -= entry.weight;
    if (roll <= 0) {
      kindId = entry.id;
      break;
    }
  }

  // The high bird's extra room goes behind it: it is harmless overhead, and
  // what would make it unfair is being forced to jump — for the next thing on
  // the track — while it is still there.
  const gap = MIN_GAP_SECONDS + rng() * (MAX_GAP_SECONDS - MIN_GAP_SECONDS);
  const gapSeconds = kindId === 'bird-high' ? Math.max(gap, HIGH_BIRD_MIN_GAP_SECONDS) : gap;
  return { kindId, gapSeconds };
}
