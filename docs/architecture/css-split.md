# CSS の分割

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

- **ゲームの CSS はそのゲームが持つ。** `games/<id>/ui/<id>.css` を同じフォルダの
  Root コンポーネントが import する(Vite が束ねるので、追加の設定はいらない)。
  ゲームを増やしても共有スタイルシートが伸びない。
- `ui/styles.css` に置くのは共有シェルのみ: デザイントークン(下地・アクセント・
  `data-game` の上書き)、コレクションホーム、設定 / About、ダイアログ・トースト・
  チュートリアル・バナースロットなどの共通クロム。
- **全タイトルが規約に従っている**: `number-match.css` / `sudoku.css` / `minesweeper.css` / `nonogram.css` /
  `mahjong-solitaire.css` / `takuzu.css` / `futoshiki.css` / `kakuro.css` /
  `sliding-puzzle.css` / `memory-match.css` / `water-sort.css` / `solitaire.css` /
  `spider-solitaire.css` / `freecell.css` / `hearts.css` / `gin-rummy.css` /
  `brick-breaker.css` / `sky-fighter.css` / `game-2048.css` / `block-puzzle.css` / `ludo.css` /
  `checkers.css` / `reversi.css` / `connect-four.css` / `gomoku.css` / `quick-math.css` /
  `schulte-table.css` / `number-recall.css` / `bunny-hop.css` / `bubble-pop.css` /
  `crown-grid.css` / `number-path.css` / `shape-regions.css` / `yacht.css` / `mancala.css` /
  `dominoes.css` / `hit-and-blow.css` / `dots-and-boxes.css` / `binary-balance.css` /
  `sudoku-6x6.css` / `box-regions.css`(2026-10-02 に収録した 11 本)、
  `unblock-puzzle.css` / `snake.css` / `loop-puzzle.css` / `bridges.css` /
  `peg-solitaire.css`(Web 先行公開の 5 本、2026-10-17)、
  `chess.css` / `gem-swap.css` / `pipe-link.css` / `bounce-up.css` / `echo-pads.css`
  (Web 先行公開の次の 5 本、2026-10-22 に実装)、
  `overtake.css` / `make-the-target.css` / `nested-tic-tac-toe.css` / `scopa.css` / `tangram.css`
  (さらに次の 5 本、2026-10-21 に実装)、
  `light-grid.css` / `color-flood.css` / `three-peaks.css` / `nim.css` / `knight-tour.css`
  (No. 57〜61、2026-10-23 に実装)、
  `invaders.css` / `falling-blocks.css` / `paddle-rally.css` / `hanoi-towers.css` / `maze-escape.css`
  (No. 62〜66、2026-10-23 に実装)。
  アーケード 2 本が共有する実況行(レベル / 残り / ライフ)だけは `ui/styles.css` に
  `.game-status*` として置いてある — 2 本が同じものを必要とした時点で共有クロムに
  なるのであって、`games/A/` の CSS を `games/B/` が読むことはない。
- **ゲームのクラス名は、ほかのゲームとぶつけない**(2026-10-30)。ゲームの CSS は遅延チャンクで、
  一度開いたゲームのスタイルシートはアプリを閉じるまで残る。だから、あるゲームがセレクタの起点にした
  クラスを別のゲームの要素も持っていると、その規則はそちらにも効く。
  - **起点**: シェルが定義しないクラスのうち、セレクタで最初に出てくるもの。
  - **シェルのクラス**: `games/` の外のスタイルシートで、セレクタの先頭に来るもの。
  - **規則**: あるゲームが起点にするクラスは、ほかのゲームのスタイルシートに出てこない。
  - **書き方**: シェルのクラスに手を入れるときは、自分の起点の下に置く(Overtake の `.ot-controls .segment`)。
    同じ名前のクラスでも、それぞれが自分の起点の下に置いていれば互いに届かない(`.kt-screen .game-title` と
    `.nim-screen .game-title`)。
  - **経緯**: Hearts と Hanoi Towers は接頭辞 `ht-` を共有していて、`.ht-body` / `.ht-actions` が衝突していた。
    Hearts を開いた後の Hanoi の盤が内側でスクロールし、逆向きにも漏れていたので、Hanoi を保存キーと同じ
    `hn-` に改めた。
  - **検査**: `src/test/styles.test.ts` が、全ゲームについてこの規則と `@keyframes` の名前の重なりを確かめる。
    別のゲームのマークアップにだけあってスタイルシートにないクラスは、この検査からは見えない。
