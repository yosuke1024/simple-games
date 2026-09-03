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
- アプリに Analytics・トラッキングコードなし(公開コードで確認可能。Web 版の
  ページ解析は [docs/WEB_VERSION.md](docs/WEB_VERSION.md)「計測」、その読み方と
  限界は [docs/GROWTH_MEASUREMENT.md](docs/GROWTH_MEASUREMENT.md))
- API サーバー・アプリ用 DB・コンテンツ配信サーバーなし

詳細は [docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md) を参照してください。

## アプリと収録ゲーム

アプリは 1 つだけで、現在 30 本のゲームを収録しています。

- appId: `com.pixapps.simplegames`
- appName: `Simple Games: Offline Games`(ランチャー表示名: `Simple Games`)
- パス: [apps/simple-games](apps/simple-games)

並び順はコレクションホームの表示順(`apps/simple-games/src/app/registry.ts`)です。
フォルダはすべて `apps/simple-games/src/games/` 以下にあります。

| ゲーム                            | フォルダ             | 進行                                     | 無料・無制限の助け                                 | ルール文書                                                         |
| --------------------------------- | -------------------- | ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| Sudoku(ナンプレ)                  | `sudoku/`            | 100 レベル + デイリー + フリープレイ     | Undo / Hint                                        | [docs/SUDOKU_RULES.md](docs/SUDOKU_RULES.md)                       |
| Solitaire(クロンダイク)           | `solitaire/`         | フリー配札 + デイリー配札                | Undo / Hint(定石の合法手)                          | [docs/SOLITAIRE_RULES.md](docs/SOLITAIRE_RULES.md)                 |
| Spider Solitaire                  | `spider-solitaire/`  | フリー配札 + デイリー配札(スート数 3 種) | Undo / Hint(定石の合法手)                          | [docs/SPIDER_SOLITAIRE_RULES.md](docs/SPIDER_SOLITAIRE_RULES.md)   |
| FreeCell                          | `freecell/`          | フリー配札 + デイリー配札                | Undo(Hint なし)                                    | [docs/FREECELL_RULES.md](docs/FREECELL_RULES.md)                   |
| Hearts(ハーツ)                    | `hearts/`            | CPU 対局・難易度 3 種(デイリーなし)      | 出せる札の表示(Undo / Hint なし)                   | [docs/HEARTS_RULES.md](docs/HEARTS_RULES.md)                       |
| Gin Rummy(ジンラミー)             | `gin-rummy/`         | CPU 対局・難易度 3 種(デイリーなし)      | メルド整理とデッドウッド表示(Undo / Hint なし)     | [docs/GIN_RUMMY_RULES.md](docs/GIN_RUMMY_RULES.md)                 |
| Minesweeper                       | `minesweeper/`       | 難易度 3 種 + デイリー                   | Hint(Undo なし)                                    | [docs/MINESWEEPER_RULES.md](docs/MINESWEEPER_RULES.md)             |
| Mahjong Solitaire(麻雀ソリティア) | `mahjong-solitaire/` | 100 レベル + デイリー                    | Undo / Hint(取れる一致ペア)                        | [docs/MAHJONG_SOLITAIRE_RULES.md](docs/MAHJONG_SOLITAIRE_RULES.md) |
| 2048                              | `2048/`              | エンドレス(レベルなし)                   | Undo(Hint なし)                                    | [docs/GAME_2048_RULES.md](docs/GAME_2048_RULES.md)                 |
| Block Puzzle                      | `block-puzzle/`      | エンドレス(レベルなし)                   | Undo(Hint なし)                                    | [docs/BLOCK_PUZZLE_RULES.md](docs/BLOCK_PUZZLE_RULES.md)           |
| Ludo(西洋すごろく)                | `ludo/`              | CPU 対局・難易度 3 種(デイリーなし)      | 動かせるコマの常時表示(Undo / Hint なし)           | [docs/LUDO_RULES.md](docs/LUDO_RULES.md)                           |
| Checkers(チェッカー)              | `checkers/`          | CPU 対局・難易度 3 種(デイリーなし)      | Undo + 動かせる駒と行き先の表示(Hint なし)         | [docs/CHECKERS_RULES.md](docs/CHECKERS_RULES.md)                   |
| Reversi                           | `reversi/`           | CPU 対局・難易度 3 種(デイリーなし)      | Undo(Hint なし)                                    | [docs/REVERSI_RULES.md](docs/REVERSI_RULES.md)                     |
| Connect Four                      | `connect-four/`      | CPU 対局・難易度 3 種(デイリーなし)      | Undo(Hint なし)                                    | [docs/CONNECT_FOUR_RULES.md](docs/CONNECT_FOUR_RULES.md)           |
| Gomoku(五目並べ)                  | `gomoku/`            | CPU 対局・難易度 3 種(デイリーなし)      | Undo(Hint なし)                                    | [docs/GOMOKU_RULES.md](docs/GOMOKU_RULES.md)                       |
| Bubble Pop                        | `bubble-pop/`        | 100 レベル(デイリーなし)                 | 常時フル軌道ガイド(Undo / Hint なし)               | [docs/BUBBLE_POP_RULES.md](docs/BUBBLE_POP_RULES.md)               |
| Brick Breaker                     | `brick-breaker/`     | 100 レベル(デイリーなし)                 | 同じ盤面への即時リトライ(Undo / Hint なし)         | [docs/BRICK_BREAKER_RULES.md](docs/BRICK_BREAKER_RULES.md)         |
| Nonogram                          | `nonogram/`          | 100 レベル + デイリー + フリープレイ     | Hint(Undo なし)                                    | [docs/NONOGRAM_RULES.md](docs/NONOGRAM_RULES.md)                   |
| Takuzu(バイナリーパズル)          | `takuzu/`            | 100 レベル + デイリー + フリープレイ     | Hint(Undo なし)                                    | [docs/TAKUZU_RULES.md](docs/TAKUZU_RULES.md)                       |
| Futoshiki(不等式)                 | `futoshiki/`         | 100 レベル + デイリー + フリープレイ     | Undo / Hint                                        | [docs/FUTOSHIKI_RULES.md](docs/FUTOSHIKI_RULES.md)                 |
| Kakuro(クロスサム)                | `kakuro/`            | 100 レベル + デイリー + フリープレイ     | Undo / Hint                                        | [docs/KAKURO_RULES.md](docs/KAKURO_RULES.md)                       |
| Number Match                      | `number-match/`      | 100 レベル + デイリー + フリープレイ     | Undo / Hint                                        | [docs/NUMBER_MATCH_RULES.md](docs/NUMBER_MATCH_RULES.md)           |
| Quick Math(計算ドリル)            | `quick-math/`        | 100 レベル + デイリー                    | 無制限の解き直し + 途中保存(Undo / Hint なし)      | [docs/QUICK_MATH_RULES.md](docs/QUICK_MATH_RULES.md)               |
| Schulte Table(順番タッチ)         | `schulte-table/`     | 100 レベル + デイリー                    | 同じ面への即時リトライ(Undo / Hint なし)           | [docs/SCHULTE_TABLE_RULES.md](docs/SCHULTE_TABLE_RULES.md)         |
| Number Recall(位置記憶)           | `number-recall/`     | 100 レベル + デイリー                    | 同レベル・新配置への即時リトライ(Undo / Hint なし) | [docs/NUMBER_RECALL_RULES.md](docs/NUMBER_RECALL_RULES.md)         |
| Water Sort                        | `water-sort/`        | 100 レベル + デイリー + フリープレイ     | Undo / Hint(ソルバー証明付き)                      | [docs/WATER_SORT_RULES.md](docs/WATER_SORT_RULES.md)               |
| Sliding Puzzle                    | `sliding-puzzle/`    | 100 レベル + デイリー                    | Undo(Hint なし)                                    | [docs/SLIDING_PUZZLE_RULES.md](docs/SLIDING_PUZZLE_RULES.md)       |
| Memory Match(神経衰弱)            | `memory-match/`      | 難易度 3 種 + デイリー                   | 同じ盤面への再挑戦(Undo / Hint なし)               | [docs/MEMORY_MATCH_RULES.md](docs/MEMORY_MATCH_RULES.md)           |
| Sky Fighter                       | `sky-fighter/`       | 100 レベル(デイリーなし)                 | 同じレベルへの即時リトライ(Undo / Hint なし)       | [docs/SKY_FIGHTER_RULES.md](docs/SKY_FIGHTER_RULES.md)             |
| Bunny Hop                         | `bunny-hop/`         | エンドレス(レベルなし)                   | 次のランへの即時リトライ(Undo / Hint なし)         | [docs/BUNNY_HOP_RULES.md](docs/BUNNY_HOP_RULES.md)                 |

