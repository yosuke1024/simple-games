# Simple Games — アーキテクチャ

## モノレポ

```text
simple-games/
├── apps/
│   └── simple-games/      # 単一アプリ。複数ゲームを収録するゲーム集
├── packages/
│   ├── brand/             # ブランド定数のみ(Pure TS、フレームワーク非依存)
│   ├── eslint-config/     # 共有 ESLint flat config
│   └── typescript-config/ # 共有 tsconfig
├── docs/
└── .github/workflows/
```

- パッケージマネージャ: pnpm workspaces。タスクランナー: Turborepo。
- 依存方向は **apps → packages** のみ。packages から apps への依存、
  共通パッケージ同士の循環依存は禁止。
- PixApps モノレポへの実行時依存はない。このリポジトリ単独で
  clone / install / test / build できる。
- 出荷するアプリは 1 つ(appId `com.pixapps.simplegames` / appName
  `Simple Games: Offline Games`)。収録ゲームはワークスペースパッケージではなく
  **フォルダで分割**する。共通のゲームフレームワークは意図的に作らない。
- 収録ゲームの追加・更新はアプリのリリースとして一体で行う。ただしゲームの追加が
  既存ゲームの挙動・保存データを変えてはならない。共通パッケージの変更で
  アプリを自動リリースしない。

## アプリ内レイヤー(apps/simple-games)

```text
src/
├── app/                    # シェル: ルート App、ルーティング、ゲームレジストリ
├── games/                  # 各ゲームは game/ state/ storage/ ui/ で自己完結
│   ├── sudoku/
│   ├── solitaire/
│   ├── spider-solitaire/
│   ├── freecell/
│   ├── minesweeper/
│   ├── nonogram/
│   ├── number-match/
│   ├── quick-math/
│   ├── schulte-table/
│   ├── number-recall/
│   ├── water-sort/
│   ├── sliding-puzzle/
│   ├── memory-match/
│   ├── brick-breaker/
│   ├── sky-fighter/
│   ├── 2048/
│   ├── block-puzzle/
│   ├── checkers/
│   ├── reversi/
│   ├── connect-four/
│   ├── gomoku/
│   └── bunny-hop/
├── monetization/           # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
├── services/               # 共有: ads(バナーのみ) / network / sound / haptics
├── state/                  # 共有: SettingsContext
├── storage/                # 共有: kv / repo / SchemaDef 基盤 / 共有スキーマ
├── i18n/                   # 共有: 言語解決 + シェル所有キーの同梱カタログ + ゲームカタログの登録簿
└── ui/                     # 共有: コレクションホーム、設定 / About、共通コンポーネント
```

この配置への再編と収録ゲームの計画は
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) を参照。
各ゲームのルールは [SUDOKU_RULES.md](SUDOKU_RULES.md) /
[SOLITAIRE_RULES.md](SOLITAIRE_RULES.md) /
[SPIDER_SOLITAIRE_RULES.md](SPIDER_SOLITAIRE_RULES.md) /
[FREECELL_RULES.md](FREECELL_RULES.md) /
[MINESWEEPER_RULES.md](MINESWEEPER_RULES.md) /
[NONOGRAM_RULES.md](NONOGRAM_RULES.md) /
[NUMBER_MATCH_RULES.md](NUMBER_MATCH_RULES.md) /
[QUICK_MATH_RULES.md](QUICK_MATH_RULES.md) /
[SCHULTE_TABLE_RULES.md](SCHULTE_TABLE_RULES.md) /
[NUMBER_RECALL_RULES.md](NUMBER_RECALL_RULES.md) /
[WATER_SORT_RULES.md](WATER_SORT_RULES.md) /
[SLIDING_PUZZLE_RULES.md](SLIDING_PUZZLE_RULES.md) /
[MEMORY_MATCH_RULES.md](MEMORY_MATCH_RULES.md) /
[BRICK_BREAKER_RULES.md](BRICK_BREAKER_RULES.md) /
[SKY_FIGHTER_RULES.md](SKY_FIGHTER_RULES.md) /
[GAME_2048_RULES.md](GAME_2048_RULES.md) /
[BLOCK_PUZZLE_RULES.md](BLOCK_PUZZLE_RULES.md) /
[REVERSI_RULES.md](REVERSI_RULES.md) /
[CONNECT_FOUR_RULES.md](CONNECT_FOUR_RULES.md) /
[BUNNY_HOP_RULES.md](BUNNY_HOP_RULES.md) を唯一のソースとする。