- ゲームの CSS は色を書かない。共有のカスタムプロパティ(`--accent` など)だけを使い、
  どの色になるかはシェルが root に付けた `data-game` が決める。
  ゲーム側にパレット値が複製されないので、下地を変えるときに触る場所は 1 か所で済む。
  **例外はゲームの中身そのものが色である場合だけ**で、その色はそのゲームの CSS に
  書く: Minesweeper の数字、Memory Match の 15 色、Water Sort の 9 色、2048 の
  タイルランプ、Reversi の盤(フェルトと黒白の石)、Connect Four の対戦相手の
  ディスク、Ludo の 4 席の色(`--ld-seat-*`)、Overtake のライバルの青(`--ot-rival` と、
  数字の `--ot-rival-ink` — 2026-10-22。`--ot-rival-ink` は値を書かず `var(--surface)` を指す。2026-10-29 の路外の
  `--ot-verge` も `var(--line)` / `var(--paper)` を指す別名)、
  Light Grid の点灯・消灯(黄と暗い青、記号でも区別する。2026-10-29 に `--lg-*` の冒頭 2 ブロックへ移し、レンズの艶
  `--lg-gloss` は `var(--surface)` / `var(--ink)` の別名 — `LIGHT_GRID_RULES.md`「Lamp lenses, tray and transitions」)、
  Color Flood の 6 色と字色(`--cf-0`〜`--cf-5` / `--cf-0-ink`〜`--cf-5-ink` と質感の 4 トークン、ライト / ダーク —
  `COLOR_FLOOD_RULES.md`「Visual follow-up (2026-10-29)」。記号でも区別する)、Three Peaks の紙のカード(`--tp-face` /
  `--tp-ink` / `--tp-face-line` / `--tp-red` と影・ランプのトークン。2026-10-29 からダークでも札は紙 — `THREE_PEAKS_RULES.md` §6)、
  Gem Swap の 6 つの宝石の色(`--gs-gem-0`〜`--gs-gem-5`、ライト / ダーク — `GEM_SWAP_RULES.md` §10。2026-10-29 からは
  同じ 2 ブロックに光の別名 `--gs-glint` / `--gs-shade` と強さの数 4 本も置く)、
  Chess のマスの 2 色・駒の 2 色・印の halo(`--ch-square-*` / `--ch-piece-*` / `--ch-halo`、ライト / ダーク —
  `CHESS_RULES.md` §9。駒の色はテーマで入れ替えない)、そして 2026-10-29 の見た目の改訂(製品オーナーの判断)で
  材と顔料をゲーム内容の色として持つようになった 4 本 — Unblock Puzzle のトレイと木のブロック(`--ub-*` 9 個 —
  `UNBLOCK_PUZZLE_RULES.md` §14「色」)、Tangram の木(`--tn-plank-*` / `--tn-grain-*` / `--tn-hollow` / `--tn-groove` /
  `--tn-wood-*` / `--tn-edge` / `--tn-wood-grain`、14 個 — `TANGRAM_RULES.md` §10。板の値は Hanoi Towers の盆の写し)、
  Block Puzzle のピースの 4 色(`--bp-tone-2`〜`--bp-tone-5` — `BLOCK_PUZZLE_RULES.md` §12。tone 1 は値を書かず
  `var(--accent)` を指す)、Peg Solitaire の木の板(`--pg-plate-face` / `--pg-plate-edge` / `--pg-hole-floor` / `--pg-rim` と
  alpha だけの影と光 6 つ — `PEG_SOLITAIRE_RULES.md` §13)、同じ日に 2 ブロックの形へ揃えた Knight's Tour のマス・印の
  インク・駒の 2 色(`--kt-square-*` / `--kt-board-ink` / `--kt-piece` / `--kt-piece-edge` と alpha だけの 3 つ —
  `KNIGHT_TOUR_RULES.md`「Visual refinement (2026-10-29)」)、Hanoi Towers の木のトレー・ペグ・台座・円盤・影(`--hn-tray-*` /
  `--hn-grain` / `--hn-peg*` / `--hn-base*` / `--hn-disk-*` / `--hn-cast*` / `--hn-valid` — `HANOI_TOWERS_RULES.md`「Visual
  presentation」。2026-10-30 までは Hearts と同じ `ht-` 接頭辞で、クラス `.ht-body` / `.ht-actions` が衝突していたので
  `hn-` に改めた)、Maze Escape の盤(`--me-floor` / `--me-rim` / `--me-rim-lift` /
  `--me-wall-top` / `--me-wall-side` / `--me-cast` / `--me-start` / `--me-trail` / `--me-tray-shade` / `--me-drop` —
  `MAZE_ESCAPE_RULES.md`「Visual presentation」。駒の光沢 `--me-gloss` は `--surface` / `--ink` の別名)。いずれも冒頭の
  ライト / ダークの 2 つのブロックだけに書き、
  それ以外に色のリテラルが無いことを各ゲームの `ui/contrast.test.ts` が確かめる。いずれも「クロムは 1 タイトル 1 色、盤面はそのゲームのもの」という
  同じ線で、BRAND.md の一行を破っているわけではない。Reversi の石と Connect Four の
  相手色がテーマで反転しないのは、反転すれば盤面の意味が変わるからである
  (黒石がダークテーマの明るいインクを着たら、それはもう黒石ではない)。色の値を持たないゲームでも、共有トークンを指す
  別名だけを冒頭の 2 ブロックに置くことがある(2026-10-29: Snake の `--sn-dent`、Make the Target の `--tg-dent`、Bridges の
  `--bg-water`、Overtake の `--ot-verge`、Invaders の `--iv-*`)。別名は例外ではなく、`ui/contrast.test.ts` が「色のリテラルが
  無いこと」を確かめる対象に含める。
