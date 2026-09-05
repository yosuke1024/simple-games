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
├── app/                    # シェル: ルート App、ルーティング、ゲームレジストリ、起動手順
├── games/                  # 各ゲームは game/ state/ storage/ ui/ で自己完結
│   ├── sudoku/
│   ├── solitaire/
│   ├── spider-solitaire/
│   ├── freecell/
│   ├── hearts/
│   ├── gin-rummy/
│   ├── minesweeper/
│   ├── nonogram/
│   ├── mahjong-solitaire/
│   ├── takuzu/
│   ├── futoshiki/
│   ├── kakuro/
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
│   ├── ludo/
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
[HEARTS_RULES.md](HEARTS_RULES.md) /
[GIN_RUMMY_RULES.md](GIN_RUMMY_RULES.md) /
[MINESWEEPER_RULES.md](MINESWEEPER_RULES.md) /
[NONOGRAM_RULES.md](NONOGRAM_RULES.md) /
[MAHJONG_SOLITAIRE_RULES.md](MAHJONG_SOLITAIRE_RULES.md) /
[TAKUZU_RULES.md](TAKUZU_RULES.md) /
[FUTOSHIKI_RULES.md](FUTOSHIKI_RULES.md) /
[KAKURO_RULES.md](KAKURO_RULES.md) /
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
[CHECKERS_RULES.md](CHECKERS_RULES.md) /
[REVERSI_RULES.md](REVERSI_RULES.md) /
[CONNECT_FOUR_RULES.md](CONNECT_FOUR_RULES.md) /
[GOMOKU_RULES.md](GOMOKU_RULES.md) /
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
- **ゲームホームのヘッダー右の操作群**は共有の `GameHomeActions`
  (`ui/components/GameHomeActions.tsx`)。中身はお気に入りの星
  (`FavoriteAction.tsx`, issue #109)と、Android だけの「ホーム画面に追加」
  (`HomeShortcutAction.tsx`, issue #110。対応 Launcher でなければ描かない)。
  向きは `ShareAction` と同じ(ゲーム → `ui/components/`)で、ゲームが渡すのは
  `gameId` だけ——どちらの操作がそのプラットフォームに存在するかはシェルの事情。
  置き場所は**全 30 ゲームが戻るボタンの反対側に空けていた
  `icon-btn-placeholder` の位置**で、群として 1 子要素にまとめてあるので、
  操作が 1 つでも 2 つでもヘッダーの形(2 子要素の space-between)は変わらない。
  **盤面と結果画面には置かない**: 固定はコレクションについての判断であって、
  勝った直後に求める種類のものではない
  ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))。全 30 ゲームに 1 つずつ
  置かれていること・各タグが自分のゲーム id を名乗っていること・ホーム以外に
  無いこと・星や追加ボタンを単独で置いていないことは
  `src/test/homeActionsWiring.test.ts` が機械的に見る。
- **結果画面の任意の共有**は共有の `ShareAction`(`ui/components/ShareAction.tsx`,
  issue #86)。向きは `ResultAdSlot` と同じ(ゲーム → `ui/components/`)で、
  ゲームが渡すのは `gameId`・**嘘のない結果種別**(`completed` / `played`)・
  `details`(結果画面が表示しているのと同じ翻訳済みラベルと整形済み値、最大 3 件、
  見出しの数字を先頭に)の 3 つ。文面は `services/share/message.ts`(Pure
  TypeScript)、画像カードは `services/share/card.ts`、share sheet と clipboard は
  `services/share/share.ts` が持つ。共有が言えるのは結果画面が言ったことだけ
  (ゲームが同じ文字列を渡す) —— 履歴(自己ベスト・通算成績)は渡さない。
  ゲーム固有の共有フォーマッタを 30 個作らないのは変わらない: 渡す文字列は
  結果画面が既に整形しているものそのままである。
  `completed` を使ってよいのは勝ち・クリアが確定した結果だけで、敗北・引き分け・
  エンドレスの終了はすべて `played`。全 30 ゲームに置かれていることと、各タグが
  自分のゲーム id を名乗っていることは `src/test/shareWiring.test.ts` が
  機械的に見る。**共有シートの開き方はネイティブとブラウザで別**(2026-09-04):
  アプリは `@capacitor/share` + `@capacitor/filesystem`(画像はキャッシュへ書いて
  URL を渡す)、ブラウザは Web Share API の `files`。分けたのは好みではなく計測結果で、
  **Android の WebView には `navigator.share` が存在しない**(WebView 148 /
  `https://localhost` で `undefined`)。それまでの Android は共有シートが一度も
  開かず、クリップボードへ落ちていた。プラグインが失敗した場合はブラウザ側の
  梯子(Web Share → clipboard)へそのまま落ちるので、退化はしない。
  **Android だけは文面と URL を自前で 1 つの text にまとめ、`url` を渡さない**
  —— プラグインは両方渡すと「本文 + 半角スペース + URL」に連結するが、X の
  Android 受け口は画像が付くとその末尾 URL を捨てる(2026-09-04 の実機で確認。
  URL が独立行だったクリップボード経由の文面は残っていた)。iOS は URL を
  別項目のまま渡す(共有シートが本物の URL として扱うため)。
  共有は報酬・機能解放・再催促を一切生まない
  ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「初期リリースで実装しないもの」)。
