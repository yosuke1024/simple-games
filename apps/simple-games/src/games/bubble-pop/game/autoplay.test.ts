/**
 * Every one of the 100 levels must be clearable, and clearable without the
 * ceiling ever stalling progress — the same promise Brick Breaker's design
 * carries, but (per the plan's Phase 3 "lesson" note) not a test this
 * collection can reuse: Brick Breaker's 96-second vertical-bounce loop was
 * found by hand and fixed structurally (the wall's own descent), leaving no
 * CI-resident autoplay test behind to borrow. This one is new.
 *
 * The shooter is a seeded, deterministic greedy: for every reachable landing
 * cell (found by sweeping the clamped angle range through the *exact same*
 * `aimGuide` a real UI would call), it scores placing the current color and
 * the next color there — popped + fallen bubbles first, then same-color
 * neighbors (progress toward a future pop), then a bias toward the cell
 * nearest the ceiling — and fires whichever (color, angle) pair scores
 * highest, swapping current/next first when the next color wins (the free,
 * unlimited swap is not cosmetic — §8's fallback is genuinely "swap when it
 * reads better"). This is not a search or a solver: it never looks more than
 * one shot ahead, and it is not claimed to be optimal play. What it
 * demonstrates is a *lower bound*: if this simple a shooter clears every
 * level, the level was never a trap that only a perfect player could escape.
 *
 * The gate is workload, not wall-clock (docs/plans's Sudoku §7 discipline,
 * cited directly by the plan for this game): each level gets a fixed shot
 * budget (SHOT_BUDGET) and the test fails a level that does not reach
 * 'cleared' inside it, never on how long the run took.
 */
import { describe, expect, it } from 'vitest';
import { AIM_MAX_ANGLE_FROM_VERTICAL } from './constants';
import { placeAndResolve } from './engine';
import { cellKey, neighborsOf } from './grid';
import { LEVEL_COUNT } from './levels';
import { aimGuide, createSession, fireShot, swapNext, type BubblePopSession } from './session';
import type { BubbleColor, Cell } from './types';

const ANGLE_STEP = (3 * Math.PI) / 180;
/** Generous relative to every measured level (worst case seen: ~130 shots). */
const SHOT_BUDGET = 320;

function scoreCellForColor(session: BubblePopSession, cell: Cell, color: BubbleColor): number {
  let sameColorNeighbors = 0;
  for (const neighbor of neighborsOf(cell)) {
    if (session.board.get(cellKey(neighbor)) === color) sameColorNeighbors++;
  }
  // A cell with no same-color neighbor can never pop or drop anything this
  // shot, so the (relatively) expensive resolve is worth skipping — this is
  // the shooter being efficient, not the game being easier to search.
  let cleared = 0;
  if (sameColorNeighbors > 0) {
    const outcome = placeAndResolve(session.board, cell, color);
    cleared = outcome.popped.length + outcome.fell.length;
  }
  return cleared * 10_000 + sameColorNeighbors * 100 - cell.row;
}

/** One greedy shot: sweep the guide once, score both dispensed colors per landing cell. */
function playOneShot(session: BubblePopSession): BubblePopSession {
  let bestAngle = 0;
  let bestScore = -Infinity;
  let bestUsesNext = false;
  const seenCells = new Set<string>();

  for (let angle = -AIM_MAX_ANGLE_FROM_VERTICAL; angle <= AIM_MAX_ANGLE_FROM_VERTICAL; angle += ANGLE_STEP) {
    const cell = aimGuide(session, angle).landingCell;
    const key = cellKey(cell);
    if (seenCells.has(key)) continue; // several angles often land the same cell
    seenCells.add(key);

    const currentScore = scoreCellForColor(session, cell, session.current);
    if (currentScore > bestScore) {
      bestScore = currentScore;
      bestAngle = angle;
      bestUsesNext = false;
    }
    const nextScore = scoreCellForColor(session, cell, session.next);
    if (nextScore > bestScore) {
      bestScore = nextScore;
      bestAngle = angle;
      bestUsesNext = true;
    }
  }

  const aimed = bestUsesNext ? swapNext(session) : session;
  return fireShot(aimed, bestAngle);
}

function playLevel(seed: string, level: number): { status: string; shots: number } {
  let session = createSession(seed, level);
  let shots = 0;
  while (session.status === 'playing' && shots < SHOT_BUDGET) {
    session = playOneShot(session);
    shots++;
  }
  return { status: session.status, shots };
}

describe('every level is clearable by a one-shot-lookahead greedy shooter', () => {
  it(
    'levels 1 through 100 all reach "cleared" inside the shot budget',
    () => {
      const stuck: number[] = [];
      for (let level = 1; level <= LEVEL_COUNT; level++) {
        const { status } = playLevel('autoplay-seed', level);
        if (status !== 'cleared') stuck.push(level);
      }
      // Every level, named — a single failing assertion with the full list
      // is more useful here than failing fast on the first stuck level.
      expect(stuck).toEqual([]);
    },
    // Generous, not tight: this file's own gate is SHOT_BUDGET (workload),
    // never wall-clock — this timeout only keeps vitest itself from killing
    // a healthy run early. Measured 160-230s running alone; running inside
    // the full repo suite under shared CPU load pushed one run past a 5
    // minute timeout at 324s, the exact wall-clock skew Sudoku's §7 warns
    // about (parallel runs can be off by up to 41x) — so this stays well
    // above any single measurement rather than snug against it.
    10 * 60 * 1000,
  );

  it(
    'a level never fails from starvation — the greedy always makes forward progress',
    () => {
      // The board can only ever shrink or grow by exactly one placement per
      // shot before resolution; across a whole clear, more must have been
      // removed than the starting board held, which is only possible if pops
      // and drops did real work throughout the run (a shooter that only ever
      // added bubbles could never clear a board of any size).
      for (const level of [1, 50, 100]) {
        const session = createSession('autoplay-seed', level);
        const startingSize = session.board.size;
        const { status, shots } = playLevel('autoplay-seed', level);
        expect(status).toBe('cleared');
        expect(shots).toBeGreaterThan(0);
        expect(shots).toBeLessThan(startingSize + SHOT_BUDGET);
      }
    },
    3 * 60 * 1000,
  );
});
