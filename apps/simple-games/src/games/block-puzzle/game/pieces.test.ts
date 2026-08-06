/**
 * The catalogue and the draw (docs/BLOCK_PUZZLE_RULES.md §6).
 *
 * The shape of the catalogue is a contract with saved games and with the
 * golden test, so its size, its ids, and the normalization every shape obeys
 * are asserted rather than assumed.
 */
import { describe, expect, it } from 'vitest';
import { drawBatch, PIECES } from './pieces';
import { TRAY_SIZE } from './types';

describe('the catalogue', () => {
  it('holds exactly the nineteen shapes the rules name (§6)', () => {
    expect(PIECES).toHaveLength(19);
  });

  it('gives every shape its own id, and the id is its position', () => {
    const ids = PIECES.map((piece) => piece.id);
    expect(new Set(ids).size).toBe(PIECES.length);
    // Persistence stores the id and reads it back as an index, so the two
    // must be the same number (§10).
    expect(ids).toEqual(PIECES.map((_, index) => index));
  });

  it('normalizes every shape to touch row 0 and column 0', () => {
    for (const piece of PIECES) {
      const rows = piece.cells.map((cell) => cell.row);
      const cols = piece.cells.map((cell) => cell.col);
      expect(Math.min(...rows), `piece ${piece.id}`).toBe(0);
      expect(Math.min(...cols), `piece ${piece.id}`).toBe(0);
    }
  });

  it('keeps every shape inside 5×5, the largest the rules allow (§6)', () => {
    for (const piece of PIECES) {
      expect(piece.width, `piece ${piece.id}`).toBeLessThanOrEqual(5);
      expect(piece.height, `piece ${piece.id}`).toBeLessThanOrEqual(5);
      // The declared box must be the box the cells actually fill.
      expect(Math.max(...piece.cells.map((cell) => cell.row)) + 1).toBe(piece.height);
      expect(Math.max(...piece.cells.map((cell) => cell.col)) + 1).toBe(piece.width);
    }
  });

  it('never repeats a cell inside a shape', () => {
    for (const piece of PIECES) {
      const keys = piece.cells.map((cell) => `${cell.row},${cell.col}`);
      expect(new Set(keys).size, `piece ${piece.id}`).toBe(piece.cells.length);
    }
  });

  it('lists a shape row-major, so the first cell is the tap anchor (§3)', () => {
    for (const piece of PIECES) {
      const order = piece.cells.map((cell) => cell.row * 5 + cell.col);
      expect(
        [...order].sort((a, b) => a - b),
        `piece ${piece.id}`,
      ).toEqual(order);
    }
  });
});

describe('the draw (§6)', () => {
  it('deals three known pieces', () => {
    const batch = drawBatch('block-test', 0);
    expect(batch).toHaveLength(TRAY_SIZE);
    for (const id of batch) expect(PIECES[id]).toBeDefined();
  });

  it('is the same batch every time for the same seed and index', () => {
    expect(drawBatch('block-test', 4)).toEqual(drawBatch('block-test', 4));
  });

  it('gives different indices of one seed their own batches', () => {
    const batches = [0, 1, 2, 3, 4].map((index) => drawBatch('block-test', index).join(','));
    // Not a uniqueness guarantee — a uniform draw may repeat — but five
    // identical batches would mean batchIndex is not reaching the rng at all.
    expect(new Set(batches).size).toBeGreaterThan(1);
  });

  it('never looks at the board (§6)', () => {
    // The draw cannot depend on the board because it is never handed one:
    // two parameters, a seed and a refill counter. The moment a board could
    // reach here, "none of these three fit" stops being an outcome and starts
    // being a decision (§2).
    expect(drawBatch.length).toBe(2);
  });
});
