import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord, saveRecord } from '../../../storage/repo';
import { createSession, move, legalMoves } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, prefsSchema, statsSchema, gameSchema } from './schemas';
describe('isolated validated storage', () => {
  it('round trips its session and undo history through the repository', async () => {
    const kv = createMemoryKV(),
      initial = createSession('easy', 123);
    const next = move(initial, legalMoves(initial.heaps)[0]!)!;
    await saveGame(next, kv);
    expect(await loadSavedGame(kv)).toEqual(next);
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    expect((await loadRecord(flagsSchema, kv)).tutorialCompleted).toBe(true);
  });
  it('fails closed on malformed JSON, history and unrelated corrupt records', async () => {
    const kv = createMemoryKV({ [gameSchema.key]: '{broken', [statsSchema.key]: '{broken' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    const initial = createSession('easy', 4);
    await saveGame(initial, kv);
    expect(await loadSavedGame(kv)).toEqual(initial);
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(prefsSchema.validate({ schemaVersion: 1, mode: 'unknown' })).toBeNull();
    expect(
      statsSchema.validate({ ...statsSchema.defaultValue(), totalPlaySeconds: -1 }),
    ).toBeNull();
    // A missing stats record must not invalidate a later real result.
    const recovered = statsSchema.defaultValue();
    recovered['easy'].wins = 1;
    expect(statsSchema.validate(recovered)).toEqual(recovered);
  });
  it('clears terminal saves without changing any other game record', async () => {
    const kv = createMemoryKV({ 'other.saveGame': 'untouched' });
    const initial = createSession('easy', 2);
    await saveGame(initial, kv);
    await saveGame({ ...initial, status: 'won' }, kv);
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await kv.get('other.saveGame')).toBe('untouched');
  });
});
