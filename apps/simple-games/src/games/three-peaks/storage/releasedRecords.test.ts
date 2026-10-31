/**
 * Published Web records frozen at the 2026-10-29 app promotion (v1.7.0).
 * Source: pixapps-landing dcb9a8879783b35200c3e2c374704d50f55deade,
 * public/simple-games/play, built from simple-games 1fb236ba. The build was
 * served on 127.0.0.1 by a Playwright harness (headless Chromium, 390x780)
 * with every non-localhost request aborted; its game assets were unchanged.
 *
 * UI steps (real clicks only — no storage writes, no calls into the game, no
 * clock mocking). Finish Quick Rules (Next, Next, Start Playing, which deals
 * game 1). Game 1: tap a playable card when there is one, otherwise the
 * stock, until the "No moves left" card appears (23 takes + 23 draws + one
 * more take = 47 actions, 4 cards left); press Undo on the result card (the
 * move that ended the game is taken back and the save is written), then Home —
 * RELEASED_STUCK_UNDONE below is the storage at that moment. Game 2: Home >
 * New Game, confirm; a deal that a separate solver (fed only the seed the build
 * wrote to storage) found winnable was played out card by card (41 actions) to
 * "All peaks cleared!"; Undo on the result card (the win stays counted), then
 * Home — RELEASED_WIN_UNDONE. Game 3: Home > New Game, confirm; five card taps
 * and one draw, with pauses; Home — RELEASED, the storage at the end.
 *
 * Captured: tp.flags, tp.stats and tp.saveGame — all three declared keys, in
 * three states of the same install: after a lost-then-undone game, after a
 * won-then-undone game (countedWin: true, the marker the loader must keep),
 * and mid-way through a third deal. The `DOM_*` constants below are what the
 * published build drew at the moment of each save (cards left, stock count,
 * waste, face-up cards with their labels, face-down count), read from the page
 * by the script — they check the engine against the published rendering, not
 * against today's serializer. Not captured: a save of a finished game —
 * none can exist, the slot is cleared the moment a game ends — so the won and
 * stuck positions are reached here only through Undo.
 *
 * Only the Web Preferences key prefix `CapacitorStorage.` is removed below;
 * payload strings are verbatim. Never regenerate them from today's serializer.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { POSITIONS, canTake, isExposed, rankText, remaining, suit, type Session } from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { TP_STORAGE_KEYS, flagsSchema, gameSchema, statsSchema } from './schemas';

/** Storage at the end of the capture: a third deal, mid-way, after one lost and one won game. */
const RELEASED = {
  'tp.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tp.stats': '{"schemaVersion":1,"played":3,"wins":1,"bestRemaining":0,"totalPlaySeconds":50}',
  'tp.saveGame':
    '{"schemaVersion":1,"seed":2363165323,"actions":[{"kind":"take","index":18},{"kind":"take","index":21},{"kind":"take","index":19},{"kind":"take","index":22},{"kind":"draw"},{"kind":"take","index":23}],"elapsedSeconds":9,"countedWin":false,"savedAt":1793269237005}',
};
/** Storage after game 1 (no moves left) was undone from its result card and left by Home. */
const RELEASED_STUCK_UNDONE = {
  'tp.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tp.stats': '{"schemaVersion":1,"played":1,"wins":0,"bestRemaining":4,"totalPlaySeconds":20}',
  'tp.saveGame':
    '{"schemaVersion":1,"seed":3560369035,"actions":[{"kind":"take","index":22},{"kind":"take","index":18},{"kind":"draw"},{"kind":"take","index":24},{"kind":"draw"},{"kind":"take","index":26},{"kind":"take","index":19},{"kind":"draw"},{"kind":"take","index":9},{"kind":"take","index":27},{"kind":"take","index":20},{"kind":"take","index":17},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":10},{"kind":"take","index":3},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":21},{"kind":"take","index":11},{"kind":"take","index":23},{"kind":"draw"},{"kind":"take","index":25},{"kind":"take","index":13},{"kind":"draw"},{"kind":"take","index":4},{"kind":"take","index":0},{"kind":"take","index":14},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":16},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":12},{"kind":"take","index":8},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":15},{"kind":"draw"}],"elapsedSeconds":20,"countedWin":false,"savedAt":1793269201051}',
};
/** Storage after game 2 (all peaks cleared) was undone from its result card and left by Home. */
const RELEASED_WIN_UNDONE = {
  'tp.flags': '{"schemaVersion":1,"tutorialCompleted":true}',
  'tp.stats': '{"schemaVersion":1,"played":2,"wins":1,"bestRemaining":0,"totalPlaySeconds":41}',
  'tp.saveGame':
    '{"schemaVersion":1,"seed":666694493,"actions":[{"kind":"take","index":26},{"kind":"take","index":25},{"kind":"take","index":27},{"kind":"draw"},{"kind":"take","index":24},{"kind":"take","index":15},{"kind":"draw"},{"kind":"take","index":21},{"kind":"take","index":22},{"kind":"take","index":19},{"kind":"take","index":20},{"kind":"take","index":10},{"kind":"take","index":17},{"kind":"draw"},{"kind":"take","index":11},{"kind":"take","index":23},{"kind":"take","index":14},{"kind":"take","index":18},{"kind":"take","index":16},{"kind":"take","index":12},{"kind":"take","index":13},{"kind":"take","index":7},{"kind":"take","index":5},{"kind":"take","index":8},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":6},{"kind":"take","index":9},{"kind":"take","index":4},{"kind":"take","index":2},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"take","index":3},{"kind":"draw"},{"kind":"take","index":0},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"},{"kind":"draw"}],"elapsedSeconds":21,"countedWin":true,"savedAt":1793269226022}',
};

