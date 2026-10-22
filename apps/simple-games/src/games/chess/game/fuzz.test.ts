/**
 * Random games to the end (docs/CHESS_RULES.md §12): over many seeds, no move
 * leaves the mover's king attacked, the incremental key always equals a key
 * computed from scratch, taking every move back restores the start, and each
 * game ends for exactly the reason the rules give — judged again here from
 * the FEN text, by code that shares nothing with `rules.ts` but the move
 * generator.
 */
import { describe, expect, it } from 'vitest';
import { computeHash, generateLegalMoves, hasLegalEnPassant, inCheck } from './engine';
import { toFen } from './fen';
import { createGame, undoMove, type Game } from './record';
import { randomGame } from './test-helpers';
import { BLACK, FIFTY_MOVE_PLIES, WHITE, opponentOf, type EndReason } from './types';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Insufficient material read from the FEN placement alone (§3.3). */
function insufficientFromFen(fenText: string): boolean {
  const placement = fenText.split(' ')[0]!;
  let knights = 0;
  const bishopColours: number[] = [];
  let rank = 7;
  let file = 0;
  for (const character of placement) {
    if (character === '/') {
      rank -= 1;
      file = 0;
    } else if (/\d/.test(character)) {
      file += Number(character);
    } else {
      const kind = character.toLowerCase();
      if (kind === 'p' || kind === 'r' || kind === 'q') return false;
      if (kind === 'n') knights += 1;
      if (kind === 'b') bishopColours.push((file + rank) % 2);
      file += 1;
    }
  }
  if (knights > 1 || (knights === 1 && bishopColours.length > 0)) return false;
  return bishopColours.every((colour) => colour === bishopColours[0]);
}

/** The repetition identity from the FEN text: placement, side, rights, and a legal en passant square. */
function repetitionIdentity(game: Game): string {
  const [placement, side, castling, ep] = toFen(game.position).split(' ');
  return `${placement} ${side} ${castling} ${hasLegalEnPassant(game.position) ? ep : '-'}`;
}

interface Played {
  readonly plies: number;
  readonly reason: EndReason;
}

const SEEDS_PER_GROUP = 8;
const GROUPS = 25;
const results: Played[] = [];

describe('random games to the end', () => {
  it.each(Array.from({ length: GROUPS }, (_, group) => ({ group })))(
    'group $group: legal, consistent, and ended by the rules',
    ({ group }) => {
      for (let index = 0; index < SEEDS_PER_GROUP; index++) {
        const seed = `chess-fuzz-${group}-${index}`;
        // Occurrences of each position, the start included (§3.4).
        const seen = new Map<string, number>([[repetitionIdentity(createGame()), 1]]);
        let last = '';
        const record = (game: Game) => {
          const identity = repetitionIdentity(game);
          seen.set(identity, (seen.get(identity) ?? 0) + 1);
          return identity;
        };
        const game = randomGame(seed, (game) => {
          const mover = opponentOf(game.position.side);
          // No move leaves the mover's own king attacked.
          expect(inCheck(game.position, mover)).toBe(false);
          const fresh = computeHash(game.position);
          expect(game.position.hashHi).toBe(fresh.hi);
          expect(game.position.hashLo).toBe(fresh.lo);
          const identity = record(game);
          if (game.outcome === null) {
            // A game still going is not over by any of the rules.
            expect(seen.get(identity)!).toBeLessThan(3);
            expect(game.position.halfmoveClock).toBeLessThan(FIFTY_MOVE_PLIES);
            expect(insufficientFromFen(toFen(game.position))).toBe(false);
            expect(game.legal.length).toBeGreaterThan(0);
          }
          last = identity;
        });

        const outcome = game.outcome!;
        const fenText = toFen(game.position);
        const noMoves = generateLegalMoves(game.position).length === 0;
        const checked = inCheck(game.position);
        switch (outcome.reason) {
          case 'checkmate':
            expect(noMoves && checked).toBe(true);
            expect(outcome.winner).toBe(game.position.side === WHITE ? BLACK : WHITE);
            break;
          case 'stalemate':
            expect(noMoves && !checked).toBe(true);
            break;
          case 'insufficient':
            expect(noMoves).toBe(false);
            expect(insufficientFromFen(fenText)).toBe(true);
            break;
          case 'repetition':
            expect(noMoves || insufficientFromFen(fenText)).toBe(false);
            expect(seen.get(last)).toBe(3);
            break;
          case 'fifty':
            expect(noMoves || insufficientFromFen(fenText)).toBe(false);
            expect(game.position.halfmoveClock).toBe(FIFTY_MOVE_PLIES);
            break;
        }
        if (outcome.reason !== 'checkmate') expect(outcome.winner).toBeNull();

        results.push({ plies: game.moves.length, reason: outcome.reason });

        // Taking every move back restores the starting position exactly.
        while (undoMove(game));
        expect(toFen(game.position)).toBe(START_FEN);
        expect(game.history).toHaveLength(1);
      }
    },
  );

  it('reports how the games ended, without judging the mix', () => {
    const byReason = new Map<EndReason, number>();
    for (const result of results)
      byReason.set(result.reason, (byReason.get(result.reason) ?? 0) + 1);
    const plies = results.map((result) => result.plies).sort((a, b) => a - b);
    console.log(
      `chess fuzz: ${results.length} random games — ` +
        [...byReason.entries()].map(([reason, count]) => `${reason} ${count}`).join(', ') +
        ` — plies min ${plies[0]}, median ${plies[Math.floor(plies.length / 2)]}, max ${plies[plies.length - 1]}`,
    );
    expect(results).toHaveLength(GROUPS * SEEDS_PER_GROUP);
  });
});
