/**
 * Every one of the 100 shipped levels (BOARD_SEED = 'bubble-pop-v1') must be
 * clearable — the same promise Brick Breaker's design carries, but (per the
 * plan's Phase 3 "lesson" note) not a test this collection can reuse: Brick
 * Breaker's 96-second vertical-bounce loop was found by hand and fixed
 * structurally (the wall's own descent), leaving no CI-resident autoplay
 * test behind to borrow. This one is new.
 *
 * The claim is scoped to BOARD_SEED, not to seeds in general (constants.ts's
 * LOSS_LINE_Y comment has the full reasoning): a level's identity is
 * (BOARD_SEED, level), pinned by compatibility.test.ts's golden, and this
 * file proves exactly that frozen set of 100 boards is clearable. Changing
 * BOARD_SEED, the rng, the generator, or the board geometry already fails
 * the golden and ships new levels — at which point this file has to be
 * re-run (and will be, automatically, on every change) before the new
 * boards can be trusted.
 *
 * The shooter is a seeded, deterministic greedy with a one-shot-lookahead
 * fallback:
 *   - For every reachable landing cell (found by sweeping the clamped angle
 *     range through the *exact same* `aimGuide` a real UI would call — the
 *     branching factor here is small: a mostly-full board only exposes a
 *     handful of frontier cells no matter how fine the sweep, confirmed by
 *     comparing 1.5° against a 0.1° sweep on shipped boards), score placing
 *     the current color and the next color there. The score favors clearing
 *     *deep* rows over shallow ones (`removalWeight`, weighted by row²) —
 *     the loss line only cares about the deepest surviving row, so a large
 *     shallow pop that leaves the dangerous bottom untouched is worth less
 *     than a small one that reaches it.
 *   - When the single best-scoring placement doesn't pop or drop anything
 *     (a pure "build" shot — no cell reachable this turn has a same-color
 *     neighbor for either dispensed color), spending a second-ply lookahead
 *     on the top few candidates is worth the cost: evaluate what the *best*
 *     next-shot score would be after each, and prefer whichever build sets
 *     up the strongest follow-up rather than just the shallowest cell. When
 *     an immediate pop is available, take it — a bird in hand beats a
 *     modeled one.
 *   - The free, unlimited current/next swap (§8) is not cosmetic: every
 *     candidate is scored for *both* dispensed colors, and the shooter
 *     swaps whenever the next color's best placement outscores the
 *     current's.
 *
 * This is not a search or a solver, and it is not claimed to be optimal
 * play — it never looks more than one shot past the immediate choice. What
 * it demonstrates is a *lower bound*: if this shooter clears every shipped
 * level, no level is a trap that only perfect play could escape. Getting
 * here also moved one lever outside this file: generator.ts's
 * `supplyColorFor` weights the dispensed color by how many are still on the
 * board rather than drawing uniformly, because a uniform draw spends a
 * large share of shots on colors the exposed frontier barely offers a match
 * for — see that function's comment for why that is not a search
 * shortcoming this shooter papers over, but an ordinary difficulty knob.
 *
 * The gate is workload, not wall-clock (docs/plans's Sudoku §7 discipline,
 * cited directly by the plan for this game): each level gets a fixed shot
 * budget (SHOT_BUDGET) and the test fails a level that does not reach
 * 'cleared' inside it, never on how long the run took.
 */
import { describe, expect, it } from 'vitest';
import { AIM_MAX_ANGLE_FROM_VERTICAL, BOARD_SEED } from './constants';
import { placeAndResolve } from './engine';
import { cellKey, neighborsOf } from './grid';
import { LEVEL_COUNT } from './levels';
import { aimGuide, createSession, fireShot, swapNext, type BubblePopSession } from './session';
import type { BubbleColor, Cell } from './types';

const ANGLE_STEP = (1.5 * Math.PI) / 180;
/** How many of the top depth-1 candidates get a second-ply look when stuck. */
const LOOKAHEAD_WIDTH = 5;
/** Generous relative to every measured level (worst case seen: ~130 shots). */
const SHOT_BUDGET = 260;

/** Deeper removals matter more: row² so clearing row 8 outweighs four pops at row 0. */
function removalWeight(cells: readonly Cell[]): number {
  let total = 0;
  for (const cell of cells) total += (cell.row + 1) * (cell.row + 1);
  return total;
}

