# Simple Games by PixApps

**Fully free. Fully offline. Simply playable.**

Simple Games は PixApps が提供するシンプルゲームシリーズのモノレポです。
すべてのタイトルは以下を守ります。

- アプリ内課金なし / サブスクリプションなし
- アカウント登録・ログインなし
- 全ゲーム機能が初回起動からオフラインで利用可能
- ゲームデータは端末内にのみ保存(クラウド同期なし)
- 広告を見なくても全機能(Hint / Undo を含む)を利用可能
- API サーバー・アプリ用 DB・コンテンツ配信サーバーなし

詳細は [docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) を参照してください。

## アプリ

| アプリ | パス | 状態 |
| --- | --- | --- |
| Number Match Offline | [apps/number-match](apps/number-match) | 第1弾 |

各ゲームは Google Play 上では独立したアプリとして公開し、バージョン・リリース・ストア掲載をアプリ単位で管理します。

## リポジトリ構成

```text
simple-games/
├── apps/                # 各ゲーム(独立したスマートフォンアプリ)
│   └── number-match/
├── packages/            # 必要最小限の共通パッケージ
│   ├── brand/           # Simple Games ブランド定数
│   ├── eslint-config/   # 共有 ESLint 設定
│   └── typescript-config/
├── docs/                # ブランド・プロダクト原則・ポリシー文書
└── .github/workflows/   # CI / アプリ別リリースワークフロー
```

依存方向は `apps → packages` のみ。`packages` から `apps` へ依存してはいけません。
ゲームロジックは UI / 広告 / Firebase / Capacitor に依存しない Pure TypeScript で実装します。

## 開発

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

単一アプリのみ対象にする場合:

```bash
pnpm --filter number-match test
pnpm --filter number-match build
```

Android ビルド手順は [apps/number-match/README.md](apps/number-match/README.md) を参照してください。

## 原則(抜粋)

- 第一弾の段階で巨大な共通ゲームフレームワークを作らない
- 一度しか使われていないコードを共通化しない(第2弾で重複が確認されてから抽出)
- 共通パッケージの変更だけで全アプリを自動リリースしない(公開は手動実行またはタグ)
- 追加の固定インフラ費を発生させない
