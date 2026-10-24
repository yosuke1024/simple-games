/**
 * The saved game, through the storage layer (docs/CHESS_RULES.md §7.1): what
 * is written comes back as the same game — on the same turn, with the same
 * history, so Undo and the repetition count survive it — and anything the
 * replay refuses comes back as nothing at all, never as a different game.
 * game/serialize.test.ts covers the move list's own codec case by case; this
 * is the layer the screens actually load through.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRaw } from '../../../storage/repo';
import {
  BLACK,
  WHITE,
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  createSession,
  isCpuTurn,
  isPlayerTurn,
  parseSquare,
  undo,
  type ChessSession,
} from '../game';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { CH_STORAGE_KEYS } from './schemas';

const SEED = 'chess-persist';
const sq = parseSquare;

const stored = (record: unknown) =>
  createMemoryKV({ [CH_STORAGE_KEYS.game]: JSON.stringify(record) });

/** The player's e4, the CPU's reply: two plies, the player to move. */
function twoPlies(): ChessSession {
  const opening = createSession('normal', WHITE, SEED);
  const mine = applyPlayerMove(opening, sq('e2'), sq('e4'))!.session;
  return applyCpuMove(mine)!.session;
}

const record = (session: ChessSession) => toPersisted(session, 1)!;

describe('round trip (§7.1)', () => {
  it('gives back the same game, on the same turn', async () => {
    const kv = createMemoryKV();
    const session = { ...twoPlies(), elapsedSeconds: 42 };
    await saveGame(session, kv);
    const loaded = await loadSavedGame(kv);
    expect(loaded).not.toBeNull();
    expect(loaded!.game.moves).toEqual(session.game.moves);
    expect(Array.from(loaded!.game.position.board)).toEqual(
      Array.from(session.game.position.board),
    );
    expect(loaded!.game.history).toEqual(session.game.history);
    expect(loaded!.seed).toBe(SEED);
    expect(loaded!.difficulty).toBe('normal');
    expect(loaded!.playerColor).toBe(WHITE);
    expect(loaded!.elapsedSeconds).toBe(42);
    expect(isPlayerTurn(loaded!)).toBe(true);
  });

  it('keeps a game left on the CPU’s turn on the CPU’s turn, and the CPU answers the same', async () => {
    const kv = createMemoryKV();
    const opening = createSession('easy', WHITE, SEED);
    const mine = applyPlayerMove(opening, sq('d2'), sq('d4'))!.session;
    await saveGame(mine, kv);
    const loaded = (await loadSavedGame(kv))!;
    expect(isCpuTurn(loaded)).toBe(true);
    // The seed and the move count decide the reply (§5.4).
    expect(applyCpuMove(loaded)!.move).toBe(applyCpuMove(mine)!.move);
  });

  it('keeps the side the game was started with', async () => {
    const kv = createMemoryKV();
    await saveGame(createSession('hard', BLACK, SEED), kv);
    const loaded = (await loadSavedGame(kv))!;
    expect(loaded.playerColor).toBe(BLACK);
    expect(isCpuTurn(loaded)).toBe(true);
    expect(record(loaded).side).toBe('black');
  });

  it('brings the Undo history back with it (§6)', async () => {
    const kv = createMemoryKV();
    await saveGame(twoPlies(), kv);
    const loaded = (await loadSavedGame(kv))!;
    expect(canUndo(loaded)).toBe(true);
    expect(undo(loaded)!.game.moves).toEqual([]);
  });

  it('writes the move list as UCI with single spaces', () => {
    expect(record(twoPlies()).moves).toMatch(/^e2e4 [a-h][1-8][a-h][1-8]$/);
    expect(record(createSession('easy', WHITE, SEED)).moves).toBe('');
  });

  it('clears the slot instead of saving a finished game', async () => {
    const kv = stored(record(twoPlies()));
    // The fool's mate, White to be mated: the player is Black and mates.
    let session = createSession('easy', BLACK, SEED);
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
    ] as const) {
      const next = isPlayerTurn(session)
        ? applyPlayerMove(session, sq(from), sq(to))!.session
        : { ...session, game: forced(session, from, to) };
      session = next;
    }
    const mated = applyPlayerMove(session, sq('d8'), sq('h4'))!.session;
    expect(toPersisted(mated, 1)).toBeNull();
    await saveGame(mated, kv);
    expect(await loadRaw(CH_STORAGE_KEYS.game, kv)).toBeNull();
  });

  it('clears on request', async () => {
    const kv = stored(record(twoPlies()));
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

/**
 * The CPU's side of a fixed line: played through the player API from the
 * CPU's colour, so the test chooses the moves instead of the search.
 */
function forced(session: ChessSession, from: string, to: string) {
  const asCpu = { ...session, playerColor: session.game.position.side };
  return applyPlayerMove(asCpu, sq(from), sq(to))!.session.game;
}

describe('a record that fails closed (§7.1)', () => {
  const good = () => record(twoPlies()) as unknown as Record<string, unknown>;

  it.each([
    ['an illegal move', { moves: 'e2e4 e7e4' }],
    ['a move by the wrong side', { moves: 'e2e4 d2d4' }],
    ['a promotion letter on a quiet move', { moves: 'e2e4q' }],
    ['a capital letter', { moves: 'E2E4' }],
    ['castling written as O-O', { moves: 'O-O' }],
    ['a leading space', { moves: ' e2e4' }],
    ['a trailing space', { moves: 'e2e4 ' }],
    ['two spaces', { moves: 'e2e4  e7e5' }],
    ['a comma', { moves: 'e2e4,e7e5' }],
    ['a move after the mate', { moves: 'f2f3 e7e5 g2g4 d8h4 a2a3' }],
    ['a finished game', { moves: 'f2f3 e7e5 g2g4 d8h4' }],
    ['moves that are not text', { moves: ['e2e4'] }],
    ['an unknown version', { schemaVersion: 2 }],
    ['an empty seed', { seed: '' }],
    ['an unknown difficulty', { difficulty: 'expert' }],
    ['an unknown side', { side: 'red' }],
    ['negative seconds', { elapsedSeconds: -1 }],
  ])('%s is no saved game at all', async (_, patch) => {
    expect(await loadSavedGame(stored({ ...good(), ...patch }))).toBeNull();
  });

  it('text that is not JSON is no saved game', async () => {
    const kv = createMemoryKV({ [CH_STORAGE_KEYS.game]: '{' });
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('an empty list (saved before the first move) is a game', async () => {
    expect(await loadSavedGame(stored(record(createSession('easy', WHITE, SEED))))).not.toBeNull();
  });
});
