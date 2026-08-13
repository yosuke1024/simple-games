import { describe, it, expect } from 'vitest';
import { createSession, fireShot, swapNext, aimGuide, type BubblePopSession } from './session';
import { AIM_MAX_ANGLE_FROM_VERTICAL, BOARD_SEED } from './constants';
import { placeAndResolve } from './engine';
import { neighborsOf, cellKey } from './grid';
import { LEVEL_COUNT } from './levels';
import type { BubbleColor, Cell } from './types';

const FINE_STEP = (1.5 * Math.PI) / 180;
const COARSE_STEP = (6 * Math.PI) / 180;
const LOOKAHEAD_K = 5;

function removalWeight(cells: readonly Cell[]): number {
  let total = 0;
  for (const c of cells) total += (c.row + 1) * (c.row + 1);
  return total;
}

function scoreCellForColor(session: BubblePopSession, cell: Cell, color: BubbleColor): number {
  let neighborSame = 0;
  for (const nb of neighborsOf(cell)) {
    if (session.board.get(cellKey(nb)) === color) neighborSame++;
  }
  let primary = 0;
  if (neighborSame > 0) {
    const outcome = placeAndResolve(session.board, cell, color);
    primary = removalWeight(outcome.popped) + removalWeight(outcome.fell);
  }
  const buildBias = primary > 0 ? -cell.row : cell.row;
  return primary * 100000 + neighborSame * 1000 + buildBias;
}

interface Candidate { angle: number; usesNext: boolean; score: number }

function candidatesAt(session: BubblePopSession, step: number): Candidate[] {
  const out: Candidate[] = [];
  const seenCells = new Set<string>();
  for (let a = -AIM_MAX_ANGLE_FROM_VERTICAL; a <= AIM_MAX_ANGLE_FROM_VERTICAL; a += step) {
    const cell = aimGuide(session, a).landingCell;
    const key = cellKey(cell);
    if (seenCells.has(key)) continue;
    seenCells.add(key);
    out.push({ angle: a, usesNext: false, score: scoreCellForColor(session, cell, session.current) });
    out.push({ angle: a, usesNext: true, score: scoreCellForColor(session, cell, session.next) });
  }
  return out;
}

function bestScoreCoarse(session: BubblePopSession): number {
  let best = -Infinity;
  for (const c of candidatesAt(session, COARSE_STEP)) if (c.score > best) best = c.score;
  return best;
}

function playOneShot(session: BubblePopSession): BubblePopSession {
  const candidates = candidatesAt(session, FINE_STEP).sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, LOOKAHEAD_K);
  let best: { angle: number; usesNext: boolean; total: number } | null = null;
  for (const c of top) {
    const aimed = c.usesNext ? swapNext(session) : session;
    const result = fireShot(aimed, c.angle);
    let lookahead: number;
    if (result.status === 'cleared') lookahead = 1e12;
    else if (result.status === 'failed') lookahead = -1e12;
    else lookahead = bestScoreCoarse(result);
    const total = c.score + lookahead;
    if (best === null || total > best.total) best = { angle: c.angle, usesNext: c.usesNext, total };
  }
  const chosen = best!;
  const aimed = chosen.usesNext ? swapNext(session) : session;
  return fireShot(aimed, chosen.angle);
}

describe('debug perf', () => {
  it('shipped seed, always-on cheap-lookahead bot, all 100 levels', () => {
    const t0 = Date.now();
    let cleared = 0;
    const failedLevels: Array<{level:number, status:string, shots:number}> = [];
    for (let level = 1; level <= LEVEL_COUNT; level++) {
      let session = createSession(BOARD_SEED, level);
      let shots = 0;
      while (session.status === 'playing' && shots < 200) {
        session = playOneShot(session);
        shots++;
      }
      if (session.status === 'cleared') cleared++;
      else failedLevels.push({level, status: session.status, shots});
    }
    console.log('cleared', cleared, '/', LEVEL_COUNT, 'time', Date.now()-t0, 'ms');
    console.log('failed', JSON.stringify(failedLevels));
    expect(true).toBe(false);
  });
});
