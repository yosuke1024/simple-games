/**
 * Published Web records frozen at the 2026-10-25 app promotion.
 * Source: pixapps-landing 5f6d89a32e8a2f3d88b4a68ac29121348e80945f,
 * public/simple-games/play, built from simple-games 364d526.
 * The copied build ran at localhost:5194 with external requests blocked by
 * CSP. Its game assets were unchanged; only capture helper buttons were added.
 * UI steps: finish the tutorial, play cell 5 of small board 1, return Home
 * before the CPU reply, then choose to move second next time. These are the
 * four nt.* records in nested.json; other games' accumulated keys are omitted.
 * No storage injection or game-internal calls created them. No finished game
 * was captured, so this fixture does not establish completed-result coverage.
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { CROSS, isCpuTurn, toSavedGame } from '../game';
import { loadSavedGame } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'nt.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'nt.stats':
    '{"schemaVersion":1,"totalPlaySeconds":5,"easy":{"played":1,"wins":0,"losses":0,"draws":0},"normal":{"played":0,"wins":0,"losses":0,"draws":0},"hard":{"played":0,"wins":0,"losses":0,"draws":0}}',
  'nt.saveGame':
    '{"schemaVersion":1,"seed":"nested-tic-tac-toe-mvnsy4vq-9cje2","difficulty":"easy","playerGoesFirst":true,"moves":[4],"elapsedSeconds":5,"savedAt":1792931212302}',
  'nt.prefs': '{"schemaVersion":1,"playerGoesFirst":false}',
};

describe('records written by the published Nested Tic-Tac-Toe build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['nt.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['nt.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['nt.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['nt.saveGame']));
  });

  it('restores the send rule and CPU turn without applying the next-game side preference', async () => {
    const kv = createMemoryKV(RELEASED);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('nested-tic-tac-toe-mvnsy4vq-9cje2');
    expect(session!.difficulty).toBe('easy');
    expect(session!.playerGoesFirst).toBe(true);
    expect((await loadRecord(prefsSchema, kv)).playerGoesFirst).toBe(false);
    expect(session!.moves).toEqual([4]);
    expect(session!.view.cells[4]).toBe(CROSS);
    expect(session!.view.cells.filter((cell) => cell !== 0)).toHaveLength(1);
    expect(session!.view.playable).toEqual([4]);
    expect(session!.view.legal).toEqual([36, 37, 38, 39, 40, 41, 42, 43, 44]);
    expect(session!.view.freeMove).toBe(false);
    expect(session!.view.lastMove).toBe(4);
    expect(session!.status).toBe('playing');
    expect(session!.elapsedSeconds).toBe(5);
    expect(isCpuTurn(session!)).toBe(true);
  });

  it('writes the restored game back byte for byte at its original save time', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(JSON.stringify(toSavedGame(session!, 1792931212302))).toBe(RELEASED['nt.saveGame']);
  });
});