「フリープレイ」は、レベルの坂とデイリーの隣にある**ティアを選んで新しい盤面を引く入口**です
(2026-09-03 追加)。ティアはレベル 10 / 50 / 95 と同じ生成条件で seed だけが違い、レベル進行にも
デイリーの記録にも触れません。Hard を遊ぶために 70 レベル登る必要はなく、100 を終えた人にも
1 日 1 問以上の盤面が残ります。どのゲームの手応えも「自分の記録との差(`+0:18` / `−0:05`)」
「完成した盤面を見せてから出る結果カード」「揃った・消した・できた大きさに応じて高くなる
効果音」までで、ストリーク・称号・タイマー・通知は作りません
([docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md)「UI / UX の原則」)。

助けの内容がゲームごとに違うのは意図したものです。**どのゲームにも無料・無制限の助けを
用意し、その形はそのゲームの中身を空にしないものを選びます**(Minesweeper は推測なしで
解ける保証があるため Undo を作らず、Nonogram は印がタップで自由に付け外しできるため
Undo を作らず、Takuzu も空 → 0 → 1 → 空 とタップで一巡できてどの手もそのまま戻せるため
Undo を作らず、Sliding Puzzle は盤面に隠れた情報がないため Hint を作らず、Memory Match は
記憶そのものが中身のため Undo も Hint も作らず、代わりに同じ盤面への再挑戦を無料にして
います。2048 と Block Puzzle は盤面に隠れた情報がないため Hint を作らず、そのぶん Undo を
無制限にしています。Bunny Hop はリアルタイムの反射が中身のため Undo も Hint も作らず、
代わりに次のランへの即時リトライを無料にしています。FreeCell は 52 枚すべてが最初から
表向きで隠れた情報が 1 つもないため Hint を作らず、Undo を無制限にしています。Spider は
伏せカードがあり見えていない情報が実在するため、Solitaire と同じく Hint を持ちます。
Reversi と Connect Four も盤面がすべて見えているため Hint を作らず、Undo だけを
持ちます。Gomoku も同じ理由で Undo だけです。Checkers は Undo に加えて「動かせる駒と
その行き先」を示します — 捕獲義務(取れるときは取る手しか打てない)が初心者の最初の壁で
あり、跳べる駒だけが選べる形にすると規則が説明ではなく操作として伝わるためで、これは
ルールの可視化であって最善手の提案ではありません。Bubble Pop は物理が決定的で盤面に
隠れた情報が無いため、着弾セルまでの軌道ガイドを常時無料で表示し(他社がコイン・広告視聴の
後ろに置く定番機能をそのまま全員に渡す形です)、ポップするか・何が落ちるかは示しません —
そこを読むのがこのゲームの中身であるため Undo も Hint も作らず、失敗したら同じ盤面への
即時リトライを無料にしています。Hearts と Gin Rummy は隠れた情報がある
対局なので、どちらにも Undo を作りません — CPU の応手を見てから戻せる Undo では戻せるのは
手だけで、知ってしまったことは戻らず、取り消せない情報の漏れになるためです(Minesweeper の
「取り消せるなら賭けが残らない」と同族の理由)。代わりに Hearts は「出せる札」を常時示し
(スートを追う義務・初トリックの点札禁止・ブレイク前の ♥ リード禁止の可視化で、Checkers の
「動かせる駒の表示」と同じ物差しです)、Gin Rummy はメルドを自動で整理してデッドウッドを
常時表示します — どちらもルールが定める制約と算術であって、何を渡し・何を引き・いつノックする
かの判断は残ります。Ludo にも Undo を作りません — 出目を維持したまま戻せば次の出目を知った
うえでの先読みになり、振り直せば Undo がリロールになって「同じシードなら同じ出目」という
決定性と両立しないためで、どちらへ倒しても成立しません([docs/LUDO_RULES.md](docs/LUDO_RULES.md)
§3 / §6)。助けは動かせるコマの常時表示だけで、これも Checkers の「動かせる駒の表示」と同じ
ルールの可視化です。Futoshiki と Kakuro は Sudoku と同じ側で、Undo と Hint の両方を持ちます —
メモを置いたマスに数字を入れると同じ行・列やひと続きのメモが自動で消えるため、1 手が非自明に
不可逆になり、戻す先のある Undo が実在するからです。出題が常に一意解であることは、論理だけで
正当化できる次の一手が必ずあるということでもあるので、Hint にも誠実に言えることが残ります。
ドリル 3 本は、Schulte Table と Quick Math が「探すこと・計算すること」
そのものを中身とするため次の一手を教えず、Number Recall はタップが記憶の主張そのもので
あるため Undo を作りません)。
理由は各ルール文書と
[docs/PRODUCT_PRINCIPLES.md](docs/PRODUCT_PRINCIPLES.md)。

