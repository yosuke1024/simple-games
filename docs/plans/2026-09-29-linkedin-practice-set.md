# 5 種類のパズル練習セット — 実装計画 (2026-09-29)

issue #210 の実装計画。Web 版の専用入口から選べる 5 種類(Queens / Zip / Tango /
Mini Sudoku / Patches に対応)を、既存 2 本の活用 + 新規 3 本で揃える。
**この文書は着手時点の計画であり、恒久的な判断は canonical 文書へ移してある**:
対応表と約束の範囲は [PUZZLE_PRACTICE_SET.md](../PUZZLE_PRACTICE_SET.md)、名前と非提携は
[BRAND.md](../BRAND.md)「自社タイトルと比較対象の名前」、入口は
[WEB_VERSION.md](../WEB_VERSION.md)「専用ベータ入口」、各ゲームの規則は
`docs/<GAME>_RULES.md`。以後はそちらが勝つ。

## 決定事項

| 項目        | Binary Balance                                   | Sudoku 6×6                                        | Box Regions                                     |
| ----------- | ------------------------------------------------ | ------------------------------------------------- | ----------------------------------------------- |
| 比較対象    | Tango                                            | Mini Sudoku                                       | Patches                                         |
| id          | `binary-balance`                                 | `sudoku-6x6`                                      | `box-regions`                                   |
| 保存接頭辞  | `bn.`                                            | `s6.`                                             | `br.`                                           |
| i18n 接頭辞 | `binaryBalance*`                                 | `sudoku6x6*`                                      | `boxRegions*`                                   |
| カテゴリ    | `logic`                                          | `logic`                                           | `logic`                                         |
| グリフ      | `⊜`(U+229C)                                      | `6`                                               | `▭`(U+25AD)                                     |
| 進行        | 難易度 3 種(すべて 6×6)+ デイリー(Medium)         | 難易度 3 種 + デイリー(Medium)                     | 難易度 3 種(5 / 6 / 7)+ デイリー(Medium)         |
| 助け        | Hint(Undo なし — タップ循環)                      | Undo + Hint + メモ                                 | Undo + Hint                                     |
| 保存キー    | saveGame / saveDaily / stats / flags / prefs     | 同左(prefs に `highlightMistakes`)                | 同左                                            |
| チャンネル  | `web-beta`                                       | `web-beta`                                        | `web-beta`                                      |
| アクセント  | 若草 `#5a8128` / `#9cce5a`                        | 紺青 `#233c76` / `#6784c5`                         | 深い薔薇 `#ac3564` / `#ce5a88`                   |
| README 併記 | 二値配置パズル(リンクつき)                        | 小さな数独                                         | 長方形分割                                      |

- **Crown Grid / Number Path は変更しない。**公式 Help と照合した結果、中核ルール(合法手・
  勝利条件)は一致しており、違いは支援の形だけ(各 §14 に「比較対象との対応」を追記)。
  Crown Grid にはクイーンの長距離斜め攻撃が無いことを engine テストで明示した。
- **Shape Regions は練習セットに入れず、触らない。**Patches の領域は長方形だけ
  (公式 Help の 4 分類は長方形の縦横比、第三者解説 3 本が一致)で、Shape Regions の
  5 種のポリオミノとは合法形の集合が違う。issue #210 §D の「versioned rules / variant /
  独立 ID のうち単純な方式」のうち、既存の保存に一切触れない独立 ID を選んだ。
- **Tango 系は Takuzu の variant にしない。**Takuzu の規則 3(同じ並びの行禁止)を持たず
  リンクを持つので、engine / solver / generator は別物。保存も別領域。
- **Mini Sudoku 系は Sudoku の variant にしない。**9×9 の 100 レベル・デイリー・フリー
  プレイ・golden・保存に触れないことが、後方互換性で最も単純。6×6 の solver / grader は
  小さく書き直す。
