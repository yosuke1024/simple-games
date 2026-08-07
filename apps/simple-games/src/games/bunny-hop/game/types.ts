/** What kinds of thing stand on (or fly over) the track. */
export type ObstacleKindId =
  'bush' | 'bush-pair' | 'bush-trio' | 'hedge' | 'hedge-pair' | 'bird-low' | 'bird-high';

export interface ObstacleKind {
  id: ObstacleKindId;
  width: number;
  height: number;
  /** Height of the shape's underside above the ground; 0 stands on it. */
  bottom: number;
  /** Birds are drawn with beating wings and are the only things that fly. */
  flying: boolean;
}

export interface Obstacle {
  id: number;
  kindId: ObstacleKindId;
  /**
   * The run's distance at the moment this obstacle entered from the right
   * edge. Its position is a function of that and the distance run since, so
   * nothing drifts and a replay of the same steps places it identically.
   */
  spawnDistance: number;
  /** Set once the runner is fully past it, so it is counted exactly once. */
  passed: boolean;
}

/**
 * `ready` is the beat before the first input: the track stands still, so
 * opening the game never costs a run (docs/BUNNY_HOP_RULES.md §2).
 */
export type RunStatus = 'ready' | 'running' | 'over';

export interface GameState {
  seed: string;
  status: RunStatus;
  /** Board pixels run. The score is this divided down (§6). */
  distance: number;
  speed: number;
  /** Height of the runner's feet above the ground; 0 while grounded. */
  runnerY: number;
  /** Vertical speed, positive upwards. */
  runnerVelocity: number;
  obstacles: Obstacle[];
  /** Index into the seed's obstacle stream — the draw's second coordinate. */
  nextObstacleIndex: number;
  /** The distance at which the next obstacle enters from the right edge. */
  nextSpawnDistance: number;
  nextObstacleId: number;
  obstaclesPassed: number;
  score: number;
  /** Milestones crossed so far; the view flashes when this changes (§6). */
  milestones: number;
  elapsedMs: number;
}
