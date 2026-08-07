/**
 * What a saved match has to prove before it is handed back (§9). The board's
 * own shape is checked when it is decoded (game/serialize.ts); this is the
 * part that only the record as a whole can answer — whether the move count
 * and the discs tell the same story.
 *
 * It matters because the move count is half the CPU's draw (§5). A save that
 * disagrees with its board would resume a match that answers differently than
 * the one that was put down, which is exactly the promise Undo rests on.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { BLACK, createSession, WHITE } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { RV_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [RV_STORAGE_KEYS.game]: JSON.stringify(record) });

/** The opening, one legal move in: five discs on the board, one move played. */
const afterOneMove = () => {
  const session = createSession('normal', BLACK, 'reversi-persist');
  return toPersisted({ ...session, board: [...session.board], moveCount: 0 }, 1);
};

describe('resuming a saved match (§9)', () => {
  it('gives back a match whose record adds up', async () => {
    const session = await loadSavedGame(saved(afterOneMove()));
    expect(session).not.toBeNull();
    expect(session!.moveCount).toBe(0);
    expect(session!.playerColor).toBe(BLACK);
  });

  it('keeps the colour the match was played with', async () => {
    const white = createSession('hard', WHITE, 'reversi-persist-white');
    const session = await loadSavedGame(saved(toPersisted(white, 1)));
    expect(session!.playerColor).toBe(WHITE);
    // White holds the second move, so a fresh board is still black's.
    expect(session!.toMove).toBe(BLACK);
  });

  it('discards a record whose move count does not match its board', async () => {
    // Same board, a move count no sequence of moves could have produced: one
    // disc per move means four discs is always zero moves.
    expect(await loadSavedGame(saved({ ...afterOneMove(), moveCount: 7 }))).toBeNull();
  });

  it('discards a record with no board at all', async () => {
    expect(await loadSavedGame(saved({ ...afterOneMove(), board: '' }))).toBeNull();
  });

  it('discards a record missing the colour the player took', async () => {
    const { playerColor: _dropped, ...withoutColor } = afterOneMove();
    expect(await loadSavedGame(saved(withoutColor))).toBeNull();
  });
});
