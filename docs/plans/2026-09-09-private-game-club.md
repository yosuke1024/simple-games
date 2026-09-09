# 計画: Private Game Club(Shared)— 契約から出荷までの段取り

作成 2026-09-09。Epic #175 の段 2(#161 の設計)を
[../architecture/club.md](../architecture/club.md) として固めた時点の段取り。
この文書は**計画**であり、完了した段は履歴になる([../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)
「Authority」5 — 正典は club.md と PRODUCT_PRINCIPLES.md「Shared」)。

## 0. いま何が決まっていて、何が無いか

| 段(Epic #175)       | 状態(2026-09-09)                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. 原則の境界(#176) | **済**。PR #189 でマージ。Core の約束は 1 語も変えず、Shared を Core の外の任意層と定義。CI ガード §1 の例外 1 ディレクトリ、import 境界の規則 5                         |
| 2. #161 の設計      | **この PR**。[../architecture/club.md](../architecture/club.md)。Core の入口 3 つの具体形、`sg.club`、API v1、3 本の spike、招待、Host 導線、Hub、通信境界、受け入れ条件 |
| 3. #164 の発見導線  | **設計はこの PR**(club.md §13)。実装は下の PR F                                                                                                                          |
| 着手条件            | #156(hardening)は 2026-09-09 にクローズ、#171(実機 3 件)も 2026-09-08 にクローズ。PROJECT_CONTEXT §5「#156 の High / Critical が残る間は着手しない」は解けている         |

**実装は無い。** `src/club/` は存在せず、サーバのリポジトリ(`simple-games-club`、2026-09-09 作成)はまだ空で、template も無い。
Core の画面・文言・保存・通信は #176 の前と同じである。

## 1. なぜ設計だけを先に置くか

- Epic #175 が順序を固定している(境界 → 設計 → 発見導線)。
- #176 が「`club/` が生まれる PR」に受け入れ条件を先に宣言した(独立チャンク・
  初期グラフ不在・実行時ゲートのテスト)。それらは `src/app/` が `club/` を実際に
  動的 import する PR でしか満たせず、その PR は接続先(サーバ)が無ければ
  「接続する」画面が何にもつながらない —— 「未実装状態で Coming Soon 表示」の禁止に
  実質で触れる。
- API の契約をこちらで持たないと、サーバを別リポジトリで先に作る根拠が無い。
  club.md §5 がその契約で、サーバ側はこれを fixture にした契約テストから始められる。

## 2. PR の段取り

各 PR は前の PR がマージされてから。**B(サーバ)が使える状態になるまで C 以降は
マージしない**(C を先にマージしても Core は変わらないが、Web 版を公開した時点で
「参加する」画面が空を指す)。

