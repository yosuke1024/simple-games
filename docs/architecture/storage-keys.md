# ストレージキーの規約

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

| キー              | 内容                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `sg.settings`     | 共有設定(言語 / テーマ / 音 / 振動 / Reduced Motion)                                          |
| `sg.iap`          | 広告削除購入状態のローカルキャッシュ                                                          |
| `sg.review`       | ストアレビュー導線の状態(完了数 / 表示回数 / 解決済みフラグ)                                  |
| `sg.recent`       | 「最近遊んだ」のゲーム id(新しい順・最大 2 件)                                                |
| `sg.favorites`    | 「お気に入り」に固定したゲーム id(**留めた順**・上限は実質なし)                              |
| `sg.webAppPrompt` | Web 版のアプリ案内カードの状態(ゲーム離脱回数 / 表示済みフラグ)。**Web 版でのみ読み書きする** |
| `sd.*`            | Sudoku(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                    |
| `so.*`            | Solitaire(saveGame / saveDaily / stats / flags / prefs)                                       |
| `ms.*`            | Minesweeper(saveGame / saveDaily / stats / flags / prefs)                                     |
| `ng.*`            | Nonogram(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                  |
| `mj.*`            | Mahjong Solitaire(saveGame / saveDaily / stats / progress / flags。**prefs なし**)            |
| `tk.*`            | Takuzu(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ) |
| `ft.*`            | Futoshiki(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                 |
| `kk.*`            | Kakuro(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                    |
| `nm.*`            | Number Match(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ) |
| `ws.*`            | Water Sort(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ) |
| `sp.*`            | Sliding Puzzle(saveGame / saveDaily / stats / progress / flags)                               |
| `mm.*`            | Memory Match(saveGame / saveDaily / stats / flags)                                            |
| `bb.*`            | Brick Breaker(stats / progress / flags。**saveGame なし** — 下記)                             |
| `sf.*`            | Sky Fighter(stats / progress / flags。**saveGame なし** — 下記)                               |
| `tm.*`            | 2048(saveGame / stats / flags。デイリーもレベル進行もない)                                    |
| `bp.*`            | Block Puzzle(saveGame / stats / flags。同上)                                                  |
| `ld.*`            | Ludo(saveGame / stats / flags / prefs。統計は難易度別。デイリーが無いので 1 枠)               |
| `ck.*`            | Checkers(saveGame / stats / flags / prefs。統計は難易度別)                                    |
| `rv.*`            | Reversi(saveGame / stats / flags / prefs。統計は難易度別)                                     |
| `c4.*`            | Connect Four(saveGame / stats / flags / prefs。同上)                                          |
| `gm.*`            | Gomoku(saveGame / stats / flags / prefs。同上)                                                |
| `ss.*`            | Spider Solitaire(saveGame / saveDaily / stats / flags / prefs)                                |
| `fc.*`            | FreeCell(saveGame / saveDaily / stats / flags。**prefs なし**)                                |
| `ht.*`            | Hearts(saveGame / stats / flags / prefs。統計は難易度別)                                      |
| `gr.*`            | Gin Rummy(saveGame / stats / flags / prefs。同上)                                             |
| `bh.*`            | Bunny Hop(stats / flags。**saveGame なし** — 下記)                                            |

Sudoku の 6 キー: `sd.saveGame`(中断したレベル)/ `sd.saveDaily`(中断したデイリー。
2 スロット独立)/ `sd.stats`(難易度別)/ `sd.progress`(解放レベルとベストタイム)/
`sd.flags`(チュートリアル完了)/ `sd.prefs`(ゲーム固有設定)。
Minesweeper はレベル進行を持たないため `progress` がなく、代わりに旗モードの
`ms.prefs` を持つ。Nonogram は ×モードの `ng.prefs` を持つ。Takuzu は逆に 5 キーで、
タップ 1 種で操作が閉じ、違反表示は設定でなく規則なので `prefs` に入れるものがない
(`TAKUZU_RULES.md` §4 / §9)。Futoshiki は同じ 5 つに `ft.prefs` を加えた
6 キーで、盤面をまたいで覚える設定がミスの即時表示 1 つだけあるからである
(`FUTOSHIKI_RULES.md` §5 / §11)。**キーの数は揃えるものではなく、そのゲームが
覚えるものの数である。**Solitaire は
Draw 1/3 の `so.prefs` を持ち、Memory Match はレベル進行も個別設定も持たない
(デイリーの記録は両者とも stats 内)。デイリーを持つパズルはいずれも中断が
「通常モード用」と「デイリー用」の 2 スロットで独立する。2048 と Block Puzzle は
デイリーもレベル進行も持たないエンドレスなので、中断スロットは 1 つだけで
`progress` もない(自己ベストは stats 内 — `GAME_2048_RULES.md` §9 /
`BLOCK_PUZZLE_RULES.md` §9)。

[REVERSI_RULES.md](../REVERSI_RULES.md) /
[CONNECT_FOUR_RULES.md](../CONNECT_FOUR_RULES.md) /
[BUNNY_HOP_RULES.md](../BUNNY_HOP_RULES.md) を唯一のソースとする。

- 共有レコードは `sg.` 接頭辞。ゲーム固有レコードはゲームごとの接頭辞。
- ゲーム固有設定は共有 `sg.settings` に混ぜず、そのゲームの接頭辞に置く
  (`sd.prefs`)。シェルの設定レコードがゲーム追加ごとに膨らまない。
- `sg.adState` / `sg.rcCache` は廃止(インタースティシャル頻度制御と
  Remote Config キャッシュは存在しない)。
- `kv` / `repo` / `SchemaDef` と schemaVersion 運用は全ゲームで共有する。
- **`loadRecord` は throw しない。** 壊れた JSON も、ストア自体の失敗も、
  スキーマ既定値に倒す。ただし「保存が無い」と「読めなかった」を同一視できない
  呼び出し側のために、`loadRecordWithStatus` が `readable` を添えて返す
  (使うのは広告削除の entitlement だけ。issue #96)。
- **起動時の読み出しは 1 段ずつ独立して守る**(`app/boot.ts`)。5 つの `await` が
  1 つの `try` を共有していた頃は、最初の失敗が残り全部を巻き添えにしていた —
  無関係なレコード 1 件が読めないだけで、設定が既定値に戻り「最近遊んだ」が
  空になる(issue #96)。
- ゲームごとに保存領域を分離し、一方の破損が他方へ波及しない(validate で防御)。
  ゲームの追加が既存ゲームの保存データを失わせてはならない。
- **中断スロットを 2 つ持つゲームでは、どちらのモードのレコードかを決めるのは
  「キー」であってレコード内の `mode` ではない。**両スロットは同じ形のレコードを
  持つので、スロット schema には期待するモードを渡し、食い違うレコードは
  破損として `null` に落とす。これを怠ると、フリーのキーに `mode: 'daily'` の
  正当なレコードが入ったときにそれが読み込まれ、再開した瞬間にアプリがもう一方の
  スロットへ切り替わる — プレイヤーは頼んだのと別のゲームか、空白の画面を見る。
  規則の遵守は `src/test/savedGameSlots.test.ts` が構造的に、各ゲームの
  `storage/slots.test.ts` が実レコードで確かめる。
- **`repo.ts` はキーごとに操作を直列化する。** 書き込みは全レイヤーで fire-and-forget
  (ゲームを保存待ちで止めない)なので、1 つのキーに対して複数の操作が同時に飛びうる。
  順序を保証しないと、最後に着地したものが勝ってしまう。実害が見えるのは
  「ローカルデータ削除」で、削除の瞬間に飛んでいた保存が後から着地するとレコードが
  復活し、削除ボタンが嘘をつく。ゲームは 1 手ごとに保存するので、宙に浮いている
  可能性が最も高いのは盤面である。
  - 逆向きも同じくらい重要: **削除の後に行われた保存は残さなければならない**
    (削除してから設定を変えた、遊び直した)。「削除より前に始まった書き込みを
    後から取り消す」方式ではこれを巻き添えで消す。頼まれた順に実行するのが唯一の
    正しい規則。
  - 読み出しも同じ列に載る(自分の書き込みが読める)。キーどうしは独立なので、
    遅い 1 レコードが他を待たせることはない。
- 「ローカルデータ削除」は `sg.*` と全ゲームのキーを消す。
