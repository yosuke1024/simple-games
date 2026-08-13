import type { COLOR_ORDER } from './constants';

/** A bubble's identity. The UI picks the paint color and the inside mark. */
export type BubbleColor = (typeof COLOR_ORDER)[number];

/** Hex-offset grid address. Column range depends on row parity (grid.ts). */
export interface Cell {
  readonly row: number;
  readonly col: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The occupied cells of a board, keyed by `cellKey(cell)` (grid.ts). A plain
 * immutable map rather than a 2D array: cells empty out as bubbles pop and
 * fall, and a sparse structure means "empty" needs no sentinel value.
 */
export type Board = ReadonlyMap<string, BubbleColor>;

/**
 * What `simulateShot` returns (engine.ts). This is the one shape shared by
 * the trajectory guide and the real shot — see engine.ts for why that
 * sharing is load-bearing. `path` is the polyline from launch to landing
 * (a point per wall bounce, plus the endpoints) for the UI to replay; it
 * carries no information about whether the landing pops anything, on
 * purpose — the guide previews where a bubble lands, never what happens
 * next.
 */
export interface ShotResult {
  readonly path: readonly Point[];
  readonly landingCell: Cell;
}

/** What resolving a placement does to the board — used by engine tests. */
export interface ResolveOutcome {
  readonly board: Board;
  readonly popped: readonly Cell[];
  readonly fell: readonly Cell[];
}

export type RunStatus = 'playing' | 'cleared' | 'failed';
