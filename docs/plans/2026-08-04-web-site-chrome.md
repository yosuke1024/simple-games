# 計画: Web 版サイトクローム(グローバルヘッダー)

2026-08-04 作成。実装前の合意済み計画。実装 PR にこのファイルを含める
(契約が先、コードが後)。

## 0. 決定事項(ユーザーと合意済み — 再議論しない)

- **対象は Web 版のみ。** native ビルドには 1 バイトも入れない(成果物検査で証明)。
- **出す画面(12)**: コレクションホーム / 設定 / **10 ゲームすべてのホーム**(一括実施)。
- **出さない画面**: 盤面(プレイ中)・リザルト・`GameLoadingFallback`。
- **配置はインフロー**(スクロール面の先頭に置き、スクロールで流れて消える)。
  landing の fixed 64px 常時表示にはしない — 専有コストゼロ、「静か」優先。
- **判断軸(記録として)**: スクロールする画面はヘッダー可、固定ビューポートの
  盤面は不可。盤面では 64px + アンカー退避 116px で盤そのものが縮むが、
  ホーム系ではコストが「スクロール 1 画面ぶん」に変わるため。
- **i18n キーは 1 つも足さない。** ヘッダー文言はサイト(landing)の持ち物で
  ja/en のみ。14 ロケール画面に英語ヘッダーが載る割り切りは合意済み。
  高リスクキーの門(i18n:gate)に一切触れない構成にする。

## 1. 前提の事実(2026-08-04 調査。実装前に再確認するものは §5)

