/**
 * What a saved match has to prove before it is handed back (§8). The board's
 * own shape — gravity, piece values, the opener's parity — is checked when it
 * is decoded (game/serialize.ts); this is the part that only the record as a
 * whole can answer: whether the move count and the discs tell the same story.
 *
 * It matters because the move count is half the CPU's draw (§4). A save that
 * disagrees with its board would resume a match that answers differently than
 * the one that was put down, which is exactly the promise Undo rests on.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { applyPlayerMove, CPU, createSession, PLAYER } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { C4_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [C4_STORAGE_KEYS.game]: JSON.stringify(record) });

/** One drop in: a single disc on the board, a move count of one. */
const afterOneDrop = () => {
  const session = applyPlayerMove(createSession('normal', PLAYER, 'c4-persist'), 3)!.session;
  return toPersisted(session, 1);
};

describe('resuming a saved match (§8)', () => {
  it('gives back a match whose record adds up', async () => {
    const session = await loadSavedGame(saved(afterOneDrop()));
    expect(session).not.toBeNull();
    expect(session!.moveCount).toBe(1);
    expect(session!.toMove).toBe(CPU);
  });

  it('keeps the side that opened, so the turn comes back right', async () => {
    const cpuOpened = createSession('easy', CPU, 'c4-persist-second');
    const session = await loadSavedGame(saved(toPersisted(cpuOpened, 1)));
    expect(session!.first).toBe(CPU);
    // An empty board with the CPU as opener is the CPU's move, not the
    // player's — which the disc counts alone could never say.
    expect(session!.toMove).toBe(CPU);
  });

  it('discards a record whose move count does not match its board', async () => {
    // Same board, a move count no sequence of drops could have produced: one
    // disc per drop means one disc is always one move.
    expect(await loadSavedGame(saved({ ...afterOneDrop(), moveCount: 5 }))).toBeNull();
  });

  it('discards a record whose board could not have come from its opener', async () => {
    // The board holds one player disc and nothing else, which only happens
    // when the player opened.
    expect(await loadSavedGame(saved({ ...afterOneDrop(), first: CPU }))).toBeNull();
  });

  it('discards a record missing the side that opened', async () => {
    const { first: _dropped, ...withoutFirst } = afterOneDrop();
    expect(await loadSavedGame(saved(withoutFirst))).toBeNull();
  });
});
