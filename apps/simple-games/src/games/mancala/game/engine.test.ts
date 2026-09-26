/**
 * Sowing, extra turns, captures and the end of the game
 * (docs/MANCALA_RULES.md §2, §3). Boards are written as two rows the way the
 * screen shows them — the CPU's row on top, read right to left from its
 * pit 7, and the player's row below — so a failure reads as a position.
 */
import { describe, expect, it } from 'vitest';
import { isGameOver, isSideEmpty, legalPits, sow, storeCounts, sweepRemaining } from './engine';
import {
  BOARD_SIZE,
  CPU,
  CPU_STORE,
  initialPits,
  isValidPits,
  oppositeOf,
  PLAYER,
  PLAYER_STORE,
  TOTAL_SEEDS,
  type Pits,
} from './types';

/**
 * Builds a board from the picture on screen: `cpuRow` is the top row left to
 * right (pits 12 … 7), `playerRow` the bottom row left to right (pits 0 … 5).
 */
function boardOf(
  cpuStore: number,
  cpuRow: readonly number[],
  playerRow: readonly number[],
  playerStore: number,
): Pits {
  expect(cpuRow).toHaveLength(6);
  expect(playerRow).toHaveLength(6);
  const pits = new Array<number>(BOARD_SIZE).fill(0);
  playerRow.forEach((count, i) => (pits[i] = count));
  cpuRow.forEach((count, i) => (pits[12 - i] = count));
  pits[PLAYER_STORE] = playerStore;
  pits[CPU_STORE] = cpuStore;
  return pits;
}

const total = (pits: Pits) => pits.reduce((sum, count) => sum + count, 0);

describe('the board (§1)', () => {
  it('opens with four seeds in every pit and empty stores', () => {
    const pits = initialPits();
    expect(pits).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(total(pits)).toBe(TOTAL_SEEDS);
    expect(isValidPits(pits)).toBe(true);
  });

  it('faces each pit with the one straight across', () => {
    expect(oppositeOf(0)).toBe(12);
    expect(oppositeOf(5)).toBe(7);
    expect(oppositeOf(7)).toBe(5);
  });

  it('offers only the mover’s own pits that hold seeds', () => {
    const pits = boardOf(0, [4, 4, 0, 4, 4, 4], [0, 4, 4, 0, 4, 4], 0);
    expect(legalPits(pits, PLAYER)).toEqual([1, 2, 4, 5]);
    expect(legalPits(pits, CPU)).toEqual([7, 8, 9, 11, 12]);
  });
});

describe('sowing (§2)', () => {
  it('drops one seed in each following pit, counter-clockwise', () => {
    const move = sow(initialPits(), PLAYER, 0)!;
    expect(move.pits).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(move.touched).toEqual([1, 2, 3, 4]);
    expect(move.lastIndex).toBe(4);
    expect(move.extraTurn).toBe(false);
    expect(move.captured).toBe(0);
  });

  it('sows into its own store and on round to the other side', () => {
    const move = sow(initialPits(), PLAYER, 4)!;
    expect(move.touched).toEqual([5, PLAYER_STORE, 7, 8]);
    expect(storeCounts(move.pits)).toEqual({ player: 1, cpu: 0 });
  });

  it('skips the opponent’s store, for either side', () => {
    // Ten seeds from the player's last pit: store, the CPU's six pits, then
    // past the CPU's store without a seed, and on into the player's row.
    const player = sow(boardOf(0, [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 10], 0), PLAYER, 5)!;
    expect(player.touched).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
    expect(player.pits[CPU_STORE]).toBe(0);

    // And the same for the CPU going past the player's store.
    const cpu = sow(boardOf(0, [10, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1], 0), CPU, 12)!;
    expect(cpu.touched).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8, 9]);
    expect(cpu.pits[PLAYER_STORE]).toBe(0);
  });

  it('laps the board with 13 or more seeds, sowing the pit it started from', () => {
    // 15 seeds from pit 2: 3,4,5,store,7..12 (10 seeds), skip 13, 0,1,2 (13),
    // then 3,4 — the origin pit gets one on the way round (§2, §11).
    const pits = boardOf(0, [1, 1, 1, 1, 1, 1], [1, 1, 15, 1, 1, 1], 0);
    const move = sow(pits, PLAYER, 2)!;
    expect(move.touched).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1, 2, 3, 4]);
    expect(move.pits[2]).toBe(1);
    expect(move.pits[3]).toBe(3);
    expect(move.pits[4]).toBe(3);
    expect(move.lastIndex).toBe(4);
    expect(total(move.pits)).toBe(total(pits));
  });

  it('refuses an empty pit and a pit that is not the mover’s', () => {
    const pits = boardOf(0, [4, 4, 4, 4, 4, 4], [0, 4, 4, 4, 4, 4], 4);
    expect(sow(pits, PLAYER, 0)).toBeNull();
    expect(sow(pits, PLAYER, 7)).toBeNull();
    expect(sow(pits, PLAYER, PLAYER_STORE)).toBeNull();
    expect(sow(pits, CPU, 3)).toBeNull();
  });
});

