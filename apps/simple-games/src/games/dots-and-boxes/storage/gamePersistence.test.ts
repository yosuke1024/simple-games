/**
 * What a saved match has to prove before it is handed back (§8): a board of
 * the right size, made of the right characters, whose boxes agree with their
 * lines; a move count that is the number of lines drawn; a turn the rules
 * could have produced; and a match not already over. Anything else goes back
 * to the home screen, not into an invented position.
 *
 * The move count matters beyond tidiness: it is half the CPU's draw (§4), so a
 * save that disagreed with its board would resume a match that answers
 * differently than the one that was put down.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import {
  applyCpuMove,
  applyPlayerMove,
  claim,
  CPU,
  createSession,
  edgesOfBox,
  PLAYER,
  type DotsAndBoxesSession,
} from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { DB_STORAGE_KEYS, gameSchema } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [DB_STORAGE_KEYS.game]: JSON.stringify(record) });

/** One line each way on 3×3: two lines down, the player to draw. */
function twoLinesIn(): DotsAndBoxesSession {
  const afterPlayer = applyPlayerMove(createSession('small', 'db-persist'), 0)!;
  return applyCpuMove(afterPlayer)!;
}

describe('resuming a saved match (§8)', () => {
  it('gives back the match it was given', async () => {
    const session = twoLinesIn();
    const loaded = await loadSavedGame(saved(toPersisted(session, 1)));
    expect(loaded).not.toBeNull();
    expect(loaded!.board).toEqual(session.board);
    expect(loaded!.moveCount).toBe(2);
    expect(loaded!.toMove).toBe(PLAYER);
    expect(loaded!.size).toBe('small');
    expect(loaded!.seed).toBe('db-persist');
    // What is not part of the position does not come back.
    expect(loaded!.history).toEqual([]);
    expect(loaded!.lastMove).toBeNull();
  });

  it('keeps the turn with the CPU mid-run, which the board alone cannot say', async () => {
    // The player's line hands over box (0,0); the CPU has not drawn yet.
    let board = createSession('medium', 'db-persist-cpu').board;
    for (const edge of edgesOfBox(4, 0, 0).slice(0, 2)) board = claim(board, CPU, edge)!.board;
    const session: DotsAndBoxesSession = {
      ...createSession('medium', 'db-persist-cpu'),
      board,
      moveCount: 2,
    };
    const handed = applyPlayerMove(session, edgesOfBox(4, 0, 0)[2])!;
    expect(handed.toMove).toBe(CPU);

    const loaded = await loadSavedGame(saved(toPersisted(handed, 1)));
    expect(loaded!.toMove).toBe(CPU);
    // …and after the CPU closes the box, it is still the CPU's move.
    const took = applyCpuMove(loaded!)!;
    expect(took.lastMove?.completed).toEqual([0]);
    const reloaded = await loadSavedGame(saved(toPersisted(took, 2)));
    expect(reloaded!.toMove).toBe(CPU);
  });

  it('has nothing to give back when nothing was saved', async () => {
    expect(await loadSavedGame(createMemoryKV({}))).toBeNull();
  });
});

describe('what it refuses (§8)', () => {
  const good = () => toPersisted(twoLinesIn(), 1);

  it('refuses a move count that does not match the lines drawn', async () => {
    expect(await loadSavedGame(saved({ ...good(), moveCount: 3 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...good(), moveCount: 1 }))).toBeNull();
  });

  it('refuses strings of the wrong length for the size', async () => {
    const record = good();
    expect(await loadSavedGame(saved({ ...record, edges: record.edges.slice(1) }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, boxes: `${record.boxes}.` }))).toBeNull();
    // The same 3×3 strings saved as a 4×4 match are the wrong size too.
    expect(await loadSavedGame(saved({ ...record, size: 'medium' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record, size: 'huge' }))).toBeNull();
  });

  it('refuses characters no board has', async () => {
    const record = good();
    expect(
      await loadSavedGame(saved({ ...record, edges: `3${record.edges.slice(1)}` })),
    ).toBeNull();
    expect(
      await loadSavedGame(saved({ ...record, boxes: `x${record.boxes.slice(1)}` })),
    ).toBeNull();
  });

  it('refuses boxes that disagree with their lines', async () => {
    const record = good();
    // An owner on a box that has at most one side drawn.
    expect(
      await loadSavedGame(saved({ ...record, boxes: `p${record.boxes.slice(1)}` })),
    ).toBeNull();

    // A box with all four sides and no owner.
    let board = createSession('small', 'db-closed').board;
    for (const edge of edgesOfBox(3, 1, 1)) board = claim(board, PLAYER, edge)!.board;
    const closed = {
      ...record,
      edges: board.edges,
      boxes: '.........',
      moveCount: 4,
    };
    expect(await loadSavedGame(saved(closed))).toBeNull();
    // …which is fine once the box has its owner.
    expect(await loadSavedGame(saved({ ...closed, boxes: board.boxes }))).not.toBeNull();
  });

  it('refuses an untouched board on the CPU’s turn: the player always draws first', async () => {
    const fresh = toPersisted(createSession('small', 'db-fresh'), 1);
    expect(await loadSavedGame(saved(fresh))).not.toBeNull();
    expect(await loadSavedGame(saved({ ...fresh, toMove: CPU }))).toBeNull();
    expect(await loadSavedGame(saved({ ...fresh, toMove: 3 }))).toBeNull();
  });

  it('refuses a finished match', async () => {
    let session = createSession('small', 'db-finished');
    while (session.status === 'playing') {
      session =
        session.toMove === PLAYER
          ? applyPlayerMove(session, session.board.edges.indexOf('0'))!
          : applyCpuMove(session)!;
    }
    expect(await loadSavedGame(saved(toPersisted(session, 1)))).toBeNull();
  });

  it('refuses a record missing its fields or from another version', async () => {
    const { seed: _seed, ...withoutSeed } = good();
    expect(await loadSavedGame(saved(withoutSeed))).toBeNull();
    expect(await loadSavedGame(saved({ ...good(), seed: '' }))).toBeNull();
    expect(await loadSavedGame(saved({ ...good(), schemaVersion: 2 }))).toBeNull();
    expect(gameSchema.validate('not a record')).toBeNull();
  });
});
