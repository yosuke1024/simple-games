# 計画: Club House の順位表 — 結果ごとに 1 行、ゲーム単位の棚、あなたの順位、報告の入口

作成 2026-10-10。製品オーナーが Public Club House の実物(約 25 表・10 人)を見て出した 3 つの
指摘 — 「量が増えると見づらい」「順位が上がることに魅力を感じるようにしたい」「通報が怖く見える」 —
への対応と、同日の追加判断「最高記録以外も記録したい(1 人 1 行をやめる)」の段取り。
正典は [../architecture/club.md](../architecture/club.md)(以下 club.md)と
[../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Club House」で、この文書は**計画**。
食い違えば正典が勝つ。サーバは [yosuke1024/simple-games-club](https://github.com/yosuke1024/simple-games-club)
(Node + SQLite と Cloudflare Workers + Durable Object。同じ `src/` と同じ契約テスト)。

## 0. 製品オーナーの判断(2026-10-10)

| # | 判断 | 退けた案 |
|---|---|---|
| 1 | **順位表は結果ごとに 1 行。** 同じ人が何度も並ぶ。履歴の別画面は作らない | 自己ベスト 1 行 + 本人だけの履歴 / 自己ベスト 1 行 + 「最近の結果」節 |
| 2 | Club 画面のランキングは**ゲーム単位にたたみ、ホームと同じカテゴリ棚**(タイル)にする | 表ごとの 1 行一覧のまま並べ替えだけ直す |
| 3 | Club 画面の先頭に**「あなたの順位」**の節(自分が入っている表だけ) | — |
| 4 | **1〜3 位の色分け・メダルの印**は付けてよい(「このぐらいなら原則に触れない」) | 1 位だけ太字 |
| 5 | **1 つ上の人との差**を出す | 出さない(「急かさない」の線上) |
| 6 | **通報は行から消す。** 他人の行には何も置かず、名前を押したシートの中に「報告」1 つ。日本語は「通報」→「報告」。持ち主の端末には出さない | 完全に外す(原則とストア規約に反する。§6)/ 画面に 1 か所の入口 |
| 7 | Web 版の下端のアンカー広告は Club 画面でもそのまま | — |
| 8 | ブロック機能は今は作らない(審査で求められたときの予備案だけ club.md に残す) | 端末内で「この名前を隠す」 |

採らなかった案(記録として): 結果画面に「記録を更新しました」(club.md §2-2 が名指しで禁止。改めるなら
原則の改定)、順位の共有カード(別判断)、LP に出ていることの注記(public ビューは memberId を出さないので
判定できない)、メンバー一覧を主画面から外す(オーナーが選ばなかった。一覧は残し、行のボタンだけ消す)。

## 1. 結果ごとに 1 行 — 契約の変更(club.md §16・§5)

**変わるもの**

- `ranking_entries` は **1 結果 1 行**。主キーは到着順の `seq`(今までの同値の順序づけに使っていた
  カウンタをそのまま行の識別子にする)。`(game_id, params_key, member_id)` の主キーは**やめる**。
- `Entry` に **`id`**(`seq` の文字列)が付く。
- `POST /rankings/results` は `completed` の結果を**必ず挿入**し `201`(`played` は今までどおり何も
  保存せず `200`)。応答は同じ形 `{ gameId, paramsKey, improved, entry, entryCount }` で、`improved` は
  「この行がその表での自分の最良か」、`entry` は挿入した行。
- **1 人あたりの上限** `rankingRowsPerMember`(既定 **50**、`limits.ts`): 1 つの表に 1 人が持てる行数。
  超えたら**その人の最も悪い行を落とす**(到着順ではない — 表の上位に居る行は残す)。上限は保存量と
  荒らし(1 分 60 件 × 1 日 = 86,400 行)を抑えるためで、普通に遊んで届く数ではない。挿入のたびに
  自分の行数を数える読みは `LIMIT 上限 + 1` で切るので、1 送信あたり最大 51 行。
- `ranking_tables` の `entry_count` は**結果の行数**(= 画面の「N 件」。今まで「人数」を「件」と
  書いていたずれが消える)。1 位は `leader_seq`(行の id。`leader_member_id` は捨てる)。
- `GET /rankings/:gameId/:paramsKey` の `me` は `{ rank, entry, nextValue }`: `entry` は**自分の最良の行**、
  `rank` はその順位(数える上限は今までどおり `rankingRankScan`)、**`nextValue`** は自分の最良より
  **厳密に良い値のうち最も近い値**(軸の数値。無ければ `null`。1 位なら `null`)。同値で先着の行は
  「1 つ上」に数えない(差 0 を「あと 0 秒」と出さないため)。読みは索引 `(game_id, params_key, value, seq)` を
  自分の値から逆向きに 1 行。`entries` には自分の行が何本あってもそのまま並ぶ(画面が `memberId` で
  `あなた` を付ける)。
- **`DELETE /rankings/:gameId/:paramsKey/entries/:id`**(新): 自分の行を **1 件**消す(`204`。自分の行で
  なければ / 無ければ `404`)。件数と 1 位を直す。
- `DELETE /rankings/:gameId/:paramsKey/me` は**互換のため残す**: その表の自分の**全部の行**を消す
  (v1.4.0 のクライアントが押す「自分の記録を消す」の意味がそれだから)。新しいクライアントは使わない。
- **`GET /rankings/mine`**(新): 自分が入っている表だけ `[{ gameId, paramsKey, entryCount, leader, best:
  { rank, entry, nextValue } }]`。`rank` を数える上限は **`rankingMineScan`(既定 50)** — 一覧では 50 位より
  下を番号なしにする(正確な順位は表の画面が 1,000 位まで言う)。読みは「自分の行(索引 `(member_id,
  game_id, params_key, value)` を 1 回)+ 表ごとに(1 位 1 + 順位の数え ≤ 50 + 1 つ上 1)」で、Club の
  人数にも表の人数にも比例しない。古いサーバは `404` → クライアントは節を出さないだけ。
- `rankOf` の `value < ? OR (value = ? AND seq < ?)` を**範囲 2 本**に割る(node:sqlite の計画器が OR に
  索引の範囲を当てず、表の全行を数えていた。反証役が `EXPLAIN QUERY PLAN` で確認)。契約は変わらない。

**変わらないもの**

- 表の鍵(`gameId` + `paramsKey`)、軸と向き(`src/contracts/games.ts`)、同値は先に出した人が上。
- デイリー(`Today`)は **1 人 1 結果のまま**(「最初に完了した結果が確定する」。§6-3)。この計画は
  ランキングだけを変える。
- `GET /rankings`(一覧)、`GET /public`(LP の上位 3 行 — 同じ人が 2 行以上を占めることがある。
  人で重複を除く表示は作らない: 2 つ目の順位の定義を持たないため)、`PATCH /me` /
  `PATCH /members/:id`(全行の `nickname` を変える)、`DELETE /members/:id?purge=1`(全行を消す)。
- `X-Club-Api` は **1 のまま**(追加と、意味を保った互換で済む)。

**スキーマ v6 の移行**(`src/db/driver.ts`): `ranking_entries` を新しい主キーで作り直して全行を写す
(既存の 1 人 1 行は、その人の最初の結果になる)。`ranking_tables` に `leader_seq` を足して今の
1 位の行から埋める。索引 `ranking_entries_member` を `(member_id, game_id, params_key, value)` に
作り直す。Durable Object の upgrade は一方通行(docs/cloudflare.md §3)なので、`migrate.test.ts` に
v5 のデータベースからの移行を 1 本足す。

## 2. 画面(club.md §9・§16-2)

### Club 画面(`ClubScreen`)

```text
PixApps Club                                   [設定]
再読み込み
あなたの順位                       ← GET /rankings/mine。1 件も無ければ節ごと出ない
  [▦] Crown Grid · かんたん      3 位 · 12 件    0:31   1 つ上まで 0:08
  [♠] Solitaire · 1枚めくり      1 位 · 2 件     125
今日                               ← 変わらない
ランキング                         ← ゲーム単位の棚。ホームの GAME_CATEGORIES の順、棚の中は registry の順
  ロジック
  [▦ Sudoku] [▦ Crown Grid]        ← ホームと同じ 2 列の game-cell(タイル + 題)。押すとそのゲームの表
  カード
  [♠ Solitaire] [♠ FreeCell]
10 人                              ← メンバー一覧は残す。行のボタンは無く、名前を押すとシート(§3)
報告された名前(持ち主だけ)          ← 今までどおり(Rename / Remove)
```

- 棚に出るのは**表が実在するゲーム**だけ(空の表・未参加のモードは並べない —「まだ手に入れていないもの」を
  見せない)。かつ、この端末で遊べるゲームだけ(`availableGames()`。アプリの home に出ない web-beta の
  表はアプリでは出さない。Web では出る)。
- 「あなたの順位」の並びは棚と同じ(カテゴリ → registry → モードの難易度順)で**固定**。順位順・最近順に
  しない(表が動くたびに並びが変わる / 活動の痕跡になる)。件数(「N 表に参加」)は出さない。
- **表から戻っても読み直さない**: `ClubRoot` が endpoint ごとに最後の `ClubData` を持ち、戻りは描画を
  保つ(読み直すのは開いたときと `再読み込み`、名前の変更・メンバーの操作のあとだけ)。

### 表の画面(`RankingScreen`)— ゲーム単位、モードはチップ

```text
← [▦] Crown Grid
[かんたん] [ふつう] [むずかしい]     ← 一覧に在るモードだけ。難易度順。既定は自分の行がある最初のモード、無ければ先頭
再読み込み
3 位 · 12 件 · 0:31 · 1 つ上まで 0:08      ← 自分の行があるときだけ。rank が null なら番号を出さず値だけ
 ①  Tuck    0:23   ミス 0  ヒント 1       ← ①②③ は金・銀・銅の丸い印(SVG/CSS。絵文字は使わない)
 ②  Yoh     0:29
 ③  あなた  0:31                 [削除]  ← 自分の行は全部「あなた」。削除は行ごと(静かな文字ボタン、確認は danger)
 4   Tuck   0:35
 …
 —
 87  あなた  1:20                [削除]  ← 自分の最良が 50 位より下なら末尾に(今までどおり)
12 件 · 結果ごとに 1 行。遊び終えた局がそのまま並びます。
```

- チップは `role="tablist"`。押すと `GET /rankings/:g/:p` を 1 回(本人の操作の直後だけ)。`ClubRoot` の
  stack の**最上段を置き換える**(push しない — 戻るは常に一覧へ)。1 表のゲーム(`standard`)はチップ
  無し。
- モードの順序表は `club/ui/common.tsx` の `modeOrder(gameId, key)`: `standard` → easy < medium = normal <
  hard、`NxN` は N の昇順、Schulte は (N, ascending < descending < odd-then-even)、Dots and Boxes は
  small < medium < large、Quick Math は addsub < multiply < divide < missing < mixed、Solitaire は draw-1 <
  draw-3、Spider は 1 < 2 < 4 suits、Mahjong は `levelRange` の下限、Water Sort は easy < medium < hard、
  知らないキーは最後に文字順。`titles.test.ts` の `EVERY_KEY` で全キーに順序が付くことを固定。
- 上位 3 行の印: 順位の数字を金・銀・銅の丸地に置く(`--medal-gold` 系のトークン、ダークモード別値)。
  **その表の中の印**であって、持ち越す称号ではない。
- 「1 つ上まで {gap}」は自分の最良の行の分だけ(`me.nextValue` と `me.entry` の軸の値の差。時間は
  `formatDuration`、それ以外は `{label} {n}`)。期限・通知・後ろとの差は無い。

### デイリーの結果(`ChallengeScreen`)

行の形は今までどおり(1 人 1 結果)。上位 3 行の印だけ表と揃える。他人の名前はシート(§3)を開く。

## 3. 名前のシートと報告(club.md §17-3)

- ランキングの表・デイリーの結果・メンバー一覧の**他人の名前**を押すと、小さなシート(`NameSheet`、
  `GameActionSheet` と同じ `overlay` / `sheet` のクラス)が開く: 名前、その行の記録(表の行なら
  `factsLine`、メンバー行なら参加日)、**「報告」ボタン 1 つ**。それ以外(ほかの表の記録・回数)は載せない
  (公開プロフィールに寄せない)。
- 「報告」→ 確認(`clubReportTitle` / `clubReportBody`)→ `POST /members/:id/report`(契約は不変)。
  終わるとシートが閉じ、画面上部に `role="status"` の 1 行(`clubReported`)。行の印は変えない。
- **持ち主の端末**では名前を押しても何も開かない(自分への報告は意味が無く、持ち主の対処は Members /
  Reported の Rename / Remove)。自分の名前も開かない。
- 日本語だけ語を変える: `clubReport`「報告」、`clubReported`「報告済み」(持ち主の節見出しにも使われていて
  「通報しました」が見出しとして読めない不具合も直る)、`clubReportTitle`「この名前を報告しますか?」、
  `clubReportBody`「Club の持ち主に、この名前が報告されたことが伝わります。ほかには何も送られません。」、
  `clubReportCount`「報告 {n} 件」。en と残り 12 言語は触らない(en は 12 言語の原文)。
- ストア規約との関係(2026-10-10 に原文を確認): Apple 1.2 は「報告の仕組み」、Google Play の UGC
  ポリシーは「アプリ内の報告システム」を求めるが、**行ごとのボタンも置き場所も指定していない**。
  名前のシートの中の 1 ボタンで足りる。Google は公開 UGC に**ブロック**も求めており、今のアプリには無い
  (1.4.0 は通った)。予備案は club.md §14 の未決に 1 行残す。

## 4. i18n(club.md §11)

| キー | en | ja | 扱い |
|---|---|---|---|
| `clubMyRankings` | Your rankings | あなたの順位 | 新。普通のキー |
| `clubToNext` | {gap} to the next rank | 1 つ上まで {gap} | 新。普通のキー |
| `clubRowsNote` | One row per result: every game you finish is listed. | 結果ごとに 1 行。遊び終えた局がそのまま並びます。 | 新。普通のキー |
| `clubDeleteEntryTitle` | Delete this result? | この結果を消しますか? | 新。**高リスク**(削除の確認) |
| `clubDeleteEntryBody` | Only this result is deleted. Your other results stay. This cannot be undone. | この結果だけが消えます。ほかの結果は残ります。元に戻せません。 | 新。**高リスク** |
| `clubDeleteRankingTitle` / `clubDeleteRankingBody` | — | — | **削除**(「この表の自分の記録・次の局でまた入る」は 1 人 1 行の文言) |
| `clubReport*` | 不変 | 「通報」→「報告」 | ja だけ |

残り 12 言語は機械翻訳で足す(高リスクの 2 つは `highRiskKeys.ts` に載せ、承認は未承認のまま。
[../RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) §3 と同じ扱い)。行の削除ボタンの表示語は既存の
`clubDeleteConfirm`(「削除」)を使い、アクセシブルな名前は `clubDeleteRecord`。「{m} 位 · {n} 件」は
既存の `clubRank` と `clubEntries` を並べる。Core のカタログには何も足さない。

## 5. 作業の分け方

| 順 | 束 | 範囲 | 検証 |
|---|---|---|---|
| 1 | 文書 | この計画、PRODUCT_PRINCIPLES「順位表」、club.md §5-3 / §5-4 / §9 / §11 / §14(判断 45〜51)/ §16 / §17-3 / §18、RELEASE_CHECKLIST の Report の手順 | 読み合わせ |
| 2 | サーバ | `schema.ts` v6 + `driver.ts` の移行、`store.ts`(挿入・上限・1 位・件数・`rankOf` の範囲 2 本・`nextValue`・`mine`・行の削除)、`api/rankings.ts`(新 2 ルート、`me` の形)、`shape.ts`(`id`)、`limits.ts`、契約テスト(`rankings.test.ts` / `migrate.test.ts` / `public.test.ts` / `members.test.ts` の X-Club-Rows)、`docs/cloudflare.md` §3 の実測 | `pnpm test`(node + workers)、`pnpm lint`、`pnpm typecheck`、`pnpm measure:rows` |
| 3 | クライアント A | `club/api/types.ts`(`id`、`me.nextValue`、`RankingMine`)、`client.ts`(`rankingsMine`、`deleteMyEntry`)、`storage/outbox.ts` + `bridge.ts` + `storage/schemas.ts`(ランキングの項目は結果ごとに 1 つ、`clientId` 付き。統合しない。club.md §4-2)、`types.test.ts` | `pnpm verify:changed` |
| 4 | クライアント B | `club/ui/common.tsx`(`modeOrder`、`axisGap`)、`ClubScreen.tsx`(棚・あなたの順位・名前シート・メンバー行)、`RankingScreen.tsx`(チップ・印・行ごと削除・自分の行)、`ChallengeScreen.tsx`(印・シート)、`NameSheet.tsx`、`ClubRoot.tsx`(置き換え遷移・データの保持)、`club.css`、`club/i18n/*`(14 言語)、`highRiskKeys.ts`、`ClubRoot.test.tsx` / `titles.test.ts` | `pnpm verify:changed` → フル |
| 5 | 仕上げ | `RELEASE_CHECKLIST.md` の実機項目、App Review メモの文言(Report の場所)、Codex レビュー(高リスク経路: 保存・削除・i18n)、**landing の Club House 節の文言**(`pixapps-landing/public/simple-games/index.html` の「メンバーの自己ベストが並びます / ranking of the members' personal bests」を結果ごと 1 行の言い方に。別リポジトリ) | — |

2 と 3〜4 はリポジトリが別で、3〜4 は 2 の契約(この文書 §1)に合わせて先に書ける。本番への
デプロイ(2)とストアへの出荷(4)は製品オーナーの操作。

## 6. 受け入れ

- サーバ: 同じ人の 2 件目が**別の行**として入り、`entryCount` が 2 になること。上限 51 件目で最も悪い行が
  落ちること。`rankOf` が表の大きさに比例しないこと(`X-Club-Rows` で、他人の行 3 件と 40 件で読みが
  同じ)。`nextValue` が同値で先着の行を飛ばすこと。`entries/:id` が他人の行に `404` で何もしないこと。
  `/me` が自分の全行を消すこと。v5 → v6 の移行で 1 人 1 行がそのまま 1 結果 1 行になること。
- クライアント: 棚がホームの順で並び、空のカテゴリが出ないこと。チップが難易度順で、既定が「自分の行の
  ある最初のモード」であること。自分の行がすべて「あなた」で、削除が 1 行だけ消すこと。①②③ の印が
  1〜3 位だけに付くこと。「1 つ上まで」が 1 位には出ないこと。他人の名前を押すとシートが開き、持ち主の
  端末では開かないこと。行に「通報 / 報告」の語が無いこと。表から戻って一覧が読み直されないこと。
  14 言語に新キーが揃うこと(`i18n.test.ts`)。
- 原則: Core の画面は 1 語も変わらない(`clubResultWiring` / `check-principles.sh` が緑)。
