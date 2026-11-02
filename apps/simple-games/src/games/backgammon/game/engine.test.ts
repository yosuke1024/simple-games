import { describe, expect, it } from 'vitest';
import { allowedSteps, applyStep, bestUsage, canStep, maximalTurns, resultKindOf } from './engine';
import {
  allHome,
  BAR,
  CHECKERS_PER_SIDE,
  CPU,
  distToPoint,
  initialBoard,
  isValidBoard,
  ownAt,
  pipCount,
  PLAYER,
  type Board,
  type Side,
} from './types';

/**
 * A board from per-side distance → count maps (own checkers at their own
 * distances), the rest borne off. Keeps the fixtures readable: `{ 6: 5, 8: 3 }`
 * reads exactly as the rule doc writes a position.
 */
function boardOf(
  player: Record<number, number>,
  cpu: Record<number, number>,
  bar: [number, number] = [0, 0],
): Board {
  const points = new Array<number>(25).fill(0);
  let playerOn = bar[0];
  let cpuOn = bar[1];
  for (const [dist, count] of Object.entries(player)) {
    const index = distToPoint(PLAYER, Number(dist));
    points[index] = (points[index] ?? 0) + count;
    playerOn += count;
  }
  for (const [dist, count] of Object.entries(cpu)) {
    const index = distToPoint(CPU, Number(dist));
    points[index] = (points[index] ?? 0) - count;
    cpuOn += count;
  }
  return { points, bar, off: [CHECKERS_PER_SIDE - playerOn, CHECKERS_PER_SIDE - cpuOn] };
}

const stepSet = (board: Board, side: Side, dice: number[]): string[] =>
  allowedSteps(board, side, dice)
    .map((s) => `${s.from}/${s.die}`)
    .sort();

describe('the opening position (§1)', () => {
  it('is valid, 167 pips a side, and mirrored', () => {
    const board = initialBoard();
    expect(isValidBoard(board)).toBe(true);
    expect(pipCount(board, PLAYER)).toBe(167);
    expect(pipCount(board, CPU)).toBe(167);
    for (const side of [PLAYER, CPU] as const) {
      expect(ownAt(board, side, 24)).toBe(2);
      expect(ownAt(board, side, 13)).toBe(5);
      expect(ownAt(board, side, 8)).toBe(3);
      expect(ownAt(board, side, 6)).toBe(5);
    }
  });
});

describe('a single step (§2.2)', () => {
  it('cannot land on a point the opponent holds with two or more', () => {
    const board = initialBoard();
    // The CPU holds its 6-point, which is the player's 19-point: 24/5 is blocked.
    expect(canStep(board, PLAYER, 24, 5)).toBe(false);
    expect(canStep(board, PLAYER, 24, 4)).toBe(true);
  });

  it('hits a lone opponent checker and sends it to the bar', () => {
    const board = boardOf({ 13: 15 }, { 12: 1, 24: 14 });
    // The player's 13-point to the 12-point... the CPU blot sits on the
    // player's distance 12? Not quite: the CPU's distance 12 is the player's
    // 13-point. Put the blot where the player can reach it instead.
    const withBlot = boardOf({ 13: 15 }, { 15: 1, 24: 14 }); // CPU dist 15 = player point 10
    expect(ownAt(withBlot, CPU, 15)).toBe(1);
    const effect = applyStep(withBlot, PLAYER, { from: 13, die: 3 });
    expect(effect).not.toBeNull();
    expect(effect!.hit).toBe(true);
    expect(effect!.board.bar[1]).toBe(1);
    expect(ownAt(effect!.board, PLAYER, 10)).toBe(1);
    expect(ownAt(effect!.board, CPU, 15)).toBe(0);
    expect(isValidBoard(effect!.board)).toBe(true);
    void board;
  });

  it('freezes every other checker while one is on the bar, and enters at 25 − die', () => {
    const board = boardOf({ 13: 14 }, { 1: 2, 2: 2, 24: 11 }, [1, 0]);
    expect(canStep(board, PLAYER, 13, 3)).toBe(false);
    // Entry at distance 25 − die: the CPU holds its 1- and 2-points (the
    // player's 24 and 23), so dice 1 and 2 cannot enter; 3 can.
    expect(canStep(board, PLAYER, BAR, 1)).toBe(false);
    expect(canStep(board, PLAYER, BAR, 2)).toBe(false);
    expect(canStep(board, PLAYER, BAR, 3)).toBe(true);
    const entered = applyStep(board, PLAYER, { from: BAR, die: 3 })!;
    expect(entered.board.bar[0]).toBe(0);
    expect(ownAt(entered.board, PLAYER, 22)).toBe(1);
  });
});