- **ベース**: `restore/lazy-chunks-and-gates` は origin/main(72ae5a0)に無い
  コミット(#31 per-game lazy chunks / #32 import boundary gates)を持つ。
  **実装はこのブランチ(またはそれが main に入った後の main)を親にする。**
  origin/main 直はダメ — lazy チャンク以前の registry と衝突する。
- ヘッダー資産は landing リポジトリの `/global-header.js` + `/global-header.css`。
  play/ は pixapps.ai の同一オリジン配下なので実行時に参照できる。CSP なし。
- **`global-header.css` は `body { padding-top: 64px !important }` を全ブレーク
  ポイントで課す**(fixed ヘッダーの補償)。`.global-header-container` は
  `position: fixed; height: 64px; z-index: 10000`。→ SPA 側で中和必須(§2.3)。
- 768px 以下で `#navbar, .site-header, nav[data-context-navigation]` を
  `display: none !important` にする規則あり。SPA は該当セレクタを使っていないので
  無害(実装時に grep で再確認)。
- ヘッダーは初期化時に page-lifetime のリスナー約 29 個を張る(クリック・hover 等)。
  ゲームのマウント毎には何も張らない設計にする(§2.4)ので lifecycle 掃引に影響しない。
- `trackClick` は `window.gtag` があるときだけ送る。**`services/analytics/web` は
  実装済み**(`VITE_GA_MEASUREMENT_ID` 注入時のみ、web モードのみ)なので、計測が
  本番有効化されればヘッダーのクリックは自動で `navigation_click` として計測される。
  追加実装不要。
- 言語スイッチャーは `getSupportedLocales().length` に依存(単一ロケールなら
  出ない — jurypress の `['en']` が前例)。
- ページ設定は `<script id="pixapps-page-config" type="application/json">` を
  DOM から読む。**web ブートが動的に生成すれば index.html(native と共用の 1 枚)を
  汚さない。**
- ヘッダーのマウント先は `<div id="global-header">`(landing 各ページが持つ)。
- games/*/ui からの共有 UI import は既存合法パターン(ResultAdSlot が 8 ゲームで
  実績。importBoundaries.test.ts が許す向き)。
- **ゲームに独立した Home ファイルは無い** — 各ゲームは `<Game>Root.tsx` 1 枚が
  内部ビュー(ホーム/盤面)を持つ。設置は各 Root の「ホームを描画している部分」
  (Root 直下か、Root が描く home コンポーネント)に入れる。
- `WebAdSlot.tsx` が web 専用コンポーネントの型:
  `import.meta.env.MODE === 'web' ? lazy(() => import(...)) : null` — native ビルド
  では式が定数畳み込みで null になり、動的 import ごとバンドルから消える。
  WebChromeSlot はこれを踏襲する。
- `main.tsx` の web ゲート: `if (import.meta.env.MODE === 'web' && …)` で
  `services/ads/web/boot` と `services/analytics/web` を fire-and-forget 起動
  済み。3 つ目として chrome を並べる。ネットワーク状態はこの時点で解決済み。
- `check-dist-ads-separation.sh` は ads(`adsbygoogle|googlesyndication|ca-pub-`)と
  analytics(pattern + measurement ID)を native 不在 / web 存在で検査済み。
  chrome マーカーを 3 例目として足す。

## 2. 変更内容

### 2.1 ドキュメント(同一 PR、コードより先にコミット)

- `docs/WEB_VERSION.md`: 新節「**サイトクローム(グローバルヘッダー)**」。
  内容: 目的(位置づけ「PixApps への入口」の実装)/ 対象 12 画面と対象外
  (盤面・リザルト)/ 判断軸(スクロール画面のみ)/ インフロー配置 /
  オフライン時はロードせずリトライなし・失敗してもゲームを止めない /
  ヘッダーは ja/en のみで app の 14 ロケールと独立(割り切りの明記)/
  native 不在は成果物検査で証明 / 計測導入後は navigation_click が自動計測される旨。
- `docs/WEB_VERSION.md`「実装上の約束」: 「Web 広告はここだけが例外」の一文を
  「Web 広告・計測・サイトクロームの 3 つが `--mode web` の例外」へ改定
  (計測実装が入った時点で既に 2 つになっているはず — 現文面を見て直す)。
- `docs/ARCHITECTURE.md` レイヤー規則: 1 行追加 —
  「ゲームのホームビューは共有 `WebChromeSlot` を置いてよい(ResultAdSlot と
  同じ向き。シェルはゲーム内部のどこがホームかを知らないままでいる)」。

### 2.2 `services/chrome/web/boot.ts`(新規 — ads/web/boot.ts と同型)

`initWebChrome()`:

1. `isOnline()` でなければ何もしない(このページロード中はリトライしない —
   OFFLINE_POLICY と同じ。次のロードで再試行)。
2. `requestIdleCallback`(なければ `setTimeout` 0)で**初回描画後**に実行:
   - `document.documentElement.lang` を読む(アプリがロケール解決後に書き換える
     値)。`ja` 始まりなら `['ja']`、それ以外は `['en']` — **単一ロケール構成で
     言語スイッチャーを構造的に出さない**。
   - `<script id="pixapps-page-config" type="application/json">` を動的生成
     (`pageId: 'simple-games-play'`、上記 supportedLocales)。
   - `<div id="global-header" hidden>` を body 直下に作成(パーキング位置)。
   - `<link rel="stylesheet" href="/global-header.css">` と
     `<script src="/global-header.js" defer>` を注入。
3. あらゆる失敗は握りつぶす(ログのみ)。ヘッダーが出ないだけで、ゲームは
   一切影響を受けない。

`main.tsx`: 既存 web ゲート群の隣に
`if (import.meta.env.MODE === 'web') { void import('./services/chrome/web/boot').then(m => m.initWebChrome()).catch(() => undefined); }`。

タイミング注: idle まで遅らせるのは (a) アプリのロケール解決(SettingsContext が
`documentElement.lang` を書く)より後に読むため、(b) 初回描画をブロックしない
ため。代替案(設定ストレージを boot が直接読む)は結合が増えるので採らない。

### 2.3 `ui/components/WebChromeSlot.tsx`(新規 — WebAdSlot と同型)+ CSS 中和

- native(= `import.meta.env.MODE !== 'web'`)では定数畳み込みで **null**。
  web でもホスト `#global-header` が未生成(オフライン等)なら null。
  **空隙・プレースホルダを作らない**(インフローなので予約も不要)。
- web でマウント時: `#global-header` ホスト div を**自分の中へ移動(adopt)**し
  hidden を外す。アンマウント時: body 直下へ**戻して(park)** hidden にする。
  スクリプトは再実行しない(リスナーは要素に付いたまま生きる)。
  スロット自身はリスナー・タイマー・RAF を一切持たない(lifecycle 契約)。
- **CSS 中和**(`ui/styles.css` に追記。native では対象要素が無く無害):
  - `html body { padding-top: 0 !important; }` — global-header.css の
    `body { padding-top: 64px !important }` に**詳細度で勝つ**(0,0,2 > 0,0,1)。
  - `.sg-web-chrome .global-header-container { position: relative; }` —
    fixed を外す。**static ではなく relative**(ドロップダウンの absolute 子が
    コンテナ基準を失わないため)。z-index 10000 はインフローでは無害なので触らない。
  - スロットのラッパ: `<div className="sg-web-chrome">`。

### 2.4 設置(12 箇所)

規則: **「コレクションへ戻る出口を持つ画面の、スクロールコンテナ最上部」**
(セーフエリアのパディングの内側に置く)。

- シェル: `ui/screens/CollectionHomeScreen.tsx` / `ui/screens/SettingsScreen.tsx`。
- 10 ゲーム(各 Root が描くホームビューの先頭。Root 内のどの部分がホームかは
  ゲームごとに読む):
  `games/sudoku/ui/SudokuRoot.tsx` / `games/solitaire/ui/SolitaireRoot.tsx` /
  `games/minesweeper/ui/MinesweeperRoot.tsx` /
  `games/brick-breaker/ui/BrickBreakerRoot.tsx` /
  `games/nonogram/ui/NonogramRoot.tsx` /
  `games/number-match/ui/NumberMatchRoot.tsx` /
  `games/water-sort/ui/WaterSortRoot.tsx` /
  `games/sliding-puzzle/ui/SlidingPuzzleRoot.tsx` /
  `games/memory-match/ui/MemoryMatchRoot.tsx` /
  `games/sky-fighter/ui/SkyFighterRoot.tsx`。
- ホームと盤面が同一コンポーネント内で条件分岐しているゲームでは、**ホーム分岐の
  中だけ**に置く(盤面分岐に置かない)。途中保存から盤面へ直接復帰するゲームでは
  ヘッダーはホームへ戻るまで見えない — それで正しい(仕様)。

### 2.5 ガードとテスト

- `check-dist-ads-separation.sh`: `chrome_pattern='global-header'` を追加。
  native dist に**不在** / web dist に**存在**の両検査(ads・analytics と同列)。
  スクリプト冒頭コメントに ads + analytics + chrome の 3 つを見る旨を明記
  (ファイル名はリネームしない — CI 参照を壊さない)。
- `ui/components/WebChromeSlot.test.tsx`: WebAdSlot.test.tsx の手法を踏襲
  (MODE の扱いも同じく)。native → null / web → adopt と park(マウントで
  ホストが取り込まれ、アンマウントで body へ戻り hidden に戻る)。
- `CollectionHomeScreen.test.tsx` / `SettingsScreen.test.tsx`: プラットフォーム差
  の固定に「native ではクロームが無い」を 1 項目追加(既存の出し分けテストの形)。
- 既存の Root テスト・leak テスト・`lifecycle.test.tsx`: 変更不要で緑のまま
  (jsdom は native モード → スロットは null)。**緑であることが per-mount
  リソースゼロの証明を兼ねる。**
- `size:check`: entry と各ゲームチャンクにスロット参照ぶんの微増 →
  `size-baseline.json` 更新。**PR に増加理由を明記**(黙って上げない)。
- `check-principles.sh`: 変更不要のはず(fetch 等を使わない。script/link 注入は
  網羅対象外)。走らせて確認だけする。

### 2.6 landing 側

- **変更なしの見込み。** 資産(`/global-header.js` / `/global-header.css`)は
  配信済み・同一オリジン。ナビの Simple Games は既に "Live"(PR #85)。
- `tests/ui.test.js` の play ビルド検査は gtag マーカーのみ見る — global-header
  参照が web ビルドに入っても落ちない(実装後の sync で確認)。
- 公開(sync:simple-games + commit)は**別 PR・人間の判断**。この PR では
  simple-games リポジトリのみ変更する。

## 3. 実装順(1 PR)

1. ブランチ: `restore/lazy-chunks-and-gates` から(または main 合流後の main から)。
2. §2.1 ドキュメント。
3. §2.2 boot + main.tsx ゲート。
4. §2.3 スロット + CSS 中和 → **この時点で一度動作確認**(§5 の実測項目)。
5. §2.4 シェル 2 画面 → 10 ゲーム(機械的設置。1 ゲームずつ、ホーム分岐の位置を
   読んでから)。
6. §2.5 テスト・ガード・size baseline。
7. 検証: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` +
   `pnpm --filter simple-games build:web` + `size:check` +
   `bash .github/scripts/check-principles.sh` +
   `bash .github/scripts/check-dist-ads-separation.sh`(両ビルド後)。
8. ブラウザ実機確認(preview `simple-games-web`): コレクション / 設定 /
   ゲームホーム 2 つ以上 / 盤面 2 つ以上(**出ないこと**)/ モバイル幅・
   デスクトップ幅 / ダーク・ライト / DevTools オフラインで空隙なし /
   ドロップダウン開閉 / ホーム→盤面→ホームの往復で adopt/park が壊れないこと。
9. `services/` を触る高リスク変更 → **push 前に Codex レビュー**(PR で
   `@codex review`、観点付き)。

## 4. やらないこと(スコープ外)

- fixed 常時表示・デスクトップだけ常時表示(必要になったら別途)。
- ディープリンク / hash ナビ(M4)・計測の有効化(別マイルストーン)。
- ヘッダーの多言語化(サイトが ja/en である事実は landing 側の課題)。
- native への変更・landing のヘッダー実装の改造。SPA 側 override が §5 の実測で
  破綻した場合に限り、landing に「inflow モード」を足す案へ切り替える
  (その場合は landing 側 PR が追加で必要 — 判断は実装時にユーザーへ)。

## 5. 実装時に実測で確認すること(未確定)

1. CSS 中和が全ブレークポイント(485 / 546 / 561 行付近の 3 つの media query)で
   効くこと。`body.has-context-nav` 経路に入らないこと(SPA に該当セレクタが
   無いことを grep で確認)。
2. ドロップダウンが relative コンテナで正しく開閉すること。
3. ヘッダー初期化(idle)時点で `documentElement.lang` がアプリ解決済みで
   あること(タイミング競合があれば MutationObserver ではなく再試行 1 回で対処)。
4. adopt/park の往復でドロップダウン開閉状態・リスナーが壊れないこと
   (park 前に開いたメニューは閉じる)。
5. `#global-header` の id がスクリプトの期待と一致すること(landing の実 HTML と
   突き合わせ)。
6. importBoundaries.test.ts が games → ui/components を許すこと
   (ResultAdSlot の既存実績で担保されているはずだが、緑を確認)。
