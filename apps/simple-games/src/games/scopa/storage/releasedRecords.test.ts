/**
 * Published Web records frozen at the 2026-10-25 app promotion.
 * Source: pixapps-landing 5f6d89a32e8a2f3d88b4a68ac29121348e80945f,
 * public/simple-games/play, built from simple-games 364d526.
 * The copied build ran at localhost:5194 with external requests blocked by
 * CSP. Its game assets were unchanged; only capture helper buttons were added.
 * UI steps: finish the tutorial, allow the CPU opening capture, select the
 * three of spades, use the placement button, then return Home. These are the
 * three sc.* records in scopa.json; this game has no preferences record.
 * No storage injection or game-internal calls created them. Neither a full
 * deal nor a finished match was captured; their results are not covered here.
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { CPU, YOU, beatOwed, encodeDeal, phaseOf } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, statsSchema } from './schemas';

const RELEASED = {
  'sc.saveGame':
    '{"schemaVersion":1,"seed":"scopa-mvnsz5nq-8yer0","dealNumber":1,"dealer":0,"scores":[0,0],"moveCount":2,"elapsedSeconds":28,"deal":"1/1/060b0l0m.02","savedAt":1792931282985}',
  'sc.stats': '{"schemaVersion":1,"played":1,"wins":0,"losses":0,"totalPlaySeconds":28}',
  'sc.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
};

describe('records written by the published Scopa build', () => {
  it('loads all three original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['sc.flags']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['sc.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['sc.saveGame']));
  });

  it('replays the opening capture and placement, retaining the pending CPU beat', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe('scopa-mvnsz5nq-8yer0');
    expect(session!.dealNumber).toBe(1);
    expect(session!.deal.dealer).toBe(YOU);
    expect(session!.deal.plays).toEqual([
      { seat: CPU, card: 6, captured: [11, 21, 22] },
      { seat: YOU, card: 2, captured: [] },
    ]);
    expect(session!.deal.captured).toEqual([[], [6, 11, 21, 22]]);
    expect(session!.deal.hands.map((hand) => hand.length)).toEqual([2, 2]);
    expect(session!.deal.stock).toHaveLength(30);
    expect(session!.deal.table).toContain(2);
    expect(encodeDeal(session!.deal)).toBe('1/1/060b0l0m.02');
    expect(phaseOf(session!.deal)).toBe('play');
    expect(beatOwed(session!)).toBe('cpu');
    expect(session!.scores).toEqual([0, 0]);
    expect(session!.moveCount).toBe(2);
    expect(session!.elapsedSeconds).toBe(28);
    expect(session!.status).toBe('playing');
    expect(session!.lastDeal).toBeNull();
  });

  it('writes the restored match back byte for byte at its original save time', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(JSON.stringify(toPersisted(session!, 1792931282985))).toBe(RELEASED['sc.saveGame']);
  });
});
