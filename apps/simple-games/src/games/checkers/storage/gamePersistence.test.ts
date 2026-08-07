/**
 * What a saved match has to prove before it is handed back (§8). The board's
 * own shape — dark squares, piece values, an un-crowned man on the far edge —
 * is checked when it is decoded (game/serialize.ts); this is the part only
 * the record as a whole can answer.
 *
 * The half-played sequence is the case worth the care. A capture sequence is
 * forced to its end (§2), so a save taken in the middle of one has to come
 * back to the middle of it. If the cell it names cannot actually jump, the
 * restored match would sit on an obligation nothing can discharge, with every
 * other piece frozen — so that record is discarded rather than repaired.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import {
  applyPlayerStep,
  CPU,
  PLAYER,
  cellAt,
  createSession,
  currentMoves,
  restoreSession,
  type Board,
  type Piece,
} from '../game';
import { CPU_MAN, EMPTY, PLAYER_MAN, isDarkSquare } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { CK_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [CK_STORAGE_KEYS.game]: JSON.stringify(record) });

function boardOf(rows: readonly string[]): Board {
  const cells: Piece[] = [];
  for (const row of rows) {
    for (const character of row) {
      cells.push(character === 'p' ? PLAYER_MAN : character === 'c' ? CPU_MAN : EMPTY);
    }
  }
  for (let cell = 0; cell < cells.length; cell++) {
    if (cells[cell] !== EMPTY && !isDarkSquare(cell)) {
      throw new Error(`fixture puts a piece on the light square ${cell}`);
    }
  }
  return cells;
}

/** One quiet move in: a completed turn, and the CPU to answer. */
const afterOneTurn = () => {
  const opening = createSession('normal', PLAYER, 'ck-persist');
  return toPersisted(applyPlayerStep(opening, currentMoves(opening)[0]!)!.session, 1);
};

/** A double jump, stopped between its two steps. */
const midSequence = () => {
  const board = boardOf([
    '........',
    '........',
    '.....c..',
    '........',
    '...c....',
    '..p.....',
    '........',
    '........',
  ]);
  const session = restoreSession({
    seed: 'ck-mid',
    difficulty: 'normal',
    first: PLAYER,
    board,
    moveCount: 0,
    quietPlies: 0,
    pendingJumpFrom: null,
    elapsedSeconds: 0,
  });
  const half = applyPlayerStep(session, currentMoves(session)[0]!)!;
  expect(half.turnComplete).toBe(false);
  return toPersisted(half.session, 1);
};

describe('resuming a saved match (§8)', () => {
  it('gives back a match whose record adds up', async () => {
    const session = await loadSavedGame(saved(afterOneTurn()));
    expect(session).not.toBeNull();
    expect(session!.moveCount).toBe(1);
    expect(session!.toMove).toBe(CPU);
  });

  it('keeps the side that opened, so the turn comes back right', async () => {
    const cpuOpened = createSession('easy', CPU, 'ck-persist-second');
    const session = await loadSavedGame(saved(toPersisted(cpuOpened, 1)));
    expect(session!.first).toBe(CPU);
    // The opening position with the CPU as opener is the CPU's move, which
    // the board alone could never say.
    expect(session!.toMove).toBe(CPU);
  });

  it('comes back to the middle of a forced sequence, not to before it', async () => {
    const session = await loadSavedGame(saved(midSequence()));
    expect(session).not.toBeNull();
    expect(session!.pendingJumpFrom).toBe(cellAt(3, 4));
    expect(session!.toMove).toBe(PLAYER);
    expect(session!.moveCount).toBe(0);
    // The obligation is still the only thing on offer.
    const moves = currentMoves(session!);
    expect(moves).toHaveLength(1);
    expect(moves[0]!.from).toBe(cellAt(3, 4));
  });

  it('discards a sequence whose named piece cannot jump', async () => {
    // The cell holds nothing at all; nothing could discharge the obligation.
    expect(await loadSavedGame(saved({ ...midSequence(), pendingJumpFrom: 0 }))).toBeNull();
  });

  it('discards a sequence whose named piece belongs to the other side', async () => {
    const record = midSequence();
    // Hand the turn to the CPU while the pending cell still holds the
    // player's piece: no jump exists for the side that is to move.
    expect(await loadSavedGame(saved({ ...record, moveCount: 1 }))).toBeNull();
  });

  it('discards a record missing the side that opened', async () => {
    const { first: _dropped, ...withoutFirst } = afterOneTurn();
    expect(await loadSavedGame(saved(withoutFirst))).toBeNull();
  });

  it('discards a record whose board has a piece on a light square', async () => {
    const record = afterOneTurn();
    const board = `1${record.board.slice(1)}`;
    expect(await loadSavedGame(saved({ ...record, board }))).toBeNull();
  });

  it('discards a finished match rather than resuming it', async () => {
    const wipedOut = boardOf([
      '........',
      '........',
      '........',
      '........',
      '........',
      '..p.....',
      '........',
      '........',
    ]);
    const record = {
      ...afterOneTurn(),
      board: wipedOut.join(''),
    };
    expect(await loadSavedGame(saved(record))).toBeNull();
  });

  it('discards a record with a nonsense quiet-move counter', async () => {
    expect(await loadSavedGame(saved({ ...afterOneTurn(), quietPlies: -3 }))).toBeNull();
  });
});
