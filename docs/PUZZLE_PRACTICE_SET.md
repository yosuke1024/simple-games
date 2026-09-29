# Simple Games — 5 種類のパズル練習セット

Updated: 2026-09-29(issue #210)

Web 版の**専用ベータ入口**から選べる 5 種類のパズルと、その比較対象(LinkedIn の
Queens / Zip / Tango / Mini Sudoku / Patches)との対応を固定する文書。目的は
「LinkedIn で今日のパズルを解き終わった人が、もう少し遊んだり、同じ種類の考え方を
練習したりできる場所を提供する」こと。**各ゲームの規則の正本は各 `docs/<GAME>_RULES.md`**
であり、この文書は 5 本をセットとして扱うときの判断(名前・対応・入口・約束の範囲)だけを
持つ。ブランド原則([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))と
[BRAND.md](BRAND.md)「自社タイトルと比較対象の名前」はこの文書より上位にある。

## 1. 5 種類の対応表

2026-09-29 に公式 Help(下の「一次資料」)を読み、現行 `main` の実装と突き合わせた結果。
「同じ」は合法手と勝利条件が一致することを言い、支援(Hint / Undo / Clear)や供給
(1 日 1 問か、いつでもか)の違いは**意図した違い**として各ルール文書の §14 に記録してある。

| 比較対象    | Simple Games のタイトル(ID)   | 中核ルールの対応                                                                                            | 意図した違い(要約)                                                                             | 正本                                                 |
| ----------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Queens      | Crown Grid(`crown-grid`)      | **同じ**: 各行・各列・各領域に 1 つ、8 近傍で非接触。長距離の斜め攻撃(チェスのクイーン)は公式にも無く、足していない | Undo / Clear / 自動 × を作らない(タップ循環 + なぞり ×)。Hint は違反 → 誤り → 技法の順             | [CROWN_GRID_RULES.md](CROWN_GRID_RULES.md) §14       |
| Zip         | Number Path(`number-path`)    | **同じ**: 1 から番号順に、全マスを 1 回ずつ通る 1 本の道、壁は越えない。交差・再訪・分岐は構造上できない       | Hint は「唯一の解から外れた地点」または「次の 1 マス」(公式は最初の誤りまで消して次を示す)          | [NUMBER_PATH_RULES.md](NUMBER_PATH_RULES.md) §12     |
| Tango       | Binary Balance(`binary-balance`) | **同じ**: 2 記号、各行・各列で個数が同じ、3 連続禁止、`=` / `×` のリンク。Takuzu の「同じ並びの行(列)禁止」は持ち込まない | 記号は ○ / □(太陽・月は使わない)。Undo / Clear なし(タップ循環)。3 ティアとも 6×6 で、差は技法の集合だけ                     | [BINARY_BALANCE_RULES.md](BINARY_BALANCE_RULES.md) §14 |
| Mini Sudoku | Sudoku 6×6(`sudoku-6x6`)      | **同じ**: 6×6、2 行 × 3 列のボックス、1〜6 を各行・各列・各ボックスに 1 つ(寸法とボックスは第三者解説で確認)   | 9×9 の Sudoku とは別 ID(改名ではない)。Clear なし。難易度 3 種 + デイリー                          | [SUDOKU_6X6_RULES.md](SUDOKU_6X6_RULES.md) §14       |
| Patches     | Box Regions(`box-regions`)    | **同じ**: 重ならず全マスを長方形の箱で埋め、各箱に手がかり 1 つ。手がかりは数字 / 形(正方形・縦長・横長・自由)/ 両方 / どちらも無し | 領域は 1〜12 マス、盤面は 5×5〜7×7。Reset なし。Shape Regions(5 形のポリオミノ)は**別のゲーム**のまま | [BOX_REGIONS_RULES.md](BOX_REGIONS_RULES.md) §14     |

**Shape Regions は練習セットに入れない。**issue #210 は Shape Regions を Patches の出発点と
していたが、公式 Help と第三者解説を読んだ結果、Patches の領域は**長方形だけ**であり
(形の 4 分類は長方形の縦横比)、Shape Regions の 5 種のポリオミノとは合法な完成形の集合が
違う。名前の読み替えで「同じルールの練習用」とはできないので、長方形のルールを持つ
Box Regions を独立 ID で作り、Shape Regions のルール・保存・チャンネルには触れていない。

### 一次資料(2026-09-29 閲覧)

- Queens: <https://www.linkedin.com/help/linkedin/answer/a6269510>
- Zip: <https://www.linkedin.com/help/linkedin/answer/a7445030>
- Tango: <https://www.linkedin.com/help/linkedin/answer/a6861672/>
- Mini Sudoku: <https://www.linkedin.com/help/linkedin/answer/a8029251>
- Patches: <https://www.linkedin.com/help/linkedin/answer/a10314037>

Help に書かれていないこと(Mini Sudoku の寸法とボックスの形、Patches の「shape は長方形か」
「freeform の意味」)は同日に第三者の解説で確認し、各ルール文書の §14 に出典と日付を
書いてある。**公式の問題データ・解答・アセット・チュートリアル画面は取得も転載も
していない。**盤面はすべて端末上で生成する。Help の記述が変わったら、対応表と各 §14 を
読み直す(確認日を更新する)。

## 2. 名前とブランド

[BRAND.md](BRAND.md)「自社タイトルと比較対象の名前」が正本。要点:

- 自社タイトル(Crown Grid / Number Path / Binary Balance / Sudoku 6×6 / Box Regions)と、
  比較対象として説明する他社のゲーム名(Queens / Zip / Tango / Mini Sudoku / Patches)を
  **分ける**。他社の商品名を Simple Games の正式ゲーム名にしない。
- 説明文では比較対象の名前を隠さず、「どれに近いか」を明示する。ロゴ・配色・画面構成・
  記号のデザイン・公式の問題は複製しない。
- 公式・提携・公認と誤認させるタイトル・OG・説明文・ストア文面を作らない。専用入口には
  **非提携表示**を置く(英文の正本は BRAND.md)。
- 「LinkedIn の全ゲーム」「全ゲームを収録」とは言わない。5 種類は今回選んだ対象である。

## 3. 専用ベータ入口(Web)

[WEB_VERSION.md](WEB_VERSION.md)「専用ベータ入口(練習セット)」が正本。要点:

- 入口は `pixapps-landing` の静的ページ `https://pixapps.ai/simple-games/practice/`。
  テーマは **More puzzles, at your own pace.**
- 5 枚のカードは既存の `?game=<id>` 契約でそのゲームのホームを開く。variant もモードも
  無い — 5 本すべてが独立 ID なので、カードから対象へ迷わず着く。
- カードは各ゲームの**実際のチャンネル**に従って BETA を表示する(5 本すべてが
  `web-beta` の間はすべてに付く)。セット全体が正式リリース済みであるかのように見せない。
- 通常 LP の正式収録一覧・ガイド・ストア掲載への昇格は既存のゲート
  ([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §0)のまま。専用入口はその例外ではなく、
  「公開済みの Web ベータを案内してよい場所」として明文化したものである。
- 未実装カード・Coming Soon は出さない。「5 種類が揃った」と言えるのは 5 本すべてが
  実際に遊べてから。

## 4. 繰り返し遊べること(約束の範囲)

5 本すべてで次が成り立つ(各ルール文書が個別に約束している):

- 難易度(Easy / Medium / Hard)を最初から選べ、「新しい盤面」でいつでも独自の新しい問題が
  端末上で生成される。デイリーは「加えて 1 日 1 問」であって、供給の全部ではない。
- 日付更新・回数回復・ログイン・広告視聴・購入を待たせない。有限の既定レベルも無い。
- 無料・無制限の助けを、ゲームごとに合う形で持つ(Crown Grid / Binary Balance は Hint のみ、
  Number Path / Sudoku 6×6 / Box Regions は Undo + Hint)。形を機械的に揃えない。
- 練習ノルマ・ストリーク・常時タイマー・ランキング・通知は無い。

**約束しないこと**: 公式の当日問題と同じ難易度・同じ記録の尺度、上達・タイム短縮・認知能力の
向上。公開文面に書かない([BRAND.md](BRAND.md)「表現ルール」)。

## 5. 計測と評価

[GROWTH_MEASUREMENT.md](GROWTH_MEASUREMENT.md) / [WEB_VERSION.md](WEB_VERSION.md)「計測」の
範囲のまま。新しいイベント・SDK・個人識別は足さない。

- 見るもの: 専用ページの `page_view`、5 本の `game_open` / `game_close`(種類別の需要と、
  取得できる範囲の滞在時間)、そこから他の Simple Games / PixApps への遷移。
- LinkedIn 投稿からの流入は UTM(`utm_source=linkedin` 等)で区別する案。UTM は URL に
  付くだけで、アプリ側の計測コードは変えない。
- 測れないこと: タブを閉じたときの `game_close` 欠測、少数サンプル、「練習になったか」。
  これらを埋めるために計測の範囲を広げない。

## 6. Android / iOS への正式収録

5 本の Web 公開と正式収録は別マイルストーン。条件は [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
§0(直近 2 週間の安定稼働・計測の評価・永続化ラウンドトリップテスト)のままで、この
セットのために弱めない。**Web 公開時点で正式収録済みとは書かない。**未実施の実機検証
(低スペック端末での生成時間、7×7 / 8×8 の 320px でのタッチ精度、アセット読み込み後の
オフライン再挑戦)は各ルール文書に「まだ行っていない」と書いてあり、正式収録の判断で
確認する。
