# Simple Games — Project Context / Source of Truth

Updated: 2026-10-19

この文書は、Simple Games を変更・レビュー・説明するときの **共通の入口** である。
ここに全仕様を複製しない。実装上の事実はコード、恒久的な原則は各 canonical document を正とし、
この文書は「何が正か」「今どこを目指しているか」「どの文書を読むべきか」を固定する。

## 1. Authority — 何を正とするか

情報が食い違う場合は、次の順で扱う。

1. **現在の実装事実** — 実際に何が出荷コードに存在するかは `main` のコード・設定・テストを正とする。
2. **恒久的なプロダクト判断** — 何を作るべきか / 作ってはいけないかは `docs/PRODUCT_PRINCIPLES.md` と各 policy 文書を正とする。
3. **ゲーム固有仕様** — 各 `docs/*_RULES.md` を正とする。
4. **現在の方向性・優先順位** — この文書の「Current direction」を正とする。
5. **Issue / `docs/plans/`** — 提案・検討・実装履歴であり、上記 canonical source と矛盾する場合は canonical source を優先する。

重要な判断を Issue や会話だけに残さない。採用された判断は、実装 PR と同時かそれ以前に適切な canonical document へ反映する。

## 2. Product definition

Simple Games by PixApps は、**静かに、無料で、オフラインで遊べるクラシックゲームのコレクション**である。
ゲームを大量に詰め込むこと自体が目的ではなく、複数のゲームを同じ誠実な原則の下で提供する。

Brand promise:

> **Honest by design. Simple games, built in the open.**

Design philosophy:

> **Built by subtraction.**
> We remove what gets between you and the game.

目指すのは「少ない機能」ではなく **少ない負担** である。
ユーザーの操作、判断、待ち時間、通信、中断、義務感を減らす変更を優先する。

詳細: `docs/PRODUCT_PRINCIPLES.md`, `docs/BRAND.md`

## 3. Current product snapshot

### Collection

- 1つの `Simple Games: Offline Games` として提供する。
- 現在の正式収録は **41 games**(`registry.ts` の `GAMES` のうち `channel` を持たないエントリ。
  本数はここで数える)。`GAMES` の全 56 エントリには、下の `channel: 'web-beta'` の 15 本(Web 先行公開中の
  No. 42〜46・No. 47〜51・No. 52〜56)も含まれる。
  `'in-development'` のエントリはいま無い。
- 2026-10-02 に、Web 版で先行公開していた新作 11 本(Crown Grid / Number Path /
  Shape Regions、2026-09-26、issue #194。Yacht / Mancala / Dominoes / Hit & Blow /
  Dots and Boxes、2026-09-27、issue #197。Binary Balance / Sudoku 6×6 / Box Regions、
  2026-09-29、issue #210 — Crown Grid / Number Path と合わせて 5 種類の練習セット、
  `docs/PUZZLE_PRACTICE_SET.md`)を正式収録した。2 週間の安定稼働という基準は
  満たしておらず、製品オーナーの明示的な判断による(経緯は `docs/WEB_VERSION.md`
  「先行公開」)。保存スキーマはこの収録で凍結。ゲーム別ガイドはまだ無い。
- Web 版は新作の先行公開チャンネルとして残る。2026-10-17 に **Web 先行公開(ベータ)の
  新作 5 本**(Unblock Puzzle / Snake / Loop Puzzle / Bridges / Peg Solitaire、No. 42〜46)を
  このリポジトリに実装し、registry に `channel: 'web-beta'` で登録した(仕様の正は各
  `docs/*_RULES.md`、経緯は `docs/plans/2026-10-17-unblock-snake-loop-bridges-peg.md`)。
  **Web 版では 2026-10-19 から先行公開している**(pixapps-landing #201 で同期し、同じ PR で
  landing の `tests/ui.test.js` の `WEB_BETA_GAME_IDS` に 5 本の id を足した。
  `docs/WEB_VERSION.md`「先行公開」)。正式収録の 41 本には数えず、アプリには出ない。
  正式収録の基準(Web での 2 週間の安定稼働と計測、`docs/RELEASE_CHECKLIST.md` §0)は
  変えず、2 週間の時計は 2026-10-19 から数える。