- **名前**: issue の仮案どおり Binary Balance / Sudoku 6×6。Patches 系は Shape Regions の
  隣に置く名として Box Regions。他社の商品名は正式ゲーム名にしない(BRAND.md)。
- **接頭辞の空き**: `bn` / `s6` / `br` は未使用(`scripts/new-game.mjs` が拒否しなかった)。
- **アクセント 3 色は BRAND.md「アクセントを選ぶ手順」で機械選定**(下の Phase 1)。
- **ストア掲載文・landing のガイド・`PUBLISHED_GAME_IDS` には入れない**(正式収録まで)。

## 共通要件(3 本とも)

[2026-09-26 の計画](2026-09-26-crown-grid-number-path-shape-regions.md)「共通要件」と同じ:
骨格は Crown Grid / Shape Regions を写す(`game/ state/ storage/ ui/ i18n/`、2 スロット独立、
`prefs` は最後に選んだ難易度だけ、一意解を構成として保証、難易度は技法の集合、性能の門は
仕事量、盤面に翻訳の要る文字を置かない、時計を出さない、Quick Rules 3 ステップ、高リスク
キーを発生させない、`WebBetaNotice` をホームに置く、各ゲームは自分のフォルダと自分の
ルール文書以外に触れない)。

## フェーズ

1. **Phase 1 — 接続点**(済、2026-09-29): ルール文書 3 本(実装より先)、`scripts/new-game.mjs`
   で 3 本をスキャフォールド、registry に `channel: 'web-beta'`、`gameChannel.test.ts` の
   ベータ一覧、アクセント 3 色を styles.css / `titleAccents` / title-accent.md / BRAND.md に
   登録、css-split.md / storage-keys.md の一覧。`App.test` / `App.route.test` /
   `gameSearch.test` は `Sudoku` の部分一致が 2 本に当たるようになったので、完全一致に直した
   (ゴールデンデータの変更ではない)。
2. **Phase 2 — 3 本の本実装(並行)**: 各ゲームはルール文書 → `game/`(テスト込み)→
   `storage/` → `state/` → `ui/` → i18n(en / ja)。ルール文書の実測表を実測値で埋める。
3. **Phase 3 — 翻訳**: 残り 12 言語(機械翻訳・未承認。高リスクキーは作らない)。
4. **Phase 4 — 文書と検証**: PUZZLE_PRACTICE_SET.md / BRAND.md / WEB_VERSION.md /
   PROJECT_CONTEXT.md / README / RELEASE_CHECKLIST.md、Crown Grid / Number Path の §14、
   `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm --filter simple-games
build:web && pnpm --filter simple-games size:check`、`bash .github/scripts/check-principles.sh`、
   `pnpm size:update`、ブラウザ試遊。
5. **Phase 5 — landing(別リポジトリ `pixapps-landing`、別 PR)**: 静的ページ
   `/simple-games/practice/`(OG・非提携表示・BETA・5 カード)、`tests/ui.test.js` の
   `WEB_BETA_GAME_IDS` に 3 本、practice ページと配信 id の一致テスト、Publish ワークフローで
   Web ビルドを同期。5 本すべてが配信されてから公開する。
6. **Phase 6 — 公開後**: 投稿(手動・別判断)、GA4 での流入と `game_open` の確認、2 週間の
   安定稼働と計測を見て正式収録を別途判断(RELEASE_CHECKLIST.md §0)。

### Phase 1 の実施結果(2026-09-29)

