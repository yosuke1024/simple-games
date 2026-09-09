# Simple Games — アーキテクチャ

この文書は索引である。見出し(`## `)は元の全文と同じ順序・同じ文言で残っており、コードやドキュメントが `docs/ARCHITECTURE.md「見出し」` で参照する先は必ずここに見つかる。長い節は要約だけをここに置き、全文は `architecture/` 配下の同名ファイルへ 2026-09-05 に分割した(各節末尾の全文リンクから読む)。たとえば `ShareAction` の結果画面の共有や `games/*/game/` のレイヤー規則は分割せずに「アプリ内レイヤー」節にそのまま残っている。

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
│   └── <game-id>/          # 収録ゲームの一覧は app/registry.ts が正。ここには列挙しない
├── monetization/           # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
├── services/               # 共有: ads(バナーのみ) / network / sound / haptics
├── state/                  # 共有: SettingsContext
├── storage/                # 共有: kv / repo / SchemaDef 基盤 / 共有スキーマ
├── i18n/                   # 共有: 言語解決 + シェル所有キーの同梱カタログ + ゲームカタログの登録簿
└── ui/                     # 共有: コレクションホーム、設定 / About、共通コンポーネント
```

この配置への再編と収録ゲームの計画は
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) を参照。
各ゲームのルールは `docs/<GAME>_RULES.md`(ゲームごとに 1 本、コードは `§n` で節を引用する)を
唯一のソースとする。

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
- ゲームのホーム画面のサイトクローム `WebChromeSlot` は `GameHomeHeader` が置く(`ResultAdSlot` と同じ
  向き: ゲーム → `ui/components/`)。シェルは「ゲームの内部のどこがホームか」を
  知らないままでいられる — 知ろうとすると registry がゲーム内部のビューを
  列挙することになる([WEB_VERSION.md](WEB_VERSION.md)「サイトクローム」)。
- **ゲームホームのヘッダーは共有の `GameHomeHeader`**(`ui/components/GameHomeHeader.tsx`、
  2026-09-05)。中身は Web 版のサイトクローム(`WebChromeSlot`)、戻るボタン、その反対側の
  操作群 `GameHomeActions`(お気に入りの星 `FavoriteAction.tsx` issue #109 と、Android
  だけの「ホーム画面に追加」`HomeShortcutAction.tsx` issue #110。対応 Launcher でなければ
  描かない)。向きは `ShareAction` と同じ(ゲーム → `ui/components/`)で、ゲームが渡すのは
  `gameId` と戻る先だけ——どちらの操作がそのプラットフォームに存在するかはシェルの事情。
  30 ゲームが同じ 16 行を持っていた時代は、星も追加ボタンも 30 ファイルの掃討で載せて
  いた(#127・#132)。枠を 1 か所にしたのはそのためで、規則は「シェルの枠とゲームの中身」
  の節。操作群は 1 子要素にまとめてあるので、操作が 1 つでも 2 つでもヘッダーの形
  (2 子要素の space-between)は変わらない。**盤面と結果画面には置かない**: 固定は
  コレクションについての判断であって、勝った直後に求める種類のものではない
  ([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))。全ゲームのホームに 1 つずつ
  置かれていること・各タグが自分のゲーム id を名乗っていること・ホーム以外に無いこと・
  星や追加ボタンや操作群を単独で置いていないことは `src/test/homeActionsWiring.test.ts`
  が機械的に見る。
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
- **Shared(Private Game Club、issue #161)は `src/club/` 1 か所に置き、Core からは
  `src/app/` の動的 `import()` でしか届かない**(2026-09-09、issue #176。ディレクトリは
  まだ無い)。通信 API を書けるのはこのディレクトリだけで(`check-principles.sh` §1 の
  唯一の除外)、`club/` の外からの静的 import は `src/test/importBoundaries.test.ts` が
  禁じる。ゲーム・`ui/`・`services/`・`storage/` は `club/` を知らず、`club/` が
  ゲームへ触るのは registry 経由だけ(上の規則どおり)。チャンクは `game-<id>` と同じく
  独立させ、初期グラフに入らないことをサイズ Gate が見る(`club/` が生まれる PR の
  受け入れ条件)。**`backup/` とは切り離す** — 接続情報(member token)はバックアップに
  入れない(`sg.iap` と同じ理由)。境界の中身は
  [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「Shared」。

## 状態と ref

各ゲームの `GameContext.tsx` は状態を `useState` に持ち、render 本体で ref へ写す。**落とし穴は ref が進むのが render のときだけだという点**——同じタスクの中で 2 回ミューテーションが起きると、2 回目は 1 回目が置き換える前の値を読み、1 回目が消える(連続 pointer イベント、1 ハンドラが同じ状態を 2 回書く、の 2 パターンで実際に踏んだ)。規約は、セッション・統計・進捗は各コンテキストにつき 1 か所からしか書かないこと、その 1 か所で **setState より先に ref を進める**ことの 2 つで、`src/test/refLeading.test.ts` が機械的に見る。再生時間の `elapsedRef` / `bookedRef` は state の写しではない独立した ref なので**マウント時の種**が要り、**そのマウントが指しているスロット**(ショートカットが直接入った局か、ホームが最初に指す局)の `elapsedSeconds` を 2 本とも同じ値で積む——片方だけ直すと時計が 0 で上書きされるか統計へ二重計上される(issue #109・#113)。`src/test/playClockSeed.test.ts` が機械的に見る。

→ 全文: [architecture/state-and-refs.md](architecture/state-and-refs.md)

## ゲームレジストリの契約

`app/registry.ts` のエントリは「タイトルカード + そのゲームが持つキー + ゲーム本体のローダー」だけのプラグイン機構ではない薄い契約で、ゲームの追加は keys の import 1 行と配列要素 1 つで済む。ゲーム本体は静的 import せず `codeSplitting` でゲーム単位のチャンクに分かれる——例外は同期参照される import ゼロの葉 `storage/keys.ts` だけで、ここに import を足すとホームの初期チャンクへ引き戻される。`storageKeys` は「ローカルデータ削除」とバックアップがゲームのチャンクを読まずに列挙するためのもので、released 済みキーの一覧は `gameKeys.test.ts` のゴールデンとして固定され、**テストを直して通すのは禁止**(プレイヤーのデータに対する削除行為になるため)。`loadStorageSchemas` は**必須**のローダーで、Backup & Restore がそのゲームのレコードを持ち主の `SchemaDef` で検証するための唯一の口 —— 任意にすると、書き出せるのに復元できないゲームが黙って増える(issue #160)。Root が受け取る props は `GameRootProps` = `onExit` と任意の `entry`(どの扉から入ったか、issue #113)。`SettingsSection` は任意で、ゲーム固有の設定はゲームが所有しシェルは場所だけ貸す。

小見出し: 「ゲーム単位の lazy チャンク(issue #26)」

→ 全文: [architecture/registry.md](architecture/registry.md)

## コレクションホーム

収録数が増えても使えることが設計条件(`CollectionHomeScreen.tsx`)。**全ゲームはグリッド**(スマホ 2 列、広い画面で 3〜5 列)で、カテゴリ別セクションに分ける。**説明文はホームに置かない**——Quick Rules と Landing Page が担う。**「最近遊んだ」**(上限 2・0 件なら節ごと非表示・時刻や進捗を持たない)と**「お気に入り」**(留めた順・3 経路とも同じ `sg.favorites` を書く・お気に入りは最近遊んだから落とす)がグリッドの上に乗る。**「ホーム画面ショートカット」**(Android のみ。ショートカットからの起動だけは、中断中の局がちょうど 1 つのときに限りその盤面へ直接入る——判定はシェルではなく各ゲームが自分の保存領域だけを見て行い、`src/test/shortcutResumeWiring.test.ts` が機械的に見る。issue #113)、**「ホーム画面の Quick Actions」**(iOS のみ。お気に入りの先頭 4 本をアプリアイコン長押しのメニューに映す。項目は Android のショートカットと同じ `?game=<id>` の住所を運び、起動経路も同じ 1 本。issue #114)と**ゲーム名の検索**(常設の検索ボックスは置かない・一致は表示中タイトルへの部分一致のみ)も同じ画面の機能で、いずれも状態表示ではなく近道であることを繰り返し原則にする。

→ 全文: [architecture/collection-home.md](architecture/collection-home.md)

## ワイド画面のレイアウト

スマホ縦持ち(Compact)を基準に、CSS media query だけで Medium → Large → Wide へ段階的に広げる(端末名や User-Agent では判定しない)。**iOS の出荷バイナリは iPhone 専用**(`TARGETED_DEVICE_FAMILY = 1`)なので、ここで書くワイド段階が実際に効くのは Web 版と大きめの端末幅だけ。共通シェルが持つのは `--game-shell-max` だけで、盤面の寸法や横配置の形は各ゲームの CSS が自分のぶんだけ持つ——汎用レイアウトフレームワークは作らない。リサイズ・回転でゲーム Root を再マウントしない。キーボードは `ui/useGameKeys` を介した入力アダプターに過ぎず、画面に無い機能をキーボード専用にしない。Chromium 88 床(container query / `:has()` / subgrid 不可)はここにも適用する。

→ 全文: [architecture/wide-layout.md](architecture/wide-layout.md)

## タイトルごとのアクセント色

アクセントは `packages/brand` の `titleAccents` に 1 タイトル 1 エントリ(表は全文参照)。シェルはゲームのマウント時にルート要素へ `data-game="<id>"` を付け、`:root[data-game='…']` がアクセントトークンだけを差し替える。コレクションホームは全タイトルを同時に出すため、同じ上書きを `.accent-<id>` としても持ち、要素 1 つとその中だけに効かせる。**値は 1 か所にしか書かない**ので、ホームとゲーム内で色が食い違うことはない。**シリーズの下地(`seriesColors`)は変えない**——ゲーム側は `var(--accent)` を使うだけで、自分がどのタイトルとして塗られるかを知らない。

→ 全文: [architecture/title-accent.md](architecture/title-accent.md)

## CSS の分割

**ゲームの CSS はそのゲームが持つ**——`games/<id>/ui/<id>.css` を同じフォルダの Root が import し、ゲームを増やしても共有スタイルシートは伸びない。`ui/styles.css` に置くのはデザイントークンと共通クロムだけで、`games/A/` の CSS を `games/B/` が読むことはない。ゲームの CSS は色を書かず、共有のカスタムプロパティだけを使う——**例外はゲームの中身そのものが色である場合だけ**(Minesweeper の数字、Water Sort の 9 色、Reversi の盤など)で、クロムは 1 タイトル 1 色・盤面はそのゲームのもの、という線は破っていない。

→ 全文: [architecture/css-split.md](architecture/css-split.md)

## 広告と課金

広告は `services/ads/` のバナーのみ(Anchored Adaptive Banner)。AdMob 初期化は起動後の fire-and-forget で、UMP 同意はゲーム初期化と切り離し、オフライン時・購入済み時はリクエストしない。`BannerSlot` は高さ確保方式でレイアウトシフトを起こさない。**広告側が問うのは「この起動で広告削除が効くか」**(`isAdRemovalActive()`、購入状態が読めなかった起動も fail-closed で該当)であり、「購入したか」(`isAdRemovalPurchased()`)とは別の問いで設定画面だけが問う。`monetization/` は広告削除 IAP の基盤で、既定実装は「ストア未接続」。

→ 全文: [architecture/ads-and-billing.md](architecture/ads-and-billing.md)

## ストレージキーの規約

共有レコードは `sg.` 接頭辞、ゲーム固有レコードはゲームごとの 2 文字接頭辞(表は全文参照)。**`loadRecord` は throw しない**——壊れた JSON もストア自体の失敗もスキーマ既定値に倒す。**起動時の読み出しは 1 段ずつ独立して守る**(`app/boot.ts`。1 つの `try` を共有すると無関係なレコード 1 件の失敗が残り全部を巻き添えにする)。**`repo.ts` はキーごとに操作を直列化する**——書き込みは全レイヤーで fire-and-forget なので、順序を保証しないと「ローカルデータ削除」の最中に飛んでいた保存が後から着地してレコードが復活しうる(バックアップの復元も同じキューに載る。`loadRaw` / `saveRaw`)。中断スロットを 2 つ持つゲームでは、どちらのモードかを決めるのはキーであってレコード内の `mode` ではない。

→ 全文: [architecture/storage-keys.md](architecture/storage-keys.md)

## バックアップと復元

アカウント・クラウドセーブ・バックエンドを持たない以上、機種変更で進行が全部消える摩擦は**ユーザーが自分で運べる 1 ファイル**で引き受ける(issue #160、実装は `src/backup/`)。ファイルは `formatVersion` / `createdAt` / `appVersion` / `platform` / `data`(ストレージキー → パース済み JSON)の JSON で、**`appVersion` と `platform` は参考情報にすぎず復元可否を決めない** —— Android ↔ iOS ↔ Web を同じファイルで往復できることが目的である。運ぶ対象はレジストリの `storageKeys` とシェルの `sg.settings` / `sg.favorites` / `sg.recent`。**`sg.iap` は絶対に入れない**(ファイルはコピーできるので、入れた時点で「コピーできる買い切り」になる。docs/ADS_POLICY.md)。**レコードの検証はバックアップ層ではなく各レコードの `SchemaDef` が行い**、到達経路は必須フィールド `GameDefinition.loadStorageSchemas` —— 入れ忘れがコンパイルエラーになる。復元は `readBackup`(何も書かない・全件検証)と `applyBackup`(検証済みのものしか受け取れない)に分かれ、snapshot → 書き込み → **読み直して照合** → 不一致なら rollback。ファイルに無いキーは消す(**merge は作らない**)。未知キーと新しい `formatVersion` は黙って捨てず拒否する。Export / Restore に通信は無い。

→ 全文: [architecture/backup.md](architecture/backup.md)

## i18n

カタログは全言語をアプリに同梱する(オフライン要件)。**キーの置き場所はキーの所有者で分かれる**——複数レイヤーやシェルだけが使うキーは `src/i18n/locales/*.ts`、1 本のゲームだけが使うキーはそのゲームの `src/games/<id>/i18n/*.ts` に移してゲームのチャンクへ同梱する。ゲーム側の解決は型とランタイムの二重の仕組み(`declare module` で `GameMessages` へマージしつつ `registerGameMessages` を呼ぶ)で、配線は `gameI18nWiring.test.ts` が静的に強制する。解決順は「シェルのそのロケール → シェルの英語 → ロード済みゲームのカタログ → キー自身」。地域バリアントは `matchLocale` で親言語へ落ちるが、書記体系で割れる言語(zh-TW/HK/Hant と zh/CN/SG、pt-PT → pt-br)は専用テーブルで先に解決する。

→ 全文: [architecture/i18n.md](architecture/i18n.md)

## 電池(低消費電力)

- プレイ中の定期ポーリングなし。バックグラウンド処理なし。常時接続なし。
- オフライン時は広告取得をリトライしない。
- 画面外のゲームはアンマウントする(描画しない)。**アンマウントされたゲームは
  タイマー・RAF・リスナー・音声を一切残さない** — 契約とテストは
  [GAME_LIFECYCLE.md](GAME_LIFECYCLE.md)。
- 保存はイベント駆動(可視性変化 / pause / 状態遷移時)。
- プレイ時計は ref 加算のみで、再レンダリングを起こさない。

## Web / Android / iOS

Vite で静的 Web アプリとしてビルドし、Capacitor で Android / iOS アプリ化する(SSR 不要のため Next.js は使用しない)。**プラットフォーム差分は 3 箇所に限定する**: 広告 ID・ストアの可用性判定・ホーム画面ショートカット(Android の Pinned Shortcut と iOS の Quick Actions は同じ `services/homeShortcut/` に住む)。いずれも実行時に `Capacitor.getPlatform()` で選び、ゲーム・保存・i18n のコードに `if (ios)` を書かない。**ハードウェア戻るボタン**: ゲーム内ホーム→コレクションへ、コレクション→アプリ最小化。持ち主は常に 1 つ——ゲームが載っている間はそのゲームの `GameContext`(自分の画面→ホーム→コレクション)、チャンクの読み込み中と読み込み失敗の画面は `ui/useHardwareBackExit`、設定画面はシェル(`App.tsx`)、それ以外はコレクションホーム(レビューの質問 → タイルシート → 検索 → 最小化の順に、上に載っているものから閉じる)。レビューの質問はシェルがコレクションの上に描くが、持ち主を 2 つにはできないので、シェルは「閉じ方」だけをコレクションへ渡す——渡さないと Back が質問を残したままアプリを最小化する(issue #173、[REVIEW_PROMPT_POLICY.md](REVIEW_PROMPT_POLICY.md))。Capacitor の `backButton` は登録された全リスナーに届くので、2 つ目の持ち主は「閉じた画面の下でアプリが最小化する」事故になる。ゲーム側の配線(native ガード付きで 1 回だけ登録し、ホームでは `exitToCollection`)は `src/test/gameBackButtonWiring.test.ts` が、シェル側の受け渡しは `src/app/App.load.test.tsx` が固定する(issue #120)。初回チュートリアル(Quick Rules)から Back で抜けたときは `completeTutorial()` を呼んで「見た」扱いにする——呼ばないと `tutorialCompleted` が偽のまま残り、閉じるボタンは完了後にしか出ないので、そのゲームは開くたびにチュートリアルから始まる。「初回体験の原則」(`PRODUCT_PRINCIPLES.md`)が求めるのは 3 ステップ以内で説明してすぐ始めることであり、毎回出すことではない。全ゲームの挙動は `src/test/tutorialBackWiring.test.tsx` が固定する(issue #142)。`android:enableOnBackInvokedCallback="false"` は削除しない——targetSdk 36 の予測型戻るが既定で有効になると `@capacitor/app` の `backButton` イベントが一切発火しなくなる実機バグを回避するためで、外すとハードウェア戻るがアプリ全体で無反応になる。

→ 全文: [architecture/platforms.md](architecture/platforms.md)

## 静的 Web 版

**`https://pixapps.ai/simple-games/play/` で実装・公開済み。** 詳細・広告・計測・保存の版差分は [WEB_VERSION.md](WEB_VERSION.md) を正本とし、ここには変わらないレイヤー上の前提だけを残す。`games/*/game/` が Pure TypeScript で ESLint が依存ゼロを機械的に禁止していることが、Web 版を静的構成のまま出せる根拠。**住所はクエリパラメータ 1 本**(`?game=<game-id>`)で、`Capacitor.isNativePlatform()` のガードで native では動かない。ホスティングは Cloudflare Pages で、GitHub Pages でも配信できる**純静的構成**を維持する(Functions / Workers / D1 / 認証 / サーバー側生成は使わない)。**未実装(今後)**: 再訪時のオフライン動作(PWA / Service Worker)。

→ 全文: [architecture/static-web.md](architecture/static-web.md)

## シェルの枠とゲームの中身

「共通のゲームフレームワークは作らない」は変わらない。変わったのは、その規則が
**枠**まで禁じているわけではないと 2026-09-05 に線を引いたことである。

- **枠はシェルが持つ。** コレクションの都合で全ゲームに同じ形で存在するもの
  ——ホームのヘッダー(`GameHomeHeader`)、広告枠(`BannerSlot` / `ResultAdSlot`)、
  共有ボタン(`ShareAction`)、記録の読み込み(`ui/useLoadedRecords.ts`)——は
  `ui/` の 1 か所にあり、ゲームはそれを置いて自分の id を名乗るだけ。
- **中身はゲームが持つ。** ヒーロー(グリフ・タイトル・タグライン)、モードのボタン、
  盤面、結果画面の事実、統計の形。ここは同じ形にしない。30 本のうち 11 本のヒーローが
  独自の描き方をしているのは意図で、タイトルごとの個性はここにある
  (「タイトルごとのアクセント色」)。
- **枠へ引き上げてよい条件は 3 つ。** (1) 全ゲームで id を除いて byte 単位で同一である
  ことを実測した(ハッシュで数える。「だいたい同じ」は不可)。(2) 引き上げた後の DOM が
  1 文字も変わらない(見た目・フォーカス順・既存テストが揺れない)。(3) children で
  合成する。設定オブジェクトや分岐 prop は取らない——例外が欲しいゲームは枠の後ろに
  自分で並べる。props が増え始めたら、それはフレームワークになりかけている合図。
- 実測の記録(2026-09-05): ホームのヘッダー 30/30 同一 → `GameHomeHeader`。ヒーローは
  12 本と 7 本の 2 群に残り 11 本が独自 → ゲームに残す。結果画面の外枠は 6/30 しか
  同一でない → 引き上げない。Root の読み込み effect 30/30 同一(読む記録の一覧だけ
  違う)→ `useLoadedRecords`。
- **モーダルの間、盤面は inert。** 確認ダイアログ(`ConfirmDialog`)と結果オーバーレイが出ている間、
  `.game-content` は `inert` にする——`open` のフラグを inert 式に含める(`inert={finished ||
  confirmRestart}`)。背景の `.overlay` はポインタを遮るがフォーカスは遮らず、`useGameKeys` の
  `enabled` も window のキーリスナーを外すだけなので、これが無いと自動フォーカスされた Cancel から
  Shift+Tab → Space で裏の手が進む。実測(2026-09-05): 確認ダイアログを持つ 25 本のうち inert 式に
  そのフラグを含めていたのは 7 本 → `scripts/codemods/2026-09-05-inert-during-confirm-dialog.mjs` で
  揃え、`src/test/modalIsolationWiring.test.ts` が新しいゲームにも同じ配線を要求する(issue #120)。
  Chromium 102 未満の WebView 向けフォールバックは `styles.css` の `.game-content[inert]`
  (`pointer-events: none`)。
- **指を取り上げられたときの契約。** `pointercancel` は「この指の `pointerup` はもう来ない」
  という OS からの通告(通知シェードが降りる・着信・パーム・ペンの離脱・ブラウザが自分の
  ものにしたスクロール)で、これを聞かない盤面は押下が確保したもの——持ち上げた札・仕掛けた
  タイマー・上げたガード——を持ち越す。規約は 2 つ。**離す(`onPointerUp`)を聞く要素は、
  同じ要素で `onPointerCancel` も聞く**こと(Block Puzzle のようにトレイで指を取り、
  本体で離す形があるので、ファイル単位ではなく要素単位)。**押下を聞く要素がクリックも聞く
  なら、ドラッグが残すクリックは使い切る**こと(ドラッグの後にも `click` は届く)。cancel が
  何を意味するか——札を戻す・撃たない・ピースをトレイへ返す——はゲームごとに違うので、
  共通のポインタ処理は作らない。`src/test/pointerContractWiring.test.ts` は配線と「各ゲームの
  自前テストが `pointercancel` と trailing click を流していること」だけを要求し、意味の証明は
  各ゲームのテストに残す(`modalIsolationWiring.test.ts` と同じ形)。押下が何も抱えない 3 本
  (2048 / Bunny Hop / Sliding Puzzle——押下は開始点を置くだけで、スワイプは離したときに
  決まる)は理由を書いてゲート内の一覧で除外し、その 1 本が指を追い始めたら(`onPointerMove`・
  `setPointerCapture`)除外が古くなったこと自体で赤になる(issue #169)。
- **全ゲームに同じ変更を入れるときは codemod で入れる**(`scripts/codemods/`)。手で
  30 ファイルを編集しない: 変換スクリプトを 1 本書き、掛け、触ったファイルだけ
  prettier を通し、`src/test/` の横断ゲートで受ける。スクリプトは PR に同梱する。
  レビューは 30 個の差分ではなく 1 本のスクリプトを読めばよい。
- **新しいゲームの接続点は `scripts/new-game.mjs` が生成する**(keys の葉、i18n の
  14 言語、registry の項目、`gameKeys.test.ts` の項目、共有の枠を置いた Root と
  ホームの雛形、RULES 文書の雛形)。隣のゲームを丸ごと複製して名前を直す作業は
  もう始めない。
- 検証は `pnpm verify:changed`(差分に関係するテスト+fs を読む横断ゲート)で回し、
  CI がフルを回す(「CI / リリース」)。

## 将来の共通化

設定 / ストレージ基盤 / 広告 / i18n はアプリ内のシェルとして共有しており、
これ以上の共通化(`packages/` への抽出)は実際に重複が確認されてから行う。
ゲーム固有の概念(盤面・ルール・Hint 等)は共通パッケージへ入れない。
シェルの枠についての線引きは「シェルの枠とゲームの中身」の節。

`games/*/game/rng.ts` は**共通化しないと決めた**(2026-09-05。
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) §6 の
未決事項を閉じる)。理由は実測で、ファイル頭のコメントは「同じ 20 行のコピー」と言うが、
コメントを剥がしてハッシュを取ると 30 本に 19 種類の実装があり、公開する関数も
`createRng` だけ / `shuffled` 付き / `hashSeed` 付き / `randomSeed` 付きの 4 系統に
分かれている。統一すれば乱数列が変わりうるし、乱数列はレベルの盤面とデイリーの盤面
——つまり既存プレイヤーの手元にある記録——そのものである。一度も編集されない
1,400 行のために負うリスクではない。コピーが正。新しいゲームも隣からコピーしてよい。

カードゲーム 3 本の Drag-to-move(issue #116 → #119)も**共通化しないと決めた**
(2026-09-05)。実測: コメントを剥がすと Solitaire / Spider / FreeCell の `*Table.tsx` は
563〜681 行のうち 403 行が 3 本で同一、ポインタ処理(`onCardPointerDown` から `onTap`
まで)は 150〜152 行のうち 142 行が同一で、重複は本物である。それでも引き上げないのは、
同一でない残りがそのゲームの型そのもの——何を持ち上げられるか(`DragSource`)、
どこへ置けるか(`DropTarget`)、盤面の実測(`readLayout`)——であり、共通化すると
「運ぶ札を集める関数・置き先を測る関数・当たり判定」を引数に取るフックになるからで、
それは「シェルの枠とゲームの中身」の条件 (3)(children で合成し、設定オブジェクトを
取らない)に反する。ポインタ処理の直しは Solitaire で直してから 2 本へ移植する。

## CI / リリース

- `ci.yml`: push / PR で install → lint → typecheck → test → build(全ワークスペース)。
  対象が増えたら turbo の `--filter` で影響範囲のみに絞る。両ビルドの後に
  広告分離(`check-dist-ads-separation.sh`)とサイズ Gate
  (`pnpm --filter simple-games size:check` — ゲーム別予算・エントリ成長・
  初期グラフへのゲームチャンク混入)を検証する。
- **テストの門は壁時計で判定しない**(issue #158)。`pnpm test` は 337 ファイルを
  CPU 数ぶん並列に走らせるので、同じ仕事でも壁時計は run ごとに数倍〜数十倍ぶれる
  ([SUDOKU_RULES.md](SUDOKU_RULES.md) §7 の実測)。稀に落ちる門は信頼されない門であり、
  赤を「たぶん負荷」と読む運用が本物の退行を隠す。だから、
  - 生成・探索のコストは**仕事量**(探索した配置数・ノード数・試行回数)で門にし、
    ミリ秒は出力するだけで判定に使わない(Sudoku / Minesweeper / Nonogram /
    Kakuro / Futoshiki / Takuzu / Water Sort の生成、Checkers / Gomoku / Connect Four
    の CPU 探索)。
  - 製品コードの実タイマー(CPU の返し手 `CPU_DELAY_MS`、読み込み画面の 200ms 門)を
    待つテストは fake timers で時計を進める。`waitFor` / `findBy` の既定 1000ms を
    製品タイマーの待ちに使わない — 半分は待つ前に消えている。
  - Canvas ループは dev シーム(`__buFrame` 等)から手で回し、`stubAnimationFrames()`
    (`src/test/lifecycle.ts`)で jsdom の実 RAF を止めて、ループの時計を 1 本にする
    (実 RAF と手回しが同じ `lastTime` を共有すると dt が負になる)。
  - Suspense の reveal は `act` で settle して同期に読む。`findBy` は act 環境を切って
    ポーリングするので、react-dom の fallback throttle(実時間 300ms)をまるごと
    待つことになる。
  - vitest の per-test timeout(5 秒)は性能ゲートではない。timeout を上げるのは
    修正ではなく、1 秒級の決定的な仕事は `beforeAll` で 1 回だけ回して各 case に
    読ませるか、独立な seed ごとに `it.each` で分ける。
  - test globals は無効なので、`render` するファイルは自分で `cleanup()` を呼ぶ。

  実施記録(候補一覧・再現条件・原因)は
  [plans/2026-09-08-flaky-tests.md](plans/2026-09-08-flaky-tests.md)。
- `android-release.yml`: 手動実行(workflow_dispatch)または `v*` タグでのみ実行し、
  署名済み AAB(Play 用)と署名済み APK(実機確認用)をアーティファクトとして出す。
  `versionName` / `versionCode` はタグが決める。ストアへのアップロードは手動。
  タグに製品名を付けないのは、リリース対象がこのアプリ 1 つだけだから
  (収録ゲームはすべて 1 アプリ。`packages/` はリリース対象ではない)。
- Secrets は `ADMOB_ANDROID_APP_ID` / `ADMOB_ANDROID_BANNER_ID` のみ
  (インタースティシャル系は無い。プラットフォーム名を含むのは AdMob ID が
  OS ごとに別なため — iOS 版では `ADMOB_IOS_*` が並ぶ)。
  本番 ID・署名鍵はリポジトリにコミットしない。