describe('bearing off (§2.2)', () => {
  it('is only possible with every checker home', () => {
    // The CPU's fifteen sit at its own distance 1 — the player's 24-point —
    // out of the way of a home board.
    const notHome = boardOf({ 6: 14, 7: 1 }, { 1: 15 });
    expect(allHome(notHome, PLAYER)).toBe(false);
    expect(canStep(notHome, PLAYER, 6, 6)).toBe(false);
    const home = boardOf({ 6: 15 }, { 1: 15 });
    expect(canStep(home, PLAYER, 6, 6)).toBe(true);
  });

  it('takes the exact point, else moves a higher checker, else the farthest one', () => {
    const board = boardOf({ 6: 2, 4: 3, 3: 5, 2: 5 }, { 1: 15 });
    // A 5 with nothing on the 5-point but checkers on the 6-point must move
    // from the 6-point; it may not bear off the 4-point.
    expect(canStep(board, PLAYER, 4, 5)).toBe(false);
    expect(canStep(board, PLAYER, 6, 5)).toBe(true);
    // A 6 bears off from the 6-point exactly.
    expect(canStep(board, PLAYER, 6, 6)).toBe(true);
    // Once the 6-point is empty, a 5 bears off the farthest checker (the 4-point).
    const cleared = boardOf({ 4: 3, 3: 5, 2: 5, 1: 2 }, { 1: 15 });
    expect(canStep(cleared, PLAYER, 4, 5)).toBe(true);
    expect(canStep(cleared, PLAYER, 3, 5)).toBe(false);
    const off = applyStep(cleared, PLAYER, { from: 4, die: 5 })!;
    expect(off.borneOff).toBe(true);
    expect(off.board.off[0]).toBe(1);
  });
});

