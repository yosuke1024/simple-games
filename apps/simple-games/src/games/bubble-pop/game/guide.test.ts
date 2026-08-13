/**
 * The trajectory guide's one job (docs/BUBBLE_POP_RULES.md §8): whatever
 * cell it predicts, firing at the same angle from the same board must land
 * there. This file is what turns that promise from a claim into something
 * machine-checked — the collection's first physics golden's sibling, not a
 * static-layout test (Phase 3's "latest convention" note in the plan).
 *
 * The sweep is generated boards × several ceiling offsets × angles across
 * the whole clamp, with landing-cell *transition* boundaries injected
 * explicitly (a uniform sweep alone can straddle a boundary and never land
 * exactly on the angle where the tie-break or a new collision kicks in —
 * see `sweepAngles` below). A single fixed board would only ever exercise
 * one set of transitions; several seeds and levels vary the board shape,
 * the row count, and the color count instead.
 */
import { describe, expect, it } from 'vitest';
import { AIM_MAX_ANGLE_FROM_VERTICAL } from './constants';
import { placeAndResolve, simulateShot } from './engine';
import { buildBoard } from './generator';
import { cellKey } from './grid';
import { aimGuide, createSession, fireShot, type BubblePopSession } from './session';
import type { Board } from './types';

const BOARDS: ReadonlyArray<{ seed: string; level: number }> = [
  { seed: 'guide-a', level: 1 },
  { seed: 'guide-a', level: 12 },
  { seed: 'guide-b', level: 55 },
  { seed: 'guide-c', level: 100 },
];

const CEILING_OFFSETS = [0, 1, 2, 4, 7];

/**
 * A uniform sweep across the clamp, plus every angle where the landing cell
 * changes — found by bisecting each transition the coarse pass turns up —
 * plus the exact clamp boundary and 0. This is what "explicitly include the
 * boundary angles" (the plan's wording) means made concrete: the boundaries
 * are discovered per board rather than guessed by hand.
 */
function sweepAngles(board: Board, ceilingOffset: number): number[] {
  const angles = new Set<number>([0, AIM_MAX_ANGLE_FROM_VERTICAL, -AIM_MAX_ANGLE_FROM_VERTICAL]);
  const coarseStep = (2 * AIM_MAX_ANGLE_FROM_VERTICAL) / 90;
  let prevKey: string | null = null;
  let prevAngle = -AIM_MAX_ANGLE_FROM_VERTICAL;
  for (let a = -AIM_MAX_ANGLE_FROM_VERTICAL; a <= AIM_MAX_ANGLE_FROM_VERTICAL; a += coarseStep) {
    angles.add(a);
    const key = cellKey(simulateShot(board, ceilingOffset, a).landingCell);
    if (prevKey !== null && key !== prevKey) {
      let lo = prevAngle;
      let hi = a;
      const loKey = prevKey;
      for (let i = 0; i < 24; i++) {
        const mid = (lo + hi) / 2;
        const midKey = cellKey(simulateShot(board, ceilingOffset, mid).landingCell);
        if (midKey === loKey) lo = mid;
        else hi = mid;
      }
      angles.add(lo);
      angles.add(hi);
    }
    prevKey = key;
    prevAngle = a;
  }
  return [...angles];
}

describe('the guide and the real shot always agree', () => {
  for (const { seed, level } of BOARDS) {
    for (const ceilingOffset of CEILING_OFFSETS) {
      // The 60s timeout: Level 100's board (9 rows, 6 colors) plus
      // sweepAngles's boundary bisection is the heaviest case here (measured
      // 3-5s running alone, well past vitest's default 5s per-test timeout).
      // Kept generous rather than snug: running inside the full repo suite
      // under shared CPU load is measurably slower than running this file
      // alone (autoplay.test.ts's comment has the numbers), and this gate is
      // about correctness, not speed.
      it(`seed=${seed} level=${level} ceilingOffset=${ceilingOffset}`, () => {
        const board = buildBoard(seed, level);
        const base = createSession(seed, level);
        // Pinning board/ceilingOffset directly (rather than playing shots
        // to get there) is what lets this test sweep every offset against
        // every board independently of how many shots a real game would
        // take to reach that offset.
        const session: BubblePopSession = { ...base, board, ceilingOffset };

        for (const angle of sweepAngles(board, ceilingOffset)) {
          const guess = aimGuide(session, angle);
          // What fireShot must produce if it truly reads the guide's own
          // board and offset: place the guide's predicted cell and resolve.
          const expectedBoard = placeAndResolve(board, guess.landingCell, session.current).board;
          const actualBoard = fireShot(session, angle).board;
          expect(actualBoard).toEqual(expectedBoard);
        }
      }, 60_000);
    }
  }
});

describe('the guide never mutates and is stable under repeated calls', () => {
  it('calling aimGuide repeatedly with the same inputs never drifts', () => {
    const board = buildBoard('guide-stability', 40);
    const base = createSession('guide-stability', 40);
    const session: BubblePopSession = { ...base, board, ceilingOffset: 2 };
    for (const angle of [-1.1, -0.4, 0, 0.4, 1.1]) {
      const a = aimGuide(session, angle);
      const b = aimGuide(session, angle);
      expect(a).toEqual(b);
    }
    expect(session.board).toBe(board);
  });
});
