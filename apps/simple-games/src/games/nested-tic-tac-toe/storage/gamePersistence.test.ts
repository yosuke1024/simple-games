/**
 * The saved match, through the storage layer (docs/NESTED_TIC_TAC_TOE_RULES.md
 * §8): what is written comes back as the same match — on the same turn, with
 * the same history — and anything the replay refuses comes back as nothing at
 * all, never as a different match. game/serialize.test.ts covers the record's
 * own codec case by case; this is the layer the screens actually load through.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRaw } from '../../../storage/repo';
import {
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  createSession,
  EMPTY,
  isCpuTurn,
  isOver,
  isPlayerTurn,
  positionFromMoves,
  toSavedGame,
  undo,
  type NestedSession,
} from '../game';
import { playerWinsWith } from '../ui/testPositions';
import { clearSavedGame, loadSavedGame, saveGame } from './gamePersistence';
import { NT_STORAGE_KEYS } from './schemas';

const SEED = 'nested-tic-tac-toe-persist';

const stored = (record: unknown) =>
  createMemoryKV({ [NT_STORAGE_KEYS.saveGame]: JSON.stringify(record) });

/** The player's centre, the CPU's reply: two moves, the player to move. */
function twoMoves(): NestedSession {
  const opening = createSession('normal', true, SEED);
  const mine = applyPlayerMove(opening, 40)!.session;
  return applyCpuMove(mine)!.session;
}

const record = (session: NestedSession) => toSavedGame(session, 1)!;

describe('round trip (§8.1)', () => {
  it('gives back the same match, on the same turn', async () => {
    const kv = createMemoryKV();
    const session = { ...twoMoves(), elapsedSeconds: 42 };
    await saveGame(session, kv);
    const loaded = await loadSavedGame(kv);
    expect(loaded).not.toBeNull();
    expect(loaded!.moves).toEqual(session.moves);
    expect(loaded!.seed).toBe(SEED);
    expect(loaded!.difficulty).toBe('normal');
    expect(loaded!.playerGoesFirst).toBe(true);
    expect(loaded!.elapsedSeconds).toBe(42);
    expect(loaded!.view).toEqual(session.view);
    expect(isPlayerTurn(loaded!)).toBe(true);
  });

  it('keeps a match left on the CPU’s turn on the CPU’s turn', async () => {
    const kv = createMemoryKV();
    const opening = createSession('easy', true, SEED);
    await saveGame(applyPlayerMove(opening, 40)!.session, kv);
    const loaded = await loadSavedGame(kv);
    expect(isCpuTurn(loaded!)).toBe(true);
    // And the CPU answers it exactly as it would have (§4 — seed and move count).
    expect(applyCpuMove(loaded!)!.placed).toBe(
      applyCpuMove(applyPlayerMove(opening, 40)!.session)!.placed,
    );
  });

  it('keeps the side the match was started with', async () => {
    const kv = createMemoryKV();
    const second = createSession('hard', false, SEED);
    await saveGame(second, kv);
    const loaded = await loadSavedGame(kv);
    expect(loaded!.playerGoesFirst).toBe(false);
    expect(isCpuTurn(loaded!)).toBe(true);
  });

  it('brings the Undo history back with it (§5)', async () => {
    const kv = createMemoryKV();
    await saveGame(twoMoves(), kv);
    const loaded = (await loadSavedGame(kv))!;
    expect(canUndo(loaded)).toBe(true);
    expect(undo(loaded)!.moves).toEqual([]);
  });

  it('clears the slot instead of saving a finished match', async () => {
    const kv = createMemoryKV({ [NT_STORAGE_KEYS.saveGame]: JSON.stringify(record(twoMoves())) });
    const finished: NestedSession = { ...twoMoves(), status: 'won' };
    await saveGame(finished, kv);
    expect(await loadRaw(NT_STORAGE_KEYS.saveGame, kv)).toBeNull();
  });

  it('clears on request', async () => {
    const kv = stored(record(twoMoves()));
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('a record that fails closed (§8.2)', () => {
  const good = () => record(twoMoves()) as unknown as Record<string, unknown>;

  it.each([
    ['a filled cell', { moves: [40, 40] }],
    ['a board it was not sent to', { moves: [40, 0] }],
    ['82 moves', { moves: Array.from({ length: 82 }, (_, i) => i % 81) }],
    ['a move that is not a cell', { moves: [40, 81] }],
    ['a fractional move', { moves: [40.5] }],
    ['moves that are not a list', { moves: '40,36' }],
    ['an unknown version', { schemaVersion: 2 }],
    ['an empty seed', { seed: '' }],
    ['an unknown difficulty', { difficulty: 'expert' }],
    ['a side that is not a boolean', { playerGoesFirst: 'yes' }],
    ['negative seconds', { elapsedSeconds: -1 }],
    ['fractional seconds', { elapsedSeconds: 1.5 }],
  ])('%s is no saved game at all', async (_, patch) => {
    expect(await loadSavedGame(stored({ ...good(), ...patch }))).toBeNull();
  });

  it('a finished list, and a move after the end, are no saved game', async () => {
    const win = playerWinsWith();
    const finished = [...win.moves, win.cell];
    const position = positionFromMoves(finished);
    expect(position !== null && isOver(position)).toBe(true);
    const empty = Array.from(position!.cells).findIndex((value) => value === EMPTY);
    expect(await loadSavedGame(stored({ ...good(), moves: finished }))).toBeNull();
    expect(await loadSavedGame(stored({ ...good(), moves: [...finished, empty] }))).toBeNull();
  });

  it('text that is not JSON is no saved game', async () => {
    const kv = createMemoryKV({ [NT_STORAGE_KEYS.saveGame]: '{' });
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('an empty list (saved at the start) is a match', async () => {
    const opening = createSession('easy', true, SEED);
    expect(await loadSavedGame(stored(record(opening)))).not.toBeNull();
  });
});
