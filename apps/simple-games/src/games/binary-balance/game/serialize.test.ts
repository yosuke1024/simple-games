/**
 * The save strings of docs/BINARY_BALANCE_RULES.md §11, and the fail-closed
 * list: a record play could not have produced is dropped, never repaired.
 */
import { describe, expect, it } from 'vitest';
import {
  decodeBoards,
  decodeGivens,
  decodeLinks,
  decodeMarks,
  decodeSolution,
  encodeBoard,
  encodeLinks,
} from './serialize';
import { createDifficultySession, doTap } from './session';
import { EMPTY } from './types';

const session = doTap(createDifficultySession('medium', 'binary-balance-medium-golden'), 0)!;
const parts = {
  links: encodeLinks(session.links),
  solution: encodeBoard(session.solution),
  givens: encodeBoard(session.givens),
  marks: encodeBoard(session.marks),
};

/** Replaces one character of a board string. */
const withCharacter = (text: string, index: number, character: string): string =>
  text.slice(0, index) + character + text.slice(index + 1);

describe('links (§11)', () => {
  it('encode as h<i>= / v<i>x, comma-separated, and read back in order', () => {
    const links = [
      { dir: 'h', index: 3, same: true },
      { dir: 'v', index: 10, same: false },
    ] as const;
    expect(encodeLinks(links)).toBe('h3=,v10x');
    expect(decodeLinks('v10x,h3=', 6)).toEqual(links);
  });

  it('refuse anything that names no real edge, or names one twice', () => {
    expect(decodeLinks('', 6)).toBeNull(); // no link at all (§6)
    expect(decodeLinks('h5=', 6)).toBeNull(); // off the right edge
    expect(decodeLinks('v30x', 6)).toBeNull(); // off the bottom
    expect(decodeLinks('h36=', 6)).toBeNull(); // off the board
    expect(decodeLinks('h0=,h0x', 6)).toBeNull(); // twice
    expect(decodeLinks('h0?', 6)).toBeNull(); // not = or x
    expect(decodeLinks('d0=', 6)).toBeNull(); // not h or v
    expect(decodeLinks('h0=,', 6)).toBeNull();
    expect(decodeLinks(42, 6)).toBeNull();
    // The last real edges: the bottom row's h, the right column's v.
    expect(decodeLinks('h34=,v29x', 6)).not.toBeNull();
  });
});

describe('boards (§11)', () => {
  it('round-trip exactly', () => {
    const decoded = decodeBoards(parts, session.size);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.givens).toEqual([...session.givens]);
    expect(decoded?.marks).toEqual([...session.marks]);
    expect(decoded?.links).toEqual([...session.links]);
  });

  it('drop a solution that breaks a rule, links included', () => {
    const [first] = session.links;
    const flipped = encodeLinks([{ ...first!, same: !first!.same }, ...session.links.slice(1)]);
    expect(decodeSolution(parts.solution, decodeLinks(flipped, 6)!, 6)).toBeNull();
    expect(decodeBoards({ ...parts, links: flipped }, 6)).toBeNull();
    // Three alike in a row.
    expect(decodeSolution('000111' + parts.solution.slice(6), session.links, 6)).toBeNull();
    // Wrong length.
    expect(decodeSolution(parts.solution.slice(1), session.links, 6)).toBeNull();
  });

  it('drop givens that disagree with the solution', () => {
    const index = session.givens.findIndex((given) => given !== EMPTY);
    const wrong = withCharacter(parts.givens, index, parts.givens[index] === '0' ? '1' : '0');
    expect(decodeGivens(wrong, 6, session.solution)).toBeNull();
  });

  it('drop a mark written over a given, and characters play never writes', () => {
    const index = session.givens.findIndex((given) => given !== EMPTY);
    expect(decodeMarks(withCharacter(parts.marks, index, '1'), 6, session.givens)).toBeNull();
    expect(decodeMarks(withCharacter(parts.marks, 1, 'x'), 6, session.givens)).toBeNull();
    expect(decodeGivens(withCharacter(parts.givens, 1, '2'), 6, session.solution)).toBeNull();
  });
});
