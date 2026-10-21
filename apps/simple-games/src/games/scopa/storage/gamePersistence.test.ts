/**
 * The saved match through its key (docs/SCOPA_RULES.md §9): a round trip at
 * every kind of position a save can be written at — the player's card, the
 * CPU's card, a refill owed, a settled deal waiting for its tap — and the
 * fail-closed side: a record the decoder refuses comes back as no match at
 * all, and stays in the store untouched (it may have been written by a newer
 * version; the next save replaces it).
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { beatOwed, canDealNextDeal, isPlayersTurn, phaseOf, type ScopaSession } from '../game';
import { findPosition } from '../ui/testScenarios';
import { clearSavedGame, loadSavedGame, saveGame, toPersisted } from './gamePersistence';
import { SC_STORAGE_KEYS } from './schemas';

const KEY = SC_STORAGE_KEYS.game;

const POSITIONS: Record<string, (s: ScopaSession) => boolean> = {
  "the player's card": (s) => isPlayersTurn(s) && s.deal.plays.length > 3,
  "the CPU's card": (s) => beatOwed(s) === 'cpu' && s.deal.plays.length > 3,
  'a refill owed': (s) => beatOwed(s) === 'refill',
  'a settled deal': (s) => canDealNextDeal(s),
  'a later deal': (s) => s.dealNumber >= 3 && isPlayersTurn(s),
};

describe('a saved match comes back as it was put down', () => {
  for (const [name, wanted] of Object.entries(POSITIONS)) {
    it(`at ${name}`, async () => {
      const session = findPosition(wanted);
      const kv = createMemoryKV();
      await saveGame({ ...session, elapsedSeconds: 42 }, kv);
      const restored = await loadSavedGame(kv);
      expect(restored).toEqual({ ...session, elapsedSeconds: 42 });
      // The same beat is owed afterwards: the effect picks it up (§4.2).
      expect(beatOwed(restored!)).toBe(beatOwed(session));
      expect(phaseOf(restored!.deal)).toBe(phaseOf(session.deal));
    });
  }

  // That a resumed screen starts with nothing lifted is the screen's to show
  // (ui/ScopaRoot.test.tsx 'comes back from the home with nothing lifted');
  // this holds the half the record owns: it has no place for a lift.
  it('holds moves, not taps: the record has no field for a lifted card', () => {
    const session = findPosition((s) => isPlayersTurn(s));
    expect(Object.keys(toPersisted(session, 1)).sort()).toEqual(
      [
        'deal',
        'dealNumber',
        'dealer',
        'elapsedSeconds',
        'moveCount',
        'savedAt',
        'schemaVersion',
        'scores',
        'seed',
      ].sort(),
    );
  });
});

describe('fail closed', () => {
  it('reads nothing back from an empty store', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
  });

  it('refuses a record the replay refuses, and leaves it where it is', async () => {
    const session = findPosition((s) => isPlayersTurn(s) && s.deal.plays.length > 3);
    const tampered = { ...toPersisted(session, 1), moveCount: session.moveCount + 1 };
    const text = JSON.stringify(tampered);
    const kv = createMemoryKV({ [KEY]: text });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await kv.get(KEY)).toBe(text);
  });

  it('refuses text that is not JSON, and leaves it where it is', async () => {
    const kv = createMemoryKV({ [KEY]: '{not json' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await kv.get(KEY)).toBe('{not json');
  });

  it('refuses a decided match', async () => {
    const session = findPosition((s) => isPlayersTurn(s));
    const kv = createMemoryKV({
      [KEY]: JSON.stringify({ ...toPersisted(session, 1), scores: [12, 4] }),
    });
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('clears the slot when asked', async () => {
    const session = findPosition((s) => isPlayersTurn(s));
    const kv = createMemoryKV();
    await saveGame(session, kv);
    await clearSavedGame(kv);
    expect(await kv.get(KEY)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });
});