BRAND.md「アクセントを選ぶ手順」を出荷済み 38 色 + `--warn` に対して実行した(CIE76。
スクリプトは選定時の作業ディレクトリに置き、リポジトリには入れていない)。既存の最接近
ペアはライト 10.88(Sudoku × Schulte Table)/ ダーク 7.91(Nonogram × Sky Fighter)で
変わらず、床は 1.15 倍の 12.5 / 9.1。中央値帯(ライト |S−44| ≤ 10 / |L−37| ≤ 7、ダーク
|L−65| ≤ 7)は緩めずに済み、白インク 4.5:1・ダーク紙 4.5:1・紙 3:1 を満たす候補から、
3 本の相互距離 ΔE 30 以上を条件に、全床に対する最弱余裕を最大化する 3-クリークを選んだ
(最弱余裕 1.13)。soft / onDark は前回と同じ回帰(softLight = S×0.97 / L90%、softDark =
S×0.71 / L18%、onDark = L8%)で、Crown Grid の出荷値を誤差 0 で再現することを確かめてから
当てた。

| ゲーム         | 色       | ライト    | ダーク    | 最接近(ライト / ダーク)                | 白文字 / 紙  | ダーク紙 |
| -------------- | -------- | --------- | --------- | -------------------------------------- | ------------ | -------- |
| Binary Balance | 若草     | `#5a8128` | `#9cce5a` | Spider Solitaire 14.1 / Spider Solitaire 20.2 | 4.56 / 4.01  | 9.74     |
| Sudoku 6×6     | 紺青     | `#233c76` | `#6784c5` | Number Match 14.2 / Number Match 12.5  | 10.61 / 9.32 | 4.86     |
| Box Regions    | 深い薔薇 | `#ac3564` | `#ce5a88` | Gomoku 14.8 / Takuzu 18.0              | 6.09 / 5.35  | 4.66     |

3 色の相互距離はライト 56.5〜91.3・ダーク 55.1〜103.7。棚(論理の節、2 列)の隣人:
Binary Balance × Shape Regions(上)102.3 / 111.5、Sudoku 6×6 × Hit & Blow(上)38.6 / 34.7、
Binary Balance × Sudoku 6×6(横)90.9 / 100.6、Binary Balance × Box Regions(下)91.3 / 103.7 —
いずれも慣例の 15 / 11 を超える。Sudoku 6×6 は 9×9 の Sudoku から 53.8 / 52.1 離れている。
Binary Balance の紙の上 4.01 は 4.5 に届かない(Yacht・Bunny Hop 等と同じ扱い。
BRAND.md「コントラスト」)。

### Phase 2〜3 の実施結果(2026-09-30)

3 本とも各ルール文書のとおりに実装し、実測表(仕事量・派生 seed・fallback・壁時計)は
各文書の §6〜§8 に実値で入れた(開発機の値。低スペック実機は未計測)。実装中に
文書を直した判断は次の 3 つで、いずれも当該ルール文書に理由と数字つきで書いてある:

- **Sudoku 6×6 — ティアを「必要な技法」で定義できなかった**(§6)。固定 40 seed × 派生 60 本で
  「Medium は singles では解けない」を満たす盤面は 4 / 40、「Hard は Pair が要る」は 0 / 40
  (別の走査でも Locked Candidates 必要率 約 1%、Pair 約 1/1,500)。文書自身の退避指示に従い、
  Sudoku(9×9)§6 と同じ「許容技法 + 掘削の下限」の形にした。実測ではほぼ全盤面が singles で
  解け、ティアの差は初期数字の少なさ(Easy 16 / Medium 12 / Hard 10 が中央値)から来る。
- **Binary Balance — Hard を 8×8 から 6×6 へ**(§1)。8×8 で T5 を要する盤面は最悪 120.9ms
  (再計測 122 / 115ms、40 盤中 2 盤が 100ms 超)で端末予算 100ms を割った。案 A(8×8 のまま
  Hard を「Easy で解けない」に緩める: 最悪 47ms だが 40 盤中 17 盤が T4 止まり)と案 B(6×6 で
  T5 必要のまま: 最悪 26ms、T5 必要率 41%、fallback 0)を同じ 40 seed で比べ、文書の対処順序 ③
  でもある B を採った。3 ティアとも 6×6 で、差は技法の集合だけ。比較対象も 6×6。
