# Simple Games by PixApps

**Honest by design. Simple games, built in the open.**
**You don't have to take our word for it. The source code is public.**

「無料ゲームを、誠実に。シンプルなゲームを、オープンに。
私たちの説明を信じる必要はありません。ソースコードを公開しています。」

コンセプト: シンプル / 完全オフライン / 低消費電力 / 広告は控えめ / 急かさない /
サブスクなし / 機能課金なし / ログインなし / ソースコード公開

Simple Games は PixApps が提供するクラシックゲーム集のモノレポです。
複数のゲームを収録した 1 つのアプリ `Simple Games: Offline Puzzles` として配布します。
すべての収録タイトルは以下を守ります。

- ゲーム機能の課金ロックなし / サブスクリプションなし
- 広告はオンライン時の小さなバナー 1 つだけ(買い切り $3.99 で永久に削除可能)
- アカウント登録・ログインなし
- 全ゲーム機能が初回起動からオフラインで利用可能
- ゲームデータは端末内にのみ保存(クラウド同期なし)
- ストリークや人工的な緊急性なし
- Analytics・トラッキングコードなし(公開コードで確認可能)
- API サーバー・アプリ用 DB・コンテンツ配信サーバーなし

詳細は [docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) を参照してください。

## アプリと収録ゲーム

アプリは 1 つだけで、現在 2 本のゲームを収録しています。

- appId: `com.pixapps.simplegames`
- appName: `Simple Games: Offline Puzzles`(ランチャー表示名: `Simple Games`)
- パス: [apps/simple-games](apps/simple-games)

| ゲーム | パス | 状態 | ルール文書 |
| --- | --- | --- | --- |
| Number Match | apps/simple-games/src/games/number-match | 第1弾 / 収録済み | [docs/NUMBER_MATCH_RULES.md](docs/NUMBER_MATCH_RULES.md) |
| Sudoku(ナンプレ) | apps/simple-games/src/games/sudoku | 第2弾 / 収録済み | [docs/SUDOKU_RULES.md](docs/SUDOKU_RULES.md) |

以降の候補(実装順の提案): 2048 → Sliding Puzzle → Minesweeper。
後続候補: Nonogram / Solitaire / Kakuro / Futoshiki / Takuzu。
いずれもローカル生成で完結し、コンテンツサーバーを必要としないものを優先します。
未収録のゲームをストアやアプリ内で "Coming Soon" として見せることはしません。

収録ゲームはワークスペースパッケージではなくフォルダで分割します。共通のゲームフレームワークは意図的に作りません。
コレクション化と第2弾の計画は [docs/plans/2026-07-30-collection-and-sudoku.md](docs/plans/2026-07-30-collection-and-sudoku.md) を参照してください。

## リポジトリ構成

```text
simple-games/
├── apps/
│   └── simple-games/    # 収録ゲームを含む単一アプリ
│       └── src/
│           ├── app/            # シェル: ルート App、ルーティング、ゲームレジストリ
│           ├── games/
│           │   ├── number-match/  # game/ state/ storage/ ui/(自己完結)
│           │   └── sudoku/        # 同じ構成(自己完結)
│           ├── monetization/   # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
│           ├── services/       # 共有: ads(バナーのみ) / network / sound / haptics
│           ├── state/          # 共有: SettingsContext
│           ├── storage/        # 共有: kv / repo / SchemaDef 基盤 / 共有スキーマ
│           ├── i18n/           # 共有: 言語解決 + 言語ごとの同梱カタログ
│           └── ui/             # 共有: コレクションホーム、設定 / About、共通コンポーネント
├── packages/            # 必要最小限の共通パッケージ
│   ├── brand/           # Simple Games ブランド定数
│   ├── eslint-config/   # 共有 ESLint 設定
│   └── typescript-config/
├── docs/                # ブランド・プロダクト原則・ポリシー文書
└── .github/workflows/   # CI / Android リリースワークフロー
```

依存方向は `apps → packages` のみ。`packages` から `apps` へ依存してはいけません。
ゲームロジックは UI / 広告 / Capacitor に依存しない Pure TypeScript で実装します。
`games/A/` から `games/B/` への import は禁止。シェルは各ゲームの内部実装に触りません。

## 開発

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

アプリのワークスペースのみ対象にする場合:

```bash
pnpm --filter simple-games dev
pnpm --filter simple-games test
pnpm --filter simple-games build
```

Android ビルド手順は [apps/simple-games/README.md](apps/simple-games/README.md) を参照してください。

## 多言語

**One app. Many games. Many languages.** 現在は 5 言語(en / ja / hi / th / id)、
リリース前に 15 言語へ拡張します(オーガニック流入の中核施策)。
カタログは全言語同梱で、言語追加は「locale ファイル 1 つ + 登録」で完結します。
方針は [docs/I18N_POLICY.md](docs/I18N_POLICY.md)、
翻訳への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## 説明の二層化と将来の Web 版

アプリ内のゲーム説明は Quick Rules(最大 3 ステップ)のみとし、詳細ルール・FAQ は
ゲーム別 Landing Page(`https://pixapps.ai/simple-games/games/<game-id>/<locale>/`、
別リポジトリ・未構築)へ分離します。オフラインで外部リンクが開けなくても
ゲームは止まりません。ゲームロジックは Pure TypeScript のため、将来の静的 Web 版
(現時点では未実装)を可能な構成を維持します。詳細は
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## 原則(抜粋)

- 広告は Anchored Adaptive Banner のみ。Interstitial / Rewarded / App Open / Native は
  使わない([docs/ADS_POLICY.md](docs/ADS_POLICY.md))
- アプリ内課金は「広告削除の買い切り(USD 3.99 基準)」1 商品のみ。
  ゲーム機能は無料ユーザーと完全に同一
- オフライン時は広告リクエストを行わない(低消費電力・[docs/OFFLINE_POLICY.md](docs/OFFLINE_POLICY.md))
- 巨大な共通ゲームフレームワークを作らない
- 一度しか使われていないコードを共通化しない(重複が確認されてから抽出)
- 収録ゲームの追加・更新はアプリのリリースとして一体で行う。ただしゲーム追加が
  既存ゲームの挙動・保存データを変えてはならない
- 共通パッケージの変更だけでアプリを自動リリースしない(公開は手動実行またはタグ)
- 追加の固定インフラ費を発生させない
- ソースコード公開は「ユーザーがブランドプロミスを検証できる仕組み」である
  ([docs/BRAND.md](docs/BRAND.md))

## ライセンス

Copyright 2026 Yosuke Suzuki

このリポジトリのソースコードは [Apache License 2.0](LICENSE) の下で公開しています。

- 広告ユニット ID・署名鍵などの本番用シークレットはリポジトリに含まれません(ビルド時に環境変数で注入)
- 「Simple Games」「PixApps」の名称、ロゴ、アイコン、ストア掲載用ブランド素材は
  ライセンスの対象外です(Apache-2.0 §6)。第三者はソースからビルドできますが、
  そのビルドを公式版として提示することはできません
