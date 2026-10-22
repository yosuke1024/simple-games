/**
 * Golden test for every game's persisted keys, as the registry declares them —
 * which is exactly the list "Reset Local Data" walks and the list a real
 * player's data lives under. Like the compatibility tests, these literals pin
 * released behaviour: if this test is red, either a migration plan exists and
 * this file changes in the same commit, or somebody is about to strand or
 * delete players' data. Do not "fix" the expectation to make it pass.
 *
 * The one exception is marked where it sits: the titles still in the browser's
 * early release (registry `channel: 'web-beta'`) have keys that may change
 * before they graduate (docs/WEB_VERSION.md「先行公開」). That is a licence to
 * change them on purpose, not to edit a line until the test goes green.
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
  // The three board puzzles of issue #194, first in the browser's early
  // release (docs/WEB_VERSION.md「先行公開」) and in the app since 2026-10-02.
  // Five each, Minesweeper's shape: one suspended game per mode (difficulty /
  // daily), stats, flags, and a prefs that remembers only the last difficulty
  // picked. Since graduating they are released keys like every other line
  // here (their payloads are pinned in storage/releasedRecords.test.ts).
  'crown-grid': ['cg.saveGame', 'cg.saveDaily', 'cg.stats', 'cg.flags', 'cg.prefs'],
  'number-path': ['np.saveGame', 'np.saveDaily', 'np.stats', 'np.flags', 'np.prefs'],
  'shape-regions': ['sr.saveGame', 'sr.saveDaily', 'sr.stats', 'sr.flags', 'sr.prefs'],
  // The five genres of issue #197, in the app since 2026-10-02 (docs/plans/2026-09-27-yacht-mancala-
  // dominoes-hit-and-blow-dots-and-boxes.md). None has a daily, so one saved
  // game each. Yacht and Dominoes keep no setting (no prefs): Yacht has no
  // difficulty, and Dominoes' opener is decided by the tiles. Mancala's prefs
  // is the side to open with, Hit & Blow's the last difficulty, Dots and
  // Boxes' the last board size.
  yacht: ['yt.saveGame', 'yt.stats', 'yt.flags'],
  mancala: ['mc.saveGame', 'mc.stats', 'mc.flags', 'mc.prefs'],
  dominoes: ['dm.saveGame', 'dm.stats', 'dm.flags'],
  'hit-and-blow': ['hb.saveGame', 'hb.stats', 'hb.flags', 'hb.prefs'],
  'dots-and-boxes': ['db.saveGame', 'db.stats', 'db.flags', 'db.prefs'],
  'binary-balance': ['bn.saveGame', 'bn.saveDaily', 'bn.stats', 'bn.flags', 'bn.prefs'],
  'sudoku-6x6': ['s6.saveGame', 's6.saveDaily', 's6.stats', 's6.flags', 's6.prefs'],
  'box-regions': ['br.saveGame', 'br.saveDaily', 'br.stats', 'br.flags', 'br.prefs'],
  // The five web-beta titles of docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md.
  // Unlike every line above, these are beta keys, not released ones: while a
  // title is in the browser's early release its schema may still change
  // (docs/WEB_VERSION.md「先行公開」) — never silently, though: a change here
  // is a decision written into this file in the same commit as the code, and
  // the save it drops was announced by the BETA notice first. They freeze the
  // day a title graduates (docs/RELEASE_CHECKLIST.md §0), as the eleven from
  // cg. to br. did on 2026-10-02. Each starts at the scaffold's two keys and
  // grows to what its rules document's storage section lists; one comment per
  // line, so that each game's change to its own line merges without touching
  // its neighbours'.
  // No. 42, web-beta (docs/UNBLOCK_PUZZLE_RULES.md storage): not frozen until graduation
  'unblock-puzzle': ['ub.saveGame', 'ub.saveDaily', 'ub.stats', 'ub.flags', 'ub.prefs'],
  // No. 43, web-beta (docs/SNAKE_RULES.md storage): not frozen until graduation
  snake: ['sn.saveGame', 'sn.stats', 'sn.flags', 'sn.prefs'],
  // No. 44, web-beta (docs/LOOP_PUZZLE_RULES.md storage): not frozen until graduation
  'loop-puzzle': ['lp.saveGame', 'lp.saveDaily', 'lp.stats', 'lp.flags', 'lp.prefs'],
  // No. 45, web-beta (docs/BRIDGES_RULES.md storage): not frozen until graduation
  bridges: ['bg.saveGame', 'bg.saveDaily', 'bg.stats', 'bg.flags', 'bg.prefs'],
  // No. 46, web-beta (docs/PEG_SOLITAIRE_RULES.md storage): not frozen until graduation
  'peg-solitaire': ['pg.saveGame', 'pg.stats', 'pg.flags', 'pg.prefs'],
  // The next five titles, of
  // docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md, in
  // development (registry `channel: 'in-development'`: offered on no build until
  // each is playable, when it turns 'web-beta'): beta keys on the same terms as
  // the five above. They are still the scaffold's two
  // keys; each grows to its rules document's storage section in Phase 2/3.
  // No. 47, in-development (docs/CHESS_RULES.md §7): the scaffold's two keys grew to the rules
  // document's four in Phase 3 — the one saved game (a move list) and the side for the next
  // game. Not frozen until graduation
  chess: ['ch.saveGame', 'ch.stats', 'ch.flags', 'ch.prefs'],
  // No. 48, in-development (docs/GEM_SWAP_RULES.md §7): not frozen until graduation
  'gem-swap': ['gs.saveGame', 'gs.stats', 'gs.flags', 'gs.prefs'],
  // No. 49, in-development (docs/PIPE_LINK_RULES.md storage): not frozen until graduation
  'pipe-link': ['pn.stats', 'pn.flags'],
  // No. 50, in-development (docs/BOUNCE_UP_RULES.md storage): not frozen until graduation
  'bounce-up': ['bo.stats', 'bo.flags'],
  // No. 51, in-development (docs/ECHO_PADS_RULES.md storage): not frozen until graduation
  'echo-pads': ['ep.stats', 'ep.flags'],
  // The five titles of
  // docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md
  // (Nos. 52–56), each playable since 2026-10-21 and on the browser's
  // early-release channel like Nos. 42–46 (registry `channel: 'web-beta'`):
  // three since 2026-10-21, Overtake and Scopa since 2026-10-22 by the product
  // owner's decision. Beta keys on the same terms as the ten above.
  // Each row is its rules document's storage section; none is frozen until
  // graduation.
  // No. 52, web-beta (docs/OVERTAKE_RULES.md storage): not frozen until graduation
  overtake: ['ot.progress', 'ot.stats', 'ot.flags', 'ot.prefs'],
  // No. 53, web-beta (docs/MAKE_THE_TARGET_RULES.md §10): the scaffold's two keys grew to
  // the rules document's five in Phase 3 — two saved-game slots (Free Play and the daily) and
  // the difficulty last chosen. Not frozen until graduation
  'make-the-target': ['tg.saveGame', 'tg.saveDaily', 'tg.stats', 'tg.flags', 'tg.prefs'],
  // No. 54, web-beta (docs/NESTED_TIC_TAC_TOE_RULES.md storage): not frozen until graduation
  'nested-tic-tac-toe': ['nt.saveGame', 'nt.stats', 'nt.flags', 'nt.prefs'],
  // No. 55, web-beta (docs/SCOPA_RULES.md storage): not frozen until graduation
  scopa: ['sc.saveGame', 'sc.stats', 'sc.flags'],
  // No. 56, web-beta (docs/TANGRAM_RULES.md storage): not frozen until graduation
  tangram: ['tn.saveGame', 'tn.saveDaily', 'tn.progress', 'tn.stats', 'tn.flags', 'tn.prefs'],
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
  'crown-grid': 'cg.',
  'number-path': 'np.',
  'shape-regions': 'sr.',
  yacht: 'yt.',
  mancala: 'mc.',
  dominoes: 'dm.',
  'hit-and-blow': 'hb.',
  'dots-and-boxes': 'db.',
  'binary-balance': 'bn.',
  'sudoku-6x6': 's6.',
  'box-regions': 'br.',
  'unblock-puzzle': 'ub.',
  snake: 'sn.',
  'loop-puzzle': 'lp.',
  bridges: 'bg.',
  'peg-solitaire': 'pg.',
  chess: 'ch.',
  'gem-swap': 'gs.',
  'pipe-link': 'pn.',
  'bounce-up': 'bo.',
  'echo-pads': 'ep.',
  overtake: 'ot.',
  'make-the-target': 'tg.',
  'nested-tic-tac-toe': 'nt.',
  scopa: 'sc.',
  tangram: 'tn.',
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