- Analytics / Remote Config / トラッキングのサービスは**アプリの成果物に
  存在しない**(初期リリースで削除済み)。Web 版のページ解析は実装済みで、
  ソースには居るが `--mode web` 限定であり、native 成果物には不在
  ([WEB_VERSION.md](WEB_VERSION.md)「計測」、運用は
  [GROWTH_MEASUREMENT.md](GROWTH_MEASUREMENT.md))。**証明はもう
  「公開コードに追跡コードが無いこと」ではなく、成果物にそれが無いことを
  CI が示すこと**である(`check-dist-ads-separation.sh`)。

## 状態と ref

どの `games/*/state/GameContext.tsx` も、状態は `useState` に持ち、それを render
本体で ref へ写している(`const xRef = useRef(x); xRef.current = x;`)。コール
バックが「今の値」を読むためで、こうしておくと状態が変わるたびにコールバックを
作り直さずに済み、context の値も安定する。

**落とし穴は、ref が進むのが render のときだけだという点にある。** React は 1 つの
タスクで起きた更新をまとめ、その render はまだ走っていない。つまり **同じタスクの
中で 2 回ミューテーションが起きると、2 回目は 1 回目が置き換える前の値を読み、
1 回目が消える**。

実際に踏んだのは 2 通り:

- **連続イベント**(pointermove など)。React は discrete イベントと違ってこれらを
  同期 flush しないので、遅い端末では 2 つの move が 1 フレームに入る。Nonogram の
  ドラッグが塗ったマスを落としていたのがこれ(issue #108、
  `nonogram/ui/NonogramRoot.test.tsx` の「two moves land in one render」)。
- **1 つのハンドラが同じ状態を 2 回書く**。ラン終了の記帳と次のランの開始が 1 タップに
  入る形(2048 / Block Puzzle の `startNewGame`、アーケード 4 本の `settle` =
  `bookPlaySeconds` + `reportRunEnd`)。

逆に**危険でないもの**も憶えておく価値がある。タップ・クリック・keydown は 1 つずつ
別タスクなので、キーリピートを含めて間に必ず render が入る。CPU 対戦 7 本の思考も
安全で、1 手 = `session` を deps に持つ effect が張った setTimeout 1 本であり、
次の一手は render を経ないと arm されない(だから checkers の連続ジャンプも
hearts の 3 人分の応手も 1 タスク 1 手に割れている)。

規約:

- **セッション・統計・進捗は、各コンテキストにつき 1 か所からしか書かない** ——
  `putSession` / `persistStats` / `persistProgress`。散らばっていると ref を進める
  場所も散らばる。
- **その 1 か所で、setState より先に ref を進める**。render が同じ値をもう一度
  代入するので、ref と state が食い違うことはない。
- 両方を `src/test/refLeading.test.ts` が機械的に見る(`importBoundaries.test.ts`
  や `shareWiring.test.ts` と同じ立て付けで、新しいゲームが増えた日に落ちる)。

`elapsedRef` / `bookedRef`(再生時間の時計)は state の写しではなく**独立した ref**
で、render では追随しない。だから**マウント時の種**が要る:セッションを復元する
ゲームは、**そのマウントが指しているスロット**の `elapsedSeconds` を両方に入れて
起動する。`syncActiveGame` は表示中の画面に関係なく visibilitychange / pause で走り、
`withElapsed` がこの ref をそのままセッションへ書き込むので、0 のままバックグラウンド
に入ると**中断した盤の時計だけが 0 で上書きされる**(issue #109)。盤そのものは無傷で、
`unbooked` も 0 になるので統計にも傷が出ない —— 消えるのはプレイヤーが積んだ分数だけ
で、どこにも音が鳴らない。`bookedRef` を同じ値にしないと今度は復元済みの秒が統計へ
二重計上されるので、**2 つで 1 つの不変条件**であり片方だけ直してはいけない。
`src/test/playClockSeed.test.ts` が機械的に見る。

**「指しているスロット」は扉によって変わる**、というのが #109 と #113 の合流点で
ある。ショートカットが中断局へ直接入った launch ではその局のスロット、それ以外では
ホームが最初に指すスロット。だから名前は 1 つで、`activeMode` の初期値と時計の種の
両方がそれを読む:

```ts
const mountedMode = resumeMode ?? INITIAL_MODE;      // スロットが複数のゲーム
const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
```

スロットが 1 つのゲームは `initialSession` がそのままマウント中のセッションなので、
扉に関係なくそこから読む。**種を「再開したときだけ」に gate してはいけない**:
コレクションから開いてホームに居るだけの launch も `syncActiveGame` に届くので、
gate すると #109 がそこに残る。逆に `INITIAL_MODE` 固定にすると、デイリーやフリーだけ
中断中のときショートカット再開が空スロットから 0 を読む。**どちらの片側も穴が残る。**

- 実測(2026-09-05):セッションを持つ 24 本のうち 21 本が `useRef(0)` のままだった
  (futoshiki / kakuro / takuzu だけが先に種を持っていた)。形は単一スロット 9 本と
  複数スロット 12 本の 2 つだけで、
  `scripts/codemods/2026-09-05-seed-play-clock-refs.mjs` で揃えた。回帰テストは
  各ゲームの Root テストに 1 本ずつ、
  `scripts/codemods/2026-09-05-suspended-clock-tests.mjs` で入れた。
- #113 との合流(2026-09-05):main 側は同じ概念に 3 つの名前(`mountedMode` /
  `initialMode` / インライン式の `restoredSeconds`)を持ち、残り 21 本は種を
  再開に gate していた。`scripts/codemods/2026-09-05-merge-mounted-slot-clock.mjs`
  で 24 本を上の 1 形に正規化した。

