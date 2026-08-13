import { describe, it, expect } from 'vitest';
import { createSession, fireShot, swapNext, aimGuide, type BubblePopSession } from './session';
import { AIM_MAX_ANGLE_FROM_VERTICAL, BOARD_SEED, COLOR_ORDER } from './constants';
import { placeAndResolve } from './engine';
import { neighborsOf, cellKey } from './grid';
import { createRng } from './rng';
import { buildBoard } from './generator';
import { levelSpec } from './levels';
import type { BubbleColor, Cell, Board } from './types';

const STEP = (1.5 * Math.PI) / 180;
const LOOKAHEAD_K = 5;

// Weighted-by-abundance supply: a color with more instances still on the
// board is more likely to be dispensed. Still restricted to colors present
// (never dispenses an absent color) and still deterministic in
// (seed, level, shotIndex, remaining).
function weightedSupplyColorFor(
  seed: string, level: number, shotIndex: number, board: Board,
): BubbleColor {
  const counts = new Map<BubbleColor, number>();
  for (const c of board.values()) counts.set(c, (counts.get(c) ?? 0) + 1);
  const present = COLOR_ORDER.filter((c) => (counts.get(c) ?? 0) > 0);
  if (present.length === 0) return COLOR_ORDER[0]!;
  const weights = present.map((c) => counts.get(c)!);
  const total = weights.reduce((a, b) => a + b, 0);
  const rng = createRng(`${seed}:${level}:supply:${shotIndex}`);
  let r = rng() * total;
  for (let i = 0; i < present.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return present[i]!;
  }
  return present[present.length - 1]!;
}

function removalWeight(cells: readonly Cell[]): number {
  let total = 0;
  for (const c of cells) total += (c.row + 1) * (c.row + 1);
  return total;
}

function scoreCellForColor(session: BubblePopSession, cell: Cell, color: BubbleColor): number {
  let neighborSame = 0;
  for (const nb of neighborsOf(cell)) if (session.board.get(cellKey(nb)) === color) neighborSame++;
  let primary = 0;
  if (neighborSame > 0) {
    const outcome = placeAndResolve(session.board, cell, color);
    primary = removalWeight(outcome.popped) + removalWeight(outcome.fell);
  }
  const buildBias = primary > 0 ? -cell.row : cell.row;
  return primary * 100000 + neighborSame * 1000 + buildBias;
}

interface Candidate { angle: number; usesNext: boolean; score: number; primary: number }

function candidatesAt(session: BubblePopSession): Candidate[] {
  const out: Candidate[] = [];
  const seenCells = new Set<string>();
  for (let a = -AIM_MAX_ANGLE_FROM_VERTICAL; a <= AIM_MAX_ANGLE_FROM_VERTICAL; a += STEP) {
    const cell = aimGuide(session, a).landingCell;
    const key = cellKey(cell);
    if (seenCells.has(key)) continue;
    seenCells.add(key);
    out.push({ angle: a, usesNext: false, score: scoreCellForColor(session, cell, session.current), primary: 0 });
    out.push({ angle: a, usesNext: true, score: scoreCellForColor(session, cell, session.next), primary: 0 });
  }
  return out;
}

function bestScore(session: BubblePopSession): number {
  let best = -Infinity;
  for (const c of candidatesAt(session)) if (c.score > best) best = c.score;
  return best;
}

// A session-like object with a manually overridden supply — reuse fireShot's
// resolution by post-patching next after each shot with the weighted pick.
function withWeightedSupply(session: BubblePopSession, seed: string, level: number): BubblePopSession {
  return { ...session, next: weightedSupplyColorFor(seed, level, session.shotIndex, session.board) };
}

function playOneShot(session: BubblePopSession, seed: string, level: number): BubblePopSession {
  const candidates = candidatesAt(session).sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, LOOKAHEAD_K);
  const primaryTop = top[0]!.score > 0 && top.some(c => c.score > 50000);
  let chosen: { angle: number; usesNext: boolean };
  if (primaryTop) {
    chosen = top[0]!;
  } else {
    let best: { angle: number; usesNext: boolean; total: number } | null = null;
    for (const c of top) {
      const aimed = c.usesNext ? swapNext(session) : session;
      let result = fireShot(aimed, c.angle);
      if (result.status === 'playing') result = withWeightedSupply(result, seed, level);
      let lookahead: number;
      if (result.status === 'cleared') lookahead = 1e12;
      else if (result.status === 'failed') lookahead = -1e12;
      else lookahead = bestScore(result);
      const total = c.score + lookahead;
      if (best === null || total > best.total) best = { angle: c.angle, usesNext: c.usesNext, total };
    }
    chosen = best!;
  }
  const aimed = chosen.usesNext ? swapNext(session) : session;
  let result = fireShot(aimed, chosen.angle);
  if (result.status === 'playing') result = withWeightedSupply(result, seed, level);
  return result;
}

describe('debug weighted supply', () => {
  it('traces level 97 with weighted supply', () => {
    const seed = BOARD_SEED;
    const level = 97;
    const board = buildBoard(seed, level);
    let session = createSession(seed, level);
    session = withWeightedSupply({ ...session, current: session.current }, seed, level);
    // Also fix "current" to weighted pick at shotIndex 0 for consistency.
    const currentWeighted = weightedSupplyColorFor(seed, level, 0, board);
    session = { ...session, current: currentWeighted, next: weightedSupplyColorFor(seed, level, 1, board) };

    const t0 = Date.now();
    let shots = 0;
    while (session.status === 'playing' && shots < 150) {
      session = playOneShot(session, seed, level);
      shots++;
    }
    console.log('level97 weighted-supply', session.status, shots, 'time', Date.now() - t0, 'ms');
    expect(true).toBe(false);
  });
});