**脳トレドリル 3 本(Quick Math / Schulte Table / Number Recall)は効能を謳いません。**
「脳年齢」「IQ」「認知機能の改善」はアプリ内文言にもストア文言にも書きません。
科学的裏付けが係争的な主張であり、Honest by design と両立しないためです。この不在は
`.github/scripts/check-principles.sh` §7 が CI で検査します(英語・日本語の範囲)。
同じ理由で、このジャンルの定番である**制限時間・タイムアタックも作りません** —
時間は記録するだけで、締切にはしません([docs/SCHULTE_TABLE_RULES.md](docs/SCHULTE_TABLE_RULES.md) §14)。

後続候補は**現在ありません** — Kakuro / Futoshiki / Takuzu は 3 本とも収録済みで、
待ち行列は空です。次を選ぶときは、ローカル生成で完結しコンテンツサーバーを必要と
しないものを優先します。
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
│           │   ├── solitaire/
│           │   ├── spider-solitaire/
│           │   ├── freecell/
│           │   ├── hearts/
│           │   ├── gin-rummy/
│           │   ├── ludo/
│           │   ├── checkers/
│           │   ├── reversi/
│           │   ├── connect-four/
│           │   ├── gomoku/
│           │   ├── minesweeper/
│           │   ├── 2048/
│           │   ├── block-puzzle/
│           │   ├── brick-breaker/
│           │   ├── nonogram/
│           │   ├── takuzu/
│           │   ├── futoshiki/
│           │   ├── kakuro/
│           │   ├── number-match/
│           │   ├── water-sort/
│           │   ├── sliding-puzzle/
│           │   ├── memory-match/
│           │   ├── sky-fighter/
│           │   ├── bunny-hop/
│           │   ├── quick-math/
│           │   ├── schulte-table/
│           │   └── number-recall/
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

