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
  `Simple Games: Offline Puzzles`)。収録ゲームはワークスペースパッケージではなく
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
│   ├── minesweeper/
│   ├── nonogram/
│   ├── number-match/
│   ├── water-sort/
│   ├── sliding-puzzle/
│   └── memory-match/
├── monetization/           # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
├── services/               # 共有: ads(バナーのみ) / network / sound / haptics
├── state/                  # 共有: SettingsContext
├── storage/                # 共有: kv / repo / SchemaDef 基盤 / 共有スキーマ
├── i18n/                   # 共有: 言語解決 + 言語ごとの同梱カタログ
└── ui/                     # 共有: コレクションホーム、設定 / About、共通コンポーネント
```

この配置への再編と収録ゲームの計画は
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) を参照。
各ゲームのルールは [SUDOKU_RULES.md](SUDOKU_RULES.md) /
[SOLITAIRE_RULES.md](SOLITAIRE_RULES.md) /
[MINESWEEPER_RULES.md](MINESWEEPER_RULES.md) /
[NONOGRAM_RULES.md](NONOGRAM_RULES.md) /
[NUMBER_MATCH_RULES.md](NUMBER_MATCH_RULES.md) /
[WATER_SORT_RULES.md](WATER_SORT_RULES.md) /
[SLIDING_PUZZLE_RULES.md](SLIDING_PUZZLE_RULES.md) /
[MEMORY_MATCH_RULES.md](MEMORY_MATCH_RULES.md) を唯一のソースとする。

レイヤー規則:

- `games/*/game/` は Pure TypeScript。他のどのレイヤーも import しない
  (テスト容易性と移植性のため)。
- `games/A/` から `games/B/` への import は禁止。ゲーム同士は互いを知らない。
- シェルはゲームの内部実装に触らない(ゲームは自身のルートコンポーネントだけを公開する)。
  ゲームレジストリ(`app/registry.ts`)は薄い契約のみ(下記)。
- `services/` の失敗はゲーム進行に影響させない(OFFLINE_POLICY.md 参照)。
- ゲーム説明は二層化する: アプリ内はチュートリアル = Quick Rules(最大3ステップ)
  のみ。詳細ルール・FAQ・攻略はゲーム別 Landing Page
  (`LANDING_BASE_URL`(`packages/brand`)+ `/games/<game-id>/<locale>/`)へ分離する。
  チュートリアルの「Learn More / 詳しく見る」がそこへ遷移し、オフライン時は
  静かに何もしない(ゲームを止めない)。Landing Page 本体は別リポジトリで公開済み。
  書かれている言語は `ui/landing.ts` の `PAGE_LOCALES` のみ(それ以外は英語へ
  フォールバック)。存在しない言語を足すと 404 へ誘導することになる。
- Analytics / Remote Config / トラッキングのサービスは**存在しない**
  (初期リリースで削除済み。公開コードに追跡コードが無いことが透明性の証明)。

## ゲームレジストリの契約

`app/registry.ts` のエントリは「タイトルカード + マウント点 + そのゲームが持つキー」
だけで、プラグイン機構ではない。ゲームの追加は import 1 行と配列要素 1 つで済む。

| フィールド | 内容 |
| --- | --- |
| `id` | `'sudoku'` / `'solitaire'` / `'minesweeper'` / `'nonogram'` / `'number-match'` / `'water-sort'` / `'sliding-puzzle'` / `'memory-match'`。`data-game` 属性にもこの値を使う |
| `title` | 固有名詞。全言語で同一表記(翻訳しない) |
| `blurbKey` | コレクションカードの 1 行説明(ローカライズ対象) |
| `glyph` | シリーズマーク。アクセント色のタイルに 1 文字 |
| `Root` | ゲームのルートコンポーネント。受け取る props は `onExit` だけ |
| `storageKeys` | そのゲームが保存する全キー |
| `SettingsSection?` | 任意。共有設定画面に差し込むゲーム固有の設定 |

- `storageKeys` をレジストリに載せるのは、シェルが各ゲームの保存内部を知らないまま
  「ローカルデータ削除」を正直に実行できるようにするため。
- `SettingsSection` は任意。**ゲーム固有の設定はゲームが所有し、シェルは場所だけ貸す。**
  これがないと、ゲームの設定が増えるたびにシェル側へ
  `if (gameId === 'sudoku')` のような分岐が入り、シェルがゲーム内部を知ることになる。
  Sudoku はこの口で「ミスの即時表示」トグル(`sd.prefs`)を出している。
  設定画面はコレクションホームからのみ到達するため、ゲームが起動中にこの節が
  描画されることはない(レコードの読み書きが競合しない)。
  現在この口を使っているのは Sudoku だけで、Minesweeper の「旗モード」(`ms.prefs`)は
  プレイ中に切り替えるものなので盤面側に置いている。
- ゲームは同時に 1 つだけマウントし、離れたらアンマウントする(電池)。

## タイトルごとのアクセント色

- アクセントは `packages/brand` の `titleAccents` に 1 タイトル 1 エントリ。

| ゲーム | アクセント | ライト | ダーク |
| --- | --- | --- | --- |
| Number Match | 藍 | `#3f5b8f` | `#7d9ccf` |
| Sudoku | くすんだティール | `#2f6f62` | `#6fb3a3` |
| Solitaire | くすんだフェルトグリーン | `#557a48` | `#97bd8a` |
| Minesweeper | スレートブルー | `#4a5a72` | `#93a4bd` |
| Nonogram | くすんだプラム | `#6d5192` | `#a893cf` |
| Water Sort | くすんだアクア | `#33708c` | `#7fb4c9` |
| Sliding Puzzle | 温かみのある陶土色 | `#9c5b3c` | `#d1926f` |
| Memory Match | くすんだローズ | `#9e5468` | `#cf8fa4` |

- シェルは `app/App.tsx` でゲームのマウント時にルート要素へ `data-game="<id>"` を付け、
  `ui/styles.css` の `:root[data-game='…']` が**アクセントトークンだけ**を差し替える
  (`--accent` / `--accent-ink` / `--accent-soft` / `--accent-ring` …。
  ライト / ダークそれぞれに定義がある)。ゲームを離れると属性を消す。
- Number Match のアクセントは `:root` の既定値そのもの(コレクションホームと同じ)なので、
  `data-game='number-match'` の上書きブロックは持たない。残り 7 タイトルが上書きする。
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
- **8 タイトルすべてが規約に従っている**: `number-match.css` / `sudoku.css` /
  `minesweeper.css` / `nonogram.css` / `sliding-puzzle.css` / `memory-match.css` /
  `water-sort.css` / `solitaire.css`。
- ゲームの CSS は色を書かない。共有のカスタムプロパティ(`--accent` など)だけを使い、
  どの色になるかはシェルが root に付けた `data-game` が決める。
  ゲーム側にパレット値が複製されないので、下地を変えるときに触る場所は 1 か所で済む。

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

| キー | 内容 |
| --- | --- |
| `sg.settings` | 共有設定(言語 / テーマ / 音 / 振動 / Reduced Motion) |
| `sg.iap` | 広告削除購入状態のローカルキャッシュ |
| `sd.*` | Sudoku(saveGame / saveDaily / stats / progress / flags / prefs) |
| `so.*` | Solitaire(saveGame / saveDaily / stats / flags / prefs) |
| `ms.*` | Minesweeper(saveGame / saveDaily / stats / flags / prefs) |
| `ng.*` | Nonogram(saveGame / saveDaily / stats / progress / flags / prefs) |
| `nm.*` | Number Match(saveGame / saveDaily / stats / progress / flags) |
| `ws.*` | Water Sort(saveGame / saveDaily / stats / progress / flags) |
| `sp.*` | Sliding Puzzle(saveGame / saveDaily / stats / progress / flags) |
| `mm.*` | Memory Match(saveGame / saveDaily / stats / flags) |

Sudoku の 6 キー: `sd.saveGame`(中断したレベル)/ `sd.saveDaily`(中断したデイリー。
2 スロット独立)/ `sd.stats`(難易度別)/ `sd.progress`(解放レベルとベストタイム)/
`sd.flags`(チュートリアル完了)/ `sd.prefs`(ゲーム固有設定)。
Minesweeper はレベル進行を持たないため `progress` がなく、代わりに旗モードの
`ms.prefs` を持つ。Nonogram は ×モードの `ng.prefs` を持つ。Solitaire は
Draw 1/3 の `so.prefs` を持ち、Memory Match はレベル進行も個別設定も持たない
(デイリーの記録は両者とも stats 内)。どのゲームも中断は
「通常モード用」と「デイリー用」の 2 スロットが独立する。

- 共有レコードは `sg.` 接頭辞。ゲーム固有レコードはゲームごとの接頭辞。
- ゲーム固有設定は共有 `sg.settings` に混ぜず、そのゲームの接頭辞に置く
  (`sd.prefs`)。シェルの設定レコードがゲーム追加ごとに膨らまない。
- `sg.adState` / `sg.rcCache` は廃止(インタースティシャル頻度制御と
  Remote Config キャッシュは存在しない)。
- `kv` / `repo` / `SchemaDef` と schemaVersion 運用は全ゲームで共有する。
- ゲームごとに保存領域を分離し、一方の破損が他方へ波及しない(validate で防御)。
  ゲームの追加が既存ゲームの保存データを失わせてはならない。
- 「ローカルデータ削除」は `sg.*` と全ゲームのキーを消す。

## i18n

- カタログは全言語をアプリに同梱する(`src/i18n/locales/*.ts`。オフライン要件)。
  言語追加は「locale ファイル 1 つ + `i18n/index.ts` への登録」で完結し、
  `Messages` 型が全キーの存在をコンパイル時に強制する(キー欠落でビルドが通らない)。
- 現在 14 言語・314 キー(en / ja / hi / th / id / vi / ko / zh-hans / zh-hant /
  es / pt-br / fr / de / tr)。ロケールタグは小文字で持つ。en と ja 以外は来歴
  `machine`(AI の助けを借りて書き、その言語のネイティブは読んでいない)。
  高リスクキーはリリース前の門で逆翻訳を作者が読む(`docs/I18N_POLICY.md`)。
- 解決順: アプリ内の明示選択 → 端末の優先言語リストを順に走査(Android の
  アプリ別言語設定はここに現れる)→ 英語。初回起動時の言語選択画面はない。
- 地域バリアントは `matchLocale` で親言語へフォールバックする(en-IN → en、
  レガシー `in` → id)。書記体系で割れる言語だけは専用テーブルで先に解決する:
  zh-TW / zh-HK / zh-Hant → zh-hant、zh / zh-CN / zh-SG → zh-hans、
  pt / pt-PT → pt-br。ここで親言語へ落とすと繁体字の読者に簡体字を渡してしまう。
- 空文字・プレースホルダー不一致・制御文字/マークアップ混入はテストで検出する。
  方針と対応言語計画は [I18N_POLICY.md](I18N_POLICY.md)。

## 電池(低消費電力)

- プレイ中の定期ポーリングなし。バックグラウンド処理なし。常時接続なし。
- オフライン時は広告取得をリトライしない。
- 画面外のゲームはアンマウントする(描画しない)。
- 保存はイベント駆動(可視性変化 / pause / 状態遷移時)。
- プレイ時計は ref 加算のみで、再レンダリングを起こさない。

## Web / Android

- Vite で静的 Web アプリとしてビルドし、Capacitor で Android アプリ化する。
  SSR / API Routes は不要のため Next.js は使用しない。
- `apps/simple-games/android/` は Capacitor が生成したネイティブプロジェクトをコミットする
  (ビルド成果物・local.properties は除外)。
- ハードウェア戻るボタン: ゲーム内ホーム→コレクションへ、コレクション→アプリ最小化。

## 将来の静的 Web 版

Web 版は**現時点では実装しない**が、いつでも出せる構成を維持する。

- `games/*/game/` は Pure TypeScript で、フォルダ外への import を ESLint
  (no-restricted-imports)で機械的に禁止している。React / DOM / Capacitor /
  課金 / 広告 / ストレージへの依存ゼロ。
- 保存は `KVStore` 契約(`src/storage/kv.ts`)の背後にあり、Web 版は
  IndexedDB / localStorage 実装を差すだけでよい。
- ホスティングは Cloudflare Pages 第一候補・GitHub Pages でも配信可能な
  **純静的構成**に限る。Functions / Workers / D1 / KV / Durable Objects / R2 /
  独自 API / 認証 / クラウドセーブ / サーバー側生成は使わない。
  ロジック・生成・デイリー・保存・言語・テーマはブラウザ内で完結する。
- PWA / Service Worker は Web 版実装時に導入する。ただし Web 版は初回アクセスに
  ダウンロードが必要であり、ネイティブ版の「初回起動からオフライン」とは異なる。
  この差は Web 版のドキュメントに明記する。

## 将来の共通化

設定 / ストレージ基盤 / 広告 / i18n はアプリ内のシェルとして共有しており、
これ以上の共通化(`packages/` への抽出)は実際に重複が確認されてから行う。
ゲーム固有の概念(盤面・ルール・Hint 等)は共通パッケージへ入れない。

現時点で唯一の実測された重複は `games/*/game/rng.ts` で、**8 ゲームすべてが同じ
seed 付き乱数を持っている**(`games/A/` から `games/B/` を import できない以上、
このコピーは規約どおりでもある)。抽出を検討する条件(重複が確認された)は
満たしているが、`game/` の Pure TS 純度を保ったまま `packages/` へ出せるかが論点で、
**結論は出ていない**。未決事項として
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) §6 に
記録してある。

## CI / リリース

- `ci.yml`: push / PR で install → lint → typecheck → test → build(全ワークスペース)。
  対象が増えたら turbo の `--filter` で影響範囲のみに絞る。
- `android-release.yml`: 手動実行(workflow_dispatch)または `v*` タグでのみ実行し、
  署名済み AAB(Play 用)と署名済み APK(実機確認用)をアーティファクトとして出す。
  `versionName` / `versionCode` はタグが決める。ストアへのアップロードは手動。
  タグに製品名を付けないのは、リリース対象がこのアプリ 1 つだけだから
  (8 ゲームは 1 アプリ。`packages/` はリリース対象ではない)。
- Secrets は `ADMOB_APP_ID` / `ADMOB_BANNER_ID` のみ(インタースティシャル系は無い)。
  本番 ID・署名鍵はリポジトリにコミットしない。
