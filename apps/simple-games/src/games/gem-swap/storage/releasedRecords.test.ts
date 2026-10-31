/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780,
 * en-US) with every non-localhost request aborted; its game assets were
 * unchanged.
 *
 * UI steps (all real input — clicks, and mouse press-drag-release swipes on
 * the board; no storage writes, no calls into the app):
 *   1. First visit: Quick Rules Next, Next, Start Playing (writes gs.flags
 *      and starts a 6-gem round, which counts toward `played`).
 *   2. Round A (6 gems): played valid swaps, a swipe every third swap and taps otherwise,
 *      until "All 30 swaps are made" — a new 6-gem best. Home from the card.
 *   3. Home: picked the 5-gem toggle, New Game, played a 5-gem round to the
 *      same end — a new 5-gem best. Home from the card.
 *   4. Home: New Game (5 gems), six valid swaps, one Undo, one more swap (six in the save),
 *      then the Home arrow, which suspends the round.
 *   5. Home with the suspended round on offer: picked the 6-gem toggle. The
 *      suspended round therefore keeps 5 gems while the remembered choice
 *      for the next round is 6.
 *
 * All four declared keys were captured: gs.saveGame, gs.stats, gs.flags,
 * gs.prefs. Nothing declared in keys.ts was left out.
 *
 * Besides storage, the script read the board and score off the screen just
 * before leaving round C (the `data-kind` of the 64 cells and the score
 * text). Those two observations are the ground truth for "the restored round
 * is the round that was on screen"; they are not storage records.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { canUndo, swapsLeft } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { flagsSchema, gameSchema, prefsSchema, statsSchema } from './schemas';

const RELEASED = {
  'gs.saveGame':
    '{"schemaVersion":1,"seed":"gem-swap-mvtdycqm-9410c","colors":5,"swaps":[[25,33],[38,39],[18,26],[22,30],[32,40],[9,17]],"elapsedSeconds":9,"savedAt":1793268829421}',
  'gs.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'gs.stats': '{"schemaVersion":1,"played":3,"best5":191,"best6":156,"totalPlaySeconds":82}',
  'gs.prefs': '{"schemaVersion":1,"colors":6}',
};

/** The 64 cells (row-major, gem kind 0-4) on screen just before round C was left. */
const BOARD_ON_SCREEN = [
  3, 0, 4, 0, 3, 4, 3, 2, 2, 1, 2, 1, 0, 4, 4, 0, 2, 4, 2, 4, 3, 0, 3, 0, 1, 4, 1, 2, 4, 1, 2, 3, 0,
  2, 4, 3, 4, 4, 2, 1, 4, 0, 3, 2, 0, 3, 3, 0, 1, 3, 4, 4, 1, 1, 2, 4, 1, 2, 1, 4, 0, 4, 1, 4,
];

describe('records written by the published Gem Swap build', () => {
  it('loads all four original records without replacing them with defaults', async () => {
    const kv = createMemoryKV(RELEASED);
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(RELEASED['gs.flags']));
    expect(await loadRecord(prefsSchema, kv)).toEqual(JSON.parse(RELEASED['gs.prefs']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(RELEASED['gs.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(RELEASED['gs.saveGame']));
  });

  it('reads the statistics as played, one best per gem count, and play seconds', async () => {
    const stats = await loadRecord(statsSchema, createMemoryKV(RELEASED));
    expect(stats.played).toBe(3);
    expect(stats.best5).toBe(191);
    expect(stats.best6).toBe(156);
    expect(stats.totalPlaySeconds).toBe(82);
  });

  it('restores the suspended 5-gem round independently of the 6-gem choice for the next one', async () => {
    const kv = createMemoryKV(RELEASED);
    expect((await loadRecord(prefsSchema, kv)).colors).toBe(6);
    const session = await loadSavedGame(kv);
    expect(session).not.toBeNull();
    const { round } = session!;
    expect(round.seed).toBe('gem-swap-mvtdycqm-9410c');
    expect(round.colors).toBe(5);
    expect(round.swaps).toEqual([
      [25, 33],
      [38, 39],
      [18, 26],
      [22, 30],
      [32, 40],
      [9, 17],
    ]);
    expect(round.status).toBe('playing');
    expect(round.endReason).toBeNull();
    expect(swapsLeft(round)).toBe(24);
    expect(session!.elapsedSeconds).toBe(9);
    // The score the screen showed ("Score 35 / 24 swaps left") and the board
    // it showed: the replay of (seed, colors, swaps) reproduces both.
    expect(round.score).toBe(35);
    expect(Array.from(round.board)).toEqual(BOARD_ON_SCREEN);
    // The swap list is the Undo history too (§7).
    expect(canUndo(round)).toBe(true);
  });

  it('writes the restored round back byte for byte at its original save time', async () => {
    const session = await loadSavedGame(createMemoryKV(RELEASED));
    expect(session).not.toBeNull();
    expect(JSON.stringify(toPersisted(session!, 1793268829421))).toBe(RELEASED['gs.saveGame']);
  });
});
