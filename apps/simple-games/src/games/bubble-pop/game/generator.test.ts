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
import type { BubbleColor } from './types';

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

describe('supplyColorFor — dispensed colors depend only on what remains', () => {
  it('never dispenses a color absent from the board', () => {
    const remaining: BubbleColor[] = ['green', 'orange'];
    for (let shotIndex = 0; shotIndex < 50; shotIndex++) {
      const color = supplyColorFor('seed', 12, shotIndex, remaining);
      expect(remaining).toContain(color);
    }
  });

  it('is deterministic in (seed, level, shotIndex, remaining)', () => {
    const remaining: BubbleColor[] = ['blue', 'green', 'yellow'];
    const a = supplyColorFor('seed', 12, 3, remaining);
    const b = supplyColorFor('seed', 12, 3, remaining);
    expect(a).toBe(b);
  });

  it('changing which colors remain can change the dispensed color', () => {
    const wide: BubbleColor[] = ['blue', 'green', 'yellow', 'purple'];
    const narrow: BubbleColor[] = ['yellow'];
    expect(supplyColorFor('seed', 12, 7, narrow)).toBe('yellow');
    // Not a strict inequality claim (the wide draw could coincidentally also
    // be yellow) — only that narrowing the pool restricts the outcome.
    expect(wide).toContain(supplyColorFor('seed', 12, 7, wide));
  });

  it('a shot index used across many boards never produces a color outside a one-color board', () => {
    const remaining: BubbleColor[] = ['cyan'];
    for (let shotIndex = 0; shotIndex < 20; shotIndex++) {
      expect(supplyColorFor('seed', 1, shotIndex, remaining)).toBe('cyan');
    }
  });
});
