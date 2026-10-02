# Club House — クライアント側の契約

作成 2026-09-09、改題 2026-09-30。issue #161 の**設計**であり、
Epic #175 の段 2(原則の境界 #176 → **#161 の設計** → #164 の発見導線)に当たる。
境界の正本は [../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Shared」で、この文書は
その境界の**内側で #161 と #164 をどう作るか**を固定する。索引と要約は
[../ARCHITECTURE.md](../ARCHITECTURE.md)。

**2026-09-30 の改定**: PixApps が運用する **Public Club House** を認め、同じ盤面での
成績の順位表を作ると決めた(`simple-games-club#1`、PRODUCT_PRINCIPLES「Club House」)。
**本文書は両デプロイの契約**である。§5 が共通部分で、Public はここに**足す**ことは
あっても**変えない**。Public 固有のもの(開かれた参加、デイリーの順位表、読み量、設定)は
**§15** に 2026-10-02 に追記した(段取りの PR C)。Cloudflare の構成と費用は
`simple-games-club` の docs/cloudflare.md に、LP への読み取り専用ビューは PR G で決める。
段取りは [../plans/2026-09-30-public-club-house.md](../plans/2026-09-30-public-club-house.md)。

**クライアント実装は 2026-10-02 の PR で入る**(`apps/simple-games/src/club/`。段取りは
[../plans/2026-10-02-club-client.md](../plans/2026-10-02-club-client.md) — 段取りの PR D と E)。
サーバは [yosuke1024/simple-games-club](https://github.com/yosuke1024/simple-games-club) にあり、
Node + SQLite と Cloudflare Workers + Durable Object の 2 実装が同じ契約テストを通す
(`simple-games-club#2`、2026-10-02)。
**2026-10-02 の改定(自動送信)**: 結果の送信を「結果画面のボタン」から「参加したあとは遊び終えた
結果が自動で送られる」へ改めた(製品オーナー確認、§14 判断 37〜41)。同意の場所は結果ごとの
ボタンから**参加の画面**(「参加の前に、参加中は結果が自動で送られると言う」)へ移る。§2-2・§4-2・
§6-3・§9・§10・§11・§12・§16・§18 はこの前提で書き換えた。
**2026-10-02 の改定(参加と削除)**: 参加(入る・切断する)と、自分の記録の削除を**別のもの**にし
(判断 42。削除は**記録 1 件ずつ**で、全部を一度に消すボタンは無い)、同じ端末で同じ Club に入り直すと**同じメンバー**に戻り、名前はいつでも変えられる(判断 43)。
招待リンクでの参加は v1.4.0 では**隠す**(判断 44)。§4-1・§5-3 / §5-4・§7・§8-5・§9・§10・§11・§14・§15-1・
§17-3 はこの前提で書き換えた。
issue #161 / #164 の本文とコメントは提案・検討の記録であり、この文書と食い違う箇所は
この文書を正とする([../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)「Authority」)。

## 0. この文書が決めること、決めないこと

決めること — Simple Games 側に置かれるすべて:

- Core(Shared を有効化していない状態)に現れる入口の**具体形**(§2)
- `src/club/` の置き場所・到達経路・チャンク・実行時ゲート(§3、§12)
- 端末側に保存する接続情報と未送信キュー(§4)
- サーバとの API 契約(§5)。サーバ実装は別リポジトリだが、**契約はこちらが持つ** —
  クライアントを出荷するのはこのリポジトリであり、サーバはこの契約に合わせて作る
- 挑戦(Challenge)と結果(Result)の型と、ゲームごとの契約・盤面の同一性(§6)
- 招待 URL の形と Web からの参加(§7)、Host になる導線(§8)、Club の画面(§9)
- 通信の条件と障害の境界(§10)、i18n(§11)、発見の導線(§13)

決めないこと:

- サーバの内部構造(SQLite のスキーマ、プロセス構成、ログ)。§5 の契約を満たす限り
  サーバ側の自由で、変更してもクライアントは変わらない
- ホスティング事業者の template の中身、実コスト、referral の条件(§14「外部確認」)
- v1 の後に足すもの(掲示板、投票、Club の書き出し。§9「後続」)

## 1. 用語

| 語               | 意味                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**         | Shared を有効化していない状態のアプリと Web 版。PRODUCT_PRINCIPLES の全約束の主語                                                                                                                                                                                          |
| **Club House**   | 本人が明示的に参加したときだけ現れる任意の層。デプロイは 2 つ — **Public Club House**(PixApps が運用、誰でも参加)と **Private Club House**(利用者が建てる、招待制。2026-09-09 まで Private Game Club と呼んでいたもの)。実装側の語は `src/club/` のままで、`Shared` は旧称 |
| **サーバ**       | 利用者(または招待した知人)が建てた 1 台。**1 台 = 1 Club**(v1)。複数の Club に入る = 複数のサーバに接続する。API に Club の id を持たせるのはこの固定を将来ほどけるようにするためで、v1 のサーバは 1 つしか返さない                                                        |
| **Host / Owner** | サーバを建てた人。`role: 'owner'` の member。建てる・払う・消すのはこの人で、PixApps は関与しない。Owner の端末は複数持てる(Owner リンクで足す。§8-3)                                                                                                                      |
| **Member**       | 招待で参加した人。端末ごとに member token を持つ。同じ人が別の端末で入れば別の member(§4)                                                                                                                                                                                  |
| **Challenge**    | 「このゲームを、このモードで、この seed で」を Club に置いたもの。**終わった 1 局から作る**(§6)。締切は無い                                                                                                                                                                |
| **Result**       | 1 つの Challenge に対する member 1 人の結果。結果画面が表示した事実だけ(§6)。**1 人 1 回**                                                                                                                                                                                 |
| **Club 記録**    | そのゲーム・そのモードでの Club 内ベストとその持ち主。自己ベストと同じ意味の「記録」で、挑戦をまたいだ順位ではない(PRODUCT_PRINCIPLES「順位表」)                                                                                                                           |
| **接続**         | 端末が 1 つのサーバについて持つ endpoint + member token。`sg.club` の 1 要素(§4)                                                                                                                                                                                           |

## 2. Core に現れるもの — 入口 3 つの具体形

PRODUCT_PRINCIPLES「Core が Shared から受け取る変更は次の 3 つまで」を、画面と
コードの単位に落とす。**これ以外に Core の画面・文言・保存・通信は増えない。**

### 2-1. 設定 > Advanced の入口 1 つ(常に在る)

- 設定画面に **Advanced** の節を 1 つ足し(現状この節は無い。Backup & Restore の
  下、ローカルデータ削除の上)、行を 1 つ置く: `Club House`。副題は無し。
- 押すと `src/app/` が `club/` を動的 import し(§3)、Club の入口画面(§9「入口」)
  を開く。接続が 1 つも無ければ「参加する / 自分の Club を作る」、あれば Club 一覧。
- Core が持つ文言はこの 2 キー(`advancedTitle` / `clubEntry`)だけ。
- 設定画面はコレクションホームからしか到達しないので、ゲームが起動中にこの行が
  描かれることはない(既存の `SettingsSection` と同じ性質)。

### 2-2. 接続済みの端末だけ — ホームの入口 1 つ + 結果画面の状態 1 行

**接続済み** = 起動時に `sg.club` の接続が 1 つ以上ある(§4)。判定は Core の
`src/app/` が保存の有無だけで行い、通信しない。

- **ホームの入口**: 「最近遊んだ」の下・カテゴリ節の上(`CollectionHomeScreen` の
  流れの中の 1 枚として、Web 版のアプリ案内カードと同じく「無ければ場所を取らない」
  形。あちらはヒーローの直後に置かれるので位置は重ならない —— 2026-09-11 の
  常設化で上へ移った。[WEB_VERSION.md](../WEB_VERSION.md)「アプリへの送客」)。
  内容は見出し `Club House` と、`sg.club` にキャッシュされた Club 名を
  「 · 」で連結した 1 行(`Suzuki Family · Pune Office`)。
  **数字を出さない** — #161 の例にある「3 active challenges」は置かない。件数を出す
  にはホームを描くたびに通信する必要があり(PRODUCT_PRINCIPLES「通信は…本人の操作の
  直後にだけ」に反する)、出せたとしてもそれはバッジであり「まだ手に入れていないもの
  を見せて呼び戻す」仕掛けになる。押すと `club/` の Club 一覧(1 つなら直接その Club)。
- **結果画面の状態 1 行**(2026-10-02 まで在った `Send to Club` のボタンは無い): 契約(§6-1)を
  持つゲームの結果画面に、`ShareAction` と同じ位置に**操作ではない 1 行**。実体は Core の 1 コンポーネント
  `ui/components/ClubResultAction.tsx` で、`ShareAction` と同じくゲームが自分の結果カードに置く。
  結果画面が現れたときに結果を **1 回**、参加していて自動送信に同意している**すべての Club** へ送り(`ClubBridge.sendResult`)、
  何が起きたかを `role="status"` の 1 行で言う。押すものは無い — 同意はボタンではなく**参加の画面**
  にあり(§7-4、§15-1。「開示が先、送信が後」)、結果ごとにボタンを置くと、押さずに次の盤面へ進んだ
  良い記録が失われる。
  - **行き先は結果の種類で決まる**(1 回の判定、§6-3 / §16): デイリーの印(`daily`)と `boardDigest` が
    ある局(全員同じ盤面のデイリー)は、その日の挑戦(`Today`)へ。それ以外の `completed` は、
    そのゲーム × モードのランキングへ。`outcome: 'played'` は**どこへも送らない**
    (デイリーを黙って確定させてしまううえ、ランキングは見ないので)。`played` を渡すのは Minesweeper(地雷)・
    Number Match(行き止まり)・Dominoes(勝てなかった局)の 3 本だけ。点数を競うほかのゲーム(2048・
    Block Puzzle・Bunny Hop・Sky Fighter・Number Recall と、対 CPU の Yacht・Hearts・Gin Rummy・Mancala・
    Reversi・Dots and Boxes)は、ゲームオーバーや負けの局も `completed` として点数を送る(判断 30)。
  - **1 つの Club のとき**: `Sent to Suzuki Family` / `Will send when you open the Club`(端末のキューに
    残った。§4-2、§10)/ `Could not send to Suzuki Family`(最終的に拒まれた)。
    **2 つ以上のとき**: 全部届けば `Sent to 2 Clubs`、一部だけなら `Sent to 1 of 2 Clubs. The rest will
    send when you open them.`。サーバがその結果を既に持っていた Club(デイリーを 2 度目に送った)は
    数えず、全部がそうなら何も言わない — 先に送ったものが数える(§6-3)。
  - **自動送信に同意していない接続へは送らない**(§4-1 の `autoSend`)。自動送信の前に参加した接続
    (v1.3.2 から更新した端末)は、Club の画面の上の箱で開示を受け入れるまで、送らず・キューに積まず・
    状態の行にも出さない。接続が**すべて**そうなら、結果画面の行は空のまま(行の場所は残る)。受け入れる
    前に遊び終えた局は、受け入れたあとにも送られない(参加の前の局と同じ。§10、判断 39)。
  - **接続していない端末では描かない**(下)。結果画面の他の要素の位置は、接続の有無でも状態の
    文言の長さでも変わらない(行は常に 1 行で、`aria-live` の `status`)。
  - **何も送られない局**: 契約を持たない 6 本(Brick Breaker / Bubble Pop / Checkers / Connect Four /
    Gomoku / Ludo)は `ClubResultAction` が無く、何も送らず何も言わない。Water Sort は、ティアに一致しない
    レベルの局(デイリーでもフリープレイでもない)で `ClubResultAction` を描かず、送らない(§6-3、
    [../WATER_SORT_RULES.md](../WATER_SORT_RULES.md) §14)。結果画面はそれを理由つきで言わない
    (「送られなかった」の通知を、対象外のゲームの全プレイに出さないため。ランキングの画面に
    そのゲームの表が無いことで分かる)。
  - **既知の制限**: 結果カードは 0.9 秒の間(`useResultReveal`)のあとに現れ、送信はカードが現れたときに
    始まる。その間に盤面を離れる(Back / ↻)と何も送られない。§10。
- 接続していない端末では、このコンポーネントは **null を描き、何も知らない**。
  結果画面の他の要素(主要操作・共有・広告枠)の位置は接続の有無で変わらない。
- Core が Club から受け取る結果画面の変更は、この**状態 1 行だけ**(PRODUCT_PRINCIPLES「Core が Club House
  から受け取る変更」の 2 番目の「結果画面の副次操作」は、ボタンから状態表示へ読み替えた)。順位・件数・
  「新しい記録」は出さない。
- 機械的に足さない。置くのは §6-1 の契約を持つゲームだけで(2026-10-02 に 35 本へ広げた。
  勝ち負けしか無い対 CPU のボードゲームには置かない)、`src/test/shareWiring.test.ts` と
  同型の静的テストが「契約のあるゲームにだけ在り、自分の id を名乗る」ことを見る。

### 2-3. 接続していない端末 — ホームの静かな入口 1 つ(#164)

2-2 のホームの入口と**同じ位置に 1 行**: `Play together` と、副題 1 文
`Private challenges with people you know.`。カードではなく低コントラストのテキスト
行で、タイル・カテゴリ・お気に入りより目立たない。押すと `club/` の入口画面
(参加する / 自分の Club を作る)。

- **バッジ・点滅・初回起動の案内・Coming Soon は無い**。押さなければ何も起きず、
  通信は 0。
- 接続済みと未接続で入口は**同じ 1 枠**を使う。ホームの他の要素の位置は Shared の
  有無で変わらない。
- Web 版(pixapps.ai)にも同じ行を置く。参加は招待リンクを開くことで成立するので、
  pixapps.ai から任意のサーバへ直接つなぐ経路(#161 が「必要性が確認された後」と
  した拡張)は要らない(§7-3)。

### 2-4. 結果画面の「Challenge a friend」を未接続の端末に置かない

#164 は未接続の端末の結果画面にも `Challenge a friend` を置き、参加 / 作成へ誘導する
案だった。#176 が結果画面の操作を**接続済みの端末に限った**ので、これは置かない。
未接続の人が Shared に出会う場所は 2-1 と 2-3 の 2 つだけである。理由は結果画面が
Core の「主要操作の場」であり、そこに Shared の宣伝を置いた時点で 30 本の結果画面が
成長施策の掲示板になるからで、#164 自身の「Result 画面の主要 action を圧迫しない」
とも同じ側にある。

## 3. `src/club/` — 置き場所・到達経路・チャンク・実行時ゲート

PRODUCT_PRINCIPLES「機械で示すこと」1〜4 を、ディレクトリと関数の名前に落とす。

```text
apps/simple-games/src/club/
├─ index.ts              エントリ。`ClubRoot` を named export(§9)。先頭で `import './i18n'`
├─ i18n/                 14 言語のカタログ(ゲームと同じ形。§11)
├─ api/
│   ├─ client.ts         fetch はここだけ(check-principles.sh §1 の例外はこのディレクトリ)
│   ├─ types.ts          §5 の request / response 型と validate
│   └─ errors.ts         §5 のエラーコード
├─ contract/
│   ├─ challenge.ts      §6 の Challenge / Result の envelope と、ゲームごとの契約の型
│   └─ digest.ts         boardDigest の照合(計算はゲーム側。§6-4)
├─ storage/
│   ├─ connections.ts    `sg.club` の読み書き(schema は Core の `storage/schemas.ts`。§4)
│   └─ outbox.ts         `sg.clubOutbox`(§10)
├─ invite.ts             招待 URL の解析と除去(§7)
└─ ui/                   画面(§9)
```

- **到達経路は 1 本**: `src/app/clubGate.ts` の動的 `import('../club')` だけ
  (`src/test/importBoundaries.test.ts` 規則 5)。ゲーム・`ui/`・`services/`・
  `storage/`・`i18n/`・`backup/` は `club/` を import しない。
- **Core が club/ に渡すもの、club/ から受け取るもの**は、`src/app/` が仲介する
  React context 1 つ(`ui/clubBridge.ts` の `ClubBridge` 型)にまとめる。型は Core に
  置く(import ではない)。`ClubResultAction` はこの context を読むだけで、`club/` を
  知らない。context の値(`{ connections, sendResult(payload) }`)は `club/` がロードされた後に
  `App.tsx` が差し込む。`sendResult` は投げず、接続ごとに `sent` / `queued` / `rejected` / `already`
  の報告を返す。`App.tsx` が覚えるのは、Today の `Play` から開いたゲームを離れたときに Club の
  その挑戦へ戻るための印(`ClubFocus`)だけである。
- **`club/` がゲームへ触るのはレジストリ経由だけ**: 対応ゲームは `GameDefinition` に
  `challenge` を宣言し(§6-2)、`club/` はそれしか読まない。
- **チャンク**: `vite.config.ts` の `codeSplitting` に `src/club/` → `club` の 1 グループ
  を足す(`game-<id>` と同じ形、`includeDependenciesRecursively: false`)。
- **実行時ゲート**(`src/app/clubGate.ts`): 動的 import を呼ぶ契機は次の 3 つだけ。
  1. 起動時に `sg.club` に接続が 1 つ以上ある(§4)。ホームの入口と結果画面の状態を
     描くのに `club/` が要るため、この場合だけ起動直後にロードする。ロードは
     ディスクからで、通信ではない。
  2. 招待リンクを開いた(§7)。
  3. 本人が設定 > Advanced の行(2-1)、またはホームの `Play together`(2-3)を押した。

  どれも無ければ呼ばれない。3 つ目は #176 の文言(接続と招待の 2 つ)に**この文書で
  足した**もので、理由は 2-1 / 2-3 の入口が押されたときに `club/` 以外に開く画面が
  無いから(Core が「参加する / 作る」の画面を持てば、Shared の文言と画面が Core へ
  入る)。3 つとも**本人の操作かその結果**であり、ホームを描いただけで呼ばれることは
  無い。§12 の実行時テストが固定する。

## 4. 端末側の保存 — `sg.club` と `sg.clubOutbox`

接続情報は **shell-owned の共有レコード**として `sg.` 接頭辞に置く。理由は 2 つ:
「ローカルデータ削除」が `STORAGE_KEYS` を走査するので自動的に消えること、
`src/backup/keys.test.ts` が「運ぶ / 運ばない」を決めるまで通らないこと。
どちらも新しい仕組みを足さずに既存の門を通る。

`SchemaDef` は Core の `storage/schemas.ts` に置く(`sg.iap` と同じ扱い — 中身は
Shared のものだが、起動時の判定(§3 の契機 1)と削除・バックアップの門が `club/` を
ロードせずに読めなければならない)。`club/` は読み書きにこの schema を使う。

### 4-1. `sg.club` — 接続

```ts
interface ClubConnections {
  schemaVersion: 1;
  connections: ClubConnection[]; // 0 件 = 未接続。順序は参加順
  departed?: ClubConnection[]; // 切断した Club の資格。最大 10 件。送らない・キューに積まない(下)
}

interface ClubConnection {
  endpoint: string; // origin だけ。`https://club.example.com`。末尾スラッシュ・パス・クエリ無し
  clubId: string; // サーバが発行。§5-2 `club.id`
  clubName: string; // 表示用キャッシュ。§5-2 `club.name` を最後に読んだ値
  memberId: string; // サーバが発行
  memberToken: string; // 秘密。この端末だけ。バックアップに入れない(下記)
  nickname: string; // この Club でのこの端末の名前
  role: 'owner' | 'member';
  joinedAt: string; // ISO 8601
  autoSend?: true; // この端末が自動送信の開示を見て参加した / Club の画面で受け入れた。無い = 何も送らない
}
```

- **`autoSend` は同意の記録である**(2026-10-02)。結果の自動送信への同意は参加の画面の開示
  (`clubAutoSendDisclosure`、§7-4)がすべてなので、**その開示を見ずに作られた接続は、結果を送らない**。
  ボタンの版(v1.3.2。手動の `Send to Club`)で参加した端末は、更新後も `sg.club` に接続を持つが、
  開示を一度も見ていない — 更新した途端に送り始めると「同意していない送信」になる。そこで接続に
  任意の `autoSend?: true` を足した: **参加の 3 経路(Public・貼った招待リンク・招待 URL)は
  `true` を付けて保存する**(開示が参加の前に出ているので)。付いていない接続は、`ClubBridge.sendResult`
  が**送らず、キューにも積まず、報告にも含めない**(§2-2、§10)。持ち主が Club の画面の上に出る
  1 つの箱で同じ開示を読んで `Send my results automatically`(`clubAutoSendAccept`)を押すと
  `acceptAutoSend` が `true` を書き、そこから送り始める。押さなくても Club は普通に使える
  (結果が送られないだけ)。**追加だけの変更**で、`schemaVersion` は 1 のまま・`autoSend` の無い
  レコードも有効(validate は `autoSend === true` のときだけ残し、それ以外の値は落とす =
  同意を推測しない)。`ClubConnectionSummary`(§3 の橋)には入れない — シェルが知るのは名前だけで、
  同意の判定は送る関数(`bridge.ts`)が持つ。
- **切断した Club の資格は `departed` に残す**(2026-10-02、判断 43)。`Disconnect this device`(§8-5)は
  `connections` から要素を外し、**同じ要素をそのまま `departed` へ移す**。目的は 1 つだけ — 同じ端末で同じ
  Club へ入り直したとき、**同じメンバー(同じ member id・同じ記録・Owner なら Owner のまま)に戻す**こと
  (§7-4。入り直すたびに別の人として登録されると、1 人が何行も記録を持てる)。**追加だけの変更**で、
  `schemaVersion` は 1 のまま・`departed` の無いレコードも有効。
  - **最大 10 件**。要素ごとの検査は `connections` と同じ(壊れた要素だけが落ちる)。バックアップに入れない
    のも同じ(レコードごと `SHELL_KEYS_LEFT_BEHIND`。上)。
  - **`departed` の要素は何も起こさない**: **送らない・キューに積まない・起動時に `club` のチャンクを
    読まない**(§3 の契機は `connections` だけを見る。切断しただけの端末は §5.16 の「接続していない端末」と
    同じ — 通信 0)。ホームの入口(§2-2)の「接続済み」にも数えない。
  - **使われるのは入り直すときだけ**(§7-4): 参加の画面が、その endpoint の `departed` を見つけたら
    `GET /club` でトークンを確かめ、生きていれば `connections` へ戻し、`departed` から外す。
  - **`Reset Local Data` は `connections` と同じく消す**(同じレコード)。そのあとの参加は新しいメンバー。
  - **これは秘密を端末に残しておくことである**: 切断しても member token は端末に残る。バックアップに
    入らず、端末の外へ出ず、Reset で消える(`connections` にいた間と同じ扱い)。本人が「この端末から
    完全に消したい」なら `Reset Local Data` がそれである。
- **validate は要素ごと**。壊れた要素は落とし、正しい要素は残す。全体が読めなければ
  既定値(0 件)に倒す — その端末は「未接続」に見えるだけで、Core のゲーム・保存・
  設定には何も起きない(PRODUCT_PRINCIPLES「Shared 情報破損で Core game data を
  消さない」)。**member token はサーバ側に hash でしか無い**ので、端末側のレコードが
  消えれば(アンインストール・`Reset Local Data`・別の端末)その端末は同じメンバーとして
  認識されず、再参加は**新しいメンバー**になる(判断 43)。これは受け入れる — token を復元できる
  経路(バックアップ、クラウド)を作るほうが害が大きい。端末を識別する値(device id)も作らない
  ので、サーバは「同じ端末」を知らない。同じメンバーに戻れるのは、**この端末のレコードが残って
  いるときだけ**である。
- `endpoint` は **https のみ**。例外は `http://localhost` と `http://127.0.0.1`
  (開発用)だけで、private network(`10.`, `192.168.`, `.local`)への http は v1 では
  受け付けない(#161「arbitrary URL 接続時は localhost / private network 等の扱いを
  明示する」への答え: 明示的に**拒否**)。
- 同じ `endpoint` への接続は 1 つまで(同じ Club に 2 つの nickname で入らない)。
- 1 端末の接続は **10 件まで**(Owner として / Member として、を問わず合計)。11 件目は
  参加画面で断る。アカウントが無いので「1 人あたり」の上限はサーバにも端末にも
  置けず、置けるのはこの端末単位の上限だけである。
- **バックアップに入れない**: `src/backup/keys.ts` の `SHELL_KEYS_LEFT_BEHIND` に
  理由付きで載せる — `sg.iap` と同じく、ファイルはコピーできるので入れた時点で
  「コピーできる鍵」になる。復元しても接続は戻らない。**`Reset Local Data` は消す**
  (端末のデータの一部だから)。
- `docs/architecture/storage-keys.md` の表への追加は、キーが実在する PR(段取りの
  PR C)で行う。

### 4-2. `sg.clubOutbox` — 未送信の結果

2026-10-02 の自動送信で、キューは「Challenge の結果だけ」から**すべての送信**を持つ形に広がった
(`schemaVersion` は 1 のまま、足すだけの変更)。

```ts
interface ClubOutbox {
  schemaVersion: 1;
  items: OutboxItem[]; // 古い順。上限は約 100 件(超えたら統合したうえで古いものから落とす)
}

type OutboxItem =
  | { endpoint; challengeId; result: ResultSubmission; createdAt } // 旧形式。そのまま読め、送れる
  | { kind: 'daily'; endpoint; body; createdAt; attempts? } //   POST /challenges の本文(`daily` 付き)
  | { kind: 'ranking'; endpoint; body; createdAt; attempts? }; // POST /rankings/results の本文
```

- **本文は Core が再宣言する**(Core は `club/` を import しない。構造の検査は厳格で、壊れた要素だけが落ちる)。
- **書いてから送る**(write-ahead): 結果はまずキューへ入れ、その Club 宛てを古い順に送り、この結果の
  行き先を報告する。送れれば取り除く。アプリが落ちても失われない。
- **統合**(同じ表・同じ盤面の重複で肥らせない): ランキングは `endpoint|gameId|paramsKey` を鍵に、契約の
  `order` / `direction`(§6-1)で**良いほう 1 件**だけを残す(サーバも自己ベストしか持たない)。
  デイリーは `endpoint|gameId|seed|boardDigest` を鍵に**最初の 1 件**を残す(§6-3)。
- **上限は約 100 件。** 統合した**あとで**だけ古いものから落とす。以前の 50 件は、すべてのゲーム × すべての
  Club を持つと良い記録を捨てうるので広げた。
- **キューの変更はすべて直列化する**(モジュールの Promise 連鎖。ネットワーク待ちの間は握らない)。
  並列に失敗した 2 つの結果が互いの書き込みを消さないため(lost update)。
- **捨てる条件**: §10 の「再送しても通らない」応答。ネットワークの失敗・429 は何回でも残る。それ以外の
  失敗(5xx、形の崩れた応答)は `attempts` を数え、**5 回で捨てる**(詰まった 1 件が後続を止め続けない)。
  各 Club の送信は、**最初の再送対象の失敗で止める**。
- 同じセッションでオーバーレイが描き直されても同じ結果を二度送らない(ブリッジのクロージャに指紋を持つ。
  メモリだけで、保存しない)。
- **自分の記録の削除は、その記録を作り直すキューの要素だけを捨てる**(§9 の記録ごとの削除ボタン、判断 42):
  削除の前に、その Club 宛ての未送信のうち**消す記録を作り直すもの**だけを捨て(ランキングの行なら
  同じ endpoint + `gameId` + `paramsKey`、デイリーの結果なら同じ endpoint + `gameId` + `seed` +
  `boardDigest`)、同じ記録の「送った」の記憶(上の指紋)も忘れる。削除の直後にキューの結果が記録を
  作り直さないため。ほかの記録の未送信には触れない。

ゲームの保存とは混ぜない(#161「Shared 専用の小さな local queue」)。送るのは §10 の契機のときだけで、
タイマーもバックグラウンドも無い。**起動時には送らない。** バックアップに入れない・削除で消える、は
`sg.club` と同じ。

## 5. サーバとの契約 — API v1

サーバは別リポジトリだが、**契約はこちらが持つ**(§0)。サーバ側のリポジトリにはこの
節を満たす契約テスト(この節の JSON をそのまま fixture にしたもの)を置く。

### 5-1. 共通

- ベース: `<endpoint>/api/v1/`。JSON(`Content-Type: application/json; charset=utf-8`)。
- 認証: `Authorization: Bearer <memberToken>`。`/join`・`/claim`・`/health` だけは不要。
  token は URL・クエリ・ログに出さない。
- サーバはレスポンスに `X-Club-Api: 1` を付ける(4xx / 5xx にも)。クライアントは
  **この値を見て**、知らない版なら「このサーバは新しすぎます」を出して何も送らない(§10)。
- 一覧を返すエンドポイント(`GET /challenges` / `GET /challenges/:id/results` /
  `GET /records`)は JSON **配列**をそのまま返す。他はオブジェクト。
- エラーは `{ "error": { "code": "<snake_case>", "message": "<英語 1 文>" } }`。
  `message` は開発者向けで、画面には出さない(画面の文言は `code` から
  クライアントのカタログで引く。§11)。

| HTTP | code                  | いつ                                                                    |
| ---- | --------------------- | ----------------------------------------------------------------------- |
| 400  | `invalid_request`     | body が契約に合わない                                                   |
| 401  | `unauthorized`        | token が無い / 不正 / **revoke 済み**(Member 削除)                      |
| 403  | `forbidden`           | Owner 専用の操作を Member が呼んだ                                      |
| 404  | `not_found`           | Challenge / Member が無い                                               |
| 409  | `already_submitted`   | その Challenge にこの member の Result が既にある、または**本人が取り下げた**(§6-3「1 人 1 回」) |
| 409  | `board_mismatch`      | Result の `boardDigest` が Challenge のものと違う(§6-4)                 |
| 409  | `invite_expired`      | 招待 token が無効(再発行済み)                                           |
| 409  | `setup_key_used`      | Setup Key が既に使われた / 一致しない(§8)                               |
| 409  | `last_owner`          | 最後の Owner を外そうとした(§8-3)                                       |
| 409  | `too_many_owners`     | Club の Owner が上限(5)に達している(§8-3)                               |
| 409  | `too_many_members`    | Club の member が上限(100)に達している                                  |
| 413  | `too_large`           | body が 16KB を超えた(`params` / `facts` が 1KB を超えたときは 400)     |
| 429  | `rate_limited`        | 下記の上限                                                              |
| 500  | `internal_error`      | サーバの不具合。クライアントは他の未知の code と同じく汎用の 1 行で扱う |
| 501  | `unsupported_version` | `contractVersion` をサーバが知らない                                    |

- rate limit は最小限: `/join` と `/claim` は IP あたり 10 回 / 分、それ以外は
  member あたり 60 回 / 分。超えたら 429 で、クライアントは再試行しない(次の操作まで)。
- CORS: サーバは自分の origin、`https://localhost`(Android の Capacitor)、
  `capacitor://localhost`(iOS)を許可する。pixapps.ai は v1 では許可しない(§7-3)。
- token の生成と保存: invite token と Owner リンクは 128 bit、member token と Setup Key
  は 256 bit の乱数を base64url で。サーバ DB には **SHA-256 の hash** だけを置く
  (server secret を pepper として連結。secret は環境変数 `CLUB_SECRET`、無ければ
  volume 上に生成して保つ)。例外は **Member 招待 token だけ**で、これは平文で保存する —
  Owner が何度でも取り出して配るものであり(`GET /invite`)、作り直せば無効になる
  入場券であって、既存の誰かを名乗れる鍵ではない。member token・Owner リンク・
  Setup Key の平文は発行時のレスポンスにしか存在しない。

### 5-2. 型

```ts
interface Club {
  id: string;
  name: string; // 1..40 文字
  createdAt: string;
}
interface Member {
  id: string;
  nickname: string; // 1..24 文字。Club 内で一意でなくてよい(同名は id で区別)
  role: 'owner' | 'member';
  joinedAt: string;
}
interface Challenge {
  id: string;
  gameId: string; // レジストリの GameId。クライアントが知らない id は一覧に出さない
  contractVersion: 1; // §6 の envelope の版
  params: unknown; // ゲームごと(§6-1)。サーバは中身を解釈しない(サイズ上限 1KB)
  seed: string; // 1..80 文字
  boardDigest: string; // §6-4
  title: string | null; // 0..60 文字。無ければクライアントが「Sudoku · Hard」を組む
  daily: string | null; // その局がデイリーだった日(YYYY-MM-DD)。全員同じ盤面のデイリーだけ(§6-3)。無ければ null
  createdBy: Pick<Member, 'id' | 'nickname'>;
  createdAt: string;
  resultCount: number; // 一覧の「誰かが遊んだか」のため。順位ではない
  mine: boolean; // 自分の Result があるか(一覧を「まだ / もう」で分けるため)
}
interface Result {
  memberId: string;
  nickname: string; // 提出時点の名前
  submittedAt: string;
  outcome: 'completed' | 'played'; // 結果の共有と同じ意味(services/share/message.ts)
  facts: unknown; // ゲームごと(§6-1)。サーバは解釈しない(サイズ上限 1KB)
}
interface RankingEntry {
  memberId: string;
  nickname: string; // 提出時点の名前
  submittedAt: string; // この自己ベストを出した時刻
  facts: unknown; // §6-1。axis の値はここから読む
  seed: string; // その局の seed(由来。表示しない。アーケードは空)
  boardDigest: string | null; // §6-4 を持つゲームだけ
}
interface Hosting {
  provider: string | null; // 'railway' 等。サーバの環境変数から
  manageUrl: string | null; // 事業者側の管理画面
  referralUrl: string | null; // Owner が置いた、自分の referral リンク(§8-4)。無ければ null
  lastActivityAt: string | null; // 最後の書き込み(join / challenge / result)
}
```

### 5-3. エンドポイント

| Method / Path                      | 認証   | 目的                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                      | 不要   | `{ ok: true, api: 1, claimed, open }`。接続画面の疎通確認とテンプレートの healthcheck。`claimed` は Create 導線が「deploy 済み・claim 待ち」を知るため。`open` は nickname だけで `POST /join` できるデプロイか(Public。§15-1)                                                                                     |
| `POST /join`                       | invite | `{ nickname, inviteToken? }` → member token。`inviteToken` は `open` でないサーバでは必須(無ければ `400 invalid_request`)。`open` なサーバでは nickname だけで member として参加でき、招待 token / Owner リンクも今までどおり効く(§15-1)                                                                           |
| `POST /claim`                      | setup  | `{ setupKey, nickname, clubName? }` → **owner** の member token(§8-3)。`clubName` 省略時は `<nickname>'s Club`。Setup Key が再設定されていればもう 1 回                                                                                                                                                            |
| `GET /club`                        | member | `{ club, me, members[] }`                                                                                                                                                                                                                                                                                          |
| `GET /challenges`                  | member | 新しい順。`?after=<id>` で続き。最大 50 件。`?daily=YYYY-MM-DD` でその日の印が付いた挑戦だけ(§6-3、§9 の `Today`)                                                                                                                                                                                                  |
| `POST /challenges`                 | member | 作成 + 作成者の Result を同時に(§6-3)。任意の `daily`。**同じ盤面(gameId + seed + boardDigest)の挑戦が生きていれば作らず、送った人の Result をそこへ足して `200`**(§6-3「盤面ごとに 1 つ」)。既に自分の Result があれば `409 already_submitted`                                                                    |
| `DELETE /challenges/:id`           | member | 作成者本人か Owner だけ。Result ごと消える                                                                                                                                                                                                                                                                         |
| `GET /challenges/:id`              | member | 1 件                                                                                                                                                                                                                                                                                                               |
| `GET /challenges/:id/results`      | member | **ゲームの軸で上位 N 件**(§6-1 の `order`。完了が先、同値は到着順)。要求した本人の行は常に含める(§15-2)。応答の形は変わらない                                                                                                                                                                                                                                                   |
| `POST /challenges/:id/results`     | member | 自分の Result を 1 回だけ                                                                                                                                                                                                                                                                                          |
| `GET /records`                     | member | `{ gameId, paramsKey, facts, memberId, nickname, challengeId }[]`。導出値。サーバは結果が届いたときに更新した行を読むだけで、一覧のたびに導出しない(§15-3)                                                                                                                                                         |
| `POST /rankings/results`           | member | `{ gameId, contractVersion, paramsKey, params, seed, boardDigest, outcome, facts }` → その結果を**ゲーム × モードのランキング**へ(§16)。自己ベストなら差し替え、そうでなければ何も変えない。`{ gameId, paramsKey, improved, entry, entryCount }`。サーバが知らないゲーム / 軸の無い facts は `400 invalid_request` |
| `GET /rankings`                    | member | 表の一覧 `{ gameId, paramsKey, entryCount, leader: Entry }[]`(ゲーム・モード順)。`GET /records` はこの `leader` を旧い形で返すだけになった(2026-10-02)                                                                                                                                                             |
| `GET /rankings/:gameId/:paramsKey` | member | 1 つの表 `{ gameId, paramsKey, entryCount, entries: Entry[], me }`。`?top=` で上位 N(既定 50、最大 100)。`me` は自分の順位と行(表に無ければ null。順位は数える上限より下なら null)                                                                                                                                 |
| `GET /club`(改定)                  | member | `{ club, me, memberCount, members }`。`members` は新しい順に最大 `membersPage`(50)件。Public の 1 万人を毎回は読まない(§17-2)                                                                                                                                                                                      |
| `PATCH /members/:id`               | owner  | `{ nickname }` — 表示名を変える(通報への対処)。Result とランキングの行の名前も変わる(§17-3)                                                                                                                                                                                                                        |
| `DELETE /members/:id?purge=1`      | owner  | 外すと同時に、その人の Result とランキングの行を消す(`purge` 無しは今までどおり名前つきで残す)(§17-3)                                                                                                                                                                                                              |
| `POST /members/:id/report`         | member | 表示名を Club の持ち主に通報する。1 人 1 回。本文なし(§17-3)                                                                                                                                                                                                                                                       |
| `GET /members/reported`            | owner  | 通報された人 `[{ member, reportCount }]`、多い順(§17-3)                                                                                                                                                                                                                                                            |
| `GET /public`                      | 不要   | LP 向けの読み取り専用ビュー(§18)。`open` なデプロイだけ。`?date=YYYY-MM-DD`                                                                                                                                                                                                                                        |
| `GET /hosting`                     | member | `Hosting`。`manageUrl` は **Owner にだけ**返す(Member には null)                                                                                                                                                                                                                                                   |
| `PATCH /hosting`                   | owner  | `{ referralUrl }` の設定 / 解除(`null`)                                                                                                                                                                                                                                                                            |
| `GET /invite`                      | owner  | 現在の Member 招待 `{ token, url }`                                                                                                                                                                                                                                                                                |
| `POST /invite`                     | owner  | `{ role: 'member' }` は Member 招待を**作り直す**(前のものは即無効)。`{ role: 'owner' }` は **Owner リンク** `{ token, url, expiresAt }` を 1 本発行(1 回限り・24 時間。§8-3)                                                                                                                                      |
| `DELETE /members/:id`              | owner  | member を外す(Owner も外せる)。その token は即 401。Result は残る(nickname 付き)。最後の Owner は外せない(`409 last_owner`)                                                                                                                                                                                        |
| `PATCH /club`                      | owner  | `{ name }`                                                                                                                                                                                                                                                                                                         |
| `PATCH /me`                        | member | `{ nickname }` — **自分の**表示名を変える(§5-4。Owner も使える)。Result とランキングの行の名前も変わる。**通報は消えない**(§17-3)                                                                                                                                                                                  |
| `DELETE /rankings/:gameId/:paramsKey/me` | member | **自分の**ランキングの行を 1 つ消す(§5-4。Owner も使える)。行が無ければ `404`。`204` |
| `DELETE /challenges/:id/results/me` | member | **自分の** Result を 1 つ消し、**その挑戦への以後の送信を断る**(`409 already_submitted`。§5-4)。Result が無ければ `404`。`204` |

### 5-4. 主な request / response

`POST /join`

```json
{ "inviteToken": "…", "nickname": "Ken" }
```

`open` なサーバ(`GET /health` の `open: true`。Public、§15-1)では `{ "nickname": "Ken" }` だけで
よい。そうでないサーバで `inviteToken` を省くと `400 invalid_request`。

```json
{
  "club": { "id": "c_1", "name": "Suzuki Family", "createdAt": "2026-09-09T00:00:00.000Z" },
  "member": { "id": "m_7", "nickname": "Ken", "role": "member", "joinedAt": "…" },
  "memberToken": "…"
}
```

`POST /challenges`(作成者の Result を同時に。§6-3)

```json
{
  "gameId": "sudoku",
  "contractVersion": 1,
  "params": { "difficulty": "hard" },
  "seed": "sudoku-free-mf8k2a-1x9q",
  "boardDigest": "sd1:9f3a1c07",
  "title": null,
  "result": {
    "outcome": "completed",
    "facts": { "elapsedSeconds": 271, "mistakes": 0, "hints": 1 }
  }
}
```

→ `201` with `Challenge`(`mine: true`, `resultCount: 1`)。

任意の `"daily": "2026-10-02"` を付けると、その局がその日のデイリーだったという印になる
(§6-3。全員同じ盤面のデイリーだけ)。**同じ盤面(gameId + seed + boardDigest)の挑戦が
生きていれば**、サーバは新しく作らず、送った人の Result をそこへ足して `200` with その
`Challenge`(`mine: true`)を返す。既に自分の Result があれば、または**自分が取り下げた**挑戦なら `409 already_submitted`
(何も保存しない)。最初に送った人の `daily` と `title` が残る。

`POST /challenges/:id/results`

```json
{
  "contractVersion": 1,
  "boardDigest": "sd1:9f3a1c07",
  "outcome": "completed",
  "facts": { "elapsedSeconds": 305, "mistakes": 2, "hints": 0 }
}
```

→ `201` with `Result`。2 回目と、**取り下げたあと**(下の `DELETE /challenges/:id/results/me`)は
`409 already_submitted`。digest が違えば
`409 board_mismatch`(何も保存しない)。

`PATCH /me`(自分の表示名。Owner も使える)

```json
{ "nickname": "Ken K." }
```

→ `200` with `Member`(`POST /join` の `member` と同じ形)。表示名の規則は §17-1 のとおり(`POST /join` と
同じ検査で、守らなければ `400 invalid_request`。表示名の重複は許す)。**Result とランキングの行の
`nickname` も変わる**(持ち主の `PATCH /members/:id` と同じ)が、**自分で変えたときは通報を消さない**
(消せば、通報された人が名前を変えるだけで数を戻せる。持ち主が変えたときは消える。§17-3)。

`DELETE /rankings/:gameId/:paramsKey/me`(自分のランキングの行を 1 つ消す。Owner も使える)

本文なし → `204`。**その表の自分の行だけ**を消し、表の件数と 1 位も直す(表が空になったら集計行も消す)。
**メンバーのまま Club に残り、token も生きている**。**以後の局はまたその表へ入る**(普通の自己ベストの
差し替え。§16-1)。その表に自分の行が無ければ `404 not_found`。ほかの表・Result・通報には触れない。

`DELETE /challenges/:id/results/me`(デイリーの自分の Result を 1 つ消す。Owner も使える)

本文なし → `204`。**その挑戦の自分の Result だけ**を消し(`resultCount` を直す)、**取り下げた印**
(`withdrawn_results`: 挑戦 id + member id)を残す。**この挑戦への以後の送信はすべて `409
already_submitted`**(`POST /challenges/:id/results` と、同じ盤面のデイリーを `POST /challenges` で足す
経路の両方)。デイリーの Result を消すことは**その日の挑戦から抜ける**ことで、「最初に完了した結果が数える」
(§6-3)は変わらない — 消して取っておき、良い結果で送り直すことはできない。その挑戦に自分の Result が
無ければ `404 not_found`。**自分が作った挑戦は消さない**(他の人の Result がぶら下がっている)。
**通報は残る**。取り下げた挑戦は、その人に対して **`mine: true`** を返す(アプリが「終わると送られます」
と言い直さず、`Play again` と出すため。もう送れないことは自分の Result がある挑戦と同じ)。

**全部の記録を一度に消すエンドポイントは無い**(`DELETE /me/records` は作らない。判断 42)。持ち主が
メンバーを外して結果ごと消す `DELETE /members/:id?purge=1`(§17-3)は別で、同じ消し方の実装を使う。

`GET /records` の `paramsKey` は §6-1 のゲームごとの規則で作る文字列(`hard` /
`medium` / `easy` など)。**Club 記録は Result から導出する値であり、サーバは
Result 以外の集計(通算・ポイント・回数の順位)を持たない**。順位が付くのは 1 つの
挑戦の中だけで、積み上げた順位は作らない(PRODUCT_PRINCIPLES「順位表」)。この導出のためだけに、
サーバは §6-1 の表の `order`(比較軸)と `paramsKey`(モードを決める params の項目)を
ゲーム id ごとに知る(`simple-games-club` の `src/contracts/games.ts`)。それ以外の場所で
`params` / `facts` を読まない。表に無いゲームの Challenge と Result は普通に扱い、
記録だけが(サーバがそのゲームを知るまで)導出されない。

### 5-5. 送らないもの(再掲、機械で見るもの)

Result の body に入るのは `contractVersion` / `boardDigest` / `outcome` / `facts` だけ。
`facts` の各ゲームの型は §6-1 が閉じており、**結果画面が表示する事実以外の
フィールドを持たない**(アプリ版、端末名、OS、locale、統計、自己ベスト、進行、
時刻以外のメタデータは無い)。クライアント側の `api/types.ts` の型と、それを固定する
ユニットテスト(§12)がこれを守る。

## 6. 挑戦と結果の契約

### 6-0. 何が「挑戦が自然に成立する」か

条件は 3 つ。(1) 盤面が seed から決定的に生まれる、(2) その決定性を golden テストが
既に固定している(挑戦の同一性は、既存プレイヤーの自己ベストの土台と同じものに
乗る)、(3) 結果画面が比較軸になる事実を表示している。
Phase 0 で Sudoku / Minesweeper / Water Sort の 3 本を実装事実で確かめた(2026-09-09、`main` のコード):

| ゲーム      | seed → 盤面                                                                                                          | golden                                        | 結果画面の事実(= 共有の `details`) | 比較軸 |
| ----------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ---------------------------------- | ------ |
| Sudoku      | `createFreeSession(difficulty, seed)` — `generatePuzzle(seed, difficulty)`。派生 seed の再生成も生成器の内側で決定的 | `game/compatibility.test.ts`                  | 時間 / ミス / Hint                 | 時間   |
| Minesweeper | `createDifficultySession(difficulty, seed)` + `tapCell(session, firstIndex)` — **地雷は初手で決まる**(§4 の規則)     | `game/compatibility.test.ts`(seed + 初手の組) | 勝ち: 時間 / Hint。負け: 無し      | 時間   |
| Water Sort  | `createFreeSession(tier, seed)` — `generatePuzzle(seed, colors, mix)`。リトライ番号も seed の乱数列に含まれる        | `game/compatibility.test.ts`                  | 手数 / 時間 / Hint                 | 手数   |

3 本で事実の形が 3 通り(時間だけ / 時間と敗北 / 手数と時間)揃うので、envelope が
この 3 通りを表せれば残りのゲームは同じ形に収まる。**2026-10-02 に「同じ盤面」の条件を
デイリーに限った**(PRODUCT_PRINCIPLES「順位表」、§16)ので、ランキングには「結果画面に
数字(時間・手数・スコア)が出る」ことだけが要る — 35 本(§6-1 の表の 4 群)。入れないのは
勝ち負けしか無い対 CPU のボードゲーム(Checkers / Connect Four / Gomoku / Ludo)と、結果画面に
数字を出さない Brick Breaker / Bubble Pop(出すようになれば入る)。

**Minesweeper の初手は盤面の一部である**(Phase 0 の発見 1)。同じ seed でも初手が
違えば地雷が違う(`generateField(seed, difficulty, firstIndex)`)。そのためデイリーは
全員同じ盤面にならず、Today の挑戦にならない(§6-3「`daily` の印」)。結果は `params.firstIndex`
(最初に開いたマス)と `boardDigest` を添えてランキングへ送る(§16)。局を「その初手を
開いた状態で始める」ことはしない — 挑戦の盤面を別の端末で作り直す経路(下記)は 2026-10-02 に
出荷前に取り除いた。

**seed は生成器の版に依存する**(Phase 0 の発見 2)。golden が守っている限り版が変わって
も同じ盤面だが、golden を意図して更新した版(自己ベストの土台を変える判断をした版)と
古い版の間では同じ seed が違う盤面になる。Challenge は `boardDigest`(§6-4)を持ち、
比較の同一性は文書ではなく digest で守る。現在の挙動は次のとおり(`ui/components/ClubResultAction.tsx`、
`club/bridge.ts`):

- Today の `Play` はそのゲームを**普通の入口で開く**だけで(プレイヤーがデイリーを遊ぶ)、挑戦の盤面は渡さない(§16-3)。
  シェルが覚えるのは、離れたときに Club の挑戦へ戻るための印(`ClubFocus`)だけで、**結果の送り先は決めない**。
- 結果画面の `ClubResultAction` は、デイリーの局なら**自分の局の** `daily` と `boardDigest` を添えて送る
  (§2-2)。サーバは同じ `gameId` + `seed` + `boardDigest` の挑戦に結果を足すので、別の端末の同じ日の局が
  同じ挑戦に集まる。生成器が変わった版の端末のように digest が違えば、その端末の局は**別の挑戦**になる
  (元の挑戦の結果にはならない。§6-3「盤面ごとに挑戦は 1 つ」)。以前の `ActiveChallenge` /
  `isChallengeBoard`(Today から開いた局の digest だけを照合して自動送信し、それ以外は押すボタンに戻す
  分岐)は、ボタンと一緒に 2026-10-02 に無くなった。
- **局を拒む画面は無い。** 以前(spike)は、ゲームが挑戦の盤面を受け取って digest を照合し、
  不一致なら遊ばせず `This challenge was made with a different version of the game` を出していた。
  この経路(`challenge` prop・per-game の club モード・4 つ目の保存枠)は 2026-10-02 に
  出荷前に取り除いた(§16-3)。

### 6-1. ゲームごとの契約(v1)

```ts
// contract/challenge.ts(club/)と、各ゲームの challenge/contract.ts(§6-2)が共有する形
interface GameChallengeContract<P, F> {
  contractVersion: 1;
  /** サーバから来た params を受け入れるか。壊れていれば null(throw しない) */
  validateParams(raw: unknown): P | null;
  validateFacts(raw: unknown): F | null;
  /** Club 記録の単位(§5-4 の paramsKey)。同じ文字列 = 同じ「モード」 */
  paramsKey(params: P): string;
  /** 並べ替え: 比較軸 1 つ。`played` は末尾に提出順 */
  order: keyof F;
  /** `asc` = 小さいほど上(時間・手数)、`desc` = 大きいほど上(スコア)。2026-10-02 */
  direction: 'asc' | 'desc';
}
```

**4 群 35 本(2026-10-02)**。契約の葉はゲームごとに `challenge/contract.ts`(§6-2)で、
params(表を分けるモード)と facts(結果画面の数字)はそのゲームの結果画面がすでに出して
いるものだけを使う。

| 群             | `direction` | ゲーム                                                                                                                                                                                                               |
| -------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 時間           | `asc`       | Sudoku / Sudoku 6×6 / Minesweeper / Nonogram / Takuzu / Kakuro / Futoshiki / Crown Grid / Number Path / Shape Regions / Schulte Table / Binary Balance / Box Regions / Quick Math / Memory Match / Mahjong Solitaire |
| 手数           | `asc`       | Water Sort / Sliding Puzzle / Solitaire / Spider Solitaire / FreeCell / Number Match / Hit and Blow(試行回数)                                                                                                        |
| スコア         | `desc`      | 2048 / Block Puzzle / Bunny Hop / Sky Fighter / Number Recall / Yacht / Gin Rummy / Dominoes / Mancala / Reversi(石数)/ Dots and Boxes(箱数)                                                                         |
| 低いほど良い点 | `asc`       | Hearts                                                                                                                                                                                                               |

| ゲーム      | `params`                                                        | `facts`(`completed`)                                 | `facts`(`played`) | `order`          | `paramsKey`  |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------- | ----------------- | ---------------- | ------------ |
| sudoku      | `{ difficulty: 'easy' \| 'medium' \| 'hard' }`                  | `{ elapsedSeconds: int, mistakes: int, hints: int }` | (起きない)        | `elapsedSeconds` | `difficulty` |
| minesweeper | `{ difficulty: 'easy' \| 'medium' \| 'hard', firstIndex: int }` | `{ elapsedSeconds: int, hints: int }`                | `{}`              | `elapsedSeconds` | `difficulty` |
| water-sort  | `{ tier: 'easy' \| 'medium' \| 'hard' \| 'daily' }`              | `{ moves: int, elapsedSeconds: int, hints: int }`    | (起きない)        | `moves`          | `tier`       |

- `int` は 0 以上の整数。`elapsedSeconds` は 0..86400、`moves` / `mistakes` / `hints` は
  0..100000。範囲外は validate が落とす。
- **`facts` は結果画面の `details` と同じ事実**である。ゲームは `ClubResultAction` に
  `details`(共有と同じ、整形済み文字列)と `facts`(構造化)の両方を渡し、
  `facts` の値は `details` の値と同じ変数から作る(`session.elapsedSeconds` /
  `session.mistakeCount` / `session.hintCount` / `session.moveCount`)。ここで数字を
  計算しない。
- `order` は 1 軸だけ。同値は提出順のまま。**順位の数字を付けてよい**(2026-09-30 に
  「付けない」を撤回。PRODUCT_PRINCIPLES「順位表」)。付くのは 1 つの盤面の中の順位だけで、
  挑戦をまたいだ通算・ポイント・称号は無い。2 軸目(Sudoku のミス、Water Sort の時間)は
  表示するが並べ替えに使わない — 「時間は速いがミスが多い」をどう順位付けるかを製品が
  決めた時点で、それは成績の比較ではなく採点になる。

### 6-2. ゲーム側の対応 — レジストリの `challenge` と、シェルが覚える挑戦

対応ゲームが持つのは 1 つだけ。**そのゲームの中**に置き、シェルはレジストリ経由でしか触らない。
ゲームは挑戦を受け取らない(`GameRootProps` は `onExit` と `entry` のまま。2026-10-02、§16-3)。

1. **`games/<id>/challenge/contract.ts`** — §6-1 の `GameChallengeContract` の実装。
   `storage/keys.ts` と同じ **import ゼロの葉**で、レジストリが同期 import して
   `GameDefinition.challenge?: GameChallengeContract<unknown, unknown>` として公開する。
   葉にする理由も同じ — `club/` が Challenge 一覧を描くときに params の妥当性と
   `paramsKey` が要り、そのためにゲームのチャンクをロードしたくない。
   `src/test/importBoundaries.test.ts` 規則 3 と同じ「import ゼロ」の検査を足す。
2. **シェルが覚える挑戦への戻り道** — Today の `Play` を押すと、シェルはどの Club のどの挑戦かを
   `ClubFocus` として持ち、ゲームはふつうの入口で開かれ、プレイヤーがそのデイリーを遊ぶ。ゲームは
   Club の id を知らない。`ClubFocus` は、そのゲームを離れたときに Club のその挑戦の画面へ戻るためだけにある
   (結果の送り先には関わらない。§2-2)。
3. **結果画面**: どの局の結果画面でも、`ClubResultAction` は結果を自動で送り、状態 1 行を出す(§2-2)。
   Today から開いた局も、ホームから開いたデイリーも同じ扱いである。局はそのゲームの普通の局なので、統計・
   自己ベスト・レベル進行・レビュー計数は普通の局と同じに扱われる(Challenge 用の別扱いは無い)。

### 6-3. Challenge は終わった 1 局から作る — 2026-10-02 以降はデイリーだけ、自動で

#161 の「誰かが Challenge を作る」を、**フォームでもボタンでもなく、終わった 1 局の自動送信**に置く。
**2026-10-02 に、全員同じ盤面のデイリー以外の局は Challenge にせずランキング(§16)へ送ることにし、
同じ日に送信を自動にした**(判断 37〜41)。

- 結果が現れると、`ClubBridge.sendResult` が行き先を **1 回だけ**決める(§2-2): `daily` が文字列で
  `boardDigest` が null でなければ **デイリー**(`POST /challenges` に `daily` を付けて 1 回)、そうでなければ
  `outcome: 'completed'` を**ランキング**へ(`POST /rankings/results`、§16)。`played` はどこへも送らない。
  作成者の結果が最初の Result になる。
- 理由: (a) 盤面を生成せずに Challenge を作る経路(seed だけ決めて digest を計算するためにゲームの
  ロジックを `club/` から呼ぶ)が要らなくなる — digest は遊んだ局が既に持っている。(b) 「自分がまだ
  遊んでいない盤面を人に出す」形が無くなり、Challenge は常に「私はこうだった、あなたは?」になる。
- (2026-10-02 まで Club の画面に在った `New Challenge` は無くなった — §9。フリープレイの局は
  ランキングへ送る。)
- **1 人 1 回、最初に完了した結果が数える**: 1 つの Challenge に対する Result は member あたり 1 つで、
  最初に**完了した**(`completed`)結果が数える。解答を見たあとに同じ盤面を遊び直しても同じ挑戦ではない。
  `played`(負け・行き止まり)は**送らない**ので、失敗した 1 回が挑戦を黙って確定させることは無い
  (リードの設計注記。§14 末尾)。2 回目の完了はクライアントが送っても(キューは書いてから送る。§4-2)サーバが
  `409 already_submitted` を返し、クライアントはこれを**届いたのと同じ**(`already`)に数える。同じセッションの
  再描画では指紋で二度送らない。デイリーは今日の 1 問だけ(2026-10-02)で、`Today` も端末の今日の挑戦だけを並べる。
  - **自分の Result を消すと、その挑戦には二度と送れない**(2026-10-02、判断 42。`DELETE /challenges/:id/results/me`)。
    サーバは取り下げた印を残し、以後の送信を `409 already_submitted` で断る。クライアントはこれを**届いたのと
    同じ**(`already`)に数える(消した記録が戻ってこない)。**「最初に完了した結果が数える」は変わらない**:
    消すことは「その日の挑戦から抜ける」ことで、取っておいて送り直す手段ではない。ランキングの行は別で、
    消しても次の局がまた入る(§16-1)。
  - 帰結: 参加している間は、**最初に遊び終えたデイリーの結果がそのまま確定する**。良い結果になるまで
    取っておいて送り直すことはできない。**この点は、参加の画面ではまだ言っていない**(§7-4。参加の
    画面の文言 `clubAutoSendDisclosure` は「遊び終えた結果が自動で送られる」までで、デイリーの確定には
    触れない)。言うなら新しい(または広げた)高リスクの文言になり、オーナーの文言確認と門が要る
    (§14 末尾の「未決」)。
- **全員同じ盤面のデイリーは、すべて Today へ**(2026-10-02、判断 40)。次の **21 本**: Sudoku / Nonogram /
  Takuzu / Futoshiki / Kakuro / Crown Grid / Number Path / Shape Regions / Binary Balance / Sudoku 6×6 /
  Box Regions / Solitaire / Spider Solitaire / FreeCell / Mahjong Solitaire / Memory Match / Sliding Puzzle /
  Number Match / Quick Math / Schulte Table / Water Sort。各ゲームは `game/challenge.ts` に
  `boardDigest` / `boardDigestOf(session)`(接頭辞 + 契約版 + `:` + 8 桁 hex。§6-4)を持ち、結果画面が
  `daily` と `boardDigest` を渡す。Solitaire(1 枚 / 3 枚めくり)と Spider(1 / 2 / 4 スート)は
  **版が digest に入る**ので、版ごとに別の挑戦になる。Water Sort のデイリー(6 色・均等な混ぜ)はティアに
  一致しないので、契約の `validateParams` が `{ tier: 'daily' }` を受け入れ、Today へ送る。ティアの門
  (`challengeTierOf`)はランキングのためだけに残る。
- **例外 — Minesweeper と Number Recall のデイリーはランキングの表に残る**(リードの設計注記。§14 末尾。
  オーナーの確認はまだ無い。判断 29「デイリーの結果はランキングに入れない」への**例外**)。この 2 本の「デイリー」は全員同じ盤面ではない: Minesweeper は初手で
  地雷が変わり(§6-0)、Number Recall はやり直すたびに別の配置が配られる。同じ盤面でないものを `Today` の
  「同じ盤面の順位」に載せると、その約束が嘘になる。だから `daily` を付けず、その難易度の通常の局として
  ランキングへ送る(§16)。
- **盤面ごとに挑戦は 1 つ**(2026-10-02、§15-2)。同じ `gameId` + `seed` + `boardDigest` の
  挑戦が生きていれば、`POST /challenges` は新しく作らず、送った人の結果をそこへ足す
  (`200`。§5-4)。理由: デイリーは日付から seed を導くので世界中で同じ 1 盤面になり、
  送った人全員が 1 つの挑戦に集まる — それが Public の順位表である
  (PRODUCT_PRINCIPLES「順位表」)。新しいモードも、サーバ側の盤面生成も要らない。Private でも同じ(友人 2 人が同じデイリーを送れば 1 つ)。
- **`daily` の印**は、結果画面が、その局がデイリーで、かつ**そのゲームのデイリーが全員同じ盤面**のとき
  だけ付ける(`ClubResultAction` の `daily`、`POST /challenges` の `daily`)。上の 21 本が付け、
  Minesweeper と Number Recall は付けない。Club の画面は端末のローカル日付で
  `GET /challenges?daily=` を引き、`Today` に並べる(§9)。

### 6-4. `boardDigest`

- 形: `<ゲーム接頭辞><契約版>:<8 桁 hex>`(`sd1:9f3a1c07` / `ms1:…` / `ws1:…`)。
- 計算はゲームの **Pure TypeScript**(`game/`)で、盤面の正規化文字列(Sudoku: givens
  の行優先 81 文字。Minesweeper: 初手適用後の地雷 bit 列。Water Sort: 初期チューブの
  文字列形 — いずれも golden テストが既に使っている文字列形)を、そのゲームの
  `game/rng.ts` にある xmur3(32 bit。Sudoku / Minesweeper は `hashSeed` として export
  済み、Water Sort は同じ 1 行の export を足す。2026-10-02 に `Today` へ加わった他の 19 本も
  同じ 1 行を足した。export は列を変えない)に通す。新しい依存も共通ユーティリティも
  要らず、`games/*/game/` の import ゼロの規則を破らない。
- 32 bit で足りる — これは改竄対策ではなく**版ずれの検出**であり、偶然の一致は
  比較の意味を損なわない。
- サーバは文字列として保存・照合するだけで、計算しない(§0「決めないこと」)。

## 7. 招待 — URL / QR / Web からの参加

### 7-1. URL

```text
https://<endpoint>/join#invite=<inviteToken>
```

- token は **fragment** に置く。fragment はブラウザがサーバへ送らないので、HTTP の
  ログとリファラに残らない。
- サーバは `/join`(末尾スラッシュ無し)で Web ビルドの `index.html` を返す。
  `/join/` は `/join` へ redirect する — Web ビルドは `base: './'` なので、
  `/join/` で開くと `./assets/` が `/join/assets/` に解決して壊れる。
- Web ビルド側(`app/clubGate.ts` の `takeInviteFromLocation`)は `location.pathname` が `/join` で終わり、hash に
  `invite=` があれば招待と読む。読んだら `history.replaceState` で fragment を
  **即座に消す**(参加の前でも)。token が住所欄・履歴・ブックマークに残らないため。
- pixapps.ai の Web 版(`/simple-games/play/`)にはこの経路は存在しない
  (`/join` が無い)。`app/webRoute.ts` の `?game=` の契約は変わらない。
- 招待 URL の解析は pure function(`inviteFromHref(href): { endpoint, token } | null`)
  で、endpoint は URL の origin。§4-1 の https 規則をここでも適用する。

### 7-2. QR と共有

- Owner / Member が招待を渡すのは Club の画面の `Invite`(§9)。共有シート(
  `services/share/share.ts` と同じ梯子)で URL を渡すか、**QR を画面に描く**。
- QR は**読まない**。カメラ権限を足さない(`check-principles.sh` §4 の許可リストは
  INTERNET / BILLING のまま)。相手は OS のカメラで読み、ブラウザで開く。描画は
  依存ゼロの Canvas 2D(`services/share/card.ts` と同じ道具立て)で、`club/` の中に置く。
- 招待 URL は Owner が `POST /invite` で作り直せる。作り直すと前の URL は無効
  (`409 invite_expired`)。Owner リンク(§8-3)も同じ形の URL だが、**1 回使えば
  無効**で、24 時間で期限が切れる。開いた端末は `role: 'owner'` で参加する。

### 7-3. どこで参加できるか

**v1.4.0 では、招待リンクでの参加は隠す**(判断 44)。Private Club House の入口(`Create my Club` を含む)は
次の版で、招待リンクはその Private のためのものだから。次の表のうち**招待 URL をブラウザで開く行と、
設定から招待 URL を貼る行は、v1.4.0 には無い**(下の「v1.4.0 で隠すもの」)。Public への参加の 2 行だけが
ある。コードは残し、**1 つの定数 `PRIVATE_CLUBS_ENABLED`(v1.4.0 は `false`)**で切る — 次の版で `true` に
するだけで戻る。

| 経路                                                             | できること                                                                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 招待 URL をブラウザで開く(SharedHost の Web)                     | nickname → `Join and Play`。**インストール不要**。同じ origin なので CORS の問題が無い                                                                                 |
| アプリの設定 > Advanced > `Club House` > 参加                    | 招待 URL を**貼り付ける**(`inviteFromHref` で endpoint と token を読む)→ nickname → 参加                                                                               |
| アプリ / Web 版の `Play together` > `Join the Public Club House` | 開示(ニックネームと結果が公開される)→ nickname → `POST /join { nickname }`。endpoint はアプリが名前で知る唯一のもの(`club/public.ts` の `PUBLIC_CLUB_ENDPOINT`。§15-1) |
| pixapps.ai の Web 版の `Play together`                           | Public への参加(上の行)と、「招待リンクを開いてください」の説明、Host になる導線(§8)。任意 endpoint への直接接続は無い                                                 |

**v1.4.0 で隠すもの**(`PRIVATE_CLUBS_ENABLED === false` のとき。`Coming Soon` の予告も**置かない** —
PRODUCT_PRINCIPLES が Coming Soon を採らないのは Club House の中でも同じ。判断 44):

- Discover 画面(接続 0 件)の `Join with an invite link`(貼って参加)と、All Clubs の `Join another Club`
  のうち招待リンクの経路。
- 持ち主の Club の画面の `Invite`(招待 URL・QR・作り直し。§7-2、§9)。
- **Web 版の招待 URL**(`/join#invite=…`): `app/clubGate.ts` の `takeInviteFromLocation` が**読まない**
  (fragment を消す処理は残す — token を住所欄・履歴に残さない。参加画面は出ない)。
- 残るのは Public への参加と、すでに参加している Club の使用(Settings の改名と、自分の記録の横の削除ボタンを含む)。サーバの
  `POST /join { inviteToken }` と契約(§5)は変わらない。

テストは `PRIVATE_CLUBS_ENABLED` の**両方の値**を通し、隠れている経路にも網羅を残す。

アプリが招待 URL を直接受け取る経路(App Links / Universal Links)は作らない
([../WEB_VERSION.md](../WEB_VERSION.md)「URL」の判断のまま)。招待された人の最短経路は
ブラウザで、アプリは後から同じ URL を貼れば同じ Club に入れる(別の member として。
§4-1。v1.4.0 では招待リンクの経路そのものを隠す)。

### 7-4. Join の画面(SharedHost の Web)

```text
Join Suzuki Family

While you're in this Club, every game you finish sends its result
(time, moves, score) here automatically.          ← 開示が先(下)

Nickname
[ Ken ]

[ Join and Play ]

Simple Games by PixApps
```

- **開示は参加の 3 経路すべてに出す**(Public、貼った招待リンク、招待 URL を開いた参加)。文言は
  `clubAutoSendDisclosure`(高リスクキー。§11): 「参加している間は、遊び終えた結果(時間・手数・スコア
  など)がこの Club に自動で送られます」。ボタンを無くした(§2-2)ので、**結果が送られることへの同意は
  この画面だけにある** — Private の招待参加にも置く(以前は Public の `clubPublicDisclosure` だけだった)。
  Public はこれに加えて `clubPublicDisclosure`(ニックネームと結果が公開される)を出す。
- **この開示を見ずに作られた接続は、送らない**(自動送信より前に参加した端末。§4-1 の `autoSend`)。
  その接続の Club の画面の上に同じ文言と 1 つのボタン(`clubAutoSendAccept`)の箱が出て、押すと
  開示に同意したことになり、そこから送り始める。
- 約束の範囲: 送られるのは**参加したあとに遊び終えた**結果だけ(参加前の局は決して送られない)、
  対応するゲームのものだけ(§6-1)、結果画面が表示した事実だけ(§5-5)。`Disconnect this device`(§8-5)で以後の送信が止まる。

- **同じ端末で同じ Club へ入り直すと、同じメンバーに戻る**(判断 43)。参加の画面は `POST /join` の前に、
  その endpoint の `departed`(§4-1)を見る:
  1. 見つかったら、その member token で `GET /club` を呼ぶ。**生きていれば**(200)、`connections` へ戻し
     (`autoSend: true` — 開示はこの画面が出している)、`departed` から外す。同じ member id・同じ記録・
     Owner なら Owner のまま。入力した表示名がサーバのものと違えば `PATCH /me` で変える(**名前は入り直す
     ときに変えてよい**)。
  2. **401 / 404**(持ち主に外された、Club が作り直された)なら、その `departed` を捨てて、普通の
     `POST /join`(新しいメンバー)に進む。
  3. **ネットワークの失敗**は、今までの参加の失敗と同じ 1 行を出し、何も変えない(`departed` も残す)。
  - 見つからなければ今までどおり `POST /join`。
  - **できないこと**(device id もアカウントも無いので): アンインストール・`Reset Local Data`・別の端末
    では、端末が「同じ人」だと分からず、**入り直しは新しいメンバー**になる。古いメンバーの記録はサーバに
    残るので、本人が避けたいなら**切断の前に自分の記録を 1 件ずつ消す**(§9。ランキングの行・デイリーの結果それぞれの
    削除ボタン)。
- Club 名は `GET /health` では返さない(招待 token の妥当性を確かめる前に名前を
  出さない)。`POST /join` の応答で初めて表示する。画面は最初「Join a Club」と出し、
  参加後に名前が入る。
- 参加後はそのまま Club の画面(§9)。Web 版の Core(全ゲーム)は同じページに
  全部入っているので、Challenge を押せばそのまま遊べる。
- brand の一行(`Simple Games by PixApps`)は残し、インストールの壁は作らない
  (#164「install wall にしない」)。アプリの案内は Web 版の既存のカード
  (`ui/components/WebAppStoreCard.tsx`、コレクションホームの常設カード)のままで、
  Shared のために増やさない。

## 8. Host になる — 説明画面・Setup Key・claim・Hosting

### 8-1. 入口

設定 > Advanced > `Club House` > `Create my Club`(2-1)、`Play together` >
`Create a Club`(2-3)、Club の画面の末尾の `Create your own Club`(§13-3)。
3 つとも同じ説明画面へ来る。

### 8-2. 説明画面(お金の informed consent。削らない)

英語原文(§11 の高リスクキー):

```text
Create your own Club

Your Club runs on a server in your own hosting account.

• A hosting account is required.
• Hosting may cost money while the server exists.
• You manage and delete the server yourself, in the hosting provider's dashboard.
• Disconnecting Simple Games from the Club does not delete the server.

[ Continue ]
```

- 事業者名(Railway)は文言に**書かず**、`Continue` の先の URL(`club/` の定数
  `HOSTING_TEMPLATE_URL`)だけが事業者を知る。事業者が変わっても 14 言語の文言を
  直さない。
- `Continue` はこの説明の下にだけある。金額は書かない(未計測の数字を約束にしない。
  PRODUCT_PRINCIPLES「Railway 実コストを未計測のまま固定額として宣伝していない」)。
- `Continue` が開く URL は 1 つ: いま居る Club の Owner が referral リンクを置いて
  いれば(§8-4)**それ**、無ければ PixApps の template リンク `HOSTING_TEMPLATE_URL`。
  前者のとき `Continue` の**下**に 1 行:
  `Opens the provider through <nickname>'s link.` — 金銭の文言はこれ以上出さない
  (「稼げる」を言わない)。URL は加工せずそのまま開く(§8-4)。

### 8-3. Setup Key と claim

```text
Simple Games                                  SharedHost(事業者上)
  Create my Club
  → Setup Key を生成(256 bit)、sg.club とは別に一時保存
  → Continue(template URL を開く。Setup Key はクリップボードへ)
                                              template deploy: 環境変数 CLUB_SETUP_KEY に貼る
                                              deploy → 公開 URL
  ← 「デプロイが終わったらサーバの URL を貼る」
  endpoint 入力 → GET /health(疎通)
  → POST /claim { setupKey, nickname, clubName? }
                                              hash 照合 → owner member 作成 → Setup Key 失効
  ← memberToken(role: 'owner')→ sg.club へ
```

- Setup Key は **claim 1 回専用**。claim が成功した瞬間にサーバは hash を使用済みに
  し、端末も一時保存を消す。同じ Key の 2 回目は `409 setup_key_used`。
  **再設定はできる**: 事業者のダッシュボードで環境変数 `CLUB_SETUP_KEY` に新しい値を
  置けば、サーバはもう 1 回だけ claim を受け付ける(使用済みの値は hash で覚えていて
  再利用を断る)。これが「Owner の端末をすべて失った」ときの復旧経路で、ダッシュボード
  に入れる人 = サーバの持ち主、という事実だけを根拠にする。
- Setup Key を Simple Games が発行する理由は、利用者が「秘密を作って貼る」以外の
  技術操作をしないで済ませるためで(#161「Setup / Claim flow」)、Simple Games が
  そのサーバに対して持つ権限はこの 1 回の claim だけである。**事業者の API token を
  Simple Games に保存しない**。事業者側の project を Simple Games から操作する経路は
  一切作らない。
- claim の前に `GET /health` で `X-Club-Api` を見る。知らない版なら止める(§10)。
- **Owner の端末は複数持てる**(2026-09-09、製品オーナーの判断)。足し方は
  **Owner リンク**: Owner の端末で `POST /invite { role: 'owner' }` → 1 回限り・
  24 時間の URL(§7-2)を、自分の別の端末で開くか、共同で管理したい人に渡す。開いた
  端末は `role: 'owner'` の member として参加し、以後は Setup Key も元の端末も要らない。
  Owner の token 自体は配らない — 配るのは「Owner になれる 1 回の入口」である。
  サーバにとって「同じ人の 2 台目」と「別の人」は区別できず、区別しない(アカウントが
  無い)。
- 上限は 2 つ: 1 つの Club の Owner は **5 人(端末)まで**(`409 too_many_owners`)、
  1 端末の接続は 10 件まで(§4-1)。Owner が増えるほど「誰が消せるか」が広がるので
  少なく保つが、1 台に縛らない。
- Owner は Owner を外せる(`DELETE /members/:id`)が、**最後の 1 人は外せない**
  (`409 last_owner`)。最後の Owner が端末を失ったときの復旧は上の Setup Key の再設定。

### 8-4. Hosting(Owner の画面)

```text
Hosting

Server: Online            ← 直前の GET /hosting が通ったかどうか。常時監視ではない
Last activity: Sep 7, 2026

[ Manage server ]          ← hosting.manageUrl を外部ブラウザで開く(openExternal)
[ Add an Owner device ]    ← POST /invite { role: 'owner' } → Owner リンクを共有シート / QR で(§8-3)
Referral link  [ none ]    ← PATCH /hosting。任意。無くても同じ UX

To stop future hosting usage, delete the server in your hosting provider's dashboard.
Hosting costs are paid to the provider and depend on usage.
```

**Referral link は Host 自身のもの。** 事業者が利用者ごとに発行する referral リンクを、
Host が自分の事業者アカウントで取得し、ここに貼る。使われるのは 1 か所 — この Club の
Member が `Create your own Club`(§13-3)を選んだときの説明画面の `Continue` である
(§8-2)。つまり **子の Host は親の Host のリンクで事業者へ行き**、子の Host が自分の
Club に自分のリンクを置けば、孫は子のリンクで行く。親のいない最上位の Host だけが
PixApps の template リンク(`HOSTING_TEMPLATE_URL`。事業者の制度上 PixApps 自身の
referral を含み得る)で行く。Simple Games が持つのはこの「1 段上のリンクを 1 回開く」
だけで、リンクの中身を加工しない・親子関係を保存しない・段数を数えない・報酬を
表示しない(PRODUCT_PRINCIPLES「紹介」)。referral の制度が無い事業者でも同じ画面が
同じに動く — 行が空のままになるだけである。

- `Server: Online` は画面を開いたときの 1 回の結果で、定期確認は無い。
- **通知しない**。使われていないサーバについて、Push・催促・バッジ・定期削除の案内を
  出さない。Owner が Club の画面を開いたとき `Last activity` を見られるだけ。
- Simple Games からサーバ / project を削除する API は実装しない(理由は #161 と同じ:
  事業者の credential を持たない。削除は低頻度の管理操作で、事業者の UI が安全)。

### 8-5. Disconnect と Delete を分ける

Club の設定(§9)に `Disconnect this device`。文言(高リスクキー):

```text
Disconnect this device
Stops this device from connecting to Suzuki Family. The server keeps running,
and the others can still play. To stop hosting usage, delete the server in your
hosting provider's dashboard.
```

最後の 1 文(`clubDisconnectHostingNote`)は、**自分で建てた Club の Owner にだけ**出す
(2026-10-02)。メンバーにも、Public Club House の参加者にも、削除するサーバも費用も無い —
以前は 1 つのキーで全員に出しており、Public のメンバーに「ホスティング事業者の管理画面で
サーバを削除」と言っていた。

切断は**以後の自動送信を止める**(`connections` から外すので、次の結果は送られない)。その Club 宛ての未送信の結果は
捨てる(§4-2、§10)。**すでに送られた記録はサーバに残り、メンバーとしての登録も残る**(判断 42 — 切断と記録の
削除は別のもの)。**切断した Club の資格は端末の `departed`(§4-1)に残り、同じ Club へ入り直すと同じメンバーに
戻る**(§7-4。名前は入り直すときに変えてよい)。記録を消したい人は、**切断の前に、自分の記録の横の削除ボタン**
(ランキングの行・デイリーの結果。§9)を使う。**全部を一度に消すボタンは無い**。**アプリは今、「記録が残る」「入り直すと戻る」を切断の文言では言っていない**
(`clubDisconnectBody` は「この端末の接続を止める。サーバは動き続け、他の人は遊べる」までで、
送った結果が残ることには触れない)。言うなら `clubDisconnectBody`(高リスクキー)の原文を直すことになり、
14 言語の承認が失効して門を通し直す — 公開の説明(プライバシーページ、§13-6)が先にそれを言う。

Owner が Disconnect しても、サーバは動き続ける。切断は端末側だけの操作で(`sg.club`
から接続を消す)、サーバの member は残る — Members の一覧に居続け、他の Owner が
外せる。Owner の端末が切断するときは、直前に `GET /club` で他の Owner が居るかを見て、
**自分が最後の Owner なら** 1 文を足す: `This is the only Owner device. Add another
Owner device first, or reset the setup key in your hosting provider's dashboard to
claim the Club again.`(§8-3)。確認すれば切断できる — 端末を手放す人を止めない。

## 9. Club の画面 — 情報設計

`club/ui/`。すべて `club/` の中で、Core の画面は §2 の 3 つ以外変わらない。

### 入口(`ClubRoot`)

`entry: 'settings' | 'home' | 'discover' | 'invite'` で最初の画面が決まる。

- 接続 0 件: `Join the Public Club House`(§15-1)/ `Join with an invite link`(招待 URL を
  貼る)/ `Create my Club`(§8)。
  `entry: 'invite'` なら §7-4 の Join 画面。
- 接続 1 件: その Club。
- 接続 2 件以上: **All Clubs** — Club 名の一覧だけ(件数・未読・バッジ無し)、末尾に
  `Join the Public Club House`(Public に未接続のときだけ)、`Join another Club`、
  `Create your own Club`(§13-3)。
- **v1.4.0 では招待リンクの経路を出さない**(`PRIVATE_CLUBS_ENABLED === false`。§7-3、判断 44):
  `Join with an invite link` / `Join another Club` の招待リンクの経路 / `entry: 'invite'` / 持ち主の
  `Invite` は無い。Private の入口(`Create my Club`、`Create your own Club`)は §14 判断 19 のとおり
  次の版。予告(`Coming Soon`)も置かない。

### Club

```text
Suzuki Family                                  [Invite] [Settings]

Today                                          ← その日のデイリー(§6-3、21 本)。無い日は節ごと出ない
  Sudoku · Hard · Daily                        12 played
Rankings                                       ← ゲーム × モードの表(§16)。1 位の名前と記録
  Sudoku · Hard          1. Ken 3:58           24 entries
  2048                   1. Mika 18,432        9 entries
Members
Hosting                                        ← Owner だけ
```

(2026-10-02 まで在った `Challenges` / `Played` / `New Challenge` / `Records` は、デイリー以外の
局が Challenge にならなくなったので消えた。`Records` は各表の 1 位として `Rankings` に居る。)

- **Today** はその日(端末のローカル日付)の `daily` の印が付いた挑戦(`GET /challenges?daily=`、
  §6-3)。順位は Challenge の中にある。
- **Rankings** は `GET /rankings` の表の一覧。1 行 = 1 表(ゲーム · モード、1 位の名前と記録、
  行数)。開くと §16-2 の画面。
- 一覧は開いたときと明示の再読み込みで取る(§10)。件数・未読・「新着」を Core へ
  持ち出さない。
- Members: nickname と参加日。Owner には各行に `Remove`。プロフィール・アバター・
  通算は無い。
- 記録(ゲーム・モードの 1 位)は `Rankings` の各行に居る。別の節は持たない。
- **自動送信を受け入れていない接続**(自動送信より前に参加した端末。§4-1)では、画面の一番上に
  小さな箱が 1 つ出る: 参加の画面と同じ開示(`clubAutoSendDisclosure`)と、ボタン 1 つ
  (`clubAutoSendAccept`、`Send my results automatically`)。押すと `autoSend` が保存され、箱が消える。
  押さなくても Club は普通に使える(結果が送られないだけ)。`Disconnect this device` は今までの
  場所(Settings)のまま。箱は Club の画面にだけ置き、Invite / Settings の面と他の画面には出さない。

### Challenge

```text
Sudoku · Hard
by Yoh · Sep 7

When you finish, your result is sent to Suzuki Family.   ← 開示が先(§7-4。ここでも繰り返す)

[ Play ]

Results
  Ken    4:31   Mistakes 0   Hints 1
  Yoh    5:05   Mistakes 2   Hints 0
```

(自動送信を受け入れていない接続(§4-1)では「When you finish, ...」の 1 文を出さない — その接続は送らないので、
約束にならない。)

(`played`(負け・行き止まり)は 2026-10-02 から送られないので、Results に `played` の行は新しくは並ばない。
それ以前にサーバへ届いた行は、今までどおり末尾に提出順で出る。)

- `Play`(2026-10-02 以降、Today のデイリーの挑戦)→ `App.tsx` の `enterGame(gameId,
'collection')` でそのゲームを開き、シェルが戻り道(`ClubFocus`)を覚える。プレイヤーが
  そのゲームのデイリーを遊んで終えると、結果画面の `ClubResultAction` が結果を自動で送る
  (ホームから開いたデイリーも同じ。§2-2、§6-3)。開く前の 1 行は `Open Sudoku and play today's Daily. When
you finish, your result is sent to Suzuki Family.`。ゲームへ挑戦の盤面は渡さない(§6-2、§16-3)。
- Results は §6-1 の `order` で並び、**順位の数字が付く**(2026-09-30)。メダル・称号・
  挑戦をまたいだ差分は無い。自分の行は `You` で示す。
- 自分が遊んだ後にだけ他の人の結果を見せる、という隠し方は**しない**(隠すのは
  「遊ばせるための仕掛け」であり、Solo by default に反する)。見たい人は見る。
- **自分の行にだけ削除ボタン**(`clubDeleteRecord`、`Delete my record`。アクセシブルな名前。2026-10-02、判断 42):
  押すと確認(ConfirmDialog、danger。題・本文は高リスクキー `clubDeleteResultTitle` / `clubDeleteResultBody`。
  確認ボタンは `clubDeleteConfirm`)。本文が言うのは「この挑戦から自分の結果が消える / この挑戦へはもう
  結果を送れない / 元に戻せない」。確認したら、この端末の同じ挑戦(同じ endpoint + `gameId` + `seed` +
  `boardDigest`)の未送信を捨て、`DELETE /challenges/:id/results/me`(§5-4)→ この画面を読み直す。
  **ほかの人の行にボタンは無い**。Owner のメンバー削除(§17-3)は別。
- 自分の結果がある Challenge の `Play` は `Play again`(ローカルで同じ盤面を遊べる。2 度目の
  結果は送っても先のものが残り、画面は何も言わない。§6-3「1 人 1 回」)。

### Settings(Club ごと)

- **`Change your name`**(2026-10-02、判断 43): 入力欄 + `Save`。参加と同じ表示名の検査(§17-1 を
  クライアントでも見る)を通ったら `PATCH /me`(§5-4)で変え、成功したら端末の表示名のキャッシュ
  (`sg.club` の `nickname`)を直す。**いつでも変えられる**(入り直しを要しない)。自分で変えても通報は
  消えない(§17-3)。
- **記録の削除は Settings に置かない**(2026-10-02、判断 42): 消すのは**記録 1 件ずつ**で、ボタンは自分の
  記録の横にある(ランキングの行は §16-2、デイリーの結果は上の Challenge)。**全部の記録を一度に消す
  ボタンは無い**。Owner も同じ(自分の記録だけ)。メンバーを辞めるのではない — 辞めたい人は先に消して
  から `Disconnect this device` を使う。
- `Disconnect this device`(§8-5。記録は残る。同じ端末なら入り直して同じメンバーに戻る)。
- Owner: Club 名の変更、招待の作り直し(**v1.4.0 は隠す**。§7-3)、Owner 端末の追加(§8-3)。

nickname を**持ち主が**通報への対処として変える `PATCH /members/:id` は別(§17-3)。

### 後続(v1 では作らない)

#161 comment の Private Game Club 拡張のうち、v1 の契約に**入れない**もの:
掲示板 / スレッド / リアクション / pin、投票、Club の書き出し、Group identity
(アイコン・色)、Member プロフィール。入れるときは §5 の版を上げる(`X-Club-Api: 2`)。
DM / リアルタイムチャット / フォロー / アルゴリズムフィード / 無限フィード /
Push は後続でも作らない(PRODUCT_PRINCIPLES「Club House」)。**公開の Club House は
2026-09-30 に「作らない」から外れた** — ただし作るのは PixApps が運用する 1 デプロイ
だけで、利用者の Private を公開に切り替える機能は作らない。

## 10. 通信・オフライン・障害

- **通信が起きる契機**(すべて本人の操作の直後):
  Club / Challenge / Ranking の画面を開く・明示の再読み込み(GET。Club の画面は club /
  challenges?daily=今日 / rankings の 3 本)、参加 / claim(POST)、
  **遊び終えた結果が現れたとき**(自動送信の POST。参加している Club ごとに 1 リクエスト、§2-2)、
  **Settings の `Change your name`**(`PATCH /me`)と**自分の記録の横の削除ボタン**
  (`DELETE /rankings/:gameId/:paramsKey/me` / `DELETE /challenges/:id/results/me`)(どれも本人が押した
  とき 1 回)、**同じ Club へ入り直すとき**(`GET /club`、必要なら `PATCH /me`。§7-4)、
  Owner の操作、そして**未送信キューの再送**(下)。
  ホームを描く・ゲームを開く・盤面を遊ぶ・設定を開く・**アプリを起動する**、では**通信しない**。
- **ポーリング・バックグラウンド同期・常時接続・Push は無い**。`setInterval` /
  `WebSocket` / `EventSource` は `club/` にも書かない(`check-principles.sh` §1 は
  `club/` を除外しているので、これは文書とレビューの約束。§12 で `WebSocket` /
  `EventSource` / `sendBeacon` については `club/` を含めた不在検査を足す)。
  自動送信は「本人が遊び終えた」という本人の行為の直後にだけ起き、タイマーでは起きない。
- **参加の前は何も送らない**: 接続は送る瞬間に読む。参加前に遊んだ局は、あとで参加しても送られない
  (判断 39。「入る前の局の記録は要らない」判断 14 のまま)。
- **同意の前も何も送らない**: 自動送信の開示を見ていない接続(`autoSend` が無い。§4-1。自動送信より前に
  参加した端末)へは、送らず・キューに積まない。持ち主が Club の画面で開示を受け入れた瞬間から
  送り始め、**それ以前に遊び終えた局は送られない**(参加の前の局と同じ線)。送らないことで、その
  接続宛てのキューが増えることも無い。
- **同じ結果の二重送信の抑止は、メンバーごと**: セッション内の「送った」の記憶は
  (endpoint, memberId, 結果の指紋)で持つ。**別のメンバーとして入り直した**(`departed` が無い・
  サーバが外していた)ときは、同じ盤面の結果も新しいメンバーとして送られる。**同じメンバーに戻った**
  ときは、同じ memberId なので、先に送った結果を送り直さない。
- **自分の記録を削除すると、その記録を作り直す未送信と「送った」の記憶は先に捨てる**(§4-2、判断 42)。
  削除の直後にキューの結果が記録を作り直さない。ランキングの行を消したあとに遊び終えた局は、また送られて
  表へ入る。**デイリーの Result を消したあとは、その挑戦へは送れない**(サーバが `409 already_submitted`。
  クライアントは `already` に数える)。
- タイムアウト 10 秒。失敗は結果画面の 1 行(`Will send when you open the Club`)と、Club の画面の 1 行
  (`Could not reach Suzuki Family`)で、ダイアログ・トースト・再試行ループは無い。**ゲームは止まらない**
  — 送信は結果画面が現れたあとの非同期で、サーバが落ちていても・機内モードでも遊べる。
  オフラインを知らせる表示を毎回出さない([../OFFLINE_POLICY.md](../OFFLINE_POLICY.md))。
- **未送信キュー**(§4-2)— 結果の POST が失敗したら(オフライン、応答なし)`sg.clubOutbox` に残る
  (結果はまずキューに書いてから送る)。**再送は本人の行為の直後だけ**(判断 38):
  (1) **次の結果を送るとき**(その Club 宛てを古い順に、そのあとで今回の結果)、
  (2) **その Club の画面を開いたとき**。**起動時には再送しない**し、タイマー・`online` イベント・
  フォアグラウンド復帰でも再送しない。古い順に送り、**最初の再送対象の失敗で止める**。
  `already_submitted` / `board_mismatch` / `not_found` /
  `unauthorized` が返ったら**捨てる**(再送しても通らない。`already_submitted` は届いたのと同じ扱い)。
  body そのものが拒まれた
  `invalid_request` / `forbidden` / `too_large` / `unsupported_version` も同じ(先頭で
  詰まると、その Club の後続が一つも送れないため)。`X-Club-Api` が**知らない版を名乗る**サーバも
  同じ(次項: その Club へは何も送らない。残せば開くたびに送ってしまう)。応答が無い・
  429・形の崩れた応答・5xx は再送の対象だが、ネットワークの失敗と 429 以外は 5 回で捨てる(§4-2)。
  - **Cloudflare 自体のエラーは非最終**(リードの設計注記。§14 末尾): 応答に `X-Club-Api` が無い(無料枠の使い切りなど、
    プラットフォームが返したページ)は、`unsupported_server` として**捨てず**、キューに残す。最終扱いに
    するのは、`X-Club-Api` が**ある**のに知らない版のときだけ。
  結果画面の 1 行は §2-2 のとおり(送れたら `Sent to <club>`、キューに入ったら
  `Will send when you open the Club`、最終的に拒まれたら `Could not send to <club>`)。Club との接続を
  切ったら、その Club 宛てのキューも捨てる(§4-2)。
- **既知の制限 — 結果カードの 0.9 秒**(リードの設計注記。§14 末尾): 結果カードは、局が終わってから約 0.9 秒の「間」
  (`useResultReveal`)のあとに現れ、送信はそのカードが現れたときに始まる。**その間に盤面を離れる**
  (Back / ↻)と、その結果は**何も送られず、キューにも入らない**。気づきにくい失敗だが、塞ぐには
  ゲームごとの変更(局が終わった時点で送る)が要り、全ゲームに触れるので今回は入れない。既知のまま出す
  (§14 末尾の設計注記)。
- **Club ごとに独立**: 1 つのサーバの障害・401 は、その接続の画面にだけ現れる。
  All Clubs の一覧は `sg.club` のキャッシュから描くので、落ちているサーバの名前も出る。
- **`X-Club-Api` が知らない版**: 画面に 1 行出して、その Club へは何も送らない。
  クライアントが古いときにサーバが受け付けてくれる限り(サーバは `contractVersion` を
  見る)、古いクライアントは古い契約のまま動く。
- 位置情報・端末識別子・広告 ID・contacts は Shared でも触らない。

## 11. i18n

- `club/` の文言は **`club/i18n/`** の 14 言語カタログに置き、`club` チャンクに同梱する。
  ゲームと同じ仕組み — `declare module '@/i18n/registry'` で `GameMessages` へマージし、
  `registerGameMessages('club', catalogs)` を `club/index.ts` の先頭の
  `import './i18n'` で呼ぶ(`registerGameMessages` は id で登録するだけなので
  ゲーム以外にも使える)。`src/test/gameI18nWiring.test.ts` の対象に `club/index.ts` を
  足す。Shared を触らない人は、この文言を一度もパースしない。
- Core に入るキーは §2 の 4 つ(`advancedTitle` / `clubEntry` / `playTogetherTitle` /
  `playTogetherBody`)と、`ClubResultAction` の**状態の 5 つ**(`clubResultSent`(`{club}`)/
  `clubResultPending` / `clubResultNotSent`(`{club}`)/ `clubResultSentMany`(`{count}`)/
  `clubResultPartial`(`{sent}` `{count}`))だけ。ボタンの `clubSendResult` は 2026-10-02 に 14 言語から
  削除した(§2-2)。状態の 5 つは高リスクキーではない(Core の短い状態表示で、同意の場所ではない)。
- **高リスクキー**(`src/i18n/highRiskKeys.ts` に足す。門は `gateRecord.json`):
  §8-2 の説明画面の 4 箇条、§8-5 の Disconnect の本文、§9 Challenge の
  「終えたら結果を {club} へ送る」の 1 文、§8-4 の「削除は事業者側で」の 2 文、§15-1 の
  Public の開示(`clubPublicDisclosure`: ニックネームと結果が公開される)、そして 2026-10-02 に足した
  **`clubAutoSendDisclosure`**(§7-4: 参加している間は遊び終えた結果が自動で送られる。**参加の全経路に
  出る、結果ごとのボタンに代わる同意の文言**で、誤訳すると「同意していない送信」になる最も重いキー)と、
  その開示を**自動送信より前に参加した接続の持ち主が Club の画面で受け入れるボタン**
  **`clubAutoSendAccept`**(§4-1。押すことが同意のすべてなので、「結果を自動で送る」を弱めた訳は、
  押していない送信を許してしまう)。この 2 つは新しい高リスクキーで、12 言語ぶんの承認は未承認
  (24 件。[../RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) §3)。
  2026-10-02(判断 42)にもう 5 つの高リスクキーを足す: **ランキングの行を消す確認の題・本文**
  (`clubDeleteRankingTitle` / `clubDeleteRankingBody`。「この表の自分の記録が消える・次に終えた局はまた入る・
  元に戻せない」)、**デイリーの結果を消す確認の題・本文**(`clubDeleteResultTitle` / `clubDeleteResultBody`。
  「この挑戦から自分の結果が消える・この挑戦へはもう結果を送れない・元に戻せない」。**2 つ目の文を弱めた訳は、
  消したあとに送り直せると思わせる**)、**確認ボタン**(`clubDeleteConfirm`。§9)。誤訳は**取り消せない
  削除**を、意図せず押させる。12 言語ぶんの承認は未承認で、門を通し直すまで機械翻訳のまま配らない扱いは他の
  高リスクキーと同じ(承認はこの変更では記録しない)。行のボタンの名前(`clubDeleteRecord`、
  `Delete my record`)は高リスクキーにしない — 押しても確認が挟まり、お金・同意・公開の約束ではない。
  (全部の記録を消すキー `clubEraseRecords` / `clubEraseTitle` / `clubEraseBody` / `clubEraseConfirm` /
  `clubErased` は作らない。判断 42。)
  `Change your name`(欄・ボタン・エラー)と、`departed` の入り直しの文言は高リスクキーにしない
  (取り消せる操作で、お金・同意・公開の約束ではない)。
  英語の原文を変えた高リスクキーは、`gateRecord.json` の承認が古くなるので**門を通し直す**
  (盲検の逆翻訳と著者の読み。[../RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) §3)。
  どれも誤訳が「お金の約束の反故」か「同意していない送信・公開」になる。機械翻訳で配らない
  とは「門を通さずに配らない」の意味で、来歴は他のキーと同じ `machine` のまま
  ページと設定が開示する([../I18N_POLICY.md](../I18N_POLICY.md))。
- **`leaderboard` は `club/` のカタログでだけ使ってよい**(2026-09-30 に全面禁止を撤回。
  [../BRAND.md](../BRAND.md))。Core のカタログ(`src/i18n/locales/`)には引き続き
  入れない — Core に順位は無いからで、`check-principles.sh` §6 の禁止語は
  **Core のカタログに対してだけ**残す。

## 12. 機械で示すこと — `club/` が生まれる PR の受け入れ条件

PRODUCT_PRINCIPLES「機械で示すこと」の 3 と 4 を、実装の名前で書く。1 と 2 は #176 で
入っている。

1. **チャンク** — `vite.config.ts` に `club` グループ。`scripts/bundle-size.mjs` に:
   - `src/club/index.ts` が存在するなら `club-*.js` チャンクが**存在する**こと
     (静的 import へ戻ると消える。ゲームの「全ゲームにチャンクがあるか」と同型)。
   - エントリの静的 import グラフから `club-*` へ**届かない**こと
     (`staticallyReachableGameChunks` の走査対象に club を足す)。
   - 予算: gzip **200KB**(ゲームの 500KB より小さい。画面数は多いが盤面ロジックは
     無い。超えるときは理由を PR に)。
   - ベースライン(`size-baseline.json`)に `club` を載せ、エントリの成長比率の検査は
     そのまま — §2 の Core 側の追加(1 コンポーネント + 7 キー)がエントリを
     1.1 倍させることは無い。
2. **実行時** — `src/app/clubGate.test.ts`: ローダーを注入した `clubGate` に対して、
   (a) 接続 0・招待無し・操作無し → ローダーは**呼ばれない**、(b) 接続 1 以上 →
   起動時に 1 回、(c) 招待 URL → 1 回、(d) Advanced / Play together の操作 → 1 回、
   (e) ロード失敗はゲームにもホームにも波及しない(`bootStep` と同じ握りつぶし)。
3. **送るもの** — `club/api/types.test.ts`: Result の body の型を `Object.keys` で固定し、
   §5-5 の 4 フィールド以外を持てないこと。`facts` の各ゲームの validate が範囲外・
   余分なフィールドを落とすこと。
4. **到達経路の網羅** — `src/test/importBoundaries.test.ts` 規則 5 が、実在する
   `club/` に対して緑であること(合成 import の自己検査は既にある)。
   `games/<id>/challenge/contract.ts` の import ゼロ検査(規則 3 と同型)。
5. **結果画面の配線** — `src/test/clubResultWiring.test.ts`(`shareWiring.test.ts` と
   同型): `ClubResultAction` が §6-1 の対応ゲームの結果画面に**だけ**あり、自分の id を
   名乗り、`facts` と `details` を両方渡していること。レジストリで `challenge` を
   宣言したゲームの集合と一致すること。
   **自動送信の受け入れ**(2026-10-02): (a) `ClubResultAction.test.tsx` — 結果が現れたとき 1 回だけ送る
   (StrictMode でも 1 回)、遅れて届いたブリッジでも送る、アンマウントしても送信は取り消されない、
   状態の行(1 Club の 3 状態 / 2 Club の全部 / 一部 / 全部 `already` は無言)、`played` は何も送らない、
   接続が無ければ何も描かない。(b) ブリッジ — 行き先は 1 回の判定(`daily` + `boardDigest` なら
   デイリー、`completed` ならランキング)、接続は送るとき読む(参加前の局は送られない)、書いてから送る、
   409 `already_submitted` は `already`。(c) キュー — 統合(ランキングは良いほう、デイリーは最初)、
   上限、並列に失敗した結果が互いを消さない(lost update)、`attempts` の上限、旧形式の要素も読めて送れる。
   (d) 参加 — 3 経路(Public / 貼った招待リンク / 招待 URL)すべてで `clubAutoSendDisclosure` が出る。
   (e) 各ゲームの `challenge.test.ts` が `boardDigest` を新しい golden として固定し、結果画面が
   デイリーのときだけ `daily` / `boardDigest` を渡す(§6-3 の 21 本)。(f) `X-Club-Api` の無い応答が
   非最終であること(§10)。
6. **保存の門** — `src/backup/keys.test.ts`(`sg.club` / `sg.clubOutbox` が
   `SHELL_KEYS_LEFT_BEHIND` に理由付きで在る)、`src/test/resetLocalDataWiring.test.tsx`
   (削除で消える。この test の `SHELL_SCHEMAS` はシェルの schema を名指しで列挙して
   いるので、2 つの schema を**足す**まで「遊んだ端末」に新キーが置かれず、削除の
   検査が空振りする)、`storage.test.ts`(壊れた要素だけが落ちる)。
7. **原則ガード** — `check-principles.sh` §1 は変えない。§6 に §11 の禁止語を足す。
   `WebSocket` / `EventSource` / `sendBeacon` / `setInterval` の `club/` を含めた不在
   検査を **§1 とは別の項**として足す(§1 の除外は `fetch` / `XMLHttpRequest` のため
   にだけ要る)。
8. **実機**([../RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md) に節を足す): 未接続の
   端末で機内モード → ホーム・設定・結果画面に変化が無く、リクエストが 0 件
   (Android Studio の Network Inspector / Safari の Web Inspector で見る)。
   Shared を出荷するリリースの前に、**未確認は未確認として**書く。

## 13. 発見の導線(#164)— #176 の枠で決めたこと

#164 の 4 段(Solo → Play together → Member → Create your own Club)を、§2 の 3 つの
入口に写す。実装は #161 の Club が動いた後(段取りの PR F)。

### 13-1. 常設の静かな入口 — `Play together`(§2-3)

決めたとおり。1 行、バッジ無し、押すまで通信 0。押した先の文言は `club/` にあり、
`Self-host a server` / `Railway` / `SharedHost` は出ない(`Join a Club` /
`Create a Club`)。

### 13-2. 文脈上の入口 — 結果画面(§2-2、§2-4)

接続済みの端末の対応ゲームだけ。結果が自動で送られたことを言う状態 1 行(§2-2)が置かれる
(2026-10-02 まではここに `Send to Club` のボタンがあり、#164 の `Challenge a friend` の位置だった。
自動送信で、操作ではなく状態になった)。未接続の端末には**置かない**(#176)。毎回強調しない・
点滅しない・バッジを付けない。

### 13-3. Club を体験した後 — `Create your own Club`

- 置く場所: All Clubs の末尾(§9)、Club の Settings の末尾。Core には置かない。
- 文言: `Create your own Club` / `Start a private game space for another group of
friends or family.`。押した先が §8-2 の説明画面で、**お金の話はそこで初めて**出る。
- `Continue` は、いま居る Club の Owner が置いた referral リンク(§8-4)があればそれを、
  無ければ PixApps の template リンクを開く。前者のときだけ `Continue` の下に 1 行。
  `Invite friends and earn money` の類の CTA は作らない。紹介人数・報酬・ランキング・
  進捗バーは Simple Games のどこにも無い(PRODUCT_PRINCIPLES「紹介」)。

### 13-4. Viral の入口 — 招待 URL(§7)

招待された人は Shared を探さない。URL を開く → nickname → `Join and Play`。
インストールを条件にしない。ページの brand 表示は 1 行。**v1.4.0 ではこの入口を隠す**(Private は次の
版。§7-3、判断 44)。

### 13-5. やらないこと(#164 の禁止一覧をそのまま)

初回起動の Shared モーダル / timed popup / 「試そう」バッジ / Push・ローカル通知 /
ゲーム開始前の interstitial / ホームの大きなバナー / streak・期間限定 Challenge /
未接続端末の background request / referral 収益のホームでの訴求 / `Coming Soon`。

### 13-6. 公開文面と LP

出荷するまで README・ストア・LP・GitHub metadata に書かない([../BRAND.md](../BRAND.md))。
出荷時にプライバシーページへ Shared の節を足す(何を、どこへ、誰の管理下で)。

## 14. 決めたこと(製品オーナー確認済み)/ 外部確認

この文書で決めた判断は、この文書を直す PR で変えられる。

**2026-09-09 に製品オーナーが確認した判断**:

1. 最初の 3 本は Sudoku / Minesweeper / Water Sort(§6-0)。
2. Result は「1 人 1 回、最初に終わった局が数える」(§6-3)。「自己ベストを送れる」は
   採らない — 同じ盤面を繰り返す圧力になる。
3. **Owner の端末は複数**(§8-3)。当初の「Owner 端末は 1 台」は却下され、Owner リンクで
   端末を足す形に改めた。上限は端末あたりの接続数(10)と Club あたりの Owner 数(5)で
   置き、台数では縛らない。
4. Minesweeper の Challenge は初手を固定して始まる(§6-0)。参加者は最初のひと開きを
   選べないが、それが「同じ盤面」の定義である。
5. ホームの入口は「最近遊んだ」の下(§2-2 / §2-3)。

**2026-09-30 に製品オーナーが確認した判断**(`simple-games-club#1`):

10. **PixApps が Public Club House を 1 デプロイ運用する。** 2026-09-09 の「PixApps は
    サーバーを 1 台も運用しない」を、この 1 台に限って撤回した。
11. **Cloudflare を使い、固定費が限りなくゼロに近いことが前提。** 前提が崩れたら機能を
    削るかデプロイを畳む。利用者への課金・サブスク・広告の強化で埋めない
    (PRODUCT_PRINCIPLES「費用の上限」)。**未計測なので金額を書かない。**
12. **順位表を作る。** 同じ盤面・同じモードの中でだけ順位の数字を付ける。挑戦をまたいだ
    通算・シーズン・ラダーと、熱心さの順位は作らない(同「順位表」)。
13. **Public と Private は同じ体験。** Public にあって Private に無いゲーム体験を作らない。
    「同じ」とは API 契約のことで、実装は 2 つあってよい(Public は Cloudflare、Private は
    Node + SQLite)。同一性は共有コードではなく §5 の契約テストが示す。

**2026-10-02 に製品オーナーが確認した判断**:

14. **入る前の局の記録は要らない。** 参加する前に遊んだ局を、参加したあとに送る仕組み(デイリーの
    後送り、直近の局の保持)は作らない。(当初は「結果画面で `Send to Club` を押し忘れた局」を
    後から送る仕組みを指していた。ボタンは 2026-10-02 に判断 37 で無くなり、参加後の結果は
    すべて自動で送られる。「参加前の局は送らない」は判断 39 として残る。)
15. **Public の Durable Object は作られた場所(EU)のまま。** 法的に動かす理由は無く、
    EU 内に置くのは GDPR 上むしろ保守的。利用者の分布を見て作り直すかは出荷前(PR F)に
    決める(`simple-games-club` の docs/cloudflare.md §1)。
16. **本番 `club.pixapps.ai` のクラブ名は「PixApps Club」。** claim 時は既定の
    「Yoh's Club」で、2026-10-02 に `PATCH /club` で変えた。クラブ名は claim の `clubName`
    で付け、Owner が `PATCH /club` で変える(§5-3)。Private の Owner 画面(名前の入力と
    変更)は段取りの PR H。
17. **本番の計測用データは Public 公開前に消す。** 費用の spike(`simple-games-club#2`)
    が作ったメンバー 10 人と挑戦は、PR F で Durable Object を作り直してから公開する。
18. **紹介は §8-4 の形で確定。** Simple Games が招待コードを発行する形にはしない。Host が
    自分の事業者 referral リンクを置き、メンバーが `Create your own Club` を選んだときに
    そのリンクで事業者を 1 回開くだけ。親の Club を使うだけの子は事業者アカウントを
    持たないので還元は起きず、子が自分の Club を建てたときに限る。
19. **Public を先に届け、Private は次の版。** 次のアプリの版に Public Club House と、
    いまベータのアプリの公開リリースを同梱する。Private の Owner 導線(段取りの PR H:
    `Create my Club` / Hosting / クラブ名 / Railway での実証)はその次の版。

**2026-10-02 に製品オーナーが確認した判断(段取りの PR C)**:

20. **Public への参加はニックネームだけ。** 招待 token の代わりにサーバの設定
    (`CLUB_OPEN_JOIN`)で `POST /join` を開く。アプリは Public の endpoint を定数で 1 つだけ
    知り、参加の前に「ニックネームと結果が公開される」を開示する(§15-1)。
21. **盤面ごとに挑戦は 1 つ。** 同じ gameId + seed + boardDigest の挑戦が生きていれば
    `POST /challenges` はそこへ結果を足す(`200`)。デイリーはこれで世界中が 1 つの挑戦に
    集まり、新しいモードもサーバ側の盤面生成も要らない(§6-3、§15-2)。Private でも同じ。
22. **`daily` の印は、全員同じ盤面のデイリーだけに付ける。** Sudoku は付く。Minesweeper は
    初手で盤面が変わるので付けない(送れるが普通の挑戦)。Water Sort のデイリーはティアに
    無く送れない(§6-3)。
23. **読み量は行で持つ。** `result_count` と `records` を結果の到着時に更新し、一覧と記録は
    読むだけ(§15-3)。契約は変えない。
24. **LP 向けの読み取り専用ビューは PR G へ**(§15-4)。
25. **Web 版(pixapps.ai)からも Public に参加できる。** Public のサーバの CORS に
    `https://pixapps.ai` を足す(§15-1)。
26. **Public の `maxMembers` は 10,000。** `wrangler.toml` の `CLUB_LIMITS` で上げる。超えたら
    `This Club is full`(無料枠の天井とは別の、濫用の上限)。
27. **対応ゲームは 3 本に留めない。** Sudoku / Minesweeper / Water Sort は配線を通すための
    最初の 3 本(§6-0)。§6-0 の 3 条件を満たすゲームは順次 `challenge` を宣言する
    (段取りの PR E2。盤面が揃わないゲームの扱いは別の判断)。

**2026-10-02 に製品オーナーが確認した判断(ランキング。段取りの PR R)**:

28. **デイリー以外は盤面が揃っていなくてよい。** ゲーム × モードごとのランキングに、各メンバーの
    自己ベスト 1 行(§16、PRODUCT_PRINCIPLES「順位表」の改定)。ランダム性はゲームの一部で、
    何度も遊んで自己ベストを更新するのが競い方。Private も同じ。
29. **デイリーの結果はランキングに入れない。** デイリーは `Today` の挑戦の中で順位(同じ盤面)。
    (**例外**: 全員同じ盤面にならない Minesweeper と Number Recall のデイリーはランキングの表へ送る。
    リードの設計注記・オーナー確認待ち。§14 末尾。)
30. **対 CPU のスコア系も入れる**(Yacht / Hearts / Gin Rummy / Dominoes / Mancala / Reversi /
    Dots and Boxes)。勝ち負けしか無い 4 本(Checkers / Connect Four / Gomoku / Ludo)は入れない。
31. **表は上位 50 + 自分の行**。

**2026-10-02 に製品オーナーが確認した判断(段取りの PR F / G)**:

32. **表示名の規則**(§17-1): NFC 正規化、前後の空白を落とし、連続する空白は 1 つに。制御・書式・
    私用・未割り当ての文字は拒否。文字か数字を 1 つ以上含む。1〜24 文字。14 言語を一人で見る
    前提なので、語の禁止表は持たない — 代わりに通報と持ち主の対処(§17-3)。
33. **通報と対処**(§17-3): メンバーは表示名を通報できる(1 人 1 回、本文なし)。持ち主は名前を
    変える(`PATCH /members/:id`)か、結果ごと消す(`DELETE …?purge=1`)。Public の持ち主は PixApps。
34. **本番の作り直し**(§17-4): Durable Object の名前を設定(`CLUB_OBJECT_NAME`)で変えて新しい
    object から始める。古い object は消さずに残る(保存量は僅か)。claim は同じ setup key で
    できる(使用済みの記録は古い object の中)。
35. **LP に出すのは今日のデイリーの上位 3 人と表の 1 位、メンバー数**(§18)。認証なしの
    `GET /public` を 5 分キャッシュ。Private にも同じコードがあり、`open` でないデプロイでは 404。
36. **`GET /club` のメンバー一覧は新しい順に 50 件 + 総数**(§17-2)。Public の 1 万人を毎回読まない。

**2026-10-02 に製品オーナーが確認した判断(自動送信)**:

37. **参加している Club すべてへ、結果は自動で送る。ボタンは無い。** 一度 Club に参加した端末は、
    遊び終えた結果(対応ゲームの `completed`)を、参加している**すべての Club** へ自動で送る。
    `Send to Club` は無くなる(§2-2)。理由: 良い記録が、ボタンを押さずに次の盤面へ進んだだけで
    失われてはならない。同意は参加の画面で取る(§7-4。PRODUCT_PRINCIPLES「Club House」の
    「開示が先、送信が後」を参加の時点に置く)。
38. **未送信の結果は端末に残し、本人の行為のあとにだけ送る。** オフラインや失敗の結果はキュー
    (`sg.clubOutbox`、§4-2)に残る。再送は**次の結果を送るとき**と**Club の画面を開いたとき**だけで、
    **起動時には送らない**。ポーリング・バックグラウンド同期・常時接続は引き続き無い(§10)。
39. **参加の前の局は送らない。** 接続は送る瞬間に読む(§10)。
40. **全員同じ盤面のデイリーは、すべて `Today` へ。** 21 本(Sudoku、Water Sort を含む。一覧は §6-3)。
    デイリーは `Today` の挑戦の中だけで順位が付く(判断 29)。
41. **LP は各表の上位 3 人を出す**(最大 8 表、プレイの多い順)。今日のデイリーの上位 3 人とメンバー数に
    加えて(§18。判断 35 を広げる)。

**2026-10-02 に製品オーナーが確認した判断(参加と削除)**:

42. **参加(入る・切断する)と、自分の記録の削除は別のもの。削除は記録 1 件ずつで、全部を一度に消す
    ボタンは無い。** 自分の記録の横に削除ボタンがあり(ランキングの行・デイリーの結果)、押す(確認の
    あと)とその 1 件だけが消える。メンバーは記録を消して Club に残れる(ランキングの行は次の局でまた
    入る)。切断して記録をサーバに残すこともできる。**デイリーの結果を消すことは、その日の挑戦から
    抜けること**で、その挑戦へはもう結果を送れない(「最初に完了した結果が数える」はそのまま)。どちらも
    本人がいつでもできる(Owner も)。**記録を消したい人が切断だけで済ませて記録が残る**ことは、公開の説明
    (プライバシーページ、§13-6)が言う。
43. **同じ端末で同じ Club へ入り直すと、同じメンバーに戻る。** 同じ member id・同じ記録・Owner なら
    Owner のまま(新しいメンバーを作らない)。**名前は入り直すときと、そのあといつでも変えられる**。
    理由: 入り直すたびに別の人として登録されると、1 人が何行も記録を持ててしまい、「自己ベスト 1 行」の
    表(判断 28)が成り立たない。
44. **招待リンクでの参加は v1.4.0 では隠す。** Private Club House は次の版で、招待リンクはそのため
    のもの(判断 19)。参加の入口・Web の招待 URL・持ち主の招待パネルを出さない。**Coming Soon の予告は
    置かない**(PRODUCT_PRINCIPLES が採らない)。コードは残し、次の版で戻す(§7-3)。
    判断 42〜44 はすべて **v1.4.0 に入る**。

同日に、判断 42〜44 の実装についてリードが決めた設計上の注記(オーナー確認ではなく、実装の都合で決めた
こと。変えるときはこの文書を直す):

- **端末を識別する値は作らない**(判断 43 の限界。PRODUCT_PRINCIPLES「アカウントを作らない」と、
  端末識別子を触らない本書 §10 の約束)。「同じ端末」は、`sg.club` の `departed` に**秘密(member token)が残っている**ことで
  決まる。アンインストール・`Reset Local Data`・別の端末では復元できず、そこでの参加は新しいメンバーになる。
  だから、重複を残したくない人の手段は**切断の前に自分の記録を 1 件ずつ消す**こと(判断 42)であり、サーバは
  「同じ人」を推測しない。
- **自分で名前を変えても、通報は消えない**(`PATCH /me`。持ち主が変えるとき(`PATCH /members/:id`)は
  消える。§17-3)。消せば、通報された人が名前を変えるだけで数を戻せる。名前の規則は参加と同じ(§17-1)。
- **記録の削除は、先にその記録を作り直す未送信と「送った」の記憶を捨てる**(§4-2、§10)。削除の直後に
  キューの結果が記録を作り直さないため。
- **自分が作った挑戦は消さない**(`DELETE /challenges/:id/results/me`)。他の人の Result がぶら下がっている —
  消すのは自分の Result 1 件(と、ランキングでは自分の行 1 件)だけ。
- **取り下げた印は挑戦ごとに残る**(`withdrawn_results`)。デイリーの Result を消したあとの送信を
  `409 already_submitted` で断るためで、「最初に完了した結果が数える」(§6-3)を、消すことで迂回させない。
  ランキングの行には印を作らない(次の局がまた入るのが、自己ベストの表の通常の動き。§16-1)。
- **`departed` は最大 10 件で、バックアップに入れず、Reset が消す**(§4-1)。切断しても token が端末に
  残る点は §4-1 に書いた。
- **招待リンクの切り替えは 1 つの定数**(`PRIVATE_CLUBS_ENABLED`。v1.4.0 は `false`)。シェル(`app/clubGate.ts`)と
  `club/` の両方が読める場所に置く(§7-3)。

同日に、判断 37〜40 の実装についてリードが決めた設計上の注記(オーナー確認ではなく、実装の都合で
決めたこと。変えるときはこの文書を直す):

- **例外 — Minesweeper と Number Recall のデイリーは `Today` に載せず、ランキングの表へ送る**
  (判断 29 への例外。**オーナーはまだ確認していない**)。前者は初手で地雷が変わり、後者はやり直すたびに
  別の配置が配られるので、「全員同じ盤面」ではない。同じ盤面でないものを `Today` に載せると、その約束が
  嘘になる(§6-3)。オーナーが「この 2 本も `Today` へ」と決めるなら、判断 40 の一覧に足す。
- **自動送信より前に参加した接続は、同じ開示を Club の画面で受け入れるまで送らない**(§4-1 の `autoSend`、
  §10。**オーナーはまだ確認していない**)。v1.3.2 の手動ボタンで参加した端末は参加の画面で開示を
  見ていないので、更新した途端に送り始めると判断 37 の「同意は参加の画面で取る」が成り立たない。
  Club の画面の上の箱(開示 + `clubAutoSendAccept`)で同意を取り、取るまでは送らない。
- **デイリーは最初に完了した結果が数える**(§6-3)。失敗(`outcome: 'played'`)は**どこへも送らない** —
  送ればデイリーを黙って確定させてしまい、ランキングは `played` を見ない。数えるのは `completed` だけ。
- **未決 — デイリーの確定を参加の画面で言うか**: 参加している間は最初に完了したデイリーの結果が確定する
  (上)。参加の画面の `clubAutoSendDisclosure` はそれを言わない。言うなら新しい(または広げた)高リスクの
  文言で、オーナーの文言確認と 14 言語の門が要る。決まるまでは「言っていない」が現状(§6-3、§7-4)。
- **既知の制限 — 結果カードの 0.9 秒**: `useResultReveal` の「間」の間に盤面を離れると何も送られない
  (§10)。塞ぐにはゲームごとの変更が要り、v1.4.0 には入れない。
- **Cloudflare のプラットフォームエラーは非最終**: `X-Club-Api` の無い応答(無料枠の使い切りなど)は
  キューに残し、`X-Club-Api` が有って版が違うときだけ最終(§10)。
- Solitaire / Spider は版(めくり枚数・スート数)が digest に入るので、版ごとに別の `Today` の挑戦。
  Water Sort のデイリーは `{ tier: 'daily' }`(§6-3)。

**外部の事実確認**(#161 Phase 0 と `simple-games-club#1` の未完了項目。確認できるまで
文言と数字を出さない):

6. 事業者は **Railway を第一候補**とする(#161 のとおり)。one-click template で
   persistent volume / healthcheck / 環境変数 `CLUB_SETUP_KEY` の入力と再設定 /
   serverless 既定 OFF が揃う見込みで、段取りの PR B の deploy で実際に確かめる。
7. 少人数(5〜10 人、週数回)での実コスト。**計測値が出るまで金額を書かない**。
8. referral commission と template kickback の併用は**前提にしない**(製品オーナー
   判断)。両立すれば副次収益が 2 つになる、というだけで、どちらも Shared の採用条件
   ではない。未確認のまま収益に数えない。
9. 事業者が利用者ごとに referral リンクを発行していること(Host が自分のリンクを
   §8-4 に置ける前提。Railway には referral program がある見込みで、PR E で確かめる)。
   リンクを template の導線へ「引き継ぐ」仕組みは**要らない** — Host のリンクを
   そのまま開くだけで、加工も追跡もしない(§8-4)。
10. **Public を Cloudflare の無料枠で運用できるか**(判断 11 の前提そのもの)。
    **2026-10-02 に前半が確かめられた**: Workers + SQLite-backed Durable Object の実装が
    Node 版と同じ契約テスト 56 本を通し、本番 `club.pixapps.ai` への往復 114 リクエストが
    すべて契約どおりに返った(サーバエラー 0、中央値 184 ms。`simple-games-club#2`、
    同リポジトリの docs/cloudflare.md §7)。費用の driver は同 §2〜§5 に一次資料付きで
    書いた — 無料枠の上限は「止まる」であって課金ではなく、1 日 10 万リクエストが天井。
    **後半 — ダッシュボードの実測値(rows read / written、duration、保存量、請求 0)— は
    未読で、金額は書いていない。** 一覧(`GET /challenges`)と記録(`GET /records`)の
    読み量が Club の大きさに比例することが分かり、PR C で件数と記録を行で持つ形に直した
    (§15-3)。本番での再計測は PR F。
11. **表示名の安全策がどこまで要るか。** 表示名が pixapps.ai の公開ページに出る以上、
    長さ・文字種の制約と通報・削除の手段が要る。14 言語を一人で見る前提で、どこまでが
    現実的かを決める。 **2026-10-02 に判断 32・33 で決めた**(§17-1、§17-3)。

**このリポジトリの外**: サーバの実装(Node + SQLite + 1 volume)と template は
[yosuke1024/simple-games-club](https://github.com/yosuke1024/simple-games-club)
(2026-09-09 作成)。§5 の契約テストをそちらに置き、`X-Club-Api: 1` を返す最初の版が
デプロイできた時点で、こちらの段取りの PR C に入る。名前は製品語の Club に合わせた
(§1 — Shared / SharedHost / Server は実装側の語)。**最初の版は同日に置いた**: §5 の
全エンドポイント、§5-4 の JSON をそのまま fixture にした契約テスト、Dockerfile、
`railway.toml`(healthcheck・app sleeping OFF)。残りは事業者の template、Web ビルドの
同梱、事業者上での往復確認(段取りの PR B の「受け入れ」)。

## 15. Public Club House 固有のもの(2026-10-02、段取りの PR C)

Public は PixApps が運用する 1 デプロイ(§14 判断 10)で、`simple-games-club` の `wrangler.toml`
がその設定である。契約(§5)は Private と同じで、違いは**サーバの設定と、アプリが名前で知る
endpoint 1 つ**だけ。Public にあって Private に無いエンドポイントは作らない
(PRODUCT_PRINCIPLES「2 つのデプロイ」)。

### 15-1. 開かれた参加

- サーバ: 環境変数 `CLUB_OPEN_JOIN=1` で `POST /join` が `{ nickname }` だけを受け付ける
  (role は member)。`GET /health` が `open: true` を返す。招待 token と Owner リンクは
  今までどおり効く。Private は未設定(= 招待制)。
- アプリ: `club/public.ts` の `PUBLIC_CLUB_ENDPOINT`(`https://club.pixapps.ai`)が、アプリが
  名前で知る唯一のサーバ。入口は Discover 画面(接続 0 件)の `Join the Public Club House` と、
  All Clubs の末尾(Public に未接続のとき)。参加画面は**開示が先**: 「ニックネームと結果は
  Public Club House のみんなと pixapps.ai の公開ページに表示されます」
  (`clubPublicDisclosure`、高リスクキー §11)と、「参加している間は、遊び終えた結果が自動で送られます」
  (`clubAutoSendDisclosure`、§7-4。Public でも Private でも同じ)→ nickname → `Join and Play`。
- Web 版(pixapps.ai)からも同じ画面で参加できる。そのために Public のサーバは
  `CLUB_CORS_ORIGINS` に `https://pixapps.ai` を持つ(アプリの origin 2 つは常に許可。
  `src/http/cors.ts`)。
- 1 端末 1 ニックネームで、アカウントは無い(PRODUCT_PRINCIPLES)。**同じ端末で入り直すと同じメンバーに
  戻る**(§7-4、判断 43。端末を識別する値は作らず、`departed` の秘密で決まる)。表示名の制約・通報・
  削除は PR F(§14 外部確認 11)。**自分の名前の変更と記録の削除は、本人が Settings からできる**(§9、§17-3)。

### 15-2. デイリーの順位表 — 盤面ごとに 1 つの挑戦

§6-3 のとおり。新しいモードもサーバ側の盤面生成も無く、`POST /challenges` が同じ盤面を
1 つにまとめ、`daily` の印で Club 画面の `Today` に集まる(§9)。`daily` が付くのは、全員同じ盤面の
デイリーを持つ **21 本**(§6-3、判断 40)。Minesweeper(初手で盤面が変わる)と Number Recall(やり直すたびに
配置が変わる)のデイリーは、全員同じ盤面ではないので付かず、ランキングへ行く(リードの設計注記)。サーバは
結果を**ゲームの軸で上位 N 人**に並べて返し(`GET /challenges/:id/results`)、要求した本人の行は
常に含める — 1 日に多くの人が集まる `Today` で、到着順の先頭 200 件だけでは良い記録が見えなくなる
ため。

### 15-3. 読み量

`GET /challenges` の `resultCount` と `GET /records` は、結果が届いたときにサーバが行として
持つ(`challenges.result_count`、`records` テーブル。schema v2、v1 からは起動時に移行)。
一覧と記録の読み量が Club の大きさに比例しなくなる(§14 外部確認 10)。応答の形は変わらない
— 実装の選択であって契約ではない(§0)。

### 15-4. PR C に入れなかったもの

- **LP 向けの読み取り専用ビュー** → PR G。LP に何を出すか(BRAND「表現ルール」)が決まって
  から形を決める。認証無し・キャッシュ付きの公開 API になる見込みで、Public の設定で
  有効化する(Private にも同じコードがあり、設定で閉じている)。
- **表示名の安全策、通報と削除、本番の計測データの作り直し** → PR F(§14 判断 17、外部確認 11)。
- **Public の `maxMembers`** は 10,000(§14 判断 26。`wrangler.toml` の `CLUB_LIMITS`)。
- **ランキング**(§16)は PR C の後の PR R で入る。

## 16. ランキング — ゲーム × モードの自己ベスト表(2026-10-02、段取りの PR R)

§14 判断 28〜31。「同じ盤面でだけ比べる」はデイリー(§6-3、`Today`)に限り、それ以外の局は
**ゲーム × モードの表**に各メンバーの自己ベスト 1 行として入る。Public も Private も同じ。
**表は、遊び終えた結果が自動で送られて育つ**(§2-2。2026-10-02 まではボタンを押した結果だけだった)。
表に並ぶのは各人の自己ベストで、盤面は人ごとに違う — 運も含めて比べる(判断 28)。Minesweeper と
Number Recall のデイリーもここに入る(リードの設計注記。§14 末尾)。

### 16-1. 契約

- 表の鍵は `gameId` + `paramsKey`(§6-1。難易度・ティア・設定。1 つしか無いゲームは
  `standard`)。`paramsKey` は**クライアントの契約が計算して送る**(`^[a-z0-9-]{1,40}$`)。
  サーバは形だけ検査し、`params` も形(小さな JSON)だけ見て保存しない。並べる軸は `order`、
  向きは `direction`(§6-1 の表)。同値は先に出した人が上。
- 送るのは結果画面が表示した事実だけ(§5-5)。`outcome: 'played'`(負け・ギブアップ)は表に
  入らない。サーバは `played` を受けても何も変えずに現状の行を返すが、2026-10-02 からクライアントは
  `played` を**そもそも送らない**(§6-3)。
- `POST /rankings/results` の本文は `POST /challenges` と同じ形(§5-4)から `title` と
  `daily` を除いたもの。`boardDigest` は §6-4 を持つゲームだけ(無ければ null)。`seed` は
  **空でもよい**(アーケードは盤面を名乗らない)。応答は `{ gameId, paramsKey, improved, entry,
entryCount }` — `improved` は自己ベストを更新したか。順位は返さない(結果画面は数字を
  **出さない**、§2-2)。
- サーバは `src/contracts/games.ts` に 35 本の `{ order, direction }` を持ち、ここでだけ
  `facts` を読む(§5-4)。知らないゲーム、形の悪い `paramsKey`、軸の無い `completed` の
  facts は `400`。軸の名前は群ごとに固定: 時間は `elapsedSeconds`、手数は `moves`、
  Hit and Blow は `attempts`、スコアは `score`。
- 保存: `ranking_entries(game_id, params_key, member_id)` が主キーで 1 人 1 行。差し替えは
  `direction` で厳密に良いときだけ。`rank` は「自分より良い行 + 同値で先の行」の数 + 1。
  表の読みは上位 N 行 + 自分の 1 行 + 順位を数える走査(上限 `rankingRankScan`、既定 1,000 行。
  それより下なら `rank: null`)で、Club の大きさに比例しない(§15-3 と同じ考え)。表の一覧
  (`GET /rankings`)は書き込み時に維持する集計行(件数と 1 位)を読むだけ。
  `GET /records` は各表の 1 位を旧い形で返すだけ(PR C の `records` テーブルは v3 で捨てる)。
- **自分の行は消せる**(2026-10-02、判断 42): `DELETE /rankings/:gameId/:paramsKey/me`(§5-4)が自分の
  行を消し、件数と 1 位を直す(表が空なら集計行も消す)。消したあとの局は、普通の初回としてまた表へ入る
  (取り下げた印は作らない)。

### 16-2. 画面

```text
Sudoku · Hard                                   ← 表の画面(club/ui/RankingScreen)
Rankings
  1  Ken     3:58   Mistakes 0  Hints 1
  2  You     4:31   Mistakes 2  Hints 0        ← 自分の行は You
  3  Mika    5:05   …
  …(上位 50)
  —
  87 You     …                                  ← 50 位より下なら、自分の行を末尾に
24 entries
```

- Club の画面(§9)の `Rankings` が一覧、1 行を開くとこの画面。`Reload` 以外に通信は無い(§10)。
- 数字は結果画面の `facts` を `club/ui/common.tsx` の `axisText` / `factsLine` で描く(§11)。
- 行数(`entryCount`)は表の中に出す。Core の画面には出ない(§2-2「数字を出さない」)。
- **自分の行にだけ削除ボタン**(`clubDeleteRecord`、`Delete my record`。上位の行にも、末尾に足した自分の行にも。
  2026-10-02、判断 42): 押すと確認(ConfirmDialog、danger。`clubDeleteRankingTitle` /
  `clubDeleteRankingBody` / `clubDeleteConfirm`。「この表の自分の記録が消える・次に終えた局はまた入る・
  元に戻せない」)。確認したら、この端末の同じ表(同じ endpoint + `gameId` + `paramsKey`)の未送信を捨て、
  `DELETE /rankings/:gameId/:paramsKey/me` → この画面を読み直す。ほかの人の行にボタンは無い。

### 16-3. 3 本の club モードの撤去と `Today` の `Play`

Sudoku / Minesweeper / Water Sort の 3 本が持っていた `mode: 'club'` と 4 つ目の保存枠
(`sd.saveClub` / `ms.saveClub` / `ws.saveClub`)は、デイリー以外の局を Challenge にしていた v1
の名残である。`Today` の `Play` はゲームを普通の入口で開き、プレイヤーがデイリーを遊ぶ
(§9「Challenge」)ので、**2026-10-02 に出荷前に取り除いた**。`saveClub` は一度も出荷されていない(v1.3.1 に無い)ので、
`gameKeys.test.ts` の golden から外した — 出荷後なら外せなかった。

取り除いたもの: `GameMode` の `'club'`、`createClubSession`、4 つ目の保存スロット(キー・スキーマ・
読み書き)、Root の `challenge` prop(`ChallengeStart`・`GameRootProps.challenge`・`openChallenge`・
digest 不一致の 1 行画面と、その `*ChallengeMismatch` の 14 言語)、`seedPrefix`。
残したもの: 各ゲームの `challenge/contract.ts`、`boardDigest`(Today の digest 照合とランキングの
`boardDigest`)、結果画面の `ClubResultAction`(2026-10-02 からは状態 1 行)、Water Sort のランキングの
ティア(`challengeTierOf`)。

**既知の制限(2026-10-02、未解決)**: `Today` の `Play` が渡すのは「Club から開いた」という印だけで、
「デイリーを開け」という意図はゲームへ渡らない。Quick Rules を終えていない人が `Play` から
ゲームを開くと、チュートリアルを終えた時点でそのゲームの普通の最初の局(Sudoku なら現在の
レベル)が始まり、デイリーではないので挑戦には入らない(結果は自動送信でランキングへ送られる)。
ホームへ戻って Daily を選べば挑戦になる。
spike には「挑戦から開いた局はチュートリアルの後にその盤面へ進む」分岐があったが、挑戦の盤面が
渡されたときにしか働かず、今の流れでは一度も通っていなかった。直すなら、シェルが「デイリーを
開く」入口(`GameEntry` の 1 値)を渡し、対応する 35 本がそれを受ける形になる(全ゲームに触れる
変更なので codemod)。v1.4.0 までに直すかは製品オーナーの判断。

## 17. Public の運用 — 表示名・通報・削除・作り直し(2026-10-02、段取りの PR F)

§14 判断 32〜34・36。PRODUCT_PRINCIPLES「Public Club House だけの規則」の「表示名には長さと文字種の
制約を置き、通報と削除の手段を持つ。汎用のモデレーション基盤は作らない」を実装する。

### 17-1. 表示名の規則(サーバ、両デプロイ)

`POST /join` / `POST /claim` / `PATCH /members/:id` の `nickname`: NFC 正規化 → 前後の空白を落とす →
連続する空白を 1 つに → 制御(Cc)・書式(Cf)・私用(Co)・サロゲート(Cs)・未割り当て(Cn)を含めば
`400` → 文字(L)か数字(N)を 1 つ以上含む → 1〜24 文字。語の禁止表は持たない(14 言語を一人で
保てないし、回避もされる)。

### 17-2. メンバー一覧は読み切らない

`GET /club` の `members` は新しい順に `membersPage`(50)件、`memberCount` に総数。Private
(≤ 100 人)では実質いままでどおり。Club の画面の `Members` は総数と、その 50 件を出す。

### 17-3. 通報と持ち主の対処

- メンバーは、他のメンバーの行(Members、ランキングの表)から `Report` → 確認 → `POST
/members/:id/report`。1 人 1 回(2 回目は `204` で何も変えない)。本文は無い — 名前そのものが
  通報の対象で、自由入力をもう 1 つ作らない。
- 持ち主は `GET /members/reported` で通報の多い順に見る(Club の画面の Members の上に `Reported`)。
  対処は 2 つ: `PATCH /members/:id { nickname }` で名前を変える(Result とランキングの行の名前も
  変わる。本人の端末は次に Club を開いたとき `me.nickname` から新しい名前を知る)、
  `DELETE /members/:id?purge=1` で外して結果ごと消す(ランキングの集計行と挑戦の `resultCount`
  も直す)。`purge` 無しの `DELETE` は今までどおり(名前つきで Result が残る)。
- **本人の側にも 2 つの手段がある**(2026-10-02、判断 42・43。§9 の Settings): `PATCH /me { nickname }`(自分の
  名前を変える。Result とランキングの行の名前も変わる。**通報は消えない** — 消えると、通報された人が
  名前を変えるだけで数を戻せるので。持ち主が `PATCH /members/:id` で変えたときだけ消える)と、
  `DELETE /rankings/:gameId/:paramsKey/me` / `DELETE /challenges/:id/results/me`(自分のランキングの行・
  デイリーの Result を **1 件ずつ**消す。メンバーのまま残る。通報は残る。作った挑戦は残る。デイリーの
  Result を消すと、その挑戦へは送れない)。Owner も使える。`purge` の持ち主の削除と、本人の削除は、
  同じ消し方(1 つの実装)を使う。
  Public では、自分でできない場合(端末を失った・別の端末だった)は、持ち主 = PixApps への連絡
  (プライバシーページ)でも消せる。
- 通知・自動判定・凍結は無い。持ち主が Club を開いたときに見る、だけ。

### 17-4. 本番の作り直し(判断 17)

計測用データの入った Durable Object は消さず、`wrangler.toml` の `CLUB_OBJECT_NAME` を新しい値に
して新しい object から始める(`idFromName`)。デプロイ後、持ち主が `scripts/claim-public.mjs` で
claim し(同じ setup key でよい。使用済みの記録は古い object の中)、クラブ名を `PixApps Club` に。
古い object は参照されないまま残る(保存量は僅か。消すには class の削除 migration が要るので、
別の判断)。

## 18. LP の読み取り専用ビュー(2026-10-02、段取りの PR G)

§14 判断 35。PRODUCT_PRINCIPLES「LP へ出すのは読み取り専用の抜粋だけ…2 つ目の順位表データベースを
持たない…リアルタイム更新は要らない」。

- `GET /api/v1/public?date=YYYY-MM-DD`(認証なし。`open` でないデプロイは `404`):
  `{ club: { name }, memberCount, today: [{ gameId, daily, resultCount, top: [{ nickname, facts }] }],
rankings: [{ gameId, paramsKey, entryCount, leader: { nickname, facts } }] }`。`today` はその日付の
  `daily` 付き挑戦ごとに完了結果の上位 3 人(サーバが §6-1 の軸で並べる。サーバが Result を
  順位付けする場所の 1 つ)。`date` 省略時は UTC の今日。
  **2026-10-02 の改定(判断 41)**: `rankings` は**最大 8 表**(件数の多い順、同数なら `gameId` / `paramsKey`)で、
  各表に `entryCount` と `top: [{ nickname, facts }]`(その表の軸で上位 3 人、同値は到着順)を持つ。
  `leader` は互換のため残す。読みは境界つきで(全走査しない)、5 分キャッシュはそのまま。
- Worker は `caches.default` で 5 分キャッシュし(`Cache-Control: public, max-age=300`)、Node は
  ヘッダだけ。CORS は `CLUB_CORS_ORIGINS`(pixapps.ai)。
- pixapps.ai の Simple Games ページは、この JSON を取り、今日のデイリーの上位 3 人(名前と記録)と、
  **各ランキング表の上位 3 人**(最大 8 表。ゲーム名 + モード + 行)と、メンバー数を小さな 1 節に出す。
  `top` が無い応答は `[leader]` で描く。取れなければ節ごと出さない。Club House の UI は複製しない。
  文面は、ランキングが**自己ベストの並び(盤面は人ごとに違う)**であり、デイリーだけが全員同じ盤面で
  あることを正しく言う(「同じ盤面」を一般の約束として書かない)。
- プライバシーページに Club House の節(何を、どこへ、誰の管理下で、消し方)を足す(§13-6)。
