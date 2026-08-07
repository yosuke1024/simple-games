/**
 * What the track is made of, and how it is drawn from a seed
 * (docs/BUNNY_HOP_RULES.md §5).
 *
 * Seven shapes and one question: hop, or don't. The bushes and hedges differ
 * in how early the hop has to start — one bush forgives a late one, three in
 * a row do not — and the birds differ in whether they are a hazard at all:
 * the low one flies straight through the runner and has to be hopped, the
 * high one only ever hits a runner that is already in the air. It is the one
 * obstacle that punishes a reflex.
 *
 * The stream is a pure function of (seed, index): the same run replays the
 * same track, which is what the golden test in compatibility.test.ts pins.
 */
import {
  BIRD_FROM_SCORE,
  CLUSTER_FROM_SCORE,
  HIGH_BIRD_MIN_GAP_SECONDS,
  MAX_GAP_SECONDS,
  MIN_GAP_SECONDS,
} from './constants';
import { createRng } from './rng';
import type { ObstacleKind, ObstacleKindId } from './types';

export const OBSTACLE_KINDS: Record<ObstacleKindId, ObstacleKind> = {
  bush: { id: 'bush', width: 18, height: 36, bottom: 0, flying: false },
  'bush-pair': { id: 'bush-pair', width: 62, height: 36, bottom: 0, flying: false },
  'bush-trio': { id: 'bush-trio', width: 106, height: 36, bottom: 0, flying: false },
  hedge: { id: 'hedge', width: 26, height: 50, bottom: 0, flying: false },
  'hedge-pair': { id: 'hedge-pair', width: 86, height: 50, bottom: 0, flying: false },
  // Low: it flies through the runner, so it has to be hopped like a bush.
  // It is the reason a bird is not automatically something to ignore.
  'bird-low': { id: 'bird-low', width: 46, height: 40, bottom: 6, flying: true },
  // High: clear of a runner on the ground (42px), and only a hop reaches it.
  'bird-high': { id: 'bird-high', width: 46, height: 40, bottom: 58, flying: true },
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
 * own order within three runs. The single bush stays the most common thing on
 * the track at every speed — the run gets faster, not more crowded (§5).
 */
const TABLE: readonly Weighted[] = [
  { id: 'bush', weight: 3, from: 0 },
  { id: 'hedge', weight: 2, from: 0 },
  { id: 'bush-pair', weight: 2, from: 0 },
  { id: 'bush-trio', weight: 1.5, from: CLUSTER_FROM_SCORE },
  { id: 'hedge-pair', weight: 1.5, from: CLUSTER_FROM_SCORE },
  { id: 'bird-low', weight: 2, from: BIRD_FROM_SCORE },
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
