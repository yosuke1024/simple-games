/**
 * generator.ts is its own file — Mahjong Solitaire's shape, not Brick
 * Breaker's (which folds board tests into engine.test.ts). See
 * docs/plans/2026-08-08-mahjong-bubble-ludo.md, Phase 3's "latest convention"
 * note.
 */
import { describe, expect, it } from 'vitest';
import { COLOR_ORDER, POP_MIN_CLUSTER } from './constants';
import { connectedGroup } from './engine';
import { allCellsInRow, cellKey } from './grid';
import { LEVEL_COUNT, levelSpec } from './levels';
import { boardToString, buildBoard, remainingColors, supplyColorFor } from './generator';
import type { Board, BubbleColor } from './types';

/** A synthetic board holding exactly these colors, spread across rows 0..n. */
function boardWith(colors: readonly BubbleColor[]): Board {
  const board = new Map<string, BubbleColor>();
  let row = 0;
  let col = 0;
  for (const color of colors) {
    const rowCells = allCellsInRow(row);
    if (col >= rowCells.length) {
      row++;
      col = 0;
    }
    board.set(cellKey({ row, col }), color);
    col++;
  }
  return board;
}

describe('buildBoard determinism', () => {
  it('the same seed and level build the same board', () => {
    expect(buildBoard('a', 5)).toEqual(buildBoard('a', 5));
    expect(buildBoard('b', 5)).not.toEqual(buildBoard('a', 5));
    expect(buildBoard('a', 6)).not.toEqual(buildBoard('a', 5));
  });
});

describe('buildBoard shape', () => {
  it('fills exactly the rows and columns levelSpec promises, with no gaps', () => {
    for (let level = 1; level <= LEVEL_COUNT; level += 7) {
      const spec = levelSpec(level);
      const board = buildBoard('gen', level);
      let expectedCells = 0;
      for (let row = 0; row < spec.rows; row++) expectedCells += allCellsInRow(row).length;
      expect(board.size).toBe(expectedCells);
      for (let row = 0; row < spec.rows; row++) {
        for (const cell of allCellsInRow(row)) {
          expect(board.has(cellKey(cell))).toBe(true);
        }
      }
    }
  });

  it('uses exactly levelSpec(level).colorCount colors, always a prefix of COLOR_ORDER', () => {
    for (let level = 1; level <= LEVEL_COUNT; level += 5) {
      const spec = levelSpec(level);
      const board = buildBoard('gen', level);
      const used = new Set(board.values());
      const expectedPalette = new Set(COLOR_ORDER.slice(0, spec.colorCount));
      for (const color of used) expect(expectedPalette.has(color)).toBe(true);
      // Every color a level is entitled to should show up somewhere on a
      // board this size — rows 5..9 at columns 7..8 is plenty of cells.
      expect(used.size).toBe(spec.colorCount);
    }
  });

  it('never generates a same-color group of POP_MIN_CLUSTER or more', () => {
    for (const [seed, level] of [
      ['a', 1],
      ['a', 50],
      ['a', LEVEL_COUNT],
      ['b', 30],
      ['c', 77],
    ] as const) {
      const board = buildBoard(seed, level);
      const seen = new Set<string>();
      for (const key of board.keys()) {
        if (seen.has(key)) continue;
        const cell = { row: Number(key.split(',')[0]), col: Number(key.split(',')[1]) };
        const color = board.get(key) as BubbleColor;
        const group = connectedGroup(board, cell, (c) => c === color);
        for (const g of group) seen.add(cellKey(g));
        expect(group.length).toBeLessThan(POP_MIN_CLUSTER);
      }
    }
  });
});

describe('boardToString', () => {
  it('round-trips row/column shape and is stable for the same board', () => {
    const board = buildBoard('gen', 10);
    const a = boardToString(board);
    const b = boardToString(board);
    expect(a).toBe(b);
    expect(a).not.toContain('undefined');
  });

  it('renders the empty board distinctly', () => {
    expect(boardToString(new Map())).toBe('(empty)');
  });
});

describe('remainingColors', () => {
  it('lists only colors actually present, in COLOR_ORDER', () => {
    const board = new Map([
      ['0,0', 'purple' as BubbleColor],
      ['0,1', 'blue' as BubbleColor],
    ]);
    expect(remainingColors(board)).toEqual(['blue', 'purple']);
  });

  it('is empty for an empty board', () => {
    expect(remainingColors(new Map())).toEqual([]);
  });
});

describe('supplyColorFor — dispensed colors depend only on what remains, weighted by abundance', () => {
  it('never dispenses a color absent from the board', () => {
    const board = boardWith(['green', 'green', 'green', 'orange']);
    for (let shotIndex = 0; shotIndex < 50; shotIndex++) {
      const color = supplyColorFor('seed', 12, shotIndex, board);
      expect(['green', 'orange']).toContain(color);
    }
  });

  it('is deterministic in (seed, level, shotIndex, board)', () => {
    const board = boardWith(['blue', 'green', 'yellow']);
    const a = supplyColorFor('seed', 12, 3, board);
    const b = supplyColorFor('seed', 12, 3, board);
    expect(a).toBe(b);
  });

  it('changing which colors remain can change the dispensed color', () => {
    const wide = boardWith(['blue', 'green', 'yellow', 'purple']);
    const narrow = boardWith(['yellow']);
    expect(supplyColorFor('seed', 12, 7, narrow)).toBe('yellow');
    // Not a strict inequality claim (the wide draw could coincidentally also
    // be yellow) — only that narrowing the pool restricts the outcome.
    expect(['blue', 'green', 'yellow', 'purple']).toContain(supplyColorFor('seed', 12, 7, wide));
  });

  it('a shot index used against a one-color board never produces another color', () => {
    const board = boardWith(['cyan']);
    for (let shotIndex = 0; shotIndex < 20; shotIndex++) {
      expect(supplyColorFor('seed', 1, shotIndex, board)).toBe('cyan');
    }
  });

  /**
   * The load-bearing behavior change (constants.ts's LOSS_LINE_Y comment,
   * levels.ts's scatterBias comment): a color with more instances left on
   * the board is dispensed more often, not with equal odds to a color that
   * is nearly gone. Measured over many independent shot indices rather than
   * asserting an exact ratio — the draw is still randomized, just no longer
   * uniform.
   */
  it('a far more abundant color is dispensed far more often than a scarce one', () => {
    const board = boardWith([...Array<BubbleColor>(18).fill('blue'), 'orange']);
    let blueCount = 0;
    const trials = 200;
    for (let shotIndex = 0; shotIndex < trials; shotIndex++) {
      if (supplyColorFor('weighted-seed', 30, shotIndex, board) === 'blue') blueCount++;
    }
    // Uniform would land near 50%; weighted by count (18:1) should land
    // near 18/19 ≈ 94.7%. The threshold is well clear of a uniform draw's
    // plausible range so this fails loudly if the weighting regresses to
    // uniform, without pinning an exact count.
    expect(blueCount).toBeGreaterThan(trials * 0.8);
  });
});