レイヤー規則:

- `games/*/game/` は Pure TypeScript。他のどのレイヤーも import しない
  (テスト容易性と移植性のため)。
- `games/A/` から `games/B/` への import は禁止。ゲーム同士は互いを知らない。
- シェルはゲームの内部実装に触らない(ゲームは自身のルートコンポーネントだけを公開する)。
  ゲームレジストリ(`app/registry.ts`)は薄い契約のみ(下記)。
- これらの境界は文書だけの約束ではない: `src/test/importBoundaries.test.ts` が
  実際の import グラフを走査して機械的に禁止する(ESLint の
  no-restricted-imports はエディタ即時フィードバック用の写し)。
- ゲームのライフサイクル(アンマウント時のリソース解放契約)は
  [GAME_LIFECYCLE.md](GAME_LIFECYCLE.md) を正本とする。
- `services/` の失敗はゲーム進行に影響させない(OFFLINE_POLICY.md 参照)。
- ゲーム説明は二層化する: アプリ内はチュートリアル = Quick Rules(最大3ステップ)
  のみ。詳細ルール・FAQ・攻略はゲーム別 Landing Page
  (`LANDING_BASE_URL`(`packages/brand`)+ `/games/<game-id>/<locale>/`)へ分離する。
  チュートリアルの「Learn More / 詳しく見る」がそこへ遷移し、オフライン時は
  静かに何もしない(ゲームを止めない)。Landing Page 本体は別リポジトリで公開済み。
  書かれている言語は `ui/landing.ts` の `PAGE_LOCALES` のみ(それ以外は英語へ
  フォールバック)。存在しない言語を足すと 404 へ誘導することになる。
- ゲームのホーム画面は共有の `WebChromeSlot` を置いてよい(`ResultAdSlot` と同じ
  向き: ゲーム → `ui/components/`)。シェルは「ゲームの内部のどこがホームか」を
  知らないままでいられる — 知ろうとすると registry がゲーム内部のビューを
  列挙することになる([WEB_VERSION.md](WEB_VERSION.md)「サイトクローム」)。
- Analytics / Remote Config / トラッキングのサービスは**アプリに存在しない**
  (初期リリースで削除済み。公開コードに追跡コードが無いことが透明性の証明)。
  Web 版のページ解析は方針決定のみで未実装([WEB_VERSION.md](WEB_VERSION.md)
  「計測」)。導入時も `--mode web` 限定で、native 成果物には含めない。

## ゲームレジストリの契約

`app/registry.ts` のエントリは「タイトルカード + そのゲームが持つキー + ゲーム本体の
ローダー」だけで、プラグイン機構ではない。ゲームの追加は keys の import 1 行と
配列要素 1 つで済む。

| フィールド             | 内容                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                   | 収録タイトルの識別子(`GameId` の union が正本。`'sudoku'` / `'solitaire'` / `'spider-solitaire'` / `'freecell'` / …)。`data-game` 属性にもこの値を使う |
| `title`                | 固有名詞。全言語で同一表記(翻訳しない)                                                                                                                 |
| `glyph`                | シリーズマーク。そのタイトルのアクセント色のタイルに 1 文字                                                                                            |
| `storageKeys`          | そのゲームが保存する全キー。各ゲームの **import ゼロの葉** `storage/keys.ts` から同期 import する                                                      |
| `loadRoot`             | ゲームのルートコンポーネントを動的 `import()` で返すローダー。Root が受け取る props は `onExit` だけ                                                   |
| `loadSettingsSection?` | 任意。共有設定画面に差し込むゲーム固有の設定のローダー                                                                                                 |

### ゲーム単位の lazy チャンク(issue #26)

ホームの起動コストを収録数から切り離すため、ゲーム本体は静的 import しない。

