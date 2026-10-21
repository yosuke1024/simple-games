/**
 * The saved match, `nt.saveGame` v1 (docs/NESTED_TIC_TAC_TOE_RULES.md §8.1,
 * §8.2): a session survives the round trip — Undo included — and anything
 * off is discarded whole, so the player goes home instead of into a match
 * nobody played.
 */
import { describe, expect, it } from 'vitest';
import {
  parseMoves,
  parseSavedGame,
  sessionFromSavedGame,
  toSavedGame,
  type SavedGame,
} from './serialize';
import { applyCpuMove, applyPlayerMove, createSession, undo, type NestedSession } from './session';
import { isLegalMove, legalMoves, positionFromMoves } from './engine';
import { judge, randomGame } from './test-helpers';
import { cellOf, CIRCLE, CROSS, ONGOING, OPEN } from './types';

function midMatch(): NestedSession {
  let session = createSession('normal', true, 'nested-tic-tac-toe-save');
  for (let turn = 0; turn < 4; turn++) {
    session = applyPlayerMove(session, session.view.legal[0]!)!.session;
    session = applyCpuMove(session)!.session;
  }
  return session;
}

const valid = (): SavedGame =>
  toSavedGame({ ...midMatch(), elapsedSeconds: 75.8 }, 1_760_000_000_000)!;

/** A JSON round trip, as storage does it. */
const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** Cross takes board 0 and sends circle to it: board 0 is closed (engine.test.ts). */
const SELF_CLOSING = [1, 9, 2, 18, 0];

describe('the round trip (§8.1)', () => {
  it('saves the move list and the match’s settings, and restores the same session', () => {
    const session = midMatch();
    const saved = toSavedGame(session, 1_760_000_000_000)!;
    expect(saved).toEqual({
      schemaVersion: 1,
      seed: 'nested-tic-tac-toe-save',
      difficulty: 'normal',
      playerGoesFirst: true,
      moves: session.moves,
      elapsedSeconds: 0,
      savedAt: 1_760_000_000_000,
    });
    const parsed = parseSavedGame(stored(saved))!;
    expect(parsed).toEqual(saved);
    const restored = sessionFromSavedGame(parsed)!;
    expect(restored).toEqual(session);
  });

  it('floors the elapsed seconds and the saved-at time to whole numbers', () => {
    expect(valid().elapsedSeconds).toBe(75);
    expect(toSavedGame(midMatch(), 1_760_000_000_000.9)!.savedAt).toBe(1_760_000_000_000);
  });

  it('never writes a record its own reader would discard', () => {
    // Out of range, negative or not finite: clamped into what parseSavedGame
    // accepts, so the match survives the round trip instead of being lost.
    const cases: [number, number, number, number][] = [
      // elapsedSeconds, savedAt → written as
      [2e9, 1e16, 1e9, 1e15],
      [-5, -1, 0, 0],
      [Number.NaN, Number.POSITIVE_INFINITY, 0, 0],
      [1e9 + 0.5, 0.5, 1e9, 0],
    ];
    for (const [elapsedSeconds, savedAt, wroteElapsed, wroteSavedAt] of cases) {
      const saved = toSavedGame({ ...midMatch(), elapsedSeconds }, savedAt)!;
      expect([saved.elapsedSeconds, saved.savedAt]).toEqual([wroteElapsed, wroteSavedAt]);
      expect(parseSavedGame(stored(saved))).toEqual(saved);
    }
  });

  it('writes nothing for a finished match — it is never saved (§8.1)', () => {
    let session = createSession('easy', true, 'nested-tic-tac-toe-finished');
    while (session.status === 'playing') {
      session = (applyPlayerMove(session, session.view.legal[0]!) ?? applyCpuMove(session))!
        .session;
    }
    expect(toSavedGame(session, 0)).toBeNull();
  });

  it('brings Undo back with the match — no history is saved because the list is the history (§5)', () => {
    const session = midMatch();
    const restored = sessionFromSavedGame(parseSavedGame(stored(toSavedGame(session, 0)!))!)!;
    expect(undo(restored)!.moves).toEqual(session.moves.slice(0, -2));
  });

  it('keeps a match saved on the CPU’s turn on the CPU’s turn (§8.3)', () => {
    const session = midMatch();
    const pending = applyPlayerMove(session, session.view.legal[0]!)!.session;
    const restored = sessionFromSavedGame(parseSavedGame(stored(toSavedGame(pending, 0)!))!)!;
    expect(applyPlayerMove(restored, restored.view.legal[0]!)).toBeNull();
    expect(applyCpuMove(restored)!.session.moves).toEqual(applyCpuMove(pending)!.session.moves);
  });
});

