# タイトルごとのアクセント色

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

- アクセントは `packages/brand` の `titleAccents` に 1 タイトル 1 エントリ。

| ゲーム            | アクセント               | ライト    | ダーク    |
| ----------------- | ------------------------ | --------- | --------- |
| Number Match      | 藍                       | `#3f5b8f` | `#7d9ccf` |
| Sudoku            | くすんだティール         | `#2f6f62` | `#6fb3a3` |
| Solitaire         | くすんだフェルトグリーン | `#557a48` | `#97bd8a` |
| Spider Solitaire  | 深い緑                   | `#31802f` | `#7fcc7d` |
| FreeCell          | 深い藍                   | `#25256a` | `#6e6ecf` |
| Hearts            | スチールブルー           | `#2763c4` | `#96bde4` |
| Gin Rummy         | 深い菫                   | `#772b97` | `#b35dd5` |
| Minesweeper       | スレートブルー           | `#4a5a72` | `#93a4bd` |
| Nonogram          | くすんだプラム           | `#6d5192` | `#a893cf` |
| Water Sort        | くすんだアクア           | `#33708c` | `#7fb4c9` |
| Sliding Puzzle    | 温かみのある陶土色       | `#9c5b3c` | `#d1926f` |
| Memory Match      | くすんだローズ           | `#9e5468` | `#cf8fa4` |
| Brick Breaker     | 黄土                     | `#8a6a2b` | `#c9a765` |
| Sky Fighter       | 夕闇の青                 | `#5d5aa8` | `#9d9be0` |
| 2048              | ジェイド                 | `#2b7d59` | `#79c39c` |
| Block Puzzle      | オーキッド               | `#8b4f80` | `#c795bd` |
| Bunny Hop         | 草原の緑                 | `#6e7a34` | `#b6c274` |
| Reversi           | 菫                       | `#7f4a9c` | `#c48ad6` |
| Connect Four      | くすんだ赤               | `#a8433d` | `#dd8f89` |
| Quick Math        | マスタード               | `#776e18` | `#c4ba6b` |
| Schulte Table     | ペトロール               | `#18787b` | `#6cbcc1` |
| Number Recall     | 深いエメラルド           | `#1d6b33` | `#92dfa8` |
| Checkers          | ウォルナット             | `#5a4632` | `#cbb08a` |
| Gomoku            | 牡丹                     | `#a32d76` | `#e086bb` |
| Takuzu            | ワイン                   | `#88355e` | `#cb7ea4` |
| Futoshiki         | パイン                   | `#29603a` | `#74c88d` |
| Kakuro            | タバコ                   | `#794e2f` | `#cb9e7e` |
| Mahjong Solitaire | 深い青菫                 | `#3b3196` | `#7e77c0` |
| Bubble Pop        | オックスブラッド         | `#712d2f` | `#cd6a6d` |
| Ludo              | マゼンタ紫               | `#ad34a7` | `#cd6ac8` |

- シェルは `app/App.tsx` でゲームのマウント時にルート要素へ `data-game="<id>"` を付け、
  `ui/styles.css` の `:root[data-game='…']` が**アクセントトークンだけ**を差し替える
  (`--accent` / `--accent-ink` / `--accent-soft` / `--accent-ring` …。
  ライト / ダークそれぞれに定義がある)。ゲームを離れると属性を消す。
- 同じ上書きブロックは `.accent-<id>` としても書いてあり、**要素 1 つとその中だけ**に
  同じアクセントを効かせられる。コレクションホームは全タイトルのタイルを同時に出すので
  こちらを使う(`data-game` はルートに 1 つしか付けられない)。値は 1 か所にしか
  書かないので、あるタイトルの色がホームとゲーム内で食い違うことはない。
- Number Match のアクセントは `:root` の既定値そのもの(コレクションホームと同じ)なので、
  `data-game='number-match'` の上書きブロックも `.accent-number-match` も持たない。
  残りのタイトルが上書きする。
- **シリーズの下地(`seriesColors`)は変えない。** 別のゲームが「同じシリーズ」に
  見えているのはこの下地であり、変わるのは 1 タイトル 1 色だけ(BRAND.md)。
- ゲーム側に色の分岐を書かない。ゲームは `var(--accent)` を使うだけで、
  自分がどのタイトルとして塗られるかを知らない。
