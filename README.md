# Simple Games by PixApps

**Honest by design. Simple games, built in the open.**
**You don't have to take our word for it. The source code is public.**

「無料ゲームを、誠実に。シンプルなゲームを、オープンに。
私たちの説明を信じる必要はありません。ソースコードを公開しています。」

コンセプト: シンプル / 完全オフライン / 低消費電力 / 広告は控えめ / 急かさない /
サブスクなし / 機能課金なし / ログインなし / ソースコード公開

Simple Games は PixApps が提供するクラシックゲーム集のモノレポです。
複数のゲームを収録した 1 つのアプリ `Simple Games: Offline Games` として配布します。
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

アプリは 1 つだけで、現在 10 本のゲームを収録しています。

- appId: `com.pixapps.simplegames`
- appName: `Simple Games: Offline Games`(ランチャー表示名: `Simple Games`)
- パス: [apps/simple-games](apps/simple-games)

並び順はコレクションホームの表示順(`apps/simple-games/src/app/registry.ts`)です。
フォルダはすべて `apps/simple-games/src/games/` 以下にあります。

| ゲーム | フォルダ | 進行 | 無料・無制限の助け | ルール文書 |
| --- | --- | --- | --- | --- |
| Sudoku(ナンプレ) | `sudoku/` | 100 レベル + デイリー | Undo / Hint | [docs/SUDOKU_RULES.md](docs/SUDOKU_RULES.md) |
| Solitaire(クロンダイク) | `solitaire/` | フリー配札 + デイリー配札 | Undo / Hint(定石の合法手) | [docs/SOLITAIRE_RULES.md](docs/SOLITAIRE_RULES.md) |
| Minesweeper | `minesweeper/` | 難易度 3 種 + デイリー | Hint(Undo なし) | [docs/MINESWEEPER_RULES.md](docs/MINESWEEPER_RULES.md) |
| Nonogram | `nonogram/` | 100 レベル + デイリー | Hint(Undo なし) | [docs/NONOGRAM_RULES.md](docs/NONOGRAM_RULES.md) |
| Number Match | `number-match/` | 100 レベル + デイリー | Undo / Hint | [docs/NUMBER_MATCH_RULES.md](docs/NUMBER_MATCH_RULES.md) |
| Water Sort | `water-sort/` | 100 レベル + デイリー | Undo / Hint(ソルバー証明付き) | [docs/WATER_SORT_RULES.md](docs/WATER_SORT_RULES.md) |
| Sliding Puzzle | `sliding-puzzle/` | 100 レベル + デイリー | Undo(Hint なし) | [docs/SLIDING_PUZZLE_RULES.md](docs/SLIDING_PUZZLE_RULES.md) |
| Memory Match(神経衰弱) | `memory-match/` | 難易度 3 種 + デイリー | 同じ盤面への再挑戦(Undo / Hint なし) | [docs/MEMORY_MATCH_RULES.md](docs/MEMORY_MATCH_RULES.md) |

助けの内容がゲームごとに違うのは意図したものです。**どのゲームにも無料・無制限の助けを
用意し、その形はそのゲームの中身を空にしないものを選びます**(Minesweeper は推測なしで
解ける保証があるため Undo を作らず、Nonogram は印がタップで自由に付け外しできるため
Undo を作らず、Sliding Puzzle は盤面に隠れた情報がないため Hint を作らず、Memory Match は
記憶そのものが中身のため Undo も Hint も作らず、代わりに同じ盤面への再挑戦を無料にして
います)。理由は各ルール文書と [docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md)。

後続候補: Solitaire / Kakuro / Futoshiki / Takuzu(**いずれも未着手**)。
いずれもローカル生成で完結し、コンテンツサーバーを必要としないものを優先します。
未収録のゲームをストアやアプリ内で "Coming Soon" として見せることはしません。

収録ゲームはワークスペースパッケージではなくフォルダで分割します。共通のゲームフレームワークは意図的に作りません。
コレクション化と収録ゲームの計画は [docs/plans/2026-07-30-collection-and-sudoku.md](docs/plans/2026-07-30-collection-and-sudoku.md) を参照してください。

## リポジトリ構成

```text
simple-games/
├── apps/
│   └── simple-games/    # 収録ゲームを含む単一アプリ
│       └── src/
│           ├── app/            # シェル: ルート App、ルーティング、ゲームレジストリ
│           ├── games/          # 各ゲームは game/ state/ storage/ ui/ で自己完結
│           │   ├── sudoku/
│           │   ├── minesweeper/
│           │   ├── nonogram/
│           │   ├── number-match/
│           │   └── sliding-puzzle/
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

**One app. Many games. Many languages.** 現在は 14 言語・227 キー
(en / ja / hi / th / id / vi / ko / zh-hans / zh-hant / es / pt-br / fr / de / tr)。
中国語は書記体系で解決し(zh-TW / zh-HK / zh-Hant → zh-hant、zh / zh-CN / zh-SG → zh-hans)、
pt / pt-PT は pt-br へ解決します。Arabic は RTL 検証の条件を満たすまで見送っています。
カタログは全言語同梱で、言語追加は「locale ファイル 1 つ + 登録」で完結します。
**en と ja 以外は来歴 `machine` です — AI の助けを借りて書いており、その言語の
ネイティブは一人も読んでいません。**この製品は一人でつくっているため、14 言語の
ネイティブレビューは供給できません。代わりに、約束を背負う高リスクキーだけは
リリース前に逆翻訳を作者が読む門を通し、自然さは来歴の開示と読者からの報告に
委ねています。
方針は [docs/I18N_POLICY.md](docs/I18N_POLICY.md)、
翻訳への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## 説明の二層化と Web 版

アプリ内のゲーム説明は Quick Rules(最大 3 ステップ)のみとし、詳細ルール・攻略・FAQ は
ゲーム別 Landing Page(`https://pixapps.ai/simple-games/games/<game-id>/<locale>/`、
別リポジトリ)へ分離します。**ページは en / ja のみ**で、他の 12 ロケールは en へ
フォールバックします(長文のルール解説を機械翻訳で量産しないため。`src/ui/landing.ts`)。
オフラインで外部リンクが開けなくてもゲームは止まりません。

ゲームロジックが Pure TypeScript なので、同じソースから **ブラウザ版**を配信します
(公開予定先 `https://pixapps.ai/simple-games/play/`。**まだ公開していません**)。
Cloudflare Pages の静的アセットのみで動き、サーバー機能は使いません。
アプリ版との役割の違い(広告・課金・オフラインの範囲・保存)は
[docs/WEB_VERSION.md](docs/WEB_VERSION.md)、レイヤー構成は
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## 原則(抜粋)

- 広告は Anchored Adaptive Banner のみ。Interstitial / Rewarded / App Open / Native は
  使わない([docs/ADS_POLICY.md](docs/ADS_POLICY.md))
- アプリ内課金は「広告削除の買い切り(USD 3.99 基準)」1 商品のみ。
  ゲーム機能は無料ユーザーと完全に同一
- 助け(Undo / Hint)は常に無料・無制限。ただし全ゲームで同じ機能を並べず、
  そのゲームの中身を空にしない形の助けを用意する
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