- `src/games/<id>/` 配下は Rolldown の `codeSplitting` でチャンク `game-<id>` に
  まとまる(`vite.config.ts`)。例外は `storage/keys.ts` だけ — レジストリが
  同期参照する import ゼロの葉で、ここに import を足すとゲーム全体がホームの
  初期チャンクへ引き戻される(`src/test/importBoundaries.test.ts` が禁止)。
- 全チャンクはアプリ / Web 配布物に同梱。**ゲームを開くのはディスクからの読み込み
  であり、ネットワークからのダウンロードは存在しない**(docs/OFFLINE_POLICY.md)。
- シェル側は `app/lazyRoots.ts`(id ごとに 1 つの `React.lazy`)+ Suspense +
  `GameErrorBoundary` で開く。ローディング表示は 200ms 遅延(ローカルチャンクの
  ロードは通常見えない)。ロード中のハードウェアバックは `GameLoadingFallback` が
  所有し、コレクションへ戻す。失敗画面の確実な出口は「すべてのゲーム」で、
  リトライはベストエフォート(React も Chromium も失敗したロードをキャッシュする
  ため、lazy ラッパーを作り直して再マウントする)。
- エントリからゲームチャンクへ静的に到達したら CI が落ちる
  (`scripts/bundle-size.mjs` が `.vite/manifest.json` を辿る)。サイズの実測・
  ゲーム別予算(gzip 500KB)・ベースライン差分も同じスクリプト
  (`pnpm size:check` / `pnpm size:update`、基準値は `size-baseline.json`)。
