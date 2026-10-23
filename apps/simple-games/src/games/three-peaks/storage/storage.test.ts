import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { applyAction, createSession, undo } from '../game';
import { winningPrefix } from '../game/fixtures';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema, TP_STORAGE_KEYS } from './schemas';
describe('Three Peaks local records', () => {
  it('round trips the seeded history, clock and undo through the exact backup schema', async () => {
    const kv = createMemoryKV();
    const session = { ...winningPrefix(22), elapsedSeconds: 128, countedWin: true };
    await saveGame(session, kv);
    expect(await loadSavedGame(kv)).toEqual(session);
    const record = JSON.parse((await kv.get(TP_STORAGE_KEYS.game))!);
    expect(gameSchema.validate(record)).toEqual(record);
    expect(undo((await loadSavedGame(kv))!)?.actions).toHaveLength(21);
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('rejects finished positions, fake boards, malformed moves and unsupported schemas', () => {
    const valid = toPersisted(createSession(6), 123);
    expect(gameSchema.validate(valid)).toEqual(valid);
    for (const invalid of [
      null,
      [],
      { ...valid, schemaVersion: 2 },
      { ...valid, savedAt: -1 },
      { ...valid, seed: 1.1 },
      { ...valid, countedWin: 'true' },
      { ...valid, actions: [{}] },
      { ...valid, actions: [{ kind: 'take', index: 0 }] },
      toPersisted(winningPrefix(), 123),
    ])
      expect(gameSchema.validate(invalid)).toBeNull();
    expect(gameSchema.validate({ ...valid, removed: Array(28).fill(true) })).toEqual(valid);
  });
  it('never deletes corrupt source data merely by reading it', async () => {
    const kv = createMemoryKV({ [TP_STORAGE_KEYS.game]: '{broken' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await kv.get(TP_STORAGE_KEYS.game)).toBe('{broken');
    await saveGame(applyAction(createSession(1), { kind: 'draw' })!, kv);
    expect(await loadSavedGame(kv)).not.toBeNull();
  });
  it('validates independent flags and statistics conservatively', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 1 })).toBeNull();
    expect(statsSchema.validate({ ...statsSchema.defaultValue(), wins: -1 })).toBeNull();
    expect(statsSchema.validate({ ...statsSchema.defaultValue(), bestRemaining: 29 })).toBeNull();
    expect(
      statsSchema.validate({ ...statsSchema.defaultValue(), totalPlaySeconds: NaN }),
    ).toBeNull();
    expect(statsSchema.validate({ ...statsSchema.defaultValue(), wins: 3 })).not.toBeNull();
  });
});