- 2026-10-19 から、さらに **Web 先行公開(ベータ)向けの新作 5 本**(Chess / Gem Swap /
  Pipe Link / Bounce Up / Echo Pads、No. 47〜51)に着手し、**2026-10-22 に 5 本とも遊べる形まで
  このリポジトリに実装した**(計画は
  `docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md`、仕様の正は各
  `docs/*_RULES.md`)。registry は 2026-10-20 から `channel: 'in-development'`(どのビルドの扉からも
  開けない — `app/gameChannel.ts`)で、**2026-10-22 に 5 本とも `'web-beta'` にした**(製品オーナーの依頼は
  「Web 公開まで」。計画の判断 4 — Chess を別 PR にして残り 4 本を待たせない — は、5 本が同時に仕上がったので
  1 つの PR で満たした)。**Web 版では 2026-10-23 から先行公開している**(JST、UTC では 2026-10-22 17:33。
  pixapps-landing #206(2026-10-22 16:13 UTC にマージ)で landing の門の一覧の 5 本を `IN_DEVELOPMENT_GAME_IDS` から
  `WEB_BETA_GAME_IDS` へ移し、#253(2026-10-22 16:55 UTC にマージ)の後、製品オーナーの承認を得て公開ワークフローが
  `7b95a94` の web ビルドを landing main に同期した — `0415eb18`、2026-10-22 17:33 UTC。それまでの配信物の
  5 本のチャンクは `'in-development'` のときのビルドのもので、開けなかった。本番への反映はこのリポジトリからは
  観測していない。`docs/WEB_VERSION.md`「先行公開」)。Bounce Up の題(同名作がある)は、製品オーナーが
  2026-10-22 に「このまま出す」と判断した(`docs/BOUNCE_UP_RULES.md` 冒頭と §12)。
  実機では何も確かめておらず、`ja` と 12 言語の文言は AI が書いて誰も読んでいない。題の商標・ストアの検索は
  5 本とも正式収録の前に。正式収録の 41 本には数えず、アプリには出ず、
  Club House にも登録しない。2 週間の時計(`docs/RELEASE_CHECKLIST.md` §0)は Web で公開した日から数える —
  5 本とも 2026-10-23 から(UTC では 2026-10-22 17:33 の同期から)。
  チャンネルの宣言は registry の `channel`、出し分けは `app/gameChannel.ts` の
  実行時ガード(`docs/WEB_VERSION.md`「先行公開」)。