Android / iOS のビルド手順は [apps/simple-games/README.md](apps/simple-games/README.md) を参照してください。

## 多言語

**One app. Many games. Many languages.** 現在は 14 言語・900 キー
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
別リポジトリ)へ分離します。**ページは 10 言語**(`src/ui/landing.ts` の `PAGE_LOCALES`:
en / ja / es / pt-br / fr / id / de / th / vi / ko)で、残る 4 ロケール
(hi / tr / zh-hans / zh-hant)は en へフォールバックします
(長文のルール解説を 14 言語すべてへ機械翻訳で量産しないため)。
オフラインで外部リンクが開けなくてもゲームは止まりません。

ゲームロジックが Pure TypeScript なので、同じソースから **ブラウザ版**を配信します
(`https://pixapps.ai/simple-games/play/` で公開中)。
Cloudflare Pages の静的アセットのみで動き、サーバー機能は使いません。
ゲーム別 Landing Page からは `…/play/?game=<game-id>` でそのゲームを直接開けます
(不明な ID はコレクションホームにフォールバック。アプリ版では動きません)。
アプリ版との役割の違い(広告・課金・オフラインの範囲・計測・保存)は
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
- 計測は Web 版だけ。何を見て次のゲームを選ぶか、そのデータで何が言えないかを
  文書に残す([docs/GROWTH_MEASUREMENT.md](docs/GROWTH_MEASUREMENT.md))
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
利用・改変・再配布・商用利用ができます。fork も歓迎します。

- 広告ユニット ID・署名鍵などの本番用シークレットはリポジトリに含まれません(ビルド時に環境変数で注入)
- Apache-2.0 は「Simple Games」「PixApps」の名称・アイコン・ストア掲載素材を
  **出所表示(商標)として**使う許諾は与えません(§6)。ソースからビルドすることは
  できますが、そのビルドを PixApps 公式版として提示することはできません
- fork を配布する場合は、独自のアプリ名・アプリケーション ID・アイコン・ストア
  掲載素材を使い、Apache-2.0 が求める LICENSE・著作権表示・変更通知を残して
  ください
- 境界の説明と fork の手順は [TRADEMARKS.md](TRADEMARKS.md)(独自ライセンスでは
  なく、Apache-2.0 が引いている線の説明です)
