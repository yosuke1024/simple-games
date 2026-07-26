# Simple Games — アーキテクチャ

## モノレポ

```text
simple-games/
├── apps/                  # 各ゲーム。独立したスマートフォンアプリ
│   └── number-match/
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
- 各アプリは package name / アイコン / バージョン / Firebase App / AdMob App ID /
  リリースワークフローを個別に持つ。共通パッケージの変更で全アプリを自動リリースしない。

## アプリ内レイヤー(apps/number-match)

```text
src/
├── game/       # Pure TypeScript ゲームロジック。UI/広告/Firebase/Capacitor に依存しない
├── state/      # React 状態管理(ゲームセッション、設定、統計)。game と storage を束ねる
├── storage/    # 端末内保存(KV 抽象 + schemaVersion 付きスキーマ + マイグレーション)
├── services/   # 副作用系: ads / remoteConfig / analytics / network / sound / haptics
├── i18n/       # 5 言語辞書と言語解決(同梱、外部取得なし)
└── ui/         # 画面とコンポーネント
```

レイヤー規則:

- `game/` は他のどのレイヤーも import しない(テスト容易性と移植性のため)。
- `services/` の失敗はゲーム進行に影響させない(OFFLINE_POLICY.md 参照)。
- 広告の頻度制御(`interstitialPolicy`)は純関数として `services/ads/` に置き、単体テストする。

## Web / Android

- Vite で静的 Web アプリとしてビルドし、Capacitor で Android アプリ化する。
  SSR / API Routes は不要のため Next.js は使用しない。
- `android/` は Capacitor が生成したネイティブプロジェクトをコミットする
  (ビルド成果物・local.properties は除外)。

## 将来の共通化

第 2 弾で実際に重複が確認された場合のみ、`packages/` へ抽出する
(候補: game-shell / ads / storage / i18n / theme / settings 画面など)。
Number Match 固有の概念(盤面・ルール・Hint 等)は共通パッケージへ入れない。

## CI / リリース

- `ci.yml`: push / PR で install → lint → typecheck → test → build(全ワークスペース)。
  アプリが増えたら turbo の `--filter` で影響範囲のみに絞る。
- `number-match-android.yml`: 手動実行(workflow_dispatch)または
  `number-match-v*` タグでのみ Android ビルドを行う。ストア自動公開はしない。
