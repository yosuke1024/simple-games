import { describe, expect, it } from 'vitest';
import { legalPits } from '../../games/mancala/game/engine';
import {
  legalMoves as nestedLegal,
  positionFromMoves,
} from '../../games/nested-tic-tac-toe/game/engine';
import { moveFrom, movePromotion, moveTo } from '../../games/chess/game/types';
import { generateLegalMoves } from '../../games/chess/game/engine';
import { parseFen } from '../../games/chess/game/fen';
import { adapter as mancala, type MancalaView } from './mancala';
import { adapter as dots, createDotsAdapter, type DotsView } from './dots-and-boxes';
import { adapter as nested, type NestedView } from './nested-tic-tac-toe';
import { adapter as nim, type NimView } from './nim';
import { adapter as chess, type ChessView } from './chess';
import type { GameAdapter, Seat } from '../gameTypes';

const random = () => 0.314159;
const play = (game: GameAdapter, full: unknown, action: unknown) =>
  game.apply(full, game.turn(game.project(full, 0)), action, random)!;

describe('nearby public game adapters', () => {
  for (const game of [mancala, dots, nested, nim, chess]) {
    it(`${game.id}: immutable views, strict actions and wrong-seat rejection`, () => {
      const full = game.create(random),
        before = JSON.stringify(full);
      const view = game.project(full, 0);
      expect(game.isView(view)).toBe(true);
      expect(game.project(full, 1)).toEqual(view);
      expect(game.isView({ ...(view as object), unexpected: 'field' })).toBe(false);
      expect(game.apply(full, 0, { kind: 'unknown' }, random)).toBeNull();
      expect(JSON.stringify(full)).toBe(before);
      expect(new TextEncoder().encode(JSON.stringify(view)).length).toBeLessThan(2300);
    });
  }
  it('Mancala keeps the extra turn, rejects the other side, and conserves all 48 seeds to the result', () => {
    let full = mancala.create(random);
    expect(mancala.apply(full, 1, { kind: 'sow', pit: 9 }, random)).toBeNull();
    full = play(mancala, full, { kind: 'sow', pit: 2 });
    expect(mancala.turn(full)).toBe(0);
    expect((full as MancalaView).pits[6]).toBe(1);
    let turns = 0;
    while (!mancala.finished(full) && turns++ < 2000) {
      const view = full as MancalaView;
      full = play(mancala, full, {
        kind: 'sow',
        pit: legalPits(view.pits, view.turn === 0 ? 1 : 2)[0],
      });
      expect(mancala.isView(full)).toBe(true);
      expect((full as MancalaView).pits.reduce((a, b) => a + b, 0)).toBe(48);
    }
    expect(mancala.finished(full)).toBe(true);
    expect(mancala.result(full).scores.reduce((a, b) => a + b, 0)).toBe(48);
    expect(mancala.result(full).winner).not.toBeNull();
  });
  it('Dots and Boxes uses every board size and retains a turn after claiming a box', () => {
    for (const size of [3, 4, 5] as const) {
      const game = createDotsAdapter(size);
      let full = game.create(random);
      // Top, left, bottom, right of the first box.
      for (const edge of [0, size * (size + 1), size, size * (size + 1) + 1])
        full = play(game, full, { kind: 'edge', edge });
      expect(game.turn(full)).toBe(1);
      expect(game.result(full).scores).toEqual([0, 1]);
      expect(game.apply(full, 1, { kind: 'edge', edge: 0 }, random)).toBeNull();
      while (!game.finished(full)) {
        const edge = (full as DotsView).board.edges.indexOf('0');
        full = play(game, full, { kind: 'edge', edge });
        expect(game.isView(full)).toBe(true);
      }
      expect(game.result(full).scores.reduce((a, b) => a + b, 0)).toBe(size * size);
    }
  });
  it('Nested Tic-Tac-Toe enforces the sent board and completes a legal game', () => {
    let full = play(nested, nested.create(random), { kind: 'place', cell: 8 });
    expect(nested.apply(full, 1, { kind: 'place', cell: 1 }, random)).toBeNull();
    expect(nested.apply(full, 0, { kind: 'place', cell: 72 }, random)).toBeNull();
    for (let i = 0; !nested.finished(full) && i < 81; i++) {
      const p = positionFromMoves((full as NestedView).moves)!;
      full = play(nested, full, { kind: 'place', cell: nestedLegal(p)[0] });
    }
    expect(nested.finished(full)).toBe(true);
    expect(nested.result(full).winner).not.toBeNull();
  });
  it('Nim removes exactly the requested stones and awards the last stone to its mover', () => {
    let full = nim.create(random);
    const first = full as NimView;
    expect(nim.apply(full, 0, { kind: 'take', row: 0, count: 9 }, random)).toBeNull();
    expect(nim.apply(full, 1, { kind: 'take', row: 0, count: 1 }, random)).toBeNull();
    let winner: Seat = 0;
    for (let row = 0; row < 4; row++) {
      winner = nim.turn(full);
      full = play(nim, full, { kind: 'take', row, count: first.heaps[row] });
    }
    expect(nim.finished(full)).toBe(true);
    expect(nim.result(full).winner).toBe(winner);
  });
  it('Chess uses legal moves and checkmate while only sending compact FEN and the last move', () => {
    let full = chess.create(random);
    expect(
      chess.apply(full, 0, { kind: 'move', from: 4, to: 60, promotion: 0 }, random),
    ).toBeNull();
    for (const [from, to] of [
      [13, 21],
      [52, 36],
      [14, 30],
      [59, 31],
    ])
      full = play(chess, full, { kind: 'move', from, to, promotion: 0 });
    const view = chess.project(full, 1) as ChessView;
    expect(chess.isView(view)).toBe(true);
    expect(view.outcome).toEqual({ winner: 1, reason: 'checkmate' });
    expect(Object.keys(view).sort()).toEqual(['fen', 'last', 'outcome', 'plies']);
    expect(JSON.stringify(view).length).toBeLessThan(300);
    expect(chess.result(view).winner).toBe(1);
  });
  it('Chess preserves threefold repetition in host history without sending that history', () => {
    let full = chess.create(random);
    for (let i = 0; i < 2; i++)
      for (const [from, to] of [
        [6, 21],
        [62, 45],
        [21, 6],
        [45, 62],
      ])
        full = play(chess, full, { kind: 'move', from, to, promotion: 0 });
    const view = chess.project(full, 0) as ChessView;
    expect(view.outcome).toEqual({ winner: null, reason: 'repetition' });
    expect(chess.result(view).winner).toBe('draw');
  });
  it('Chess guest legal choices are derived from the same engine after both seats move', () => {
    let full = chess.create(random);
    for (let i = 0; i < 30; i++) {
      const view = chess.project(full, 1) as ChessView;
      if (chess.finished(view)) break;
      const choices = generateLegalMoves(parseFen(view.fen)!);
      const move = choices[i % choices.length]!;
      full = play(chess, full, {
        kind: 'move',
        from: moveFrom(move),
        to: moveTo(move),
        promotion: movePromotion(move),
      });
      expect(full).not.toBeNull();
      expect(chess.isView(chess.project(full, 1))).toBe(true);
    }
  });
});