`flagsRef` / `prefsRef` / `activeModeRef` は同じように写しているが**対象外**。1 タスクに
2 回書く経路が無く、書き込みも単発トグルの全置換だからである(CPU 対戦 7 本の
`prefsRef` だけは「先後を選んでから始める」が本当に 1 タップなので先行させている ——
許すが、必須ではない)。

アーケード 4 本(Brick Breaker / Sky Fighter / Bubble Pop / Bunny Hop)にセッションの
口が無いのは、盤面が React state ではなく **board コンポーネント側の権威ある
`useRef`** に載っていて、rAF が毎フレーム直接書き換えているからである。state に
写していない以上、遅れようがない。守るのは統計と進捗だけでよい。

## ゲームレジストリの契約

`app/registry.ts` のエントリは「タイトルカード + そのゲームが持つキー + ゲーム本体の
ローダー」だけで、プラグイン機構ではない。ゲームの追加は keys の import 1 行と
配列要素 1 つで済む。

| フィールド             | 内容                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                   | 収録タイトルの識別子(`GameId` の union が正本。`'sudoku'` / `'solitaire'` / `'spider-solitaire'` / `'freecell'` / …)。`data-game` 属性にもこの値を使う             |
| `title`                | 固有名詞。全言語で同一表記(翻訳しない)                                                                                                                             |
| `glyph`                | シリーズマーク。そのタイトルのアクセント色のタイルに 1 文字                                                                                                        |
| `storageKeys`          | そのゲームが保存する全キー。各ゲームの **import ゼロの葉** `storage/keys.ts` から同期 import する                                                                  |
| `loadRoot`             | ゲームのルートコンポーネントを動的 `import()` で返すローダー。Root が受け取る props は `GameRootProps` = `onExit` と任意の `entry`(どの扉から入ったか、issue #113) |
| `loadSettingsSection?` | 任意。共有設定画面に差し込むゲーム固有の設定のローダー                                                                                                             |

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

- **全ゲームはグリッド**(`.game-grid`)。スマホ幅では 2 列、広い画面では列を
  増やして 3〜5 列(後述の「ワイド画面のレイアウト」)。1 行 1 ゲームの縦リストは
  10 本で 1 画面を超え、16 本なら 2 画面を超えて、末尾のタイトルが常にスクロールの
  先になる。グリッドが成立するのはタイトルが**全言語で同一の固有名詞**だからで、
  翻訳文を並べていたらこの形は 14 言語で保てない。
- **グリッドはカテゴリ別のセクションに分ける**(`registry.ts` の `GAME_CATEGORIES`、
  現在はロジック / カード / パズル / ボードゲーム / アーケード / ドリルの 6 つ)。
  27 本を 1 枚のグリッドに敷くと結局全タイトルを読んで探すことになるため、
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
- **「お気に入り」**(`app/favoriteGames.ts` / `sg.favorites`)を「最近遊んだ」の
  **上**に置く(issue #109)。表示順は お気に入り → 最近遊んだ → カテゴリ。
  「最近遊んだ」はシェルが書く履歴で「さっきどこにいたか」しか答えられない。
  毎日開くゲーム・週に 2 回のゲームを**常にここに置く**のは利用者の宣言であり、
  自動履歴では代替できない。
  - 全ゲーム一覧と同じ `.game-grid`。**同じ種類のもの(タイトルの棚)だから**で、
    特別なのは位置だけ。0 件なら**見出しごと出さない**(「最近遊んだ」と同じ)。
  - 並びは**留めた順(古い順)**。1 つ留めても他は動かない。自動で並び替わる棚は
    棚ではなくランキングであり、それは状態表示になる。
  - 進捗率・経過時間・ステータスを載せない。**ここも近道であって状態表示ではない。**
  - **お気に入りのゲームは「最近遊んだ」から落とす。** 二重に出さないためであり、
    「留めたゲーム = 直前に遊んだゲーム」は例外ではなく普通の場合だから
    (行 2 枠を、既に開いている扉に使わない)。「最近遊んだ」自体の挙動
    (記録・順序・上限 2・0 件なら非表示)は変えていない。
  - 操作は 3 経路。**どれも同じ `sg.favorites` を書く。**
    1. **ゲームホームのヘッダーの星**(`ui/components/FavoriteAction.tsx`)。
       「このゲームは自分のものだ」と決まるのはそのゲームを見ている時なので、
       ここが**気づかれる**経路。上の「レイヤー規則」に置き場所の規約がある。
    2. タイルの**長押し / 右クリック**が小さな Action Sheet を開く
       (`ui/components/GameActionSheet.tsx`)。キーボードのメニューキー
       (Shift+F10)もブラウザが同じ `contextmenu` を出すので同じ口を通る。
       知っている人には速いが、**発見できないので唯一の経路にはできない**。
    3. 設定画面の全ゲームぶんの星トグル(`aria-pressed`)。一覧で管理でき、
       キーボードだけで完結する。
  - 長押しでシートが出た指を離すと、**シートが既に画面にある状態で** click が
    飛ぶ。そのままだと背景を叩いて即座に閉じるか、最悪アクションを押す。
    `GameActionSheet` が capture 段でその 1 回だけを飲む(次の pointerdown /
    keydown で解除するので、click を出さないブラウザを巻き込まない)。
    **飲むのは長押しで開いた時だけ**(`openedMidPress`)。右クリックは click を
    出さず、キーボードのメニューキーは pointer イベントを出さないので、そちらで
    武装すると来ない click を待ち続けて**次の本物の click を食う**。これは机上の
    話ではない: TalkBack のダブルタップと VoiceOver の実行は、pointer も key も
    伴わない裸の click としてページに届く。
  - レジストリに無い id は表示前に落とす。ただし**レコードからは消さない** —
    取り下げたゲームが戻ってきたら、留めたまま戻る。
- **「ホーム画面ショートカット」**(Android のみ、issue #110)。OS 標準の
  Pinned Shortcut で、よく遊ぶ 1 本を Collection Home を経由せずホーム画面から
  直接開けるようにする。ゲーム別アプリを作るのではなく、実体は変わらず
  Simple Games 本体を `?game=<id>` 付きで起動するショートカットが増えるだけ
  ——Web 版の住所をそのまま共用する(`app/shortcutLaunch.ts`、契約の正本は
  [WEB_VERSION.md](WEB_VERSION.md)「URL(ゲーム別の入口)」)。
  - UX 原則は 3 つ。**お気に入り登録では作らない**(2 つは独立した決定)。
    **「Add to Home Screen」を明示的に押した時だけ OS へ要求する**。
    **Launcher/OS の確認フローを尊重し、結果は返ってこない**——拒否・失敗・
    未対応のいずれもエラー扱いにせず、ゲーム利用を妨げない
    (`services/homeShortcut/homeShortcut.ts`)。
  - 操作は 2 経路。お気に入りと同じ理由で、**ゲームホームのヘッダー**(星の隣、
    `ui/components/HomeShortcutAction.tsx`)が気づかれる経路、タイルの Action Sheet
    の 2 つ目の行(`ui/components/GameActionSheet.tsx`)が知っている人の近道。
    対応 Launcher かどうかは起動時に一度確定し
    (`ShortcutManagerCompat.isRequestPinShortcutSupported`)、
    `homeShortcutsAvailable()` が真の時だけどちらも描く——押しても何も起きない
    ボタンを出さないため。「追加済み」の状態は描かない: Launcher は結果を返さず、
    アイコンを消しても unpin しない Launcher があるので、推測して隠すと
    戻したい時に扉が無い。
  - 起動経路は cold / warm の 2 つ。cold start は boot の `initShortcutLaunch`
    が Intent の URI を読み、`initialView` がコレクションを経由せずそのゲームの
    ホームを最初に描く。warm start(`MainActivity` が singleTask ゆえの
    `onNewIntent`)は Capacitor の `appUrlOpen` として届き、同じゲームが
    既に開いていれば**触らず**、別ゲームなら閉じて開く——このときレビューの
    質問は出ない(`offerReviewIfDue` は `exitGame` という扉だけの入口で、
    ショートカットによる切り替えはその扉を通らない)。未知/廃止済み id は
    共用パーサ(`gameIdFromHref`)が落とし、コレクションへ fail-safe する。
  - アイコンは 30 本ぶんの drawable を用意する代わりに、共有カードと同じ
    Canvas 2D でその場で描く(`services/homeShortcut/icon.ts`)——WebView が
    既に持っているフォントでグリフの字形を保証できるため。
  - ネイティブ側はこの機能だけのローカル Capacitor プラグイン
    (`HomeShortcutPlugin.java`)が `ShortcutManagerCompat` を薄く包むだけで、
    新しい権限は増えていない。
  - **ショートカットからの起動だけは、中断中の 1 局へ直接入る**(issue #113)。
    シェルが渡すのは `entry`(`'collection'` / `'shortcut'`)の 1 語だけで、
    それは**指示ではなく事実**である。何をするかは各ゲームが**自分の保存領域
    だけ**を見て決め、シェルはその結果を知らない——ここでシェルがセッションを
    覗けば、レジストリが 30 本ぶんの保存スキーマを知ることになる。全ゲーム共通の
    resume フレームワークも作らない。判定は数行で、置き場所は
    `state/GameContext.tsx` の mount 時の 1 か所。スロットを 2 つ以上持つ
    15 本だけが「中断中はちょうど 1 つか」を数える小さな純関数
    (`soleSuspendedMode`)を `storage/gamePersistence.ts` に置く —— 1 スロットの
    9 本(2048 / Block Puzzle / Checkers / Connect Four / Gin Rummy / Gomoku /
    Hearts / Ludo / Reversi)は数えるものが無いので、loader が既に落としている
    「再開できない保存」の裏返し(`initialSession !== null`)がそのまま答えになる。
    - 直接入るのは**中断中のセッションがちょうど 1 つのときだけ**。0 なら開く
      ものが無く、2 つ以上なら「さっきまで遊んでいたやつ」はもう事実ではなく
      推測になる(Sudoku / Number Match などはレベル・デイリー・フリーで
      3 スロットを別々に持つ)。どちらもゲームホームへ入る——他のすべての扉が
      行き着く場所と同じである。**捨てるものは無い**:選ばれなかった中断局は
      ホームでそのまま待っている。
    - **チュートリアル未了なら Quick Rules が先。** ショートカットは説明を
      飛ばす裏口ではない。
    - 盤面へ直接入るときは、**ホームの Resume が呼ぶ `activate` が積むのと
      同じ時計**を復元済みの経過秒で積む。29 本では 2 本(`elapsedRef` =
      進行中の秒、`bookedRef` = すでに統計へ計上済みの秒)で、Number Match
      だけは終局時に一括計上するので 1 本しかない
      (「プレイ時間の計上モデルは 8 本とも同じ」ではない)。**両方を外すと
      統計は合ったまま盤面の経過秒が破壊され、`bookedRef` だけを外すと
      復元した秒がもう一度計上される** —— 前者は統計の数字が偶然そろうので、
      テストは**中断中の保存そのものの経過秒**も読まないと当たらない
      (`src/test/refLeading.test.ts` と同じ種類の落とし穴)。
    - **戻るは不自然な履歴を作らない。** 盤面から 1 歩戻ればそのゲームの
      ホームで、入り口が違っても undo すべき画面は増えていない。
    - **すでにそのゲームが開いているときのショートカットは、何もしない。**
      #110 からの「同じゲームなら触らない」がそのまま優先される —— ゲームの
      ホームに居る人がショートカットを叩いても盤面へは入らない。扉は
      **入るためのもの**であって、居る場所を作り直すためのものではない。
    - **過去日のデイリーも「中断中の 1 局」として扱う**(2026-09-05 の判断)。
      デイリーのスロットは日付が変わっても掃除されず、過去日に遡って遊べる
      ゲームでは何週間も前の日付のまま残りうる。それでも開くのは、
      **ホームの Resume が渡すのと同じ盤面**だからである——違いは、ホームには
      日付が併記されていて(`· ${dailyGame.dailyDate}`)、盤面には無いこと
      だけで、これは #113 以前からの盤面ヘッダーの性質である。ここで
      「今日のデイリーでなければ曖昧」という規則を足すと、過去日を消化して
      いる人のショートカットだけが理由なく効かなくなる。**盤面ヘッダーに
      日付を出すかどうかは別の問題**として残っている。
    - **コレクションのタイルからの起動は従来どおりゲームホーム**、Web の
      `?game=` も同じ(`entry` は `'collection'`)。ブラウザにはピン留めする
      ホーム画面が無く、誰かが渡したリンクは「始めた対局への帰り道」ではなく
      そのゲームの紹介である([WEB_VERSION.md](WEB_VERSION.md)
      「URL(ゲーム別の入口)」)。
    - **途中保存を持たないゲームは何も書かない**(アーケード 4 本 /
      Schulte Table / Number Recall)。再開できる対象が無いところで扉を
      区別すると、残るのは「ショートカットが黙って新しいランを始める」で、
      それは別の——そして統計の `played` を勝手に増やす——機能である。
      「セッションを持つゲームは全部これに答えていること」と「持たない
      ゲームは口を開けていないこと」は
      `src/test/shortcutResumeWiring.test.ts` が機械的に見る。
    - スコープ外:iOS の Quick Actions は #114。
- **ゲーム名の検索**(issue #122)。「お気に入り」でも「最近遊んだ」でも届かない
  ケース——**名前は分かっているが、留めてもいないし最近も遊んでいないタイトル**——
  のための 3 つ目の答え。判定は `app/gameSearch.ts` が持つ。
  - **常設の検索ボックスは置かない。** ヘッダーに小さなアクションを 1 つ置き、
    押した時だけヘッダーが入力欄になる**モード**にする。画面の中身が 30 枚の
    名前付きの扉である以上、常設の入力欄はその画面で最も目立つものになる。
  - 検索中は本文を丸ごと差し替える(ヒーロー・2 つの棚・6 つのセクション)。
    出るのは**ホームと同じ並びのまま**、見出しを外した 1 枚のグリッド。
    ランドマーク名は `gamesHeading` のままで、「ゲーム一覧を絞り込んだもの」
    であることを変えない。**未入力なら全ゲーム**が出る——開いた瞬間に空の画面を
    見せないため、そして欄を消した時に空状態ではなく全件へ戻すため。
  - 一致は**表示中のタイトルへの部分一致・大文字小文字を無視**するだけ。あいまい
    検索・ローマ字/かな変換・タグや説明文の索引・検索履歴・ランキング・通信は
    どれも持たない。タイトルは**全言語で同一の固有名詞**(`registry.ts`)なので、
    「表示中のタイトル」と「タイトル」は同じ文字列であり、判定は現在の言語を
    知る必要がない。畳み込みは `toLocaleLowerCase` ではなく `toLowerCase` —
    トルコ語ロケールでは前者が `I` を `ı` に写すため、大文字で打つと
    Minesweeper に当たらなくなる。
  - 並びは**ホームの並びのまま**(カテゴリ順 → レジストリ順)。一致位置で
    並べ替えない。直前まで見ていた一覧が絞り込まれる形にする。
  - 0 件は静かな 1 行だけ(`role="status"`)。代替の提案も「もしかして」も出さない。
  - 出口は 3 つ:戻る矢印、Esc、Android のハードウェア戻る。**モードを閉じると
    入力は消える**(検索履歴を持たないので、再入場は常に空欄から)。
    ブラウザの Back は出口ではない——検索は住所に乗らない(`app/webRoute.ts` が
    運ぶのはゲームだけ)。設定画面と同じ扱いで、そこでの Back は従来どおり
    サイトを出る([WEB_VERSION.md](WEB_VERSION.md)「URL(ゲーム別の入口)」)。
  - **Android のハードウェア戻るの持ち主がコレクション画面へ移った。** 検索が
    開いているかどうかはこの画面しか知らず、Capacitor の `backButton` は
    登録済みリスナーを**すべて**呼ぶので、シェル側にもう 1 つ置くと検索を
    閉じた直後にアプリが最小化される。シェル(`app/App.tsx`)が持つのは
    設定画面のぶんだけになり、「同時に 1 人だけが持つ」規約は変わらない。

## ワイド画面のレイアウト

スマホ縦持ちを基準(Compact)に、広い画面では CSS media query だけで段階的に
広げる(issue #93)。端末名や User-Agent では判定しない — iPad の Split View で
幅が縮めば、幅だけを理由に Compact / Medium へ戻る。

**ただし iOS の出荷バイナリは iPhone 専用である**(`TARGETED_DEVICE_FAMILY = 1`)。
ここで書くワイド段階が実際に効くのは Web 版と大きめの端末幅であって、iPad
アプリとしては配信していない。理由は能力ではなく検証で、iPad 実機での回転 /
Split View / Stage Manager を一度も確認できておらず、Universal 化に App Store
Connect が要求する 13 インチのスクリーンショットも用意していないため
([RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) §4.7)。**CSS を消す話ではない** —
戻すときは `project.pbxproj` の 1 行と `Info.plist` の 1 ブロックだけで足りる。

| 段階    | 条件                                             | 方針                                                   |
| ------- | ------------------------------------------------ | ------------------------------------------------------ |
| Compact | 600px 未満(基準)                                 | 既存のスマホ縦積みを変えない                           |
| Medium  | `min-width: 600px`                               | 縦積みのまま盤面・コンテンツを拡大                     |
| Large   | `min-width: 900px`                               | 縦積みを保ち、リスト幅だけ広げる(過度に横へ伸ばさない) |
| Wide    | `min-width: 900px` かつ `orientation: landscape` | 対象ゲームは「盤面+操作領域」の横配置を許可            |

- 600px はスマホ横持ち(高さ側が 600 未満)と iPad Split View 半分(約 507〜559px)
  を Compact 側に残す線。900px は iPad 縦(768〜834px)を Medium に、iPad 横
  (1024px〜)と一般 PC を Wide に分ける線。ホームのみ `min-width: 1280px` で
  5 列に増やす(一覧の最大幅は約 1,160px で、本文を画面端まで伸ばさない)。
- 共通シェルが持つのは `--game-shell-max`(ゲームクローム = トップバーと
  アクションバーが揃う列幅、既定 560px)だけ。盤面の寸法・横配置の形は各ゲームの
  CSS が同じ media query で自分のぶんだけ持つ(`src/ui/styles.css`「wide
  viewports」の節を参照)。汎用レイアウトフレームワークは作らない。
- 盤面の拡大は幅だけでなく高さも見る(`min(100%, <上限>, calc(100vh - <クローム高>))`
  の形)。1366×768 のような「幅は広いが低い PC」で盤面や操作が縦に欠けないことを
  優先する。
- リサイズ・回転でゲーム Root を再マウントしない。レイアウトは CSS が追従し、
  進行中の盤面・Undo 履歴・選択状態は React の状態として生き続ける。
- **キーボードは入力アダプター**(issue #93)。共有は `ui/useGameKeys` の
  薄い登録シームだけ(handled のときだけ preventDefault / 入力要素は素通し /
  モーダル・リザルト中は enabled=false で解除)。キーの意味は各ゲームが
  自分のタップ handler の隣に持ち、**画面に無い機能をキーボード専用に
  しない**。全ゲーム共通の型は Undo = Ctrl/Cmd+Z、Hint = H(その画面に
  ボタンがある場合のみ・ボタンと同じ有効条件)。ゲーム固有のキーは各
  `docs/<GAME>_RULES.md` の「操作」に書く。
- Chromium 88 床はワイド段階の規則にも適用する(古い WebView の Android
  タブレットが 900px 幅で到達する)。container query / `:has()` / subgrid は
  使わず、`svh`/`dvh` は `vh` フォールバックの後にだけ書く。

## タイトルごとのアクセント色

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

## CSS の分割

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

## 広告と課金

- 広告は `services/ads/` のバナーのみ(Anchored Adaptive Banner)。
  AdMob 初期化は起動後の fire-and-forget。UMP 同意はゲーム初期化と切り離す。
  オフライン時・購入済み時はリクエストしない。仕様は ADS_POLICY.md。
- `ui/` の `BannerSlot` は高さ確保方式(盤面のレイアウトシフトなし)。
  広告が出うる起動でだけ枠を確保し、出ない起動ではスロットごと消す。
- **広告側が問うのは「この起動で広告削除が効くか」**(`isAdRemovalActive()`)。
  購入済み、または購入状態が読めなかった起動がこれに当たる(fail-closed、
  issue #96 — 読めなかったを未購入と読むと、購入者にバナーが出る)。SDK の初期化
  (`app/boot.ts`)もスロットの確保もこの 1 つの判定に従うので、埋まりうるときだけ
  枠が出る。「購入したか」(`isAdRemovalPurchased()`)は別の問いで、設定画面
  だけが問う — 買っていない人を購入済みと表示しないため。
- `monetization/` は広告削除 IAP の基盤: `AdRemovalStore` 契約
  (`isAvailable` / `getPrice` / `purchase` / `restore`)と実装差し替え点。
  既定実装は「ストア未接続」(購入 UI は非表示、購入済みキャッシュだけ尊重)。
  ストア接続は Play Console での商品作成など人間作業を要する(計画書 §5)。

## ストレージキーの規約

| キー              | 内容                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| `sg.settings`     | 共有設定(言語 / テーマ / 音 / 振動 / Reduced Motion)                                                                |
| `sg.iap`          | 広告削除購入状態のローカルキャッシュ                                                                                |
| `sg.review`       | ストアレビュー導線の状態(完了数 / 表示回数 / 解決済みフラグ)                                                        |
| `sg.recent`       | 「最近遊んだ」のゲーム id(新しい順・最大 2 件)                                                                      |
| `sg.favorites`    | 「お気に入り」に固定したゲーム id(**留めた順**・上限は実質なし)                                                     |
| `sg.webAppPrompt` | Web 版のアプリ案内カードの状態(ゲーム離脱回数 / 表示済みフラグ)。**Web 版でのみ読み書きする**                       |
| `sd.*`            | Sudoku(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                                          |
| `so.*`            | Solitaire(saveGame / saveDaily / stats / flags / prefs)                                                             |
| `ms.*`            | Minesweeper(saveGame / saveDaily / stats / flags / prefs)                                                           |
| `ng.*`            | Nonogram(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                                        |
| `mj.*`            | Mahjong Solitaire(saveGame / saveDaily / stats / progress / flags。**prefs なし**)                                  |
| `tk.*`            | Takuzu(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ)       |
| `ft.*`            | Futoshiki(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                                       |
| `kk.*`            | Kakuro(saveGame / saveDaily / saveFree / stats / progress / flags / prefs)                                          |
| `nm.*`            | Number Match(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ) |
| `ws.*`            | Water Sort(saveGame / saveDaily / saveFree / stats / progress / flags / prefs — prefs はフリープレイのティアだけ)   |
| `sp.*`            | Sliding Puzzle(saveGame / saveDaily / stats / progress / flags)                                                     |
| `mm.*`            | Memory Match(saveGame / saveDaily / stats / flags)                                                                  |
| `bb.*`            | Brick Breaker(stats / progress / flags。**saveGame なし** — 下記)                                                   |
| `sf.*`            | Sky Fighter(stats / progress / flags。**saveGame なし** — 下記)                                                     |
| `tm.*`            | 2048(saveGame / stats / flags。デイリーもレベル進行もない)                                                          |
| `bp.*`            | Block Puzzle(saveGame / stats / flags。同上)                                                                        |
| `ld.*`            | Ludo(saveGame / stats / flags / prefs。統計は難易度別。デイリーが無いので 1 枠)                                     |
| `ck.*`            | Checkers(saveGame / stats / flags / prefs。統計は難易度別)                                                          |
| `rv.*`            | Reversi(saveGame / stats / flags / prefs。統計は難易度別)                                                           |
| `c4.*`            | Connect Four(saveGame / stats / flags / prefs。同上)                                                                |
| `gm.*`            | Gomoku(saveGame / stats / flags / prefs。同上)                                                                      |
| `ss.*`            | Spider Solitaire(saveGame / saveDaily / stats / flags / prefs)                                                      |
| `fc.*`            | FreeCell(saveGame / saveDaily / stats / flags。**prefs なし**)                                                      |
| `ht.*`            | Hearts(saveGame / stats / flags / prefs。統計は難易度別)                                                            |
| `gr.*`            | Gin Rummy(saveGame / stats / flags / prefs。同上)                                                                   |
| `bh.*`            | Bunny Hop(stats / flags。**saveGame なし** — 下記)                                                                  |

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

[REVERSI_RULES.md](REVERSI_RULES.md) /
[CONNECT_FOUR_RULES.md](CONNECT_FOUR_RULES.md) /
[BUNNY_HOP_RULES.md](BUNNY_HOP_RULES.md) を唯一のソースとする。

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

## i18n

- カタログは全言語をアプリに同梱する(オフライン要件。ネットワークから
  取りに行かない)。**キーの置き場所はキーの所有者で分かれる**(issue #38):
  複数レイヤーやシェルだけが使うキーは `src/i18n/locales/*.ts` に残ってエントリへ
  乗り、1 本のゲームだけが使うキーはそのゲームの `src/games/<id>/i18n/*.ts` に
  移してゲームのチャンクへ同梱する。ゲームを開かないプレイヤーは、その文言を
  一度もパースしない。
- 現在 14 言語。シェル 104 キー(エントリに乗る) + ゲーム別 30 カタログ(合計 959
  キー、13〜59 キー/ゲーム、開いたときだけパースされる)。ロケールタグは小文字で
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

## Web / Android / iOS

- Vite で静的 Web アプリとしてビルドし、Capacitor で Android / iOS アプリ化する。
  SSR / API Routes は不要のため Next.js は使用しない。
- `apps/simple-games/android/` / `apps/simple-games/ios/` は Capacitor が生成した
  ネイティブプロジェクトをコミットする(ビルド成果物・local.properties・
  `ios/App/App/public/`(web 資産のコピー)は除外)。
- **プラットフォーム差分は 3 箇所に限定する**: 広告 ID・ストアの可用性判定・
  ホーム画面ショートカット。いずれも実行時に `Capacitor.getPlatform()` で選ぶ
  (`services/ads/banner.ts` / `monetization/nativeStore.ts` の `PlatformRules` /
  `services/homeShortcut/` + `app/shortcutLaunch.ts` が
  `Capacitor.getPlatform() === 'android'` を見る、issue #110)。
  ゲーム・保存・i18n のコードに `if (ios)` を書かない。
- iOS 側の AdMob アプリ ID は Xcode ビルド設定 `ADMOB_IOS_APP_ID` →
  `Info.plist` の `GADApplicationIdentifier`(Android の manifestPlaceholder と
  同型。未設定はテスト用 app ID)。ATT は使わない(ADS_POLICY.md)。
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
- **住所はクエリパラメータ 1 本**(`?game=<game-id>`)。ゲーム別ガイドから対象
  ゲームを直接開くための入口で、シェル(`app/webRoute.ts`)だけが読み書きし、
  `Capacitor.isNativePlatform()` の実行時ガードで native では動かない。契約と
  履歴の扱いは [WEB_VERSION.md](WEB_VERSION.md)「URL(ゲーム別の入口)」が正本。
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

現時点で唯一の実測された重複は `games/*/game/rng.ts` で、**27 ゲームすべてが同じ
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
  (27 ゲームは 1 アプリ。`packages/` はリリース対象ではない)。
- Secrets は `ADMOB_ANDROID_APP_ID` / `ADMOB_ANDROID_BANNER_ID` のみ
  (インタースティシャル系は無い。プラットフォーム名を含むのは AdMob ID が
  OS ごとに別なため — iOS 版では `ADMOB_IOS_*` が並ぶ)。
  本番 ID・署名鍵はリポジトリにコミットしない。