- ゲーム固有の i18n カタログも同じチャンクに同梱する(issue #38)。詳細は
  下記「i18n」節。

- `storageKeys` をレジストリに載せるのは、シェルが各ゲームの保存内部を知らないまま
  「ローカルデータ削除」を正直に実行できるようにするため。ゲームのチャンクを
  ロードせずに列挙できるよう、キーは `storage/keys.ts` の葉に置く。released 済み
  キーの一覧は `src/app/gameKeys.test.ts` がゴールデンとして固定する
  (**テストを直して通すのは禁止** — それはプレイヤーのデータに対する削除行為)。
- `SettingsSection` は任意。**ゲーム固有の設定はゲームが所有し、シェルは場所だけ貸す。**
  これがないと、ゲームの設定が増えるたびにシェル側へ
  `if (gameId === 'sudoku')` のような分岐が入り、シェルがゲーム内部を知ることになる。
  Sudoku はこの口で「ミスの即時表示」トグル(`sd.prefs`)を出している。
  設定画面はコレクションホームからのみ到達するため、ゲームが起動中にこの節が
  描画されることはない(レコードの読み書きが競合しない)。
  現在この口を使っているのは Sudoku だけで、Minesweeper の「旗モード」(`ms.prefs`)は
  プレイ中に切り替えるものなので盤面側に置いている。
- ゲームは同時に 1 つだけマウントし、離れたらアンマウントする(電池)。
- 各ゲームは `category` で自分のカテゴリを 1 つ名乗り、ホームはカテゴリ別の
  セクションで並べる(`GAME_CATEGORIES`。後述の「コレクションホーム」)。
  配列の順序は**カテゴリ内の並び順**(検索需要の大きい順)。ただし
  **この順序が「よく遊ぶ順」を兼ねる必要はない** — 後述の「最近遊んだ」がその役を
  持つので、レジストリの順序は「名前で探す時に見つかる場所」であり続ければよい。

## コレクションホーム

収録数が増えても使えることを設計条件にする(`ui/screens/CollectionHomeScreen.tsx`)。

- **全ゲームは 2 列グリッド**(`.game-grid`)。1 行 1 ゲームの縦リストは 10 本で
  1 画面を超え、16 本なら 2 画面を超えて、末尾のタイトルが常にスクロールの先になる。
  グリッドが成立するのはタイトルが**全言語で同一の固有名詞**だからで、翻訳文を
  並べていたらこの形は 14 言語で保てない。
- **グリッドはカテゴリ別のセクションに分ける**(`registry.ts` の `GAME_CATEGORIES`、
  現在はロジック / カード / パズル / ボードゲーム / アーケード / ドリルの 6 つ)。
  22 本を 1 枚のグリッドに敷くと結局全タイトルを読んで探すことになるため、
  見出しでセクションごと読み飛ばせるようにした。ゲームはレジストリで `category` を
  1 つ名乗り、セクション内の並びはレジストリの配列順。カテゴリ見出しは固有名詞では
  ないので、シェルカタログの `category*` キーで 14 言語に翻訳する(タイトルと違い
  普通名詞は訳す)。ドリル節を通称の「脳トレ」と**呼ばない**のは規則である —
  ジャンル名の形をした効能主張になるため、全言語で「ドリル / 練習」系の語を使う
  (SCHULTE_TABLE_RULES.md §14-2。英日は `check-principles.sh` §7 が強制する)。
  ランドマークはリスト全体で 1 つの `nav`(6 個の nav で
  ランドマーク一覧を埋めない)。見出し(`h2`)がセクション飛ばしを担う。
  「全ゲームがちょうど 1 回ずつ現れる」ことは `CollectionHomeScreen.test.tsx` が
  固定する — `GAME_CATEGORIES` に無いカテゴリを名乗ったゲームは黙って消えるため。
- **説明文はホームに置かない。** 「どんなゲームか」はゲーム内の Quick Rules と
  Landing Page が担う(上記の二層化)。以前あったレジストリの `blurbKey` と
  8 本ぶんの `*Blurb` キーはこの変更で削除した。ストア掲載文も同じ方針
  (`store/listing.md`「収録ゲームは名前だけを並べる」)。
- **タイルはタイトルごとのアクセント色**を着る。名前を読まなくても色と位置で
  見つけられることを、BRAND.md の「グリフ + そのタイトルのアクセント色が識別を
  担う」に合わせるための実装。
- **「最近遊んだ」**(`app/recentGames.ts` / `sg.recent`)を上に置く。よく遊ぶ
  ゲームが収録数によらずスクロール 0 に留まるので、下のグリッドの並び順を
  「人気順」に保守し続ける必要がなくなる。
  - シェルがゲームをマウントした時に記録する。**ゲーム側は関与しない**
    (ゲームは自分が記録されていることを知らない)。
  - 上限 2 件。初回起動時や「ローカルデータ削除」直後は**節ごと出さない**
    (空状態の演出をしない)。
  - 時刻・進捗・「続きから」を持たない。**近道であって、状態表示ではない**
    (PRODUCT_PRINCIPLES.md「ユーザーを急かさない」。連続日数の類は持たない)。
  - レジストリに無い id は表示前に落とす。将来ゲームを取り下げても、開けない行が
    残らない。

## タイトルごとのアクセント色

- アクセントは `packages/brand` の `titleAccents` に 1 タイトル 1 エントリ。

| ゲーム           | アクセント               | ライト    | ダーク    |
| ---------------- | ------------------------ | --------- | --------- |
| Number Match     | 藍                       | `#3f5b8f` | `#7d9ccf` |
| Sudoku           | くすんだティール         | `#2f6f62` | `#6fb3a3` |
| Solitaire        | くすんだフェルトグリーン | `#557a48` | `#97bd8a` |
| Spider Solitaire | 深い緑                   | `#31802f` | `#7fcc7d` |
| FreeCell         | 深い藍                   | `#25256a` | `#6e6ecf` |
| Hearts           | スチールブルー           | `#2763c4` | `#96bde4` |
| Gin Rummy        | 深い菫                   | `#772b97` | `#b35dd5` |
| Minesweeper      | スレートブルー           | `#4a5a72` | `#93a4bd` |
| Nonogram         | くすんだプラム           | `#6d5192` | `#a893cf` |
| Water Sort       | くすんだアクア           | `#33708c` | `#7fb4c9` |
| Sliding Puzzle   | 温かみのある陶土色       | `#9c5b3c` | `#d1926f` |
| Memory Match     | くすんだローズ           | `#9e5468` | `#cf8fa4` |
| Brick Breaker    | 黄土                     | `#8a6a2b` | `#c9a765` |
| Sky Fighter      | 夕闇の青                 | `#5d5aa8` | `#9d9be0` |
| 2048             | ジェイド                 | `#2b7d59` | `#79c39c` |
| Block Puzzle     | オーキッド               | `#8b4f80` | `#c795bd` |
| Bunny Hop        | 草原の緑                 | `#6e7a34` | `#b6c274` |
| Reversi          | 菫                       | `#7f4a9c` | `#c48ad6` |
| Connect Four     | くすんだ赤               | `#a8433d` | `#dd8f89` |
| Quick Math       | マスタード               | `#776e18` | `#c4ba6b` |
| Schulte Table    | ペトロール               | `#18787b` | `#6cbcc1` |
| Number Recall    | 深いエメラルド           | `#1d6b33` | `#92dfa8` |
| Checkers         | ウォルナット             | `#5a4632` | `#cbb08a` |
| Gomoku           | 牡丹                     | `#a32d76` | `#e086bb` |

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

## CSS の分割

- **ゲームの CSS はそのゲームが持つ。** `games/<id>/ui/<id>.css` を同じフォルダの
  Root コンポーネントが import する(Vite が束ねるので、追加の設定はいらない)。
  ゲームを増やしても共有スタイルシートが伸びない。
- `ui/styles.css` に置くのは共有シェルのみ: デザイントークン(下地・アクセント・
  `data-game` の上書き)、コレクションホーム、設定 / About、ダイアログ・トースト・
  チュートリアル・バナースロットなどの共通クロム。
- **全タイトルが規約に従っている**: `number-match.css` / `sudoku.css` /
  `minesweeper.css` / `nonogram.css` / `sliding-puzzle.css` / `memory-match.css` /
  `water-sort.css` / `solitaire.css` / `spider-solitaire.css` / `freecell.css` /
  `gin-rummy.css` /
  `brick-breaker.css` / `sky-fighter.css` /
  `game-2048.css` / `block-puzzle.css` / `checkers.css` / `reversi.css` /
  `connect-four.css` / `gomoku.css` / `quick-math.css` / `schulte-table.css` /
  `number-recall.css` / `bunny-hop.css`。
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

## 広告と課金

- 広告は `services/ads/` のバナーのみ(Anchored Adaptive Banner)。
  AdMob 初期化は起動後の fire-and-forget。UMP 同意はゲーム初期化と切り離す。
  オフライン時・購入済み時はリクエストしない。仕様は ADS_POLICY.md。
- `ui/` の `BannerSlot` は高さ確保方式(盤面のレイアウトシフトなし)。
  広告削除購入済みならスロットごと消す。
- `monetization/` は広告削除 IAP の基盤: `AdRemovalStore` 契約
  (`isAvailable` / `getPrice` / `purchase` / `restore`)と実装差し替え点。
  既定実装は「ストア未接続」(購入 UI は非表示、購入済みキャッシュだけ尊重)。
  ストア接続は Play Console での商品作成など人間作業を要する(計画書 §5)。

## ストレージキーの規約

| キー          | 内容                                                              |
| ------------- | ----------------------------------------------------------------- |
| `sg.settings` | 共有設定(言語 / テーマ / 音 / 振動 / Reduced Motion)              |
| `sg.iap`      | 広告削除購入状態のローカルキャッシュ                              |
| `sg.review`   | ストアレビュー導線の状態(完了数 / 表示回数 / 解決済みフラグ)      |
| `sg.recent`   | 「最近遊んだ」のゲーム id(新しい順・最大 2 件)                    |
| `sd.*`        | Sudoku(saveGame / saveDaily / stats / progress / flags / prefs)   |
| `so.*`        | Solitaire(saveGame / saveDaily / stats / flags / prefs)           |
| `ms.*`        | Minesweeper(saveGame / saveDaily / stats / flags / prefs)         |
| `ng.*`        | Nonogram(saveGame / saveDaily / stats / progress / flags / prefs) |
| `nm.*`        | Number Match(saveGame / saveDaily / stats / progress / flags)     |
| `ws.*`        | Water Sort(saveGame / saveDaily / stats / progress / flags)       |
| `sp.*`        | Sliding Puzzle(saveGame / saveDaily / stats / progress / flags)   |
| `mm.*`        | Memory Match(saveGame / saveDaily / stats / flags)                |
| `bb.*`        | Brick Breaker(stats / progress / flags。**saveGame なし** — 下記) |
| `sf.*`        | Sky Fighter(stats / progress / flags。**saveGame なし** — 下記)   |
| `tm.*`        | 2048(saveGame / stats / flags。デイリーもレベル進行もない)        |
| `bp.*`        | Block Puzzle(saveGame / stats / flags。同上)                      |
| `ck.*`        | Checkers(saveGame / stats / flags / prefs。統計は難易度別)        |
| `rv.*`        | Reversi(saveGame / stats / flags / prefs。統計は難易度別)         |
| `c4.*`        | Connect Four(saveGame / stats / flags / prefs。同上)              |
| `gm.*`        | Gomoku(saveGame / stats / flags / prefs。同上)                    |
| `ss.*`        | Spider Solitaire(saveGame / saveDaily / stats / flags / prefs)    |
| `fc.*`        | FreeCell(saveGame / saveDaily / stats / flags。**prefs なし**)    |
| `bh.*`        | Bunny Hop(stats / flags。**saveGame なし** — 下記)                |

Sudoku の 6 キー: `sd.saveGame`(中断したレベル)/ `sd.saveDaily`(中断したデイリー。
2 スロット独立)/ `sd.stats`(難易度別)/ `sd.progress`(解放レベルとベストタイム)/
`sd.flags`(チュートリアル完了)/ `sd.prefs`(ゲーム固有設定)。
Minesweeper はレベル進行を持たないため `progress` がなく、代わりに旗モードの
`ms.prefs` を持つ。Nonogram は ×モードの `ng.prefs` を持つ。Solitaire は
Draw 1/3 の `so.prefs` を持ち、Memory Match はレベル進行も個別設定も持たない
(デイリーの記録は両者とも stats 内)。デイリーを持つパズルはいずれも中断が
「通常モード用」と「デイリー用」の 2 スロットで独立する。2048 と Block Puzzle は
デイリーもレベル進行も持たないエンドレスなので、中断スロットは 1 つだけで
`progress` もない(自己ベストは stats 内 — `GAME_2048_RULES.md` §9 /
`BLOCK_PUZZLE_RULES.md` §9)。

[REVERSI_RULES.md](REVERSI_RULES.md) /
[CONNECT_FOUR_RULES.md](CONNECT_FOUR_RULES.md) /
[BUNNY_HOP_RULES.md](BUNNY_HOP_RULES.md) を唯一のソースとする。

- 共有レコードは `sg.` 接頭辞。ゲーム固有レコードはゲームごとの接頭辞。
- ゲーム固有設定は共有 `sg.settings` に混ぜず、そのゲームの接頭辞に置く
  (`sd.prefs`)。シェルの設定レコードがゲーム追加ごとに膨らまない。
- `sg.adState` / `sg.rcCache` は廃止(インタースティシャル頻度制御と
  Remote Config キャッシュは存在しない)。
- `kv` / `repo` / `SchemaDef` と schemaVersion 運用は全ゲームで共有する。
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

## i18n

- カタログは全言語をアプリに同梱する(オフライン要件。ネットワークから
  取りに行かない)。**キーの置き場所はキーの所有者で分かれる**(issue #38):
  複数レイヤーやシェルだけが使うキーは `src/i18n/locales/*.ts` に残ってエントリへ
  乗り、1 本のゲームだけが使うキーはそのゲームの `src/games/<id>/i18n/*.ts` に
  移してゲームのチャンクへ同梱する。ゲームを開かないプレイヤーは、その文言を
  一度もパースしない。
- 現在 14 言語。シェル 79 キー(エントリに乗る) + ゲーム別 17 カタログ(合計 460
  キー、13〜42 キー/ゲーム、開いたときだけパースされる)。ロケールタグは小文字で
  持つ。en と ja 以外は来歴 `machine`(AI の助けを借りて書き、その言語のネイティブ
  は読んでいない)。高リスクキーはリリース前の門で逆翻訳を作者が読む
  (`docs/I18N_POLICY.md`)。
- **ゲーム側の解決は型とランタイムの二重の仕組み。** ゲームの `i18n/index.ts` が
  `declare module '@/i18n/registry'` で `GameMessages` インターフェースへ自分の
  キーをマージし(`MessageKey` 型はシェル + 全ゲームの union になる。シェルは
  `src/games/` を一切 import しないので型消去後もレイヤー境界は破れない)、
  同じファイルが `registerGameMessages(id, catalogs)` をモジュールスコープで呼ぶ。
  チャンクの各エントリポイント(`ui/<Game>Root.tsx` 等、レジストリの `loadRoot` /
  `loadSettingsSection` が指す先)は先頭で `import '../i18n'` するだけ — モジュール
  評価は React がコンポーネントを描画するより先に終わるので、画面が最初に
  `t()` を呼ぶ時点でそのゲームの 14 言語は登録済み。この配線は
  `src/test/gameI18nWiring.test.ts` が静的に強制する(すり抜けると本番で
  キー名がそのまま画面に出る)。
- `translate(locale, key)` の解決順は「シェルのそのロケール → シェルの英語 →
  ロード済みゲームのカタログ(`src/i18n/registry.ts`)→ キー自身」。キー集合は
  シェルと全ゲームで互いに素なので(`i18n.test.ts` が保証)、最後の到達順は結果に
  影響しない。ゲームのチャンクがまだロードされていないキーを尋ねる、という
  分割前には存在しなかったバグだけが最終フォールバックに落ち、クラッシュではなく
  そのキー名がそのまま出る(grep で追える形にする設計)。
- 言語切替はゲームを開いた状態でも即座に反映される。切替を判断する
  `resolveLocale` はシェルの同期処理で、開いているゲームは既に 14 言語ぶんの
  カタログをチャンクごと保持しているため、ロードは発生しない
  (docs/OFFLINE_POLICY.md)。
- Sudoku の難易度表記 (`sudokuTier_*`) や Minesweeper / Memory Match の難易度
  (`*Difficulty_*`) のように `t(\`prefix\_${variable}\`)` で動的に組み立てる
キーは、静的解析では「未使用」に見える。`i18n.test.ts` がロケールごとに
  実際の解決を確認して、削除で無言に壊れるのを防ぐ。
- 解決順(ロケール自体の決定): アプリ内の明示選択 → 端末の優先言語リストを
  順に走査(Android のアプリ別言語設定はここに現れる)→ 英語。初回起動時の
  言語選択画面はない。
- 地域バリアントは `matchLocale` で親言語へフォールバックする(en-IN → en、
  レガシー `in` → id)。書記体系で割れる言語だけは専用テーブルで先に解決する:
  zh-TW / zh-HK / zh-Hant → zh-hant、zh / zh-CN / zh-SG → zh-hans、
  pt / pt-PT → pt-br。ここで親言語へ落とすと繁体字の読者に簡体字を渡してしまう。
- 空文字・プレースホルダー不一致・制御文字/マークアップ混入はテストで検出する
  (シェルとゲームカタログの両方、`import.meta.glob` で横断)。方針と対応言語計画は
  [I18N_POLICY.md](I18N_POLICY.md)。

## 電池(低消費電力)

- プレイ中の定期ポーリングなし。バックグラウンド処理なし。常時接続なし。
- オフライン時は広告取得をリトライしない。
- 画面外のゲームはアンマウントする(描画しない)。**アンマウントされたゲームは
  タイマー・RAF・リスナー・音声を一切残さない** — 契約とテストは
  [GAME_LIFECYCLE.md](GAME_LIFECYCLE.md)。
- 保存はイベント駆動(可視性変化 / pause / 状態遷移時)。
- プレイ時計は ref 加算のみで、再レンダリングを起こさない。

## Web / Android

- Vite で静的 Web アプリとしてビルドし、Capacitor で Android アプリ化する。
  SSR / API Routes は不要のため Next.js は使用しない。
- `apps/simple-games/android/` は Capacitor が生成したネイティブプロジェクトをコミットする
  (ビルド成果物・local.properties は除外)。
- ハードウェア戻るボタン: ゲーム内ホーム→コレクションへ、コレクション→アプリ最小化。
  `AndroidManifest.xml` の `android:enableOnBackInvokedCallback="false"` は削除しない
  ——targetSdk 36(Android 16)から予測型戻る(predictive back)が既定で有効になり、
  `@capacitor/app` の `backButton` イベントが一切発火しなくなる実機バグを回避している
  (キーイベントもジェスチャーも同様に無反応になる。@capacitor/app 8.4.2 で確認、
  Capacitor 側にも既知の相互作用: ionic-team/capacitor-plugins#2418)。全ゲームの
  ナビゲーションがこのイベントに依存しているため、外すとハードウェア戻るが
  アプリ全体で無反応になる。予測型戻るのプレビューアニメーションと引き換えの選択。

## 静的 Web 版

**`https://pixapps.ai/simple-games/play/` で実装・公開済み。** この節はもともと
「将来の静的 Web 版」という見出しで、実装前に「現時点では実装しない」と書かれていた
名残である。実装済みの詳細・広告・計測・保存の版差分は
[WEB_VERSION.md](WEB_VERSION.md) を正本とする。ここには変わらないレイヤー上の
前提だけを残す。

- `games/*/game/` は Pure TypeScript で、フォルダ外への import を ESLint
  (no-restricted-imports)で機械的に禁止している。React / DOM / Capacitor /
  課金 / 広告 / ストレージへの依存ゼロ。これが Web 版を静的構成のまま出せる根拠であり、
  Web 版のためにこのレイヤーへ何かを足す必要はない。
- 保存は `KVStore` 契約(`src/storage/kv.ts`)の背後にあり、Web 版は
  Capacitor Preferences の web 実装(`localStorage`)を差すだけで動く。
- ホスティングは Cloudflare Pages(`pixapps-landing` リポジトリへの生成物コミット)。
  GitHub Pages でも配信できる**純静的構成**を維持する。Functions / Workers / D1 / KV /
  Durable Objects / R2 / 独自 API / 認証 / クラウドセーブ / サーバー側生成は使わない。
  ロジック・生成・デイリー・保存・言語・テーマはブラウザ内で完結する。
- **未実装(今後)**: 再訪時のオフライン動作(PWA / Service Worker、M3)。導入までは
  Web 版は初回アクセスにダウンロードが必要で、ネイティブ版の「初回起動から
  オフライン」とは異なる([WEB_VERSION.md](WEB_VERSION.md)「オフラインの扱い」)。

## 将来の共通化

設定 / ストレージ基盤 / 広告 / i18n はアプリ内のシェルとして共有しており、
これ以上の共通化(`packages/` への抽出)は実際に重複が確認されてから行う。
ゲーム固有の概念(盤面・ルール・Hint 等)は共通パッケージへ入れない。

現時点で唯一の実測された重複は `games/*/game/rng.ts` で、**20 ゲームすべてが同じ
seed 付き乱数を持っている**(`games/A/` から `games/B/` を import できない以上、
このコピーは規約どおりでもある)。抽出を検討する条件(重複が確認された)は
満たしているが、`game/` の Pure TS 純度を保ったまま `packages/` へ出せるかが論点で、
**結論は出ていない**。未決事項として
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) §6 に
記録してある。

## CI / リリース

- `ci.yml`: push / PR で install → lint → typecheck → test → build(全ワークスペース)。
  対象が増えたら turbo の `--filter` で影響範囲のみに絞る。両ビルドの後に
  広告分離(`check-dist-ads-separation.sh`)とサイズ Gate
  (`pnpm --filter simple-games size:check` — ゲーム別予算・エントリ成長・
  初期グラフへのゲームチャンク混入)を検証する。
- `android-release.yml`: 手動実行(workflow_dispatch)または `v*` タグでのみ実行し、
  署名済み AAB(Play 用)と署名済み APK(実機確認用)をアーティファクトとして出す。
  `versionName` / `versionCode` はタグが決める。ストアへのアップロードは手動。
  タグに製品名を付けないのは、リリース対象がこのアプリ 1 つだけだから
  (20 ゲームは 1 アプリ。`packages/` はリリース対象ではない)。
- Secrets は `ADMOB_ANDROID_APP_ID` / `ADMOB_ANDROID_BANNER_ID` のみ
  (インタースティシャル系は無い。プラットフォーム名を含むのは AdMob ID が
  OS ごとに別なため — iOS 版では `ADMOB_IOS_*` が並ぶ)。
  本番 ID・署名鍵はリポジトリにコミットしない。