- **Box Regions** は文書どおり(Hard 最悪 50ms、派生 seed 最悪 21、fallback 0)。手がかりの数字は
  箱を描く前は数字だけ、描いてからは `現在/目標`。生成の敷き詰めは「孤立した空マスが残りの
  1×1 枠を超えたら戻る」という単純な形で §8 の「覆えない欠片」を実装した。

Crown Grid には「斜めに 2 マス離れた王冠は合法(クイーンの長距離攻撃は無い)」の engine テストを
足した。Number Path の既存テストは壁・番号順・再訪・K の先・全マス被覆を既に拒否している。

Phase 3(翻訳)は 3 本 × 12 言語を機械翻訳で埋めた(未承認 — [I18N_POLICY.md](../I18N_POLICY.md))。
高リスクキーは作っていない。翻訳者が確信の低かった語: Box Regions の形の種類名(縦長 / 横長)
と「clue / hint」の使い分け(fr は shape-regions の "Indices" と違い "indice / aide")、
Binary Balance の Hint 文の `{mark}` / `{other}` の格・助詞(de / ko / hi / th / tr)、
Sudoku 6×6 の `{current}` / `{next}` を含む確認文。読める人が直す。

## 計測の読み方(公開後)

[PUZZLE_PRACTICE_SET.md](../PUZZLE_PRACTICE_SET.md) §5 のとおり。専用ページの `page_view`、
5 本の `game_open` / `game_close`、UTM での投稿流入の区別。測れないこと(タブ終了の
`game_close` 欠測・少数サンプル)を数字の解釈に書く。

## LinkedIn 投稿案(公開後に手動で使う。自動投稿はしない)

前提: 5 本すべてが Web で遊べ、専用ページが配信されてから。Web ベータであることと
非提携を明示し、公式の当日問題のネタバレ・難易度や記録の同等性・上達の保証は書かない。
「LinkedIn は 1 日 1 回しかできない」とは断定しない。URL には `?utm_source=linkedin&utm_medium=social&utm_campaign=practice-set`
を付ける(計測の範囲は変えない)。

### 日本語

> 今日のパズルを解き終わったあと、「もう少し遊びたい」と思うことがあって、自分で作りました。
>
> Simple Games の Web 版に、Queens / Zip / Tango / Mini Sudoku / Patches と同じ種類の
> 考え方で遊べる 5 種類のパズルを揃えました。問題はすべて端末上で生成する独自のもので、
> 難易度を選べば何問でも。インストールも登録も要りません。
>
> Web 先行公開(ベータ)中で、保存データは更新で消えることがあります。LinkedIn とは
> 関係のない、PixApps の個人プロジェクトです。
>
> https://pixapps.ai/simple-games/practice/?utm_source=linkedin&utm_medium=social&utm_campaign=practice-set

### English

> After finishing today's puzzle I often wanted one more, so I built a place for that.
>
> Simple Games now has five puzzles on the web that use the same kind of thinking as
> Queens, Zip, Tango, Mini Sudoku and Patches. Every board is generated on your device,
> you pick the difficulty, and there is no limit — no install, no account.
>
> They are in early release on the web (saved progress may be reset by an update).
> Simple Games is an independent project by PixApps, not affiliated with or endorsed by LinkedIn.
>
> https://pixapps.ai/simple-games/practice/?utm_source=linkedin&utm_medium=social&utm_campaign=practice-set

## 正式収録の残作業(別マイルストーン)

- RELEASE_CHECKLIST.md §0 の条件(直近 2 週間の安定稼働・計測・永続化ラウンドトリップ
  テスト)。壊す変更があれば数え直す。
- 未実施の実機検証: 低スペック端末での生成時間(各ルール文書の「低スペック実機での実測は
  まだ行っていない」)、Box Regions 7×7 / Binary Balance 8×8 の 320px でのタッチ精度、
  アセット読み込み後のオフラインでの生成・再挑戦(Web)。
- 12 言語の翻訳の自然さ(機械翻訳のまま。高リスクキーは無い)。