- 2026-10-20 から、さらに **Web 先行公開(ベータ)向けの新作 5 本**(Overtake / Make the Target /
  Nested Tic-Tac-Toe / Scopa / Tangram、No. 52〜56)に着手し、**2026-10-21 に 5 本とも遊べる形まで
  このリポジトリに実装した**(計画は
  `docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md`、仕様の正は各
  `docs/*_RULES.md`)。registry では Make the Target / Nested Tic-Tac-Toe / Tangram の 3 本が 2026-10-21 から
  `channel: 'web-beta'`(遊べるようになる変更で `'in-development'` から変えた)。**Overtake と Scopa も
  2026-10-22 に `'web-beta'` にした** — 製品オーナーの指示(2026-10-22):「Overtake, Scopa は Web に
  出したいです。計画が間違ってる。このタイミングで、実機の確認はできない。」それまでは各ルール文書が
  切り替えを止めていた。Overtake は Phase 0 を行わないまま、`docs/OVERTAKE_RULES.md` §3 が記録の前に
  上げるときの形として定めていたとおり `DRAG_MAPPING` を `'B'`(横ドラッグ + ▼ 長押し)にして出す
  (モード A のコードと試験は定数の裏に残す)。Scopa は復帰時に CPU の拍を 450ms から張り直す今の
  読み方を暫定の挙動として出し、読み方は確認待ちのまま(§4.2)。規則の出典と商標・ストアの検索も
  未確認のままで、`docs/SCOPA_RULES.md` §14 では「正式収録の前に(できるだけ早く)」に移した。
  **Make the Target / Nested Tic-Tac-Toe / Tangram の 3 本は Web 版で 2026-10-22 から先行公開している**
  (JST、UTC では 2026-10-21 17:38。pixapps-landing #204 で landing の `tests/ui.test.js` の
  `WEB_BETA_GAME_IDS` に 3 本の id を、`IN_DEVELOPMENT_GAME_IDS` に Overtake と Scopa の id を足し、
  続けて製品オーナーの指示で公開ワークフローが `11a3036` の web ビルドを landing main に同期した —
  `af9dedc`、2026-10-21 17:38 UTC。本番への反映はこのリポジトリからは観測していない。
  `docs/WEB_VERSION.md`「先行公開」)。そのビルドでは `'in-development'` のため開けなかった
  **Overtake と Scopa も Web 版で 2026-10-22 から先行公開している**(JST、UTC でも 2026-10-22 02:32。
  pixapps-landing #205 で landing の一覧の 2 本を `IN_DEVELOPMENT_GAME_IDS` から `WEB_BETA_GAME_IDS` へ移し、
  続けて製品オーナーの指示で公開ワークフローが `3ed2b16` の web ビルドを landing main に同期した —
  `6204b78`。本番への反映はこのリポジトリからは観測していない。`docs/WEB_VERSION.md`「先行公開」)。
  Overtake と Tangram の実機での試作(Phase 0)はまだ行っておらず、操作の既定は暫定(Overtake は製品
  オーナーが Phase 0 を当面見送ったのでモード B で出す。Tangram はそれが通らなければ Three Peaks に
  差し替える)。正式収録の 41 本には数えず、アプリには出ず、Club House にも登録しない。
  正式収録の基準(`docs/RELEASE_CHECKLIST.md` §0)の 2 週間の時計は Web で公開した日から数える —
  5 本とも 2026-10-22 から(Make the Target / Nested Tic-Tac-Toe / Tangram は UTC では 2026-10-21 17:38、
  Overtake と Scopa は 2026-10-22 02:32 UTC の同期から)。47〜51 の Phase 1(#239)が先に main に入ったので、
  この 5 本はその後ろに No. 順で並ぶ。
- 実装上のゲーム一覧・ID・並び順・カテゴリの正は `apps/simple-games/src/app/registry.ts` の `GAMES` / `GAME_CATEGORIES`。
- 人間向け一覧は root `README.md`。
- 各ゲームの実装は `apps/simple-games/src/games/<game-id>/` に分離する。
- 未実装タイトルを Coming Soon として表示しない。

### Platforms

同一のゲーム実装を基盤として Android / iOS / Web を提供する。

- **Android / iOS app**: 静かに長く遊ぶための完成版。ゲーム機能は初回起動からオフラインで利用できる。
- **Web**: インストールせず試せる入口、検索流入、PixApps / app への導線、非妨害型広告による収益化。
- Web を意図的に不便にして app へ誘導しない。
- platform 差分の正は `docs/WEB_VERSION.md` と platform code / config。

## 4. Non-negotiable product constraints

以下は成長施策や一般的なゲームアプリ慣習より優先する。

以下は **Core** — Club House を使っていない状態のアプリと Web 版 — の約束である。
Club House(#161 / #164)は本人が明示的に参加したときだけ現れる任意の層で、Core の
約束の例外ではなく **Core の外** に置く(2026-09-09 の #176、2026-09-30 の
`simple-games-club#1`)。デプロイは PixApps が運用する **Public** と利用者が建てる
**Private** の 2 つ。Club House を一度も触らない利用者にとって、以下は 1 つも変わらない。
Club House の側の境界(ゲームは PixApps のサーバーを 1 つも必要としない・送るのは
結果画面の事実だけ・順位はゲーム × モードごとの自己ベスト(同じ盤面で競うのはデイリーだけ)・Core の画面に現れる入口は 3 つまで・
公開デプロイの費用の上限・CI での証明)は `docs/PRODUCT_PRINCIPLES.md`「Club House」が定める。

- ゲーム機能を課金または広告視聴で解放しない。
- サブスクリプションを導入しない。
- アカウント登録を要求しない。
- ゲームデータを端末外へ保存しない。クラウドセーブを作らない。
  (ユーザー自身が設定画面から書き出す 1 つのバックアップファイルはこれに当たらない。
  端末外へ出すかどうかも、出す先を選ぶのもアプリではなく利用者であり、アプリは
  転送先を知らない。issue #160 / `docs/architecture/backup.md`。Club House が送る
  結果も同じ形 — 送るかどうかも送る先も利用者が(参加することで、参加の前の開示を受けて)選び、内容は結果画面が
  表示した事実だけ。参加している間は結果ごとの確認なしに自動で送られる(2026-10-02)。
  同「Club House」)
- フレンド、対人オンライン機能を作らない。**Core の画面に順位を出さない**
  (順位表は Club House の層にあり、参加した人がその画面へ行ったときだけ見える。
  2026-09-30 に「オンラインランキングを採用しない」を Core だけの約束へ縮めた)。
- ストリーク、ログインボーナス、期間限定イベント、人工的な緊急性を作らない。
- Push / ローカル通知で再訪を促さない。
- ゲームプレイを中断する広告を app に導入しない。
- **ゲームが** API サーバー、クラウド DB、認証基盤を必要とする構成にしない。
  PixApps が持つ固定費は Public Club House の 1 デプロイだけで、それも限りなくゼロに
  近い額に限る(超えたら機能を削るか畳む。同「費用の上限」)。
- AI API / 有料問題生成 API に依存しない。
- ローエンド端末、低通信、低消費電力を設計制約として扱う。
- 実施していない検証を成功扱いにしない。

詳細: `docs/PRODUCT_PRINCIPLES.md`, `docs/OFFLINE_POLICY.md`, `docs/ADS_POLICY.md`

## 5. Current direction — Friction first

現時点のプロダクト改善の中心は **engagement mechanics を増やすことではなく、ゲーム内外のストレスを徹底的に減らすこと** である。

共有機能の整備後は、「中毒性を上げる」方向の追加施策をいったん止め、次を優先する。

1. 遊び始めるまでの手数を減らす。
2. プレイ中の誤操作、モード切替、探索、待ち時間を減らす。
3. タッチ / マウス / キーボード / タブレットそれぞれで自然に操作できるようにする。
4. 結果確認、再挑戦、次のゲーム開始までの不要な摩擦を減らす。
5. 多言語、アクセシビリティ、ローエンド端末での摩擦を減らす。
6. ゲームそのものの判断や挑戦まで自動化して、ゲーム性を空にしない。

判断基準:

> **新機能を足す前に、その問題を「手数を削る」「待ちを削る」「迷いを削る」ことで解決できないか確認する。**

これは `PRODUCT_PRINCIPLES.md` の Built by subtraction / Zero Friction を、現在の改善優先順位として明示したものである。

### Club House は Friction first の後

Club House(#161 / #164、`simple-games-club#1`)は任意の層であり、上の 1〜6 より
優先しない。順序は — 原則の境界(#176、2026-09-09。済)→ 設計
(`architecture/club.md`、2026-09-09。済)→ **Public を含む原則の再改定**
(`simple-games-club#1`、2026-09-30。済)→ 費用と構成の spike → 実装 → 発見導線 —
で、段取りは `docs/plans/2026-09-30-public-club-house.md`。着手しても判断基準は同じで、
Club House の UI も「手数を削る」で評価する(招待リンクから Join and Play までを 1 画面、
インストールを参加条件にしない)。Club House を理由に Core へ入口を足せるのは
「Club House」節が数える 3 つまで(具体形は `club.md` §2)で、Friction first の側に
Club House のための摩擦を持ち込まない。**Public ができても、この数は増えない。**

## 6. Monetization

### App

- 全ゲーム・全ゲーム機能を無料提供。
- Anchored Adaptive Banner 1枠のみ。オフラインでは広告取得しない。
- Rewarded / Interstitial / App Open / Native は採用しない。
- 買い切りの広告削除商品のみ。ゲーム機能差は作らない。

Canonical: `docs/ADS_POLICY.md`, `docs/PRODUCT_PRINCIPLES.md`

### Web

- 全ゲームを無料提供。
- ゲーム盤面・操作を妨害しない範囲で広告を掲載する。
- 広告視聴による機能解放を行わない。
- 課金機能は提供しない。

Canonical: `docs/WEB_VERSION.md`

## 7. Measurement and North Star

North Star は **「通知・ストリーク等で強制せず、それでも繰り返し自発的に遊ばれていること」**。
滞在時間最大化だけを成功としない。

- App: 個人追跡のための Analytics を入れない。ストア / 広告プラットフォームが提供する集計値を使う。
  例外は **Android の獲得計測(Meta)** だけで、EEA/UK/CH 等の同意が要る地域を除く新規
  インストールについて、利用者の操作なしにインストールと広告 ID を 1 回だけ Meta に自動で
  知らせる期限つきの仕組み(1,000+ installs で撤去を判断。ゲームのデータは送らない。
  2026-09-27 導入・2026-09-29 に同意方式から自動送信へ変更、issue #204 —
  `docs/PRODUCT_PRINCIPLES.md`「Android の獲得計測(Meta)」、運用は
  `docs/META_ANDROID_ACQUISITION.md`)。
- Web: サイト側の集計計測として GA4 を利用し、`page_view`, `game_open`, `game_close` 等を見る。
- 計測を理由にゲームデータを外部送信しない。
- 数字は「何を改善するか」を判断する材料であり、ブランド原則を破る理由にはしない。

Canonical: `docs/GROWTH_MEASUREMENT.md`, `docs/WEB_VERSION.md`, `docs/PRODUCT_PRINCIPLES.md`

## 8. Engineering invariants

- Game logic は Pure TypeScript。
- 依存方向は `apps → packages`。循環依存禁止。
- `games/A` から `games/B` への依存禁止。
- Shell は各ゲーム内部の state / rules に踏み込まない。
- 各ゲームの保存領域を分離し、保存データ破損を波及させない。
- 既存 save schema の後方互換性を壊さない。migration は失敗時もデータを破壊しない。
- ゲームは lazy chunk として app 内に同梱し、open 時にネットワーク取得しない。
- 実際の重複が確認される前に共通フレームワークを作らない。
- 新規ゲーム・共通 UI の変更で既存ゲームの挙動を変えない。
- Android / iOS / Web の差は明示的に設計し、意図しない差分を作らない。

Canonical: `docs/ARCHITECTURE.md`, 各 game rules, tests

## 9. Canonical documents map

| Topic                                                                                      | Canonical source                                    |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Product philosophy / prohibitions / UX principles                                          | `docs/PRODUCT_PRINCIPLES.md`                        |
| Brand / public wording                                                                     | `docs/BRAND.md`                                     |
| GitHub repository metadata (description / homepage / topics)                               | `docs/BRAND.md`「GitHub リポジトリの公開 metadata」 |
| Architecture / dependency rules                                                            | `docs/ARCHITECTURE.md`                              |
| Offline behavior                                                                           | `docs/OFFLINE_POLICY.md`                            |
| App advertising / IAP                                                                      | `docs/ADS_POLICY.md`                                |
| Web role / differences / web measurement                                                   | `docs/WEB_VERSION.md`                               |
| Analytics interpretation                                                                   | `docs/GROWTH_MEASUREMENT.md`                        |
| Puzzle practice set (5 titles vs. their comparison games, dedicated web entry, promises)   | `docs/PUZZLE_PRACTICE_SET.md`                       |
| Android acquisition measurement (Meta) — operation, data inventory, removal                | `docs/META_ANDROID_ACQUISITION.md`                  |
| i18n                                                                                       | `docs/I18N_POLICY.md`                               |
| Release gates                                                                              | `docs/RELEASE_CHECKLIST.md`                         |
| Review prompt                                                                              | `docs/REVIEW_PROMPT_POLICY.md`                      |
| Backup / restore format and versioning                                                     | `docs/architecture/backup.md`                       |
| Club House (Public / Private) — Core との境界、費用の上限、順位の線、CI での証明           | `docs/PRODUCT_PRINCIPLES.md`「Club House」          |
| Club House — クライアント側の契約(入口・保存・API・挑戦と結果・順位・招待・Host・発見導線) | `docs/architecture/club.md`                         |
| Game-specific behavior                                                                     | `docs/<GAME>_RULES.md`                              |
| Current game inventory                                                                     | `apps/simple-games/src/app/registry.ts`             |
| Human-readable game inventory                                                              | `README.md`                                         |
| Historical implementation plans                                                            | `docs/plans/` — not authoritative after completion  |

## 10. Decision rules for proposals

新しい施策は次の順で評価する。

1. ユーザー体験、特に friction を改善するか。
2. Honest by design / Built by subtraction と矛盾しないか。
3. オフライン、低通信、低消費電力を維持できるか。
4. ローエンド端末で成立するか。
5. 固定インフラ費を増やさないか。
6. 保存データや既存ゲームを危険にさらさないか。
7. 実装と保守が十分に単純か。
8. その上で、流入・継続利用・収益へ合理的につながるか。

**8 を理由に 1–7 を破らない。**

## 11. Required reading before changes

変更前に全部の docs を読む必要はない。最低限:

- 常にこの `PROJECT_CONTEXT.md`
- product / UX の変更: `PRODUCT_PRINCIPLES.md`
- game の変更: 対象 `*_RULES.md`
- storage / migration: `ARCHITECTURE.md` + 対象 game rules
- backup / restore: `architecture/backup.md`(保存領域の所有と復元の安全性)
- club house(`src/club/`、Public / Private、対応ゲームの `challenge/`): `PRODUCT_PRINCIPLES.md`「Club House」+ `architecture/club.md`
- ads / purchase: `ADS_POLICY.md`
- Android acquisition measurement (Meta, `android/app/src/metaOn` / `metaOff`, `.github/scripts/check-principles.sh` §8): `PRODUCT_PRINCIPLES.md`「Android の獲得計測(Meta)」+ `META_ANDROID_ACQUISITION.md`
- web only: `WEB_VERSION.md`
- 練習セットの 5 本(Crown Grid / Number Path / Binary Balance / Sudoku 6×6 / Box Regions)や専用入口: `PUZZLE_PRACTICE_SET.md` + `BRAND.md`「自社タイトルと比較対象の名前」
- public copy: `BRAND.md`
- i18n: `I18N_POLICY.md`

Issue や会話に新しい恒久判断が生まれた場合、実装だけで終わらせず、この map の適切な canonical source も更新する。