/** What the published build showed at the moment each of the three saves was written. */
const DOM_STUCK_UNDONE = {
  cardsLeft: 5,
  stock: 0,
  waste: 'A spades',
  faceUp: [
    'Card 6: 9 diamonds, cannot move',
    'Card 7: 9 clubs, cannot move',
    'Card 8: K spades, can move',
  ],
  faceDown: 2,
};
const DOM_WIN_UNDONE = {
  cardsLeft: 1,
  stock: 10,
  waste: '4 diamonds',
  faceUp: ['Card 2: 3 spades, can move'],
  faceDown: 0,
};
const DOM_THIRD_DEAL = {
  cardsLeft: 23,
  stock: 22,
  waste: '2 spades',
  faceUp: [
    'Card 10: 3 hearts, can move',
    'Card 13: A diamonds, can move',
    'Card 14: Q clubs, cannot move',
    'Card 21: 5 diamonds, cannot move',
    'Card 25: 6 diamonds, cannot move',
    'Card 26: 9 hearts, cannot move',
    'Card 27: J hearts, cannot move',
    'Card 28: 5 hearts, cannot move',
  ],
  faceDown: 15,
};

const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'];
const cardName = (card: number) => `${rankText(card)} ${SUIT_NAMES[suit(card)]}`;
const indexes = POSITIONS.map((_, index) => index);

/** The board as the page labelled it (`Card n: rank suit, can/cannot move`). */
function shownByPage(session: Session) {
  return {
    cardsLeft: remaining(session),
    stock: 52 - session.stockIndex,
    waste: cardName(session.waste),
    faceUp: indexes
      .filter((index) => isExposed(session, index))
      .map(
        (index) =>
          `Card ${index + 1}: ${cardName(session.deck[index]!)}, ${canTake(session, index) ? 'can move' : 'cannot move'}`,
      ),
    faceDown: indexes.filter((index) => !session.removed[index] && !isExposed(session, index))
      .length,
  };
}

