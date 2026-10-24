/**
 * The save format of docs/LOOP_PUZZLE_RULES.md §12: what is written, that it
 * reads back exactly, and that every record play could not have produced is
 * refused — including a board whose answer cannot be proven, since the answer
 * is re-derived on load rather than read, and a clue string damaged into
 * another valid board, which only the digest can tell.
 */
import { describe, expect, it } from 'vitest';
import { BUNDLED_BOARDS } from './bundled';
import { emptyMarks } from './engine';
import { gridFor } from './grid';
import {
  cluesDigest,
  decodeBoard,
  decodeClues,
  decodeMarks,
  encodeClues,
  encodeMarks,
} from './serialize';
import { countSolutions, uniqueSolution } from './solver';
import { CROSS, LINE, PRESETS, UNKNOWN, type Mark } from './types';

const preset = PRESETS.medium;
const board = BUNDLED_BOARDS.medium[0]!;
const clues = decodeClues(board.clues, 5, 5)!;
const solution = uniqueSolution({ ...preset, clues })!;
const edgeCount = gridFor(5, 5).edgeCount;

describe('encoding (§12)', () => {
  it('writes one character per cell and per edge', () => {
    expect(encodeClues([0, 1, null, 3])).toBe('01.3');
    expect(encodeMarks([UNKNOWN, LINE, CROSS, LINE])).toBe('.LXL');
    expect(encodeClues(clues)).toBe(board.clues);
    expect(encodeMarks(emptyMarks(preset))).toBe('.'.repeat(edgeCount));
  });

  it('reads back exactly what it wrote', () => {
    const marks: Mark[] = emptyMarks(preset);
    marks[0] = LINE;
    marks[7] = CROSS;
    expect(decodeMarks(encodeMarks(marks), edgeCount)).toEqual(marks);
    expect(decodeClues(encodeClues(clues), 5, 5)).toEqual(clues);
  });

  it('refuses the wrong length, an unknown character, or a 4', () => {
    expect(decodeClues(board.clues.slice(1), 5, 5)).toBeNull();
    expect(decodeClues(`${board.clues.slice(1)}4`, 5, 5)).toBeNull();
    expect(decodeClues(`${board.clues.slice(1)}a`, 5, 5)).toBeNull();
    expect(decodeClues(`${board.clues.slice(1)}-`, 5, 5)).toBeNull();
    expect(decodeClues(42, 5, 5)).toBeNull();
    expect(decodeClues('....', 2, 2)).toEqual([null, null, null, null]);
    expect(decodeClues('.', 1, 1)).toBeNull(); // no 1×1 board
    expect(decodeMarks('.'.repeat(edgeCount - 1), edgeCount)).toBeNull();
    expect(decodeMarks(`${'.'.repeat(edgeCount - 1)}x`, edgeCount)).toBeNull();
    expect(decodeMarks(null, edgeCount)).toBeNull();
  });
});

describe('decoding a saved board (§12)', () => {
  /** A record as the storage layer hands it over; the digest is the clues' own unless given. */
  const parts = (marks: readonly Mark[], text = board.clues, digest?: string) => ({
    width: 5,
    height: 5,
    clues: text,
    digest: digest ?? cluesDigest(decodeClues(text, 5, 5) ?? []),
    marks: encodeMarks(marks),
  });

  it('re-derives the answer and keeps the marks as written', () => {
    const marks: Mark[] = emptyMarks(preset);
    marks[3] = LINE;
    marks[4] = CROSS;
    const decoded = decodeBoard(parts(marks), preset)!;
    expect(decoded.clues).toEqual(clues);
    expect(decoded.solution).toEqual(solution);
    expect(decoded.marks).toEqual(marks);
    // A board breaking a rule is still a board play produces.
    const broken = solution.map((m) => (m === LINE ? CROSS : LINE));
    expect(decodeBoard(parts(broken), preset)).not.toBeNull();
  });

  it('refuses a size that is not the preset', () => {
    expect(decodeBoard({ ...parts(emptyMarks(preset)), width: 6 }, preset)).toBeNull();
    expect(decodeBoard({ ...parts(emptyMarks(preset)), height: '5' }, preset)).toBeNull();
    expect(decodeBoard(parts(emptyMarks(preset)), PRESETS.hard)).toBeNull();
  });

  it('refuses clues with two loops, or with none', () => {
    // Two numbers alone cannot pin a loop down on a 5×5.
    let kept = 0;
    const fewer = [...board.clues].map((ch) => (ch !== '.' && kept++ < 2 ? ch : '.')).join('');
    expect(countSolutions({ ...preset, clues: decodeClues(fewer, 5, 5)! }).count).toBe(2);
    expect(decodeBoard(parts(emptyMarks(preset), fewer), preset)).toBeNull();
    expect(decodeBoard(parts(emptyMarks(preset), '.'.repeat(25)), preset)).toBeNull();
    expect(decodeBoard(parts(emptyMarks(preset), '0'.repeat(25)), preset)).toBeNull();
  });

  it('refuses a board whose answer cannot be proven within the node limit', () => {
    const hard = BUNDLED_BOARDS.hard[0]!;
    const hardParts = {
      width: 6,
      height: 6,
      clues: hard.clues,
      digest: cluesDigest(decodeClues(hard.clues, 6, 6)!),
      marks: encodeMarks(emptyMarks(PRESETS.hard)),
    };
    expect(decodeBoard(hardParts, PRESETS.hard)).not.toBeNull();
    expect(decodeBoard(hardParts, PRESETS.hard, 1)).toBeNull();
  });

  it('refuses clues damaged into another one-loop board: the digest no longer matches', () => {
    // Every one-character change of the clue string that still decodes to a
    // board with exactly one loop — a different puzzle the search alone
    // would accept. The digest written with the original clues refuses each.
    const original = cluesDigest(clues);
    let stillUnique = 0;
    for (let cell = 0; cell < board.clues.length; cell++) {
      for (const ch of '.0123') {
        if (ch === board.clues[cell]) continue;
        const text = board.clues.slice(0, cell) + ch + board.clues.slice(cell + 1);
        const changed = decodeClues(text, 5, 5)!;
        if (uniqueSolution({ ...preset, clues: changed }) === null) continue;
        stillUnique++;
        expect(decodeBoard(parts(emptyMarks(preset), text, original), preset), text).toBeNull();
        // With its own digest the same string is a valid board: the digest is what refuses it.
        expect(decodeBoard(parts(emptyMarks(preset), text), preset), text).not.toBeNull();
      }
    }
    expect(stillUnique).toBeGreaterThan(0);
  });

  it('refuses a missing or malformed digest', () => {
    const marks = emptyMarks(preset);
    expect(decodeBoard({ ...parts(marks), digest: undefined }, preset)).toBeNull();
    expect(decodeBoard({ ...parts(marks), digest: 42 }, preset)).toBeNull();
    expect(
      decodeBoard({ ...parts(marks), digest: cluesDigest(clues).toUpperCase() }, preset),
    ).toBeNull();
    expect(cluesDigest(clues)).toMatch(/^lp1:[0-9a-f]{8}$/);
  });

  it('refuses a finished board: a solved game is history, not a game to resume', () => {
    expect(decodeBoard(parts(solution), preset)).toBeNull();
    const lines = solution.map((m) => (m === LINE ? LINE : UNKNOWN));
    expect(decodeBoard(parts(lines), preset)).toBeNull();
  });
});