describe('reading fails closed (§8.2)', () => {
  const withMoves = (moves: unknown) => ({ ...valid(), moves });

  it('rejects a move onto a filled cell', () => {
    expect(parseSavedGame(withMoves([40, 40]))).toBeNull();
  });

  it('rejects a move into a closed small board', () => {
    // Board 0 is taken; cell 3 is one of its empty cells, and circle is free.
    expect(parseMoves(SELF_CLOSING)).not.toBeNull();
    expect(parseSavedGame(withMoves([...SELF_CLOSING, cellOf(0, 3)]))).toBeNull();
  });

  it('rejects a move outside the board it was sent to', () => {
    expect(parseSavedGame(withMoves([8, 0]))).toBeNull();
  });

  it('rejects a list that ends finished', () => {
    const finished = randomGame('serialize-1');
    expect(judge(finished).result).not.toBe(ONGOING);
    expect(parseSavedGame(withMoves(finished))).toBeNull();
  });

  it('rejects a move after the match had finished — one that would be legal had it not', () => {
    // A won match with an open board left, and the move the next player
    // could have made if the win had not ended it: only the end rejects it.
    let finished: number[] = [];
    for (let n = 1; finished.length === 0; n++) {
      const game = randomGame(`serialize-${n}`);
      const end = judge(game);
      if ((end.result === CROSS || end.result === CIRCLE) && end.smalls.includes(OPEN))
        finished = game;
    }
    const notOver = positionFromMoves(finished)!;
    notOver.result = ONGOING;
    const cell = legalMoves(notOver)[0]!;
    expect(cell).toBeDefined();
    expect(isLegalMove(notOver, cell)).toBe(true);
    expect(parseMoves([...finished, cell])).toBeNull();
    expect(parseSavedGame(withMoves([...finished, cell]))).toBeNull();
  });

  it('rejects 82 moves or more, before reading any of them', () => {
    expect(parseSavedGame(withMoves(Array.from({ length: 82 }, (_, i) => i % 81)))).toBeNull();
    // A legal list is never that long, so the result alone cannot show the
    // length check (the list above fails at its third move anyway); the
    // proxy shows that no element of an over-long array is read.
    let reads = 0;
    const huge = new Proxy(new Array<number>(1_000_000).fill(0), {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads += 1;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    expect(parseMoves(huge)).toBeNull();
    expect(reads).toBe(0);
  });

  it('rejects moves that are not an array of whole cells 0–80', () => {
    for (const moves of [null, '40', { 0: 40 }, [40.5], [-1], [81], ['40'], [Number.NaN]]) {
      expect(parseSavedGame(withMoves(moves))).toBeNull();
    }
  });

  it('rejects a wrong or missing version', () => {
    expect(parseSavedGame({ ...valid(), schemaVersion: 2 })).toBeNull();
    expect(parseSavedGame({ ...valid(), schemaVersion: '1' })).toBeNull();
    const { schemaVersion: _omitted, ...rest } = valid();
    expect(parseSavedGame(rest)).toBeNull();
  });

  it('rejects an empty or over-long seed, and one that is not a string', () => {
    expect(parseSavedGame({ ...valid(), seed: '' })).toBeNull();
    expect(parseSavedGame({ ...valid(), seed: 'x'.repeat(65) })).toBeNull();
    expect(parseSavedGame({ ...valid(), seed: 'x'.repeat(64) })).not.toBeNull();
    expect(parseSavedGame({ ...valid(), seed: 7 })).toBeNull();
  });

  it('rejects an unknown difficulty and a side that is not a boolean', () => {
    expect(parseSavedGame({ ...valid(), difficulty: 'expert' })).toBeNull();
    expect(parseSavedGame({ ...valid(), playerGoesFirst: 'true' })).toBeNull();
    expect(parseSavedGame({ ...valid(), playerGoesFirst: undefined })).toBeNull();
  });

  it('rejects elapsed seconds and saved-at out of range or not whole', () => {
    for (const elapsedSeconds of [-1, 1.5, 1e9 + 1, '3', Number.POSITIVE_INFINITY]) {
      expect(parseSavedGame({ ...valid(), elapsedSeconds })).toBeNull();
    }
    expect(parseSavedGame({ ...valid(), elapsedSeconds: 1e9 })).not.toBeNull();
    for (const savedAt of [-1, 0.5, 1e15 + 1, null]) {
      expect(parseSavedGame({ ...valid(), savedAt })).toBeNull();
    }
  });

  it('rejects things that are not records at all', () => {
    for (const raw of [null, undefined, 0, 'save', [], [valid()]]) {
      expect(parseSavedGame(raw)).toBeNull();
    }
  });

  it('accepts the empty list — a match saved at its start', () => {
    expect(parseSavedGame(withMoves([]))).not.toBeNull();
  });
});
