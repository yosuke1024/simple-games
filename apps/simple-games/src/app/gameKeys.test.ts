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
  'spider-solitaire': ['ss.saveGame', 'ss.saveDaily', 'ss.stats', 'ss.flags', 'ss.prefs'],
  freecell: ['fc.saveGame', 'fc.saveDaily', 'fc.stats', 'fc.flags'],
  hearts: ['ht.saveGame', 'ht.stats', 'ht.flags', 'ht.prefs'],
  'gin-rummy': ['gr.saveGame', 'gr.stats', 'gr.flags', 'gr.prefs'],
  minesweeper: ['ms.saveGame', 'ms.saveDaily', 'ms.stats', 'ms.flags', 'ms.prefs'],
  'brick-breaker': ['bb.stats', 'bb.progress', 'bb.flags'],
  nonogram: ['ng.saveGame', 'ng.saveDaily', 'ng.stats', 'ng.progress', 'ng.flags', 'ng.prefs'],
  // Five, not six: no per-game setting to keep, and none of the record is a
  // board — a save is identity plus the removal order
  // (docs/MAHJONG_SOLITAIRE_RULES.md §10).
  'mahjong-solitaire': ['mj.saveGame', 'mj.saveDaily', 'mj.stats', 'mj.progress', 'mj.flags'],
  // Five, not six: Takuzu has no per-game setting to keep
  // (docs/TAKUZU_RULES.md §4, §9).
  takuzu: ['tk.saveGame', 'tk.saveDaily', 'tk.stats', 'tk.progress', 'tk.flags'],
  // Six, where Takuzu has five: this game keeps one setting across boards —
  // whether a digit that disagrees with the answer is marked as it lands
  // (docs/FUTOSHIKI_RULES.md §5, §11).
  futoshiki: ['ft.saveGame', 'ft.saveDaily', 'ft.stats', 'ft.progress', 'ft.flags', 'ft.prefs'],
  // Six as well, and for the same one reason: the mistake-highlight toggle is
  // the only thing this game remembers across boards (docs/KAKURO_RULES.md
  // §5, §11).
  kakuro: ['kk.saveGame', 'kk.saveDaily', 'kk.stats', 'kk.progress', 'kk.flags', 'kk.prefs'],
  'number-match': ['nm.saveGame', 'nm.stats', 'nm.flags', 'nm.progress', 'nm.saveDaily'],
  'quick-math': ['qm.saveGame', 'qm.saveDaily', 'qm.stats', 'qm.progress', 'qm.flags'],
  // Two keys short of the others on purpose: neither drill saves a round in
  // progress (docs/SCHULTE_TABLE_RULES.md §11, docs/NUMBER_RECALL_RULES.md §12).
  'schulte-table': ['st.stats', 'st.progress', 'st.flags'],
  'number-recall': ['nr.stats', 'nr.progress', 'nr.flags'],
  'water-sort': ['ws.saveGame', 'ws.saveDaily', 'ws.stats', 'ws.progress', 'ws.flags'],
  'sliding-puzzle': ['sp.saveGame', 'sp.saveDaily', 'sp.stats', 'sp.progress', 'sp.flags'],
  'memory-match': ['mm.saveGame', 'mm.saveDaily', 'mm.stats', 'mm.flags'],
  'sky-fighter': ['sf.stats', 'sf.progress', 'sf.flags'],
  'bunny-hop': ['bh.stats', 'bh.flags'],
  '2048': ['tm.saveGame', 'tm.stats', 'tm.flags'],
  'block-puzzle': ['bp.saveGame', 'bp.stats', 'bp.flags'],
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