describe('the obligation to use the dice (§2.3)', () => {
  it('offers the classic 8/5 6/5 from the opening with a 3-1', () => {
    const board = initialBoard();
    const steps = stepSet(board, PLAYER, [3, 1]);
    expect(steps).toContain('8/3');
    expect(steps).toContain('6/1');
    const makesFivePoint = maximalTurns(board, PLAYER, [3, 1]).some(
      (turn) => ownAt(turn.board, PLAYER, 5) === 2,
    );
    expect(makesFivePoint).toBe(true);
    expect(bestUsage(board, PLAYER, [3, 1])).toEqual({ count: 2, sum: 4 });
  });

  it('forbids a step that would leave the other die unplayable when both could be played', () => {
    // The player has a checker on the bar and one at distance 5; the CPU
    // holds the player's 1-point and 19-point (its own 24 and 6). With [4, 2]:
    // entering with the 4 (to 21) leaves the 2 for 5/3 — both dice played;
    // entering with the 2 (to 23) leaves a 4 that neither checker can play
    // (23/19 and 5/1 are both blocked). Only the first entry is allowed.
    const board = boardOf({ 5: 1 }, { 24: 2, 6: 2, 12: 11 }, [1, 0]);
    expect(bestUsage(board, PLAYER, [4, 2])).toEqual({ count: 2, sum: 6 });
    expect(stepSet(board, PLAYER, [4, 2])).toEqual(['25/4']);
  });

  it('plays the larger die when only one of the two can be played', () => {
    // Player on the bar; the CPU holds the entry points for 1..4 except 3 and 5.
    // With [5, 3] both enter, so both are offered; with [6, 3]: 6 is blocked
    // and 3 enters... make 6 and 3 both enterable but mutually exclusive:
    // one checker on the bar and no other checker that can move after entry.
    const board = boardOf({}, { 1: 2, 2: 2, 4: 2, 6: 2, 20: 2, 22: 2, 24: 3 }, [1, 0]);
    // Entries: die 3 → distance 22 (CPU dist 3, open), die 5 → distance 20
    // (CPU dist 5, open). After entering, the second die must be played by
    // the entered checker: from 22, a 5 lands on 17 (open); from 20, a 3
    // lands on 17 (open). Both dice are playable, so both entries are offered.
    expect(stepSet(board, PLAYER, [5, 3])).toEqual(['25/3', '25/5']);
    // Now block the continuations: the CPU holds the player's 17-point
    // (CPU distance 8). Entering with either die leaves the other die dead,
    // so the rule picks the larger: only the 5 may be played.
    const blocked = boardOf({}, { 1: 2, 2: 2, 4: 2, 6: 2, 8: 2, 20: 1, 22: 1, 24: 3 }, [1, 0]);
    expect(bestUsage(blocked, PLAYER, [5, 3])).toEqual({ count: 1, sum: 5 });
    expect(stepSet(blocked, PLAYER, [5, 3])).toEqual(['25/5']);
  });

  it('plays doubles four times when it can', () => {
    const board = initialBoard();
    expect(bestUsage(board, PLAYER, [2, 2, 2, 2])).toEqual({ count: 4, sum: 8 });
    const turns = maximalTurns(board, PLAYER, [2, 2, 2, 2]);
    expect(turns.length).toBeGreaterThan(1);
    for (const turn of turns) {
      expect(turn.steps).toHaveLength(4);
      expect(isValidBoard(turn.board)).toBe(true);
      expect(pipCount(turn.board, PLAYER)).toBe(167 - 8);
    }
  });

  it('returns no steps, and a zero usage, when nothing can be played (§2.4)', () => {
    const board = boardOf({ 13: 14 }, { 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 24: 3 }, [1, 0]);
    expect(bestUsage(board, PLAYER, [3, 4])).toEqual({ count: 0, sum: 0 });
    expect(allowedSteps(board, PLAYER, [3, 4])).toEqual([]);
    expect(maximalTurns(board, PLAYER, [3, 4])).toEqual([]);
  });

  it('dedupes turns by resulting position, keeping one order per position', () => {
    const board = initialBoard();
    const turns = maximalTurns(board, PLAYER, [6, 5]);
    const keys = new Set(turns.map((t) => t.board.points.join(',')));
    expect(keys.size).toBe(turns.length);
    // The running game 24/18/13 (one checker, both dice) is among them.
    expect(turns.some((t) => ownAt(t.board, PLAYER, 24) === 1 && ownAt(t.board, PLAYER, 13) === 6)).toBe(true);
  });
});

describe('how a match ends (§3)', () => {
  it('names a single, a gammon and a backgammon', () => {
    const single = boardOf({}, { 3: 14 }, [0, 0]);
    expect(single.off[0]).toBe(15);
    expect(resultKindOf(single, PLAYER)).toBe('single');
    const gammon = boardOf({}, { 3: 15 });
    expect(resultKindOf(gammon, PLAYER)).toBe('gammon');
    // A loser with a checker still in the winner's home board — the loser's
    // distance 19..24 — or on the bar, has been backgammoned.
    const backgammon = boardOf({}, { 3: 14, 20: 1 });
    expect(resultKindOf(backgammon, PLAYER)).toBe('backgammon');
    const onBar = boardOf({}, { 3: 14 }, [0, 1]);
    expect(resultKindOf(onBar, PLAYER)).toBe('backgammon');
  });
});
