/**
 * The save's alphabets and the fail-closed decoding of docs/PIPE_LINK_RULES.md §7.
 */
import { describe, expect, it } from 'vitest';
import { generatePuzzle } from './generator';
import {
  decodeOrientations,
  decodeParts,
  decodeTypes,
  encodeOrientations,
  encodeTypes,
} from './serialize';

const puzzle = generatePuzzle('serialize-medium', 'medium');
const parts = {
  types: encodeTypes(puzzle.board.types),
  source: puzzle.board.source,
  solution: encodeOrientations(puzzle.solution),
  initial: encodeOrientations(puzzle.initial),
  current: encodeOrientations(puzzle.initial),
};

describe('types and orientations', () => {
  it('round-trip one letter and one digit per cell', () => {
    expect(parts.types).toMatch(/^[eslt]{49}$/);
    expect(parts.solution).toMatch(/^[0-3]{49}$/);
    expect(decodeTypes(parts.types, 49)).toEqual(puzzle.board.types);
    expect(decodeOrientations(parts.solution, puzzle.board.types)).toEqual(puzzle.solution);
  });

  it('refuses a wrong length, an unknown letter, a cross, or a digit outside the period', () => {
    expect(decodeTypes(parts.types.slice(1), 49)).toBeNull();
    expect(decodeTypes(`x${parts.types.slice(1)}`, 49)).toBeNull();
    expect(decodeTypes(`+${parts.types.slice(1)}`, 49)).toBeNull();
    expect(decodeTypes(42, 49)).toBeNull();
    const types = decodeTypes('sse', 3)!;
    expect(decodeOrientations('101', types)).toEqual([1, 0, 1]);
    expect(decodeOrientations('201', types)).toBeNull(); // a straight has 2 orientations
    expect(decodeOrientations('014', types)).toBeNull();
    expect(decodeOrientations('0-1', types)).toBeNull();
    expect(decodeOrientations('01', types)).toBeNull();
    expect(decodeOrientations(null, types)).toBeNull();
  });
});

describe('decodeParts (§7)', () => {
  it('reads a generated board back exactly', () => {
    const decoded = decodeParts(parts, 7, 7)!;
    expect(decoded.board).toEqual(puzzle.board);
    expect(decoded.solution).toEqual(puzzle.solution);
    expect(decoded.initial).toEqual(puzzle.initial);
  });

  it('refuses an answer that is not a solved arrangement', () => {
    expect(decodeParts({ ...parts, solution: parts.initial }, 7, 7)).toBeNull();
    const flipped = [...puzzle.solution];
    const cell = puzzle.board.types.findIndex((t) => t !== 'straight');
    flipped[cell] = (flipped[cell]! + 1) % 4;
    expect(decodeParts({ ...parts, solution: encodeOrientations(flipped) }, 7, 7)).toBeNull();
  });

  it('refuses types that are not the answer’s own', () => {
    const types = parts.types.split('');
    const at = types.findIndex((t) => t === 'l');
    types[at] = 't';
    expect(decodeParts({ ...parts, types: types.join('') }, 7, 7)).toBeNull();
  });

  it('refuses a source off the board or not an integer, and a size that is not the record’s', () => {
    expect(decodeParts({ ...parts, source: 49 }, 7, 7)).toBeNull();
    expect(decodeParts({ ...parts, source: -1 }, 7, 7)).toBeNull();
    expect(decodeParts({ ...parts, source: 1.5 }, 7, 7)).toBeNull();
    expect(decodeParts({ ...parts, source: '3' }, 7, 7)).toBeNull();
    expect(decodeParts(parts, 8, 8)).toBeNull();
    expect(decodeParts(parts, 0, 49)).toBeNull();
  });

  it('refuses initial or current orientations that do not fit their tiles', () => {
    const bad = parts.initial.replace(/^./, '9');
    expect(decodeParts({ ...parts, initial: bad }, 7, 7)).toBeNull();
    expect(decodeParts({ ...parts, current: bad }, 7, 7)).toBeNull();
    expect(decodeParts({ ...parts, current: parts.current.slice(2) }, 7, 7)).toBeNull();
  });
});