describe('records written by the published Three Peaks build', () => {
  it('declares exactly the three keys the build wrote', () => {
    for (const records of [RELEASED, RELEASED_STUCK_UNDONE, RELEASED_WIN_UNDONE]) {
      expect(Object.keys(records).sort()).toEqual(Object.values(TP_STORAGE_KEYS).sort());
    }
  });

  it.each([
    ['at the end of the capture', RELEASED],
    ['after the lost game was undone', RELEASED_STUCK_UNDONE],
    ['after the won game was undone', RELEASED_WIN_UNDONE],
  ])('loads every record %s without replacing it with a default', async (_label, records) => {
    const kv = createMemoryKV({ ...records });
    expect(await loadRecord(flagsSchema, kv)).toEqual(JSON.parse(records['tp.flags']));
    expect(await loadRecord(statsSchema, kv)).toEqual(JSON.parse(records['tp.stats']));
    expect(await loadRecord(gameSchema, kv)).toEqual(JSON.parse(records['tp.saveGame']));
  });

  it('reads the statistics of each state as the build wrote them', async () => {
    const read = async (records: Record<string, string>) =>
      loadRecord(statsSchema, createMemoryKV({ ...records }));
    expect(await read(RELEASED_STUCK_UNDONE)).toEqual({
      schemaVersion: 1,
      played: 1,
      wins: 0,
      // The lost game finished with 4 cards left; undoing its last move put
      // 5 back on the table, and the best finish stays at 4.
      bestRemaining: 4,
      totalPlaySeconds: 20,
    });
    expect(await read(RELEASED_WIN_UNDONE)).toEqual({
      schemaVersion: 1,
      played: 2,
      wins: 1,
      bestRemaining: 0,
      totalPlaySeconds: 41,
    });
    expect(await read(RELEASED)).toEqual({
      schemaVersion: 1,
      played: 3,
      wins: 1,
      bestRemaining: 0,
      totalPlaySeconds: 50,
    });
  });

  it('restores the third deal, six actions in, down to the card', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED }));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe(2363165323);
    expect(session!.actions).toEqual([
      { kind: 'take', index: 18 },
      { kind: 'take', index: 21 },
      { kind: 'take', index: 19 },
      { kind: 'take', index: 22 },
      { kind: 'draw' },
      { kind: 'take', index: 23 },
    ]);
    expect(session!.elapsedSeconds).toBe(9);
    expect(session!.countedWin).toBe(false);
    expect(session!.status).toBe('playing');
    expect(session!.stockIndex).toBe(30);
    expect(shownByPage(session!)).toEqual({
      cardsLeft: DOM_THIRD_DEAL.cardsLeft,
      stock: DOM_THIRD_DEAL.stock,
      waste: DOM_THIRD_DEAL.waste,
      faceUp: DOM_THIRD_DEAL.faceUp,
      faceDown: DOM_THIRD_DEAL.faceDown,
    });
  });

  it('restores the lost game that was undone: stock spent, 23 cards taken, 5 left', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED_STUCK_UNDONE }));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe(3560369035);
    expect(session!.actions).toHaveLength(46);
    expect(session!.actions.filter((action) => action.kind === 'take')).toHaveLength(23);
    expect(session!.actions.filter((action) => action.kind === 'draw')).toHaveLength(23);
    expect(session!.elapsedSeconds).toBe(20);
    expect(session!.countedWin).toBe(false);
    // The result card's Undo took back the move that ended it, so it plays on.
    expect(session!.status).toBe('playing');
    expect(session!.stockIndex).toBe(52);
    expect(shownByPage(session!)).toEqual({
      cardsLeft: DOM_STUCK_UNDONE.cardsLeft,
      stock: DOM_STUCK_UNDONE.stock,
      waste: DOM_STUCK_UNDONE.waste,
      faceUp: DOM_STUCK_UNDONE.faceUp,
      faceDown: DOM_STUCK_UNDONE.faceDown,
    });
  });

  it('restores the won game that was undone: one card left, the win still counted', async () => {
    const session = await loadSavedGame(createMemoryKV({ ...RELEASED_WIN_UNDONE }));
    expect(session).not.toBeNull();
    expect(session!.seed).toBe(666694493);
    expect(session!.actions).toHaveLength(40);
    expect(session!.actions.filter((action) => action.kind === 'take')).toHaveLength(27);
    expect(session!.actions.filter((action) => action.kind === 'draw')).toHaveLength(13);
    expect(session!.elapsedSeconds).toBe(21);
    // Winning it again must not count a second win (stats already hold wins: 1).
    expect(session!.countedWin).toBe(true);
    expect(session!.status).toBe('playing');
    expect(session!.stockIndex).toBe(42);
    expect(shownByPage(session!)).toEqual({
      cardsLeft: DOM_WIN_UNDONE.cardsLeft,
      stock: DOM_WIN_UNDONE.stock,
      waste: DOM_WIN_UNDONE.waste,
      faceUp: DOM_WIN_UNDONE.faceUp,
      faceDown: DOM_WIN_UNDONE.faceDown,
    });
  });

  it('writes each restored game back byte for byte at its original save time', async () => {
    const cases = [
      [RELEASED, 1793269237005],
      [RELEASED_STUCK_UNDONE, 1793269201051],
      [RELEASED_WIN_UNDONE, 1793269226022],
    ] as const;
    for (const [records, savedAt] of cases) {
      const session = await loadSavedGame(createMemoryKV({ ...records }));
      expect(session).not.toBeNull();
      expect(JSON.stringify(toPersisted(session!, savedAt))).toBe(records['tp.saveGame']);
    }
  });
});
