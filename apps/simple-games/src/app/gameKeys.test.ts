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
  // saveFree is the third suspended-game slot, added with Free Play
  // (2026-09-03, docs/SUDOKU_RULES.md §9「フリープレイ」). Purely additive: no
  // released key changed meaning or moved, so nothing is stranded.
  sudoku: [
    'sd.saveGame',
    'sd.saveDaily',
    'sd.saveFree',
    'sd.stats',
    'sd.progress',
    'sd.flags',
    'sd.prefs',
  ],
  solitaire: ['so.saveGame', 'so.saveDaily', 'so.stats', 'so.flags', 'so.prefs'],
  'spider-solitaire': ['ss.saveGame', 'ss.saveDaily', 'ss.stats', 'ss.flags', 'ss.prefs'],
  freecell: ['fc.saveGame', 'fc.saveDaily', 'fc.stats', 'fc.flags'],
  hearts: ['ht.saveGame', 'ht.stats', 'ht.flags', 'ht.prefs'],
  'gin-rummy': ['gr.saveGame', 'gr.stats', 'gr.flags', 'gr.prefs'],
  minesweeper: ['ms.saveGame', 'ms.saveDaily', 'ms.stats', 'ms.flags', 'ms.prefs'],
  'bubble-pop': ['bu.stats', 'bu.progress', 'bu.flags'],
  'brick-breaker': ['bb.stats', 'bb.progress', 'bb.flags'],
  nonogram: [
    'ng.saveGame',
    'ng.saveDaily',
    'ng.saveFree',
    'ng.stats',
    'ng.progress',
    'ng.flags',
    'ng.prefs',
  ],
  // Five, not six: no per-game setting to keep, and none of the record is a
  // board — a save is identity plus the removal order
  // (docs/MAHJONG_SOLITAIRE_RULES.md §10).
  'mahjong-solitaire': ['mj.saveGame', 'mj.saveDaily', 'mj.stats', 'mj.progress', 'mj.flags'],
  // Seven since Free Play (2026-09-03): the free slot, and a prefs record that
  // exists for one thing only — the tier the Free Play picker last stood on
  // (docs/TAKUZU_RULES.md §7「フリープレイ」, §11). Before that Takuzu kept five,
  // having no per-game setting.
  takuzu: [
    'tk.saveGame',
    'tk.saveDaily',
    'tk.saveFree',
    'tk.stats',
    'tk.progress',
    'tk.flags',
    'tk.prefs',
  ],
  // Seven: the free slot, and a prefs that keeps two settings across boards —
  // whether a digit that disagrees with the answer is marked as it lands,
  // and the Free Play tier (docs/FUTOSHIKI_RULES.md §5, §9, §11).
  futoshiki: [
    'ft.saveGame',
    'ft.saveDaily',
    'ft.saveFree',
    'ft.stats',
    'ft.progress',
    'ft.flags',
    'ft.prefs',
  ],
  // Seven as well, for the same two reasons: the mistake-highlight toggle and
  // the Free Play tier are what this game remembers across boards
  // (docs/KAKURO_RULES.md §5, §9, §11).
  kakuro: [
    'kk.saveGame',
    'kk.saveDaily',
    'kk.saveFree',
    'kk.stats',
    'kk.progress',
    'kk.flags',
    'kk.prefs',
  ],
  // Seven since Free Play (2026-09-03): the free slot, and a prefs record
  // that holds only the tier the picker last stood on
  // (docs/NUMBER_MATCH_RULES.md §11「フリープレイ」, §14).
  'number-match': [
    'nm.saveGame',
    'nm.stats',
    'nm.flags',
    'nm.progress',
    'nm.saveDaily',
    'nm.saveFree',
    'nm.prefs',
  ],
  'quick-math': ['qm.saveGame', 'qm.saveDaily', 'qm.stats', 'qm.progress', 'qm.flags'],
  // Two keys short of the others on purpose: neither drill saves a round in
  // progress (docs/SCHULTE_TABLE_RULES.md §11, docs/NUMBER_RECALL_RULES.md §12).
  'schulte-table': ['st.stats', 'st.progress', 'st.flags'],
  'number-recall': ['nr.stats', 'nr.progress', 'nr.flags'],
  // Seven since Free Play (2026-09-03): the free slot, and a prefs record
  // that holds only the tier the picker last stood on
  // (docs/WATER_SORT_RULES.md §6「フリープレイ」, §10).
  'water-sort': [
    'ws.saveGame',
    'ws.saveDaily',
    'ws.saveFree',
    'ws.stats',
    'ws.progress',
    'ws.flags',
    'ws.prefs',
  ],
  'sliding-puzzle': ['sp.saveGame', 'sp.saveDaily', 'sp.stats', 'sp.progress', 'sp.flags'],
  'memory-match': ['mm.saveGame', 'mm.saveDaily', 'mm.stats', 'mm.flags'],
  'sky-fighter': ['sf.stats', 'sf.progress', 'sf.flags'],
  'bunny-hop': ['bh.stats', 'bh.flags'],
  '2048': ['tm.saveGame', 'tm.stats', 'tm.flags'],
  'block-puzzle': ['bp.saveGame', 'bp.stats', 'bp.flags'],
  // Four, the shape every CPU-opponent title in the collection has: one saved
  // match (no daily, so no second slot — docs/LUDO_RULES.md §10), stats,
  // flags, and a prefs that holds the difficulty. Hearts, Gin Rummy and the
  // four board games below keep exactly these four, for exactly these reasons.
  ludo: ['ld.saveGame', 'ld.stats', 'ld.flags', 'ld.prefs'],
  checkers: ['ck.saveGame', 'ck.stats', 'ck.flags', 'ck.prefs'],
  reversi: ['rv.saveGame', 'rv.stats', 'rv.flags', 'rv.prefs'],
  'connect-four': ['c4.saveGame', 'c4.stats', 'c4.flags', 'c4.prefs'],
  gomoku: ['gm.saveGame', 'gm.stats', 'gm.flags', 'gm.prefs'],
};

const PREFIXES: Record<string, string> = {
  sudoku: 'sd.',
  solitaire: 'so.',
  'spider-solitaire': 'ss.',
  freecell: 'fc.',
  hearts: 'ht.',
  'gin-rummy': 'gr.',
  minesweeper: 'ms.',
  'bubble-pop': 'bu.',
  'brick-breaker': 'bb.',
  nonogram: 'ng.',
  'mahjong-solitaire': 'mj.',
  takuzu: 'tk.',
  futoshiki: 'ft.',
  kakuro: 'kk.',
  'number-match': 'nm.',
  'quick-math': 'qm.',
  'schulte-table': 'st.',
  'number-recall': 'nr.',
  'water-sort': 'ws.',
  'sliding-puzzle': 'sp.',
  'memory-match': 'mm.',
  'sky-fighter': 'sf.',
  'bunny-hop': 'bh.',
  '2048': 'tm.',
  'block-puzzle': 'bp.',
  ludo: 'ld.',
  checkers: 'ck.',
  reversi: 'rv.',
  'connect-four': 'c4.',
  gomoku: 'gm.',
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
