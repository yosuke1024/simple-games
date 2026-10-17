/**
 * The one saved-game slot, end to end (docs/PEG_SOLITAIRE_RULES.md §6, §11):
 * a game written by `saveGame` comes back as the same game — board, problem,
 * the whole Undo history and the clock — and anything that is not a game in
 * play comes back as nothing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import {
  applyMove,
  createSession,
  ENGLISH_PROBLEM,
  findProblem,
  undo,
  type PegSolitaireSession,
} from '../game';
import {
  ENGLISH_SOLUTION,
  parseEnglishJumps,
  TRIANGLE_APEX_PERFECT_LAST,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_SINGLE_LAST,
} from '../game/fixtures';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted, toSession } from './gamePersistence';
import { PG_STORAGE_KEYS } from './schemas';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

afterEach(() => deviceStore.clear());

function play(session: PegSolitaireSession, jumps: readonly (readonly [number, number])[]) {
  let current = session;
  for (const [from, to] of jumps) current = applyMove(current, from, to)!;
  return current;
}

const APEX = findProblem('triangle', 0, 0)!;

describe('saving and resuming (§11)', () => {
  it('gives back the same game, with its whole Undo history (§6)', async () => {
    const game = {
      ...play(createSession(ENGLISH_PROBLEM), parseEnglishJumps(ENGLISH_SOLUTION).slice(0, 5)),
      elapsedSeconds: 42,
    };
    await saveGame(game);
    expect(deviceStore.has(PG_STORAGE_KEYS.game)).toBe(true);

    const resumed = await loadSavedGame();
    expect(resumed).not.toBeNull();
    expect(resumed!.problem).toEqual(ENGLISH_PROBLEM);
    expect(resumed!.pegs).toEqual(game.pegs);
    expect(resumed!.jumps).toEqual(game.jumps);
    expect(resumed!.elapsedSeconds).toBe(42);

    // Every jump can still be taken back, to the very first position.
    let back: PegSolitaireSession | null = resumed;
    for (let i = 0; i < 5; i++) back = undo(back!);
    expect(back!.pegs).toEqual(createSession(ENGLISH_PROBLEM).pegs);
    expect(undo(back!)).toBeNull();
  });

  it('round-trips through the persisted form unchanged, on both boards', () => {
    for (const game of [
      play(createSession(ENGLISH_PROBLEM), parseEnglishJumps(ENGLISH_SOLUTION).slice(0, 30)),
      play(createSession(APEX), TRIANGLE_APEX_PREFIX),
    ]) {
      const persisted = toPersisted(game, 1792200000000);
      const back = toSession(JSON.parse(JSON.stringify(persisted)))!;
      expect(back.pegs).toEqual(game.pegs);
      expect(back.jumps).toEqual(game.jumps);
      expect(back.problem).toEqual(game.problem);
    }
  });

  it('keeps a perfect clear that was undone, through the save and back (§6, §10)', async () => {
    const clear = play(createSession(APEX), [...TRIANGLE_APEX_PREFIX, TRIANGLE_APEX_PERFECT_LAST]);
    expect(clear.outcome?.kind).toBe('perfect');
    // The clear itself is never written: it is finished.
    await saveGame(clear);
    expect(deviceStore.has(PG_STORAGE_KEYS.game)).toBe(false);

    // Undone, it is a game in play again — saved like any other, with its clear.
    const undone = undo(clear)!;
    await saveGame(undone);
    const stored = JSON.parse(deviceStore.get(PG_STORAGE_KEYS.game)!) as Record<string, unknown>;
    expect(stored.cleared).toBe(true);
    expect(stored.jumps).toHaveLength(TRIANGLE_APEX_PREFIX.length);
    const resumed = (await loadSavedGame())!;
    expect(resumed.status).toBe('playing');
    expect(resumed.cleared).toBe(true);
    expect(resumed.pegs).toEqual(undone.pegs);

    // A game never cleared is saved without it.
    await saveGame(play(createSession(APEX), TRIANGLE_APEX_PREFIX));
    expect(JSON.parse(deviceStore.get(PG_STORAGE_KEYS.game)!)).not.toHaveProperty('cleared');
    expect((await loadSavedGame())!.cleared).toBe(false);
  });

  it('writes whole seconds only, so what it writes it can always read', async () => {
    const game = { ...createSession(APEX), elapsedSeconds: 12.7 };
    await saveGame(game);
    expect((await loadSavedGame())!.elapsedSeconds).toBe(12);
  });

  it('never writes a finished game, and clearing leaves the slot empty', async () => {
    const finished = play(createSession(APEX), [
      ...TRIANGLE_APEX_PREFIX,
      TRIANGLE_APEX_SINGLE_LAST,
    ]);
    expect(finished.status).toBe('over');
    await saveGame(finished);
    expect(deviceStore.has(PG_STORAGE_KEYS.game)).toBe(false);

    await saveGame(createSession(APEX));
    expect(await loadSavedGame()).not.toBeNull();
    await clearSavedGame();
    expect(deviceStore.has(PG_STORAGE_KEYS.game)).toBe(false);
    expect(await loadSavedGame()).toBeNull();
  });

  it('reads a damaged slot as nothing, through the load-side seam too', async () => {
    const kv = createMemoryKV({ [PG_STORAGE_KEYS.game]: '{"schemaVersion":1,"board":"engl' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(toSession(null)).toBeNull();
  });

  it('touches no key but its own', async () => {
    deviceStore.set('so.saveGame', 'untouched');
    deviceStore.set('mc.saveGame', 'untouched');
    await saveGame(createSession(APEX));
    await clearSavedGame();
    expect(deviceStore.get('so.saveGame')).toBe('untouched');
    expect(deviceStore.get('mc.saveGame')).toBe('untouched');
  });
});
