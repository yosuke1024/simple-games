/**
 * Golden test for every game's persisted keys, as the registry declares them —
 * which is exactly the list "Reset Local Data" walks and the list a real
 * player's data lives under. Like the compatibility tests, these literals pin
 * released behaviour: if this test is red, either a migration plan exists and
 * this file changes in the same commit, or somebody is about to strand or
 * delete players' data. Do not "fix" the expectation to make it pass.
 */
import { describe, expect, it } from 'vitest';
import { GAMES } from './registry';

const RELEASED_KEYS: Record<string, readonly string[]> = {
  sudoku: ['sd.saveGame', 'sd.saveDaily', 'sd.stats', 'sd.progress', 'sd.flags', 'sd.prefs'],
  solitaire: ['so.saveGame', 'so.saveDaily', 'so.stats', 'so.flags', 'so.prefs'],
  minesweeper: ['ms.saveGame', 'ms.saveDaily', 'ms.stats', 'ms.flags', 'ms.prefs'],
  'brick-breaker': ['bb.stats', 'bb.progress', 'bb.flags'],
  nonogram: ['ng.saveGame', 'ng.saveDaily', 'ng.stats', 'ng.progress', 'ng.flags', 'ng.prefs'],
  'number-match': ['nm.saveGame', 'nm.stats', 'nm.flags', 'nm.progress', 'nm.saveDaily'],
  'water-sort': ['ws.saveGame', 'ws.saveDaily', 'ws.stats', 'ws.progress', 'ws.flags'],
  'sliding-puzzle': ['sp.saveGame', 'sp.saveDaily', 'sp.stats', 'sp.progress', 'sp.flags'],
  'memory-match': ['mm.saveGame', 'mm.saveDaily', 'mm.stats', 'mm.flags'],
  'sky-fighter': ['sf.stats', 'sf.progress', 'sf.flags'],
  '2048': ['tm.saveGame', 'tm.stats', 'tm.flags'],
  snake: ['sn.stats', 'sn.flags'],
  'block-puzzle': ['bp.saveGame', 'bp.stats', 'bp.flags'],
};

const PREFIXES: Record<string, string> = {
  sudoku: 'sd.',
  solitaire: 'so.',
  minesweeper: 'ms.',
  'brick-breaker': 'bb.',
  nonogram: 'ng.',
  'number-match': 'nm.',
  'water-sort': 'ws.',
  'sliding-puzzle': 'sp.',
  'memory-match': 'mm.',
  'sky-fighter': 'sf.',
  '2048': 'tm.',
  snake: 'sn.',
  'block-puzzle': 'bp.',
};

describe('registry storage keys (released data — do not edit to make green)', () => {
  it('covers every registered game and no more', () => {
    expect(Object.keys(RELEASED_KEYS).sort()).toEqual(GAMES.map((game) => game.id).sort());
  });

  for (const game of GAMES) {
    it(`${game.id} declares exactly its released keys`, () => {
      expect([...game.storageKeys]).toEqual([...RELEASED_KEYS[game.id]!]);
    });

    it(`${game.id} keys carry the ${PREFIXES[game.id]} prefix`, () => {
      for (const key of game.storageKeys) {
        expect(key.startsWith(PREFIXES[game.id]!)).toBe(true);
      }
    });
  }

  it('no key is shared between two games', () => {
    const all = GAMES.flatMap((game) => [...game.storageKeys]);
    expect(new Set(all).size).toBe(all.length);
  });
});