describe('another turn (§2.1)', () => {
  it('is earned when the last seed lands in the mover’s own store', () => {
    // Pit 2 holds four: 3, 4, 5, store.
    const move = sow(initialPits(), PLAYER, 2)!;
    expect(move.lastIndex).toBe(PLAYER_STORE);
    expect(move.extraTurn).toBe(true);
    expect(move.captured).toBe(0);
  });

  it('is earned by the CPU in its own store too', () => {
    // CPU pit 9 holds four: 10, 11, 12, its store.
    const move = sow(initialPits(), CPU, 9)!;
    expect(move.lastIndex).toBe(CPU_STORE);
    expect(move.extraTurn).toBe(true);
  });

  it('is earned after a full lap as well (seeds = distance + 13)', () => {
    // Pit 5 is one from the store; fourteen seeds go round once and land there.
    const pits = boardOf(0, [2, 2, 2, 2, 2, 2], [2, 2, 2, 2, 2, 14], 0);
    const move = sow(pits, PLAYER, 5)!;
    expect(move.lastIndex).toBe(PLAYER_STORE);
    expect(move.extraTurn).toBe(true);
  });
});

describe('capture (§2.2)', () => {
  it('takes the opposite pit and the last seed when it lands in an empty pit of its own', () => {
    // Pit 1 holds two: 2, 3. Pit 3 was empty; across from it (9) sit five.
    const pits = boardOf(0, [4, 4, 4, 5, 4, 4], [4, 2, 4, 0, 4, 4], 0);
    const move = sow(pits, PLAYER, 1)!;
    expect(move.lastIndex).toBe(3);
    expect(move.captured).toBe(6);
    expect(move.pits[3]).toBe(0);
    expect(move.pits[oppositeOf(3)]).toBe(0);
    expect(move.pits[PLAYER_STORE]).toBe(6);
    expect(move.extraTurn).toBe(false);
    expect(total(move.pits)).toBe(total(pits));
  });

  it('does not capture when the pit across is empty — the seed stays', () => {
    const pits = boardOf(0, [4, 4, 4, 0, 4, 4], [4, 2, 4, 0, 4, 4], 0);
    const move = sow(pits, PLAYER, 1)!;
    expect(move.captured).toBe(0);
    expect(move.pits[3]).toBe(1);
    expect(move.pits[PLAYER_STORE]).toBe(0);
  });

  it('does not capture in a pit that already held seeds', () => {
    const pits = boardOf(0, [4, 4, 4, 5, 4, 4], [4, 2, 4, 1, 4, 4], 0);
    const move = sow(pits, PLAYER, 1)!;
    expect(move.captured).toBe(0);
    expect(move.pits[3]).toBe(2);
  });

  it('does not capture on the opponent’s side', () => {
    // The last seed lands in the CPU's empty pit 8; that is not the player's.
    const pits = boardOf(0, [4, 4, 4, 4, 0, 4], [4, 4, 4, 4, 4, 3], 0);
    const move = sow(pits, PLAYER, 5)!;
    expect(move.lastIndex).toBe(8);
    expect(move.captured).toBe(0);
    expect(move.pits[8]).toBe(1);
  });

  it('captures for the CPU into the CPU’s store', () => {
    // CPU pit 7 holds one: it lands in 8, empty, across from player pit 4.
    const pits = boardOf(0, [4, 4, 4, 4, 0, 1], [4, 4, 4, 4, 7, 4], 0);
    const move = sow(pits, CPU, 7)!;
    expect(move.lastIndex).toBe(8);
    expect(move.captured).toBe(8);
    expect(move.pits[CPU_STORE]).toBe(8);
    expect(move.pits[4]).toBe(0);
  });

  it('can capture in the pit it started from after a full lap', () => {
    // Thirteen seeds from pit 0 come all the way round and end in pit 0,
    // which was emptied when they were lifted.
    const pits = boardOf(0, [3, 1, 1, 1, 1, 1], [13, 1, 1, 1, 1, 1], 23);
    const move = sow(pits, PLAYER, 0)!;
    expect(move.lastIndex).toBe(0);
    // Across from pit 0 is 12, which held 3 and got one on the way round.
    expect(move.captured).toBe(5);
    expect(move.pits[0]).toBe(0);
    expect(move.pits[12]).toBe(0);
  });
});

describe('the end of the game (§3)', () => {
  it('is over when either row is empty', () => {
    expect(isGameOver(initialPits())).toBe(false);
    const playerOut = boardOf(20, [1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 0], 22);
    expect(isSideEmpty(playerOut, PLAYER)).toBe(true);
    expect(isGameOver(playerOut)).toBe(true);
    const cpuOut = boardOf(20, [0, 0, 0, 0, 0, 0], [1, 1, 1, 1, 1, 1], 22);
    expect(isGameOver(cpuOut)).toBe(true);
  });

  it('sweeps each row into its own side’s store', () => {
    const pits = boardOf(20, [1, 2, 0, 0, 0, 3], [0, 0, 0, 0, 0, 0], 22);
    const swept = sweepRemaining(pits);
    expect(storeCounts(swept)).toEqual({ player: 22, cpu: 26 });
    expect(total(swept)).toBe(TOTAL_SEEDS);
    expect(swept.filter((count, i) => i !== PLAYER_STORE && i !== CPU_STORE)).toEqual(
      new Array(12).fill(0),
    );
  });
});
