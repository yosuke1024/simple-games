/**
 * The move string of docs/MAKE_THE_TARGET_RULES.md §10「手の文字列」.
 */
import { describe, expect, it } from 'vitest';
import { decodeMoves, encodeMove, encodeMoves } from './serialize';
import type { Move } from './types';

const moves: Move[] = [
  { left: 0, op: '*', right: 3 },
  { left: 2, op: '-', right: 1 },
  { left: 5, op: '/', right: 4 },
  { left: 1, op: '+', right: 3 },
];

describe('the move string (§10)', () => {
  it('is three ASCII characters a move, with no separator', () => {
    expect(encodeMove(moves[0]!)).toBe('0*3');
    expect(encodeMoves(moves)).toBe('0*32-15/41+3');
    expect(encodeMoves([])).toBe('');
  });

  it('reads back exactly what it wrote', () => {
    expect(decodeMoves(encodeMoves(moves), 5)).toEqual(moves);
    expect(decodeMoves('', 4)).toEqual([]);
  });

  it('refuses anything that is not whole triples of digit, operator, digit', () => {
    for (const text of [
      '0*', // not a multiple of 3
      '0x3', // not an operator
      '0−3', // the board's symbol is not the stored one
      'a+3',
      '6+0', // slot digits stop at 5 (MAX_TILES)
      '0+ 3',
      ' 0+3',
      null,
      undefined,
      3,
      ['0+3'],
    ]) {
      expect(decodeMoves(text, 4), String(text)).toBeNull();
    }
  });

  it('refuses more moves than the problem can hold', () => {
    expect(decodeMoves('0+11+22+3', 3)).toHaveLength(3);
    expect(decodeMoves('0+11+22+33+4', 3)).toBeNull();
  });
});
