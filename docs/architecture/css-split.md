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
  `schulte-table.css` / `number-recall.css` / `bunny-hop.css` / `bubble-pop.css`。
  アーケード 2 本が共有する実況行(レベル / 残り / ライフ)だけは `ui/styles.css` に
  `.game-status*` として置いてある — 2 本が同じものを必要とした時点で共有クロムに
  なるのであって、`games/A/` の CSS を `games/B/` が読むことはない。
- ゲームの CSS は色を書かない。共有のカスタムプロパティ(`--accent` など)だけを使い、
  どの色になるかはシェルが root に付けた `data-game` が決める。
  ゲーム側にパレット値が複製されないので、下地を変えるときに触る場所は 1 か所で済む。
  **例外はゲームの中身そのものが色である場合だけ**で、その色はそのゲームの CSS に
  書く: Minesweeper の数字、Memory Match の 15 色、Water Sort の 9 色、2048 の
  タイルランプ、Reversi の盤(フェルトと黒白の石)、Connect Four の対戦相手の
  ディスク。いずれも「クロムは 1 タイトル 1 色、盤面はそのゲームのもの」という
  同じ線で、BRAND.md の一行を破っているわけではない。Reversi の石と Connect Four の
  相手色がテーマで反転しないのは、反転すれば盤面の意味が変わるからである
  (黒石がダークテーマの明るいインクを着たら、それはもう黒石ではない)。
