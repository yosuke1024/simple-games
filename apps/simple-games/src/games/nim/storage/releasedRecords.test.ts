/**
 * Published Web records frozen at the 2026-10-25 app promotion.
 * Source: pixapps-landing 5f6d89a32e8a2f3d88b4a68ac29121348e80945f,
 * public/simple-games/play, built from simple-games 364d526.
 * The copied build ran at localhost:5194 with external requests blocked by
 * CSP. Its game assets were unchanged; only capture helper buttons were added.
 * UI steps: finish the tutorial, select row 1 (eight stones), take one stone,
 * then return Home before the CPU reply. These are the four ni.* records in
 * nim.json; other games' accumulated keys are omitted.
 * No storage injection or game-internal calls created them. No finished game
 * was captured, so this fixture does not establish completed-result coverage.
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { isCpuTurn, undo } from '../game';
import { loadSavedGame, saveGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'ni.prefs': '{"schemaVersion":1,"mode":"easy"}',
  'ni.saveGame':
    '{"schemaVersion":1,"seed":1767322067,"mode":"easy","moves":[{"row":0,"count":1}],"heaps":[7,5,8,4],"status":"playing","elapsedSeconds":6,"resultRecorded":false}',
  'ni.stats':
    '{"schemaVersion":1,"totalPlaySeconds":6,"easy":{"played":1,"wins":0,"losses":0},"normal":{"played":0,"wins":0,"losses":0},"hard":{"played":0,"wins":0,"losses":0}}',
  'ni.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
};

describe('records written by the published Nim build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['ni.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['ni.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['ni.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['ni.saveGame']));
  });

  it('restores the CPU turn and the undo history from the published seed and move', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).toEqual(JSON.parse(RELEASED['ni.saveGame']));
    expect(isCpuTurn(session!)).toBe(true);
    const beforeMove = undo(session!);
    expect(beforeMove).not.toBeNull();
    expect(beforeMove!.heaps).toEqual([8, 5, 8, 4]);
    expect(beforeMove!.moves).toEqual([]);
    expect(beforeMove!.elapsedSeconds).toBe(6);
    expect(beforeMove!.resultRecorded).toBe(false);
    expect(isCpuTurn(beforeMove!)).toBe(false);
    // Undo is immutable: reopening the old record still owes the CPU turn.
    expect(session!.heaps).toEqual([7, 5, 8, 4]);
  });

  it('writes the restored game back byte for byte', async () => {
    const kv = createMemoryKV(RELEASED);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    await saveGame(session!, kv);
    expect(await kv.get('ni.saveGame')).toBe(RELEASED['ni.saveGame']);
  });
});
