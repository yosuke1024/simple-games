/**
 * What a saved match has to prove before it is handed back (§8). The board's
 * own shape — known stones, black either level or one ahead — is checked when
 * it is decoded (game/serialize.ts); this is the part only the record as a
 * whole can answer: whether the move count and the stones tell the same
 * story.
 *
 * It matters because the move count is half the CPU's draw (§4). A save that
 * disagrees with its board would resume a match that answers differently than
 * the one that was put down, which is exactly the promise Undo rests on.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { BLACK, WHITE, applyPlayerMove, cellAt, createSession } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { GM_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [GM_STORAGE_KEYS.game]: JSON.stringify(record) });

/** One stone in: a single black stone, a move count of one. */
const afterOneStone = () => {
  const session = applyPlayerMove(
    createSession('normal', BLACK, 'gm-persist'),
    cellAt(7, 7),
  )!.session;
  return toPersisted(session, 1);
};

describe('resuming a saved match (§8)', () => {
  it('gives back a match whose record adds up', async () => {
    const session = await loadSavedGame(saved(afterOneStone()));
    expect(session).not.toBeNull();
    expect(session!.moveCount).toBe(1);
    expect(session!.toMove).toBe(WHITE);
  });

  it('keeps the colour the player holds, so the turn comes back right', async () => {
    const asWhite = createSession('easy', WHITE, 'gm-persist-white');
    const session = await loadSavedGame(saved(toPersisted(asWhite, 1)));
    expect(session!.playerColor).toBe(WHITE);
    // An empty board is black to move, and black here is the CPU — which the
    // stones alone could never say.
    expect(session!.toMove).toBe(BLACK);
  });

  it('discards a record whose move count does not match its board', async () => {
    // Same board, a move count no sequence of stones could have produced: one
    // stone per move means one stone is always one move.
    expect(await loadSavedGame(saved({ ...afterOneStone(), moveCount: 5 }))).toBeNull();
  });

  it('discards a record missing the colour the player holds', async () => {
    const { playerColor: _dropped, ...withoutColor } = afterOneStone();
    expect(await loadSavedGame(saved(withoutColor))).toBeNull();
  });

  it('discards a board with a stone value that is neither colour', async () => {
    const record = afterOneStone();
    expect(
      await loadSavedGame(saved({ ...record, board: `3${record.board.slice(1)}` })),
    ).toBeNull();
  });

  it('discards a finished match rather than resuming it', async () => {
    // Five black in a row across the top, and five white below, so the counts
    // still balance and only the completed line makes it terminal.
    const cells = Array.from({ length: 225 }, () => '0');
    for (let col = 0; col < 5; col++) {
      cells[cellAt(0, col)] = '1';
      cells[cellAt(2, col)] = '2';
    }
    expect(
      await loadSavedGame(saved({ ...afterOneStone(), board: cells.join(''), moveCount: 10 })),
    ).toBeNull();
  });
});
