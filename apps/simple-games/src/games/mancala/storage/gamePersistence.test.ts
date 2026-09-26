/**
 * What a saved match has to prove before it is handed back (§8): a board that
 * could exist (fourteen whole counts adding up to 48), sides that are sides,
 * a turn that is stored rather than guessed, and a game still in play. The
 * move count is half the CPU's draw (§4), so a save that disagrees with
 * itself would resume a match that answers differently than the one that was
 * put down — which is exactly the promise Undo rests on.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { applyPlayerMove, CPU, createSession, PLAYER, PLAYER_STORE } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { gameSchema, MC_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [MC_STORAGE_KEYS.game]: JSON.stringify(record) });

/** One move in: pit 0 sown, the CPU to move. */
const afterOneMove = () => {
  const session = applyPlayerMove(createSession('normal', PLAYER, 'mancala-persist'), 0)!;
  return toPersisted(session, 1);
};

/** An extra turn in: pit 2 into the store, the player to move again. */
const afterExtraTurn = () => {
  const session = applyPlayerMove(createSession('hard', PLAYER, 'mancala-persist-extra'), 2)!;
  return toPersisted(session, 1);
};

describe('resuming a saved match (§8)', () => {
  it('gives back a match whose record adds up', async () => {
    const session = await loadSavedGame(saved(afterOneMove()));
    expect(session).not.toBeNull();
    expect(session!.moveCount).toBe(1);
    expect(session!.toMove).toBe(CPU);
    expect(session!.pits).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(session!.history).toEqual([]);
    expect(session!.lastMove).toBeNull();
  });

  it('keeps the stored turn after an extra turn — the board could not say it', async () => {
    const session = await loadSavedGame(saved(afterExtraTurn()));
    expect(session!.toMove).toBe(PLAYER);
    expect(session!.pits[PLAYER_STORE]).toBe(1);
  });

  it('keeps the side that opened, so a CPU opening comes back on the CPU’s turn', async () => {
    const cpuOpened = createSession('easy', CPU, 'mancala-persist-second');
    const session = await loadSavedGame(saved(toPersisted(cpuOpened, 1)));
    expect(session!.first).toBe(CPU);
    expect(session!.toMove).toBe(CPU);
  });

  it('round-trips through the schema unchanged', () => {
    const record = afterExtraTurn();
    expect(gameSchema.validate(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });
});

describe('discarding what could not have come from play (§8)', () => {
  it('discards seeds made or lost', async () => {
    const record = afterOneMove();
    const pits = [...record.pits];
    pits[3]! += 1;
    expect(await loadSavedGame(saved({ ...record, pits }))).toBeNull();
  });

  it('discards a board of the wrong length, or with a negative or fractional count', async () => {
    const record = afterOneMove();
    expect(await loadSavedGame(saved({ ...record, pits: record.pits.slice(1) }))).toBeNull();
    const negative = [...record.pits];
    negative[1] = -1;
    negative[2]! += 2;
    expect(await loadSavedGame(saved({ ...record, pits: negative }))).toBeNull();
    const fractional = [...record.pits];
    fractional[1] = 4.5;
    fractional[2] = 4.5;
    expect(await loadSavedGame(saved({ ...record, pits: fractional }))).toBeNull();
  });

  it('discards a side that is not one of the two', async () => {
    expect(await loadSavedGame(saved({ ...afterOneMove(), toMove: 0 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...afterOneMove(), first: 3 }))).toBeNull();
    const { toMove: _dropped, ...withoutTurn } = afterOneMove();
    expect(await loadSavedGame(saved(withoutTurn))).toBeNull();
  });

  it('discards a negative move count', async () => {
    expect(await loadSavedGame(saved({ ...afterOneMove(), moveCount: -1 }))).toBeNull();
  });

  it('discards "no moves yet" on anything but the opening, with the opener to move', async () => {
    // A moved board claiming no moves.
    expect(await loadSavedGame(saved({ ...afterOneMove(), moveCount: 0 }))).toBeNull();
    // The opening, with the wrong side up.
    const opening = toPersisted(createSession('easy', PLAYER, 'mancala-persist-open'), 1);
    expect(await loadSavedGame(saved({ ...opening, toMove: CPU }))).toBeNull();
    // And the opening as it really is comes back.
    expect(await loadSavedGame(saved(opening))).not.toBeNull();
  });

  it('discards a finished match', async () => {
    const record = afterOneMove();
    // The player's row empty: over, whatever the rest says.
    const pits = [0, 0, 0, 0, 0, 0, 20, 4, 4, 4, 4, 4, 4, 4];
    expect(await loadSavedGame(saved({ ...record, pits }))).toBeNull();
  });

  it('discards an unknown difficulty or an empty seed', async () => {
    expect(await loadSavedGame(saved({ ...afterOneMove(), difficulty: 'expert' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...afterOneMove(), seed: '' }))).toBeNull();
  });
});
