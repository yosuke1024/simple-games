/**
 * The move string of docs/MAKE_THE_TARGET_RULES.md §10「手の文字列」: three
 * ASCII characters a move — the left term's slot digit, the operator
 * (`+ - * /`), the right term's slot digit — joined with no separator.
 * `0*3` is "slot 0 times slot 3": the result goes into slot 3 and slot 0 is
 * left empty (§1). The saved solution has the same form.
 *
 * Decoding checks the shape only: a string of whole triples, each a slot
 * digit `0`–`5` (MAX_TILES), an operator and a slot digit, at most
 * `maxMoves` of them. Whether a move names a slot that holds a number, and
 * is legal there, is the replay's question (engine.ts `isLegalMove`).
 */
import { MAX_TILES } from './tiers';
import { isOperator, type Move } from './types';

export function encodeMove(move: Move): string {
  return `${move.left}${move.op}${move.right}`;
}

export function encodeMoves(moves: readonly Move[]): string {
  return moves.map(encodeMove).join('');
}

function slotDigit(char: string): number | null {
  const code = char.charCodeAt(0) - 48;
  return code >= 0 && code < MAX_TILES ? code : null;
}

/** The moves a move string names, or null when it is not one (§10). Never throws. */
export function decodeMoves(text: unknown, maxMoves: number): Move[] | null {
  if (typeof text !== 'string' || text.length % 3 !== 0 || text.length / 3 > maxMoves) {
    return null;
  }
  const moves: Move[] = [];
  for (let i = 0; i < text.length; i += 3) {
    const left = slotDigit(text[i]!);
    const op = text[i + 1];
    const right = slotDigit(text[i + 2]!);
    if (left === null || right === null || !isOperator(op)) return null;
    moves.push({ left, op, right });
  }
  return moves;
}
