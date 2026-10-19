/**
 * The full check of bundled boards (docs/UNBLOCK_PUZZLE_RULES.md §8, §17),
 * shared by catalogue.test.ts and the catalogue.<tier>-<part>.test.ts files
 * that split the work of checking every entry across workers. Test-only: no
 * file the app imports imports this one.
 *
 * Every entry is checked, none sampled: a bundled board is dealt as it is
 * (Hard, the daily, an Easy or Medium fallback) and is the board every Easy
 * and Medium deal starts from, so each must be exactly what the data says.
 */
import { describe, expect, it } from 'vitest';
import { catalogueEntry, catalogueSize, type CatalogueEntry } from './catalogue';
import { isSolved, isValidBoard } from './engine';
import { COMPONENT_LIMIT, TIERS, componentKey, meetsBlockBounds, meetsTier } from './generator';
import { exploreComponent, exploredStates, type Component } from './search';
import { decodeBoard, encodeBoard } from './serialize';
import { oracleSolve } from './test-helpers';
import type { Board, Difficulty } from './types';

/**
 * Whether board `other` is one of `component`'s boards (the component of a
 * board with the same blocks). The two may number their blocks differently,
 * so `other`'s offsets are first put in the component's block order: blocks
 * of the same shape in the same lane can never pass each other, so the k-th
 * of them along the lane in one board is the k-th in every board of its
 * component.
 */
export function holdsBoard(component: Component, other: Board): boolean {
  const own: Board = { blocks: component.blocks, positions: component.positionsAt(0) };
  if (componentKey(own) !== componentKey(other)) return false;
  const shape = (board: Board, index: number): string => {
    const block = board.blocks[index]!;
    return `${block.orientation}${block.length}${block.lane}`;
  };
  const along = (board: Board): Map<string, number[]> => {
    const groups = new Map<string, number[]>();
    board.blocks.forEach((_, index) => {
      const key = shape(board, index);
      groups.set(key, [...(groups.get(key) ?? []), index]);
    });
    for (const indices of groups.values()) {
      indices.sort((a, b) => board.positions[a]! - board.positions[b]!);
    }
    return groups;
  };
  const mine = along(own);
  const theirs = along(other);
  const positions = new Array<number>(own.blocks.length);
  for (const [key, indices] of mine) {
    indices.forEach((index, k) => {
      positions[index] = other.positions[theirs.get(key)![k]!]!;
    });
  }
  return component.indexOf(positions) >= 0;
}

/** Entries per case: well inside the 5-second case limit on a slow machine. */
const CHUNK = 50;

/**
 * Everything one entry promises: a legal, unsolved board in canonical order
 * inside the tier's block bounds; a component of at most COMPONENT_LIMIT
 * boards (so no Hint on it, or on any board reached from it, is ever cut
 * short); exactly the recorded fewest moves by a complete search of that
 * component; the tier on both measures; for Hard, a board furthest from the
 * exit; and the same fewest moves and search size from the independent
 * brute-force oracle of test-helpers.ts.
 */
export function checkEntry(difficulty: Difficulty, entry: CatalogueEntry): void {
  const spec = TIERS[difficulty];
  const { board, minMoves } = entry;
  const name = `${difficulty} ${entry.index}`;
  const text = encodeBoard(board);
  expect(decodeBoard(text), name).toEqual(board);
  expect(isValidBoard(board), name).toBe(true);
  expect(isSolved(board), name).toBe(false);
  expect(meetsBlockBounds(spec, board), name).toBe(true);

  const result = exploreComponent(board, COMPONENT_LIMIT);
  expect(result.status, name).toBe('complete');
  if (result.status !== 'complete') return;
  const { component } = result;
  const start = component.indexOf(board.positions);
  expect(component.goalDistance[start], name).toBe(minMoves);
  const explored = exploredStates(component, start, minMoves);
  expect(explored !== null && meetsTier(spec, minMoves, explored), name).toBe(true);
  if (spec.farthest) expect(minMoves, name).toBe(component.maxDistance);

  expect(oracleSolve(board), name).toEqual({ minMoves, explored });
}

/**
 * Registers one case per CHUNK entries of `part` (1-based) of `parts` equal
 * slices of a tier's list. With `parts` 1, the whole list.
 */
export function checkSlice(difficulty: Difficulty, part: number, parts: number): void {
  const size = catalogueSize(difficulty);
  const from = Math.floor(((part - 1) * size) / parts);
  const to = Math.floor((part * size) / parts);
  const chunks: { from: number; to: number }[] = [];
  for (let at = from; at < to; at += CHUNK) chunks.push({ from: at, to: Math.min(to, at + CHUNK) });
  describe(`every bundled ${difficulty} board, part ${part} of ${parts} (§8)`, () => {
    it('covers its share of the list', () => {
      expect(to - from).toBeGreaterThan(0);
    });
    it.each(chunks)('entries $from–$to are exactly what the data says', ({ from: a, to: b }) => {
      for (let index = a; index < b; index++) {
        checkEntry(difficulty, catalogueEntry(difficulty, index));
      }
    });
  });
}