interface Candidate {
  readonly angle: number;
  readonly usesNext: boolean;
  readonly score: number;
}

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
    cleared = removalWeight(outcome.popped) + removalWeight(outcome.fell);
  }
  // Building (cleared === 0): bias toward the deepest cell reachable, to
  // work material toward wherever the loss line is actually threatened.
  // Clearing (cleared > 0): bias toward the shallowest, a minor tie-break
  // among equally-weighted removals.
  const positionBias = cleared > 0 ? -cell.row : cell.row;
  return cleared * 100_000 + sameColorNeighbors * 1_000 + positionBias;
}

/** Every distinct (landing cell, dispensed color) choice reachable this shot. */
function allCandidates(session: BubblePopSession): Candidate[] {
  const out: Candidate[] = [];
  const seenCells = new Set<string>();
  for (
    let angle = -AIM_MAX_ANGLE_FROM_VERTICAL;
    angle <= AIM_MAX_ANGLE_FROM_VERTICAL;
    angle += ANGLE_STEP
  ) {
    const cell = aimGuide(session, angle).landingCell;
    const key = cellKey(cell);
    if (seenCells.has(key)) continue; // several angles often land the same cell
    seenCells.add(key);
    out.push({ angle, usesNext: false, score: scoreCellForColor(session, cell, session.current) });
    out.push({ angle, usesNext: true, score: scoreCellForColor(session, cell, session.next) });
  }
  return out;
}

function bestScore(session: BubblePopSession): number {
  let best = -Infinity;
  for (const candidate of allCandidates(session)) best = Math.max(best, candidate.score);
  return best;
}

/** One shot: greedy by default, one ply of lookahead only when nothing pops. */
function playOneShot(session: BubblePopSession): BubblePopSession {
  const candidates = allCandidates(session).sort((a, b) => b.score - a.score);
  const top = candidates[0]!;

  let chosen = top;
  if (top.score < 100_000) {
    // Nothing in `candidates` scored a pop/drop (that band starts at
    // 100_000 — see scoreCellForColor). Worth a second ply on the leading
    // few: fire each, then measure the best score achievable from the
    // result, and prefer whichever build sets up the strongest follow-up.
    let bestTotal = -Infinity;
    for (const candidate of candidates.slice(0, LOOKAHEAD_WIDTH)) {
      const aimed = candidate.usesNext ? swapNext(session) : session;
      const result = fireShot(aimed, candidate.angle);
      const lookahead =
        result.status === 'cleared'
          ? Infinity
          : result.status === 'failed'
            ? -Infinity
            : bestScore(result);
      const total = candidate.score + lookahead;
      if (total > bestTotal) {
        bestTotal = total;
        chosen = candidate;
      }
    }
  }

  const aimed = chosen.usesNext ? swapNext(session) : session;
  return fireShot(aimed, chosen.angle);
}

function playLevel(level: number): { status: string; shots: number } {
  let session = createSession(BOARD_SEED, level);
  let shots = 0;
  while (session.status === 'playing' && shots < SHOT_BUDGET) {
    session = playOneShot(session);
    shots++;
  }
  return { status: session.status, shots };
}

describe('every shipped level is clearable by a one-shot-lookahead greedy shooter', () => {
  it(
    'levels 1 through 100 all reach "cleared" inside the shot budget',
    () => {
      const stuck: number[] = [];
      for (let level = 1; level <= LEVEL_COUNT; level++) {
        const { status } = playLevel(level);
        if (status !== 'cleared') stuck.push(level);
      }
      // Every level, named — a single failing assertion with the full list
      // is more useful here than failing fast on the first stuck level.
      expect(stuck).toEqual([]);
    },
    // Generous, not tight: this file's own gate is SHOT_BUDGET (workload),
    // never wall-clock — this timeout only keeps vitest itself from killing
    // a healthy run early. Running inside the full repo suite under shared
    // CPU load measured slower than running this file alone, the exact
    // wall-clock skew Sudoku's §7 warns about (parallel runs can be off by
    // up to 41x) — so this stays well above any single measurement.
    10 * 60 * 1000,
  );

  it(
    'a level never fails from starvation — the shooter always makes forward progress',
    () => {
      // The board can only ever shrink or grow by exactly one placement per
      // shot before resolution; across a whole clear, more must have been
      // removed than the starting board held, which is only possible if pops
      // and drops did real work throughout the run (a shooter that only ever
      // added bubbles could never clear a board of any size).
      for (const level of [1, 50, 100]) {
        const session = createSession(BOARD_SEED, level);
        const startingSize = session.board.size;
        const { status, shots } = playLevel(level);
        expect(status).toBe('cleared');
        expect(shots).toBeGreaterThan(0);
        expect(shots).toBeLessThan(startingSize + SHOT_BUDGET);
      }
    },
    3 * 60 * 1000,
  );
});
