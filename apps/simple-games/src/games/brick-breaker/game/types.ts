/** A plain brick, or one that releases an extra ball when broken. */
export type BrickKind = 'normal' | 'ball';

export interface Brick {
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
  kind: BrickKind;
}

export type BallStatus = 'ready' | 'launched';

export interface Ball {
  x: number;
  y: number;
  dx: number;
  dy: number;
  status: BallStatus;
}

export type RunStatus = 'playing' | 'cleared' | 'failed';

export interface GameState {
  seed: string;
  level: number;
  paddleX: number;
  balls: Ball[];
  bricks: Brick[];
  /** Bricks broken in this level — the ball's speed is a function of this. */
  broken: number;
  /** How far the wall has crept down. Added to every brick's y. */
  descent: number;
  lives: number;
  status: RunStatus;
}