| PR    | どこ                 | 何を                                                                                                                                                                                                                                                                                                                                                                                           | 受け入れ                                                                                                                            |
| ----- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **A** | このリポジトリ       | この設計(club.md、本文書、正典の参照更新)。コードは無し                                                                                                                                                                                                                                                                                                                                        | docs のみ。`pnpm format:check`                                                                                                      |
| **B** | `simple-games-club`  | Node + SQLite + 1 volume。club.md §5 の API v1 を満たす。§5 の JSON を fixture にした契約テスト。Web ビルドを `/` と `/join` で配る(`/join/` → `/join`)。CORS(自 origin / `https://localhost` / `capacitor://localhost`)。token は hash 保存。`X-Club-Api: 1`。事業者の template(volume / healthcheck / `CLUB_SETUP_KEY` / serverless 既定 OFF)。Dockerfile 1 枚で他の事業者でも動く           | 契約テスト緑。手元(localhost)と事業者上の 1 台で `/health` → `/claim` → `/join` → `/challenges` の往復を確認                        |
| **C** | このリポジトリ       | **`club/` が生まれる PR**。`sg.club` / `sg.clubOutbox`(schema・backup 左置き・削除)、`src/app/clubGate.ts`(契機 3 つ)、`vite.config.ts` の `club` チャンク、`bundle-size.mjs` の club 規則、設定 > Advanced の行、`club/` の入口・参加(招待 URL 貼り付け / `/join`)・All Clubs・Club(Members / Settings / Disconnect)・API client・`club/i18n/`(14 言語)。**Challenge / 結果 / Create はまだ** | club.md §12 の 1・2・4・6・7。`pnpm test` / size gate 緑。Web 版で `/join#invite=` → Join が通る(B のサーバ)                        |
| **D** | このリポジトリ       | 3 本の対応(Sudoku / Minesweeper / Water Sort): `challenge/contract.ts`(import ゼロ)、`GameRootProps.challenge`、4 つ目のスロット、`boardDigest`、`ClubResultAction`(Core 1 コンポーネント + 3 キー)、Club の Challenge / Results / Records、`New Challenge`、未送信キュー。**高リスクキー**(「終えたら結果を送る」)を `highRiskKeys.ts` へ                                                     | club.md §12 の 3・5。各ゲームの golden がそのまま緑(生成器に触らない)。`gameKeys.test.ts` の golden に新キー 3 つを**意図して**足す |
| **E** | このリポジトリ       | Host になる: 説明画面(§8-2、高リスクキー 4 箇条)、Setup Key / claim(再設定による復旧を含む)、Owner リンクで端末を足す、Hosting 画面、Disconnect の本文(最後の Owner の 1 文)、referral の設定と表示、QR の描画。`HOSTING_TEMPLATE_URL` は B の template が公開されてから                                                                                                                       | 端末 → 事業者 → claim を実際に 1 回通す。**実コストの計測を開始**(club.md §14-7)                                                    |
| **F** | このリポジトリ(#164) | `Play together`(Core 2 キー)、`Create your own Club`(All Clubs / Settings の末尾)、pixapps.ai の Web 版での `Play together` の文言(招待リンクを開く案内)                                                                                                                                                                                                                                       | #164 の Acceptance Criteria(club.md §13 に写したもの)                                                                               |
| **G** | このリポジトリ + LP  | 出荷: README / ストア / LP / GitHub metadata / プライバシーページに Shared の節。Core の約束は Core の主語のまま。RELEASE_CHECKLIST に Shared の節(未接続端末のリクエスト 0 件の実機確認)                                                                                                                                                                                                      | BRAND.md「表現ルール」。実機で「未接続 = 0 リクエスト」を見る                                                                       |

C と D を分けるのは、C の時点で Core が受け取る変更を「設定の行 1 つ」に留め、
結果画面(Core の主要操作の場)への 1 コンポーネントを、Challenge の局が実際に遊べる
PR と同時に入れるため — 押しても何も送れない `Send to Club` を 1 リリースでも出さない。

## 3. #161 / #164 の Acceptance Criteria との対応

#161 本文と comment、#164 本文の受け入れ条件を、この設計のどこが引き受けるかで写す。
**満たすのは実装 PR であり、設計はそれを可能にするだけ。**

| 条件(要約)                                                                | 引き受ける場所                                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Shared 未設定ユーザーの Core UX / offline / network が変わらない          | club.md §2(入口 3 つ)、§3(実行時ゲート)、§12-2・§12-8                     |
| Settings > Advanced からのみ有効化                                        | §2-1、§7-3、§8-1                                                          |
| 接続済みのときだけホームに入口                                            | §2-2(数字を出さない)                                                      |
| Hub の中心が Active Challenges で、順位 / pressure UI でない              | §9、§6-1 `order`(1 軸・番号無し)                                          |
| realtime multiplayer を導入しない                                         | §10、§9「後続」                                                           |
| Endpoint + Invite Token または URL で参加、初回 join 後に member token    | §5-3 `/join`、§7                                                          |
| game save 全体を送らない                                                  | §5-5、§6-1(facts の閉じた型)、§12-3                                       |
| Web ブラウザだけで参加できる                                              | §7-1・§7-4                                                                |
| one-click deploy 導線、飛ぶ前に account / 費用 / 自己管理を明示           | §8-1〜§8-3                                                                |
| Disconnect ≠ server delete                                                | §8-5                                                                      |
| Owner が hosting 管理画面へ移動できる                                     | §8-4                                                                      |
| serverless 既定 OFF、cold start を通常 UX へ持ち込まない                  | 段取り B(template)、§14-6                                                 |
| 実コストを未計測のまま宣伝しない                                          | §8-2(金額を書かない)、§14-7                                               |
| PixApps に固定 backend cost が無い / referral 無しでも成立                | §8、PRODUCT_PRINCIPLES「Shared」                                          |
| Shared Server 障害が Core gameplay を止めない                             | §10                                                                       |
| 1 端末から複数 Club、Owner / Member 両立、All Clubs                       | §4-1、§9「入口」                                                          |
| Challenge の結果は起点 Club にだけ自動送信、通常 play は明示のみ          | §2-2、§6-3                                                                |
| personal stats と Club records を分離                                     | §6-2-3(統計に入れない)、§5-4(導出値のみ)                                  |
| Club ごとに nickname / token が独立                                       | §4-1                                                                      |
| 1 Host 障害が他 Host / Core へ波及しない                                  | §10「Club ごとに独立」                                                    |
| Owner が optional に referral URL を登録                                  | §5-3 `PATCH /hosting`、§8-4                                               |
| Member の `Create your own Club` が、設定済みなら Host の referral を使う | §8-2、§8-4(親の Host のリンクをそのまま開く。最上位だけ PixApps のリンク) |
| referral tree / earning leaderboard / payout を持たない                   | §13-3、PRODUCT_PRINCIPLES「紹介」                                         |
| (#164)`Play together` を自然に発見、技術語を主語にしない                  | §2-3、§13-1                                                               |
| (#164)対応 game の Result から Challenge、既存 Club 参加者は Club 選択    | §2-2、§6-3                                                                |
| (#164)未参加者は Join / Create を選べる                                   | §9「入口」                                                                |
| (#164)Club 体験後に `Create your own Club`                                | §13-3                                                                     |
| (#164)first-launch modal / badge / notification 無し                      | §13-5                                                                     |

**#164 から縮めたもの**: 未接続の端末の結果画面の `Challenge a friend`(club.md §2-4)。
**#161 から変えたもの**: ホームの入口に件数を出さない(§2-2)、Challenge はフォームでは
なく終わった局から作る(§6-3)、1 サーバ = 1 Club(§1)。Owner の端末は複数(§8-3。当初案の
「1 台」は製品オーナーが却下し、Owner リンクで足す形に改めた)。

## 4. Epic #175 の Acceptance Criteria

| 条件                                                                                                                 | 状態                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1 の PR がマージされている                                                                                           | 済(PR #189)                                                                                                                             |
| 改定後も Core について「全ゲームをオフラインで利用可能」「アカウント登録なし」「PixApps はサーバーを運用しない」が真 | 真。PRODUCT_PRINCIPLES は Core の主語で 1 語も変わっていない。この設計も Core に足すのは §2 の 3 つの入口だけ                           |
| Shared を設定していないユーザーの体験に、改定で許した範囲を超える追加が無い                                          | 設計上は §2-1(設定の行)と §2-3(ホームの 1 行)だけ。実装 PR C / F でこの範囲を超えないことを §12 のテストが見る                          |
| #161 と #164 がこの Epic を Tracking にしている                                                                      | 両 issue にコメントで #175 へ変更済み(2026-09-08)。本文の `Tracking: #156` / `Tracked by: #156` の行は未更新 — 製品オーナーが本文を直す |

## 5. 検証(この PR)

docs だけなので `pnpm format:check` と、docs を読むテストが無いことの確認
(`pnpm --filter simple-games test` を一度回す)。実機・ビルド・サイズは変わらない。

## 6. 非目標(この計画全体で作らないもの)

PRODUCT_PRINCIPLES「Shared」と club.md §9「後続」のとおり。加えてこの計画では:
アプリの App Links / Universal Links、QR の読み取り(カメラ権限)、pixapps.ai から
任意サーバへの直接接続、Owner token の複数端末配布、Club 内の通算 / シーズン /
ポイント、サーバ側の集計、Push。
