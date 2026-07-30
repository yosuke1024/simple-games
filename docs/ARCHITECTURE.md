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
├── games/
│   ├── number-match/       # game/ state/ storage/ ui/(自己完結)
│   └── sudoku/             # 第2弾。同じ構成(実装予定)
├── monetization/           # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
├── services/               # 共有: ads(バナーのみ) / network / sound / haptics
├── state/                  # 共有: SettingsContext
├── storage/                # 共有: kv / repo / SchemaDef 基盤 / 共有スキーマ
├── i18n/                   # 共有: 言語解決 + 言語ごとの同梱カタログ
└── ui/                     # 共有: コレクションホーム、設定 / About、共通コンポーネント
```

この配置への再編と Sudoku 収録の計画は
[plans/2026-07-30-collection-and-sudoku.md](plans/2026-07-30-collection-and-sudoku.md) を参照。
Sudoku のルールは `SUDOKU_RULES.md`(新設予定)を唯一のソースとする。

レイヤー規則:

- `games/*/game/` は Pure TypeScript。他のどのレイヤーも import しない
  (テスト容易性と移植性のため)。
- `games/A/` から `games/B/` への import は禁止。ゲーム同士は互いを知らない。
- シェルはゲームの内部実装に触らない(ゲームは自身のルートコンポーネントだけを公開する)。
  ゲームレジストリは `{ id, titleKey, Icon, accent, Root }` 程度の薄い契約のみ。
- `services/` の失敗はゲーム進行に影響させない(OFFLINE_POLICY.md 参照)。
- ゲーム説明は二層化する: アプリ内はチュートリアル = Quick Rules(最大3ステップ)
  のみ。詳細ルール・FAQ・攻略はゲーム別 Landing Page
  (`LANDING_BASE_URL`(`packages/brand`)+ `/games/<game-id>/<locale>/`)へ分離する。
  チュートリアルの「Learn More / 詳しく見る」がそこへ遷移し、オフライン時は
  静かに何もしない(ゲームを止めない)。Landing Page 本体は別リポジトリで未構築。
- Analytics / Remote Config / トラッキングのサービスは**存在しない**
  (初期リリースで削除済み。公開コードに追跡コードが無いことが透明性の証明)。

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
| `nm.*` | Number Match(saveGame / saveDaily / stats / progress / flags) |
| `sd.*` | Sudoku(同型。実装時に定義) |

- 共有レコードは `sg.` 接頭辞。ゲーム固有レコードはゲームごとの接頭辞。
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
- 解決順: アプリ内の明示選択 → 端末の優先言語リストを順に走査(Android の
  アプリ別言語設定はここに現れる)→ 英語。初回起動時の言語選択画面はない。
- 地域バリアントは `matchLocale` で親言語へフォールバックする(en-IN → en、
  レガシー `in` → id)。zh のスクリプト解決は中国語対応時に追加。
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

## CI / リリース

- `ci.yml`: push / PR で install → lint → typecheck → test → build(全ワークスペース)。
  対象が増えたら turbo の `--filter` で影響範囲のみに絞る。
- `android-release.yml`: 手動実行(workflow_dispatch)または
  `simple-games-v*` タグでのみ実行し、未署名のリリース APK をアーティファクトとして出す。
  ストアへのアップロードは手動。
- Secrets は `ADMOB_APP_ID` / `ADMOB_BANNER_ID` のみ(インタースティシャル系は無い)。
  本番 ID・署名鍵はリポジトリにコミットしない。
