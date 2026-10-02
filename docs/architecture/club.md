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
issue #161 / #164 の本文とコメントは提案・検討の記録であり、この文書と食い違う箇所は
この文書を正とする([../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md)「Authority」)。

## 0. この文書が決めること、決めないこと

決めること — Simple Games 側に置かれるすべて:

- Core(Shared を有効化していない状態)に現れる入口の**具体形**(§2)
- `src/club/` の置き場所・到達経路・チャンク・実行時ゲート(§3、§12)
- 端末側に保存する接続情報と未送信キュー(§4)
- サーバとの API 契約(§5)。サーバ実装は別リポジトリだが、**契約はこちらが持つ** —
  クライアントを出荷するのはこのリポジトリであり、サーバはこの契約に合わせて作る
- 挑戦(Challenge)と結果(Result)の型と、最初の 3 ゲームでの spike(§6)
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

### 2-2. 接続済みの端末だけ — ホームの入口 1 つ + 結果画面の操作 1 つ

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
- **結果画面の操作**: 契約(§6-1)を持つゲームの結果画面に、`ShareAction` と同じ位置・
  同じ格の副次操作を 1 つ。実体は Core の 1 コンポーネント
  `ui/components/ClubResultAction.tsx` で、`ShareAction` と同じくゲームが自分の結果
  カードに置く。描くものは局の種類で 1 つに決まる:
  - **通常の局**(レベル / フリー / 対 CPU など、デイリー以外): `Send to Club`。押すと Club を
    選び(1 つなら選ばない)、この結果を**そのゲーム × モードのランキング**へ送る(§16)。
    自己ベストでなければ表は変わらないが、送信は押した直後に 1 回で、画面は `Sent to
Suzuki Family` と言うだけ(順位の数字は Club の画面で見る)。
  - **デイリーの局**(全員同じ盤面のデイリー): `Send to Club`。押すと、その日の挑戦
    (§6-3「盤面ごとに 1 つ」)に自分の結果が入る。Club の `Today` から開いて遊んだ局
    (§9)は、開くときに「終えたら結果を Suzuki Family へ送る」と**先に**書いてあるので
    自動送信し、画面は**状態 1 行** — `Sent to Suzuki Family` / `Will send when you open
the Club` / `Could not send to Suzuki Family`(§10)。「開示が先、送信が後」。
  - デイリーが全員同じ盤面にならないゲーム(Minesweeper は初手で地雷が変わる)のデイリーは、
    通常の局として扱う(ランキングへ)。
- 接続していない端末では、このコンポーネントは **null を描き、何も知らない**。
  結果画面の他の要素(主要操作・共有・広告枠)の位置は接続の有無で変わらない。
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
  知らない。context の値は `club/` がロードされた後に `App.tsx` が差し込む。
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
}
```

- **validate は要素ごと**。壊れた要素は落とし、正しい要素は残す。全体が読めなければ
  既定値(0 件)に倒す — その端末は「未接続」に見えるだけで、Core のゲーム・保存・
  設定には何も起きない(PRODUCT_PRINCIPLES「Shared 情報破損で Core game data を
  消さない」)。**member token はサーバ側に hash でしか無い**ので、端末側のレコードが
  消えれば再参加(招待を再度もらう)しか無い。これは受け入れる — token を復元できる
  経路(バックアップ、クラウド)を作るほうが害が大きい。
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

```ts
interface ClubOutbox {
  schemaVersion: 1;
  items: OutboxItem[]; // 送信順。上限 50 件、超えたら古いものから落とす
}

interface OutboxItem {
  endpoint: string; // どのサーバへ(接続が消えていたら捨てる)
  challengeId: string;
  result: ResultSubmission; // §6-3 と同じ body
  createdAt: string;
}
```

ゲームの保存とは混ぜない(#161「Shared 専用の小さな local queue」)。送るのは §10 の
契機のときだけで、タイマーもバックグラウンドも無い。バックアップに入れない・
削除で消える、は `sg.club` と同じ。

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
| 409  | `already_submitted`   | その Challenge にこの member の Result が既にある(§6-3「1 人 1 回」)    |
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
| `GET /challenges/:id/results`      | member | 提出順。**並べ替えはクライアント**(§6-1 の `order`)。最大 200 件                                                                                                                                                                                                                                                   |
| `POST /challenges/:id/results`     | member | 自分の Result を 1 回だけ                                                                                                                                                                                                                                                                                          |
| `GET /records`                     | member | `{ gameId, paramsKey, facts, memberId, nickname, challengeId }[]`。導出値。サーバは結果が届いたときに更新した行を読むだけで、一覧のたびに導出しない(§15-3)                                                                                                                                                         |
| `POST /rankings/results`           | member | `{ gameId, contractVersion, paramsKey, params, seed, boardDigest, outcome, facts }` → その結果を**ゲーム × モードのランキング**へ(§16)。自己ベストなら差し替え、そうでなければ何も変えない。`{ gameId, paramsKey, improved, entry, entryCount }`。サーバが知らないゲーム / 軸の無い facts は `400 invalid_request` |
| `GET /rankings`                    | member | 表の一覧 `{ gameId, paramsKey, entryCount, leader: Entry }[]`(ゲーム・モード順)。`GET /records` はこの `leader` を旧い形で返すだけになった(2026-10-02)                                                                                                                                                             |
| `GET /rankings/:gameId/:paramsKey` | member | 1 つの表 `{ gameId, paramsKey, entryCount, entries: Entry[], me }`。`?top=` で上位 N(既定 50、最大 100)。`me` は自分の順位と行(表に無ければ null。順位は数える上限より下なら null)                                                                                                                                 |
| `GET /hosting`                     | member | `Hosting`。`manageUrl` は **Owner にだけ**返す(Member には null)                                                                                                                                                                                                                                                   |
| `PATCH /hosting`                   | owner  | `{ referralUrl }` の設定 / 解除(`null`)                                                                                                                                                                                                                                                                            |
| `GET /invite`                      | owner  | 現在の Member 招待 `{ token, url }`                                                                                                                                                                                                                                                                                |
| `POST /invite`                     | owner  | `{ role: 'member' }` は Member 招待を**作り直す**(前のものは即無効)。`{ role: 'owner' }` は **Owner リンク** `{ token, url, expiresAt }` を 1 本発行(1 回限り・24 時間。§8-3)                                                                                                                                      |
| `DELETE /members/:id`              | owner  | member を外す(Owner も外せる)。その token は即 401。Result は残る(nickname 付き)。最後の Owner は外せない(`409 last_owner`)                                                                                                                                                                                        |
| `PATCH /club`                      | owner  | `{ name }`                                                                                                                                                                                                                                                                                                         |

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
`Challenge`(`mine: true`)を返す。既に自分の Result があれば `409 already_submitted`
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

→ `201` with `Result`。2 回目は `409 already_submitted`。digest が違えば
`409 board_mismatch`(何も保存しない)。

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

## 6. 挑戦と結果の契約 — 3 本の spike

### 6-0. 何が「挑戦が自然に成立する」か

条件は 3 つ。(1) 盤面が seed から決定的に生まれる、(2) その決定性を golden テストが
既に固定している(挑戦の同一性は、既存プレイヤーの自己ベストの土台と同じものに
乗る)、(3) 結果画面が比較軸になる事実を表示している。
Phase 0 の spike として 3 本を実装事実で確かめた(2026-09-09、`main` のコード):

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

**Minesweeper の初手は Challenge の一部である**(spike の発見 1)。同じ seed でも初手が
違えば地雷が違う(`generateField(seed, difficulty, firstIndex)`)。デイリーはこれを
許している(比べないから)が、Challenge では許せないので `params.firstIndex` を持ち、
参加者の局は**そのマスを開いた状態で始まる**(時計は 0 から)。作成者が見た開始局面と
同じ局面から始めることになり、これは「同じ盤面」の定義そのものである。

**seed は生成器の版に依存する**(spike の発見 2)。golden が守っている限り版が変わって
も同じ盤面だが、golden を意図して更新した版(自己ベストの土台を変える判断をした版)と
古い版の間では同じ seed が違う盤面になる。Challenge は `boardDigest`(§6-4)を持ち、
参加者の端末で生成した盤面の digest が違えば**遊ばせず送らせない**
(`This challenge was made with a different version of the game`)。比較の同一性は
文書ではなく digest で守る。

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
  /** Challenge の局に使う seed の接頭辞(§6-2)。club モードを持つ 3 本だけ */
  seedPrefix?: string;
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

| ゲーム      | `params`                                                        | `facts`(`completed`)                                 | `facts`(`played`) | `order`          | `paramsKey`  | `seedPrefix`   |
| ----------- | --------------------------------------------------------------- | ---------------------------------------------------- | ----------------- | ---------------- | ------------ | -------------- |
| sudoku      | `{ difficulty: 'easy' \| 'medium' \| 'hard' }`                  | `{ elapsedSeconds: int, mistakes: int, hints: int }` | (起きない)        | `elapsedSeconds` | `difficulty` | `sudoku-club-` |
| minesweeper | `{ difficulty: 'easy' \| 'medium' \| 'hard', firstIndex: int }` | `{ elapsedSeconds: int, hints: int }`                | `{}`              | `elapsedSeconds` | `difficulty` | `mines-club-`  |
| water-sort  | `{ tier: 'easy' \| 'medium' \| 'hard' }`                        | `{ moves: int, elapsedSeconds: int, hints: int }`    | (起きない)        | `moves`          | `tier`       | `water-club-`  |

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

### 6-2. ゲーム側の対応 — レジストリの `challenge` と 4 つ目のスロット

対応ゲームは 2 つのものを持つ。どちらも**そのゲームの中**に置き、シェルはレジストリ
経由でしか触らない。

1. **`games/<id>/challenge/contract.ts`** — §6-1 の `GameChallengeContract` の実装。
   `storage/keys.ts` と同じ **import ゼロの葉**で、レジストリが同期 import して
   `GameDefinition.challenge?: GameChallengeContract<unknown, unknown>` として公開する。
   葉にする理由も同じ — `club/` が Challenge 一覧を描くときに params の妥当性と
   `paramsKey` が要り、そのためにゲームのチャンクをロードしたくない。
   `src/test/importBoundaries.test.ts` 規則 3 と同じ「import ゼロ」の検査を足す。
2. **Challenge の局を受け取る口** — `GameRootProps` に任意の `challenge` を足す:

   ```ts
   interface ChallengeStart {
     seed: string; // §6-1 の seedPrefix で始まる
     params: unknown; // そのゲームの contract で validate 済み
     boardDigest: string; // 参加者側で生成した盤面と照合する(§6-4)
   }
   interface GameRootProps {
     onExit: () => void;
     entry?: GameEntry;
     challenge?: ChallengeStart;
   }
   ```

   `entry` と同じで、**指示ではなく事実**である。対応ゲームは `challenge` があれば
   その seed / params で局を作り(Sudoku: `createFreeSession(difficulty, seed)`、
   Minesweeper: `createDifficultySession(difficulty, seed)` → `tapCell(firstIndex)`、
   Water Sort: `createFreeSession(tier, seed)`)、digest を照合してから盤面へ入る。
   チュートリアル未了なら Quick Rules が先(ショートカットと同じ)。非対応ゲームは
   この prop を受け取らない(レジストリに `challenge` が無いゲームへ `club/` は
   渡さない)。

3. **4 つ目の中断スロット**(spike の 3 本だけ。2026-10-02 以降、`Today` の `Play` はゲームの
   デイリーを開くので新しいゲームには足さない。§16-3)— Challenge の局は `mode: 'club'` として、そのゲームの
   新しいキー(`sd.saveClub` / `ms.saveClub` / `ws.saveClub`)に中断・再開する。
   フリーのスロットを使い回すと、進行中のフリー局が Challenge で置き換わる(データ
   損失)。新しいキーは `storage/keys.ts` に足し、`gameKeys.test.ts` の golden・
   `storageKeys`・バックアップ(**運ぶ** — ゲームの中断局であり、鍵ではない)に
   自動的に載る。Challenge の局の結果は**そのゲームの統計に入れない**(自己ベスト・
   クリア数・レベル進行に触れない。#161 comment「personal stats と Club records を
   分離する」)。局の識別は他のスロットと同じくキーで決め、レコード内の `mode` が
   食い違えば破損として落とす(`savedGameSlots.test.ts` の規則)。
4. **Challenge から入った局の結果画面**は、`ClubResultAction` に `challengeRef`
   (どの Club のどの Challenge か)を渡す。それがあれば §2-2 の「状態 1 行」になり、
   結果は自動送信される。`challengeRef` は `ChallengeStart` に含めず、`club/` →
   `App.tsx` → `ClubBridge` の側で持つ(ゲームに Club の id を教えない)。

### 6-3. Challenge は終わった 1 局から作る — 2026-10-02 以降はデイリーだけ

#161 の「誰かが Challenge を作る」を、**フォームではなく結果画面**に置く。**2026-10-02 に、
デイリー以外の局は Challenge にせずランキング(§16)へ送ることにした** — 以下の「通常の局」
の記述は、全員同じ盤面のデイリーの局についてだけ生きている。

- 通常の局(レベル / デイリー / フリー)の結果画面で `Send to Club` を押す →
  その局の `seed` / `params` / `boardDigest` と、自分の結果を **`POST /challenges` に
  1 回**で送る。作成者の結果が最初の Result になる。
- 理由: (a) 盤面を生成せずに Challenge を作る経路(seed だけ決めて digest を計算する
  ためにゲームのロジックを `club/` から呼ぶ)が要らなくなる — digest は遊んだ局が
  既に持っている。(b) 「自分がまだ遊んでいない盤面を人に出す」形が無くなり、
  Challenge は常に「私はこうだった、あなたは?」になる。(c) #164 の
  `Challenge a friend` と #161 の Create Challenge が同じ 1 操作になる。
- Club の画面にある `New Challenge`(§9)は、対応ゲームを選んでフリープレイの局を
  始めるだけ(ゲームの通常のフリープレイ)。終えた結果画面に `Send to Club` がある。
- **1 人 1 回**: 1 つの Challenge に対する Result は member あたり 1 つで、最初に
  **終わった**局(勝ちでも負けでも)が数える。同じ盤面を解答を見た後に遊び直しても
  同じ挑戦ではない。2 回目は端末側で送らず(`sg.club` 側に「送った Challenge の id」を
  持たない — サーバの `mine` を見る)、送ってもサーバが 409。Minesweeper の敗北も
  1 回に数える — 地雷の位置を知った 2 回目は同じ挑戦ではないから。デイリーの
  「過去日へ遡れる」とは別の話で、Challenge に締切が無いのは変わらない。
- **レベルの局・デイリーの局も送れる**。seed がそのままレコードに乗り、参加者は
  `mode: 'club'` の 4 つ目のスロットで遊ぶ(自分のレベル進行・デイリー履歴には
  触れない)。

- **盤面ごとに挑戦は 1 つ**(2026-10-02、§15-2)。同じ `gameId` + `seed` + `boardDigest` の
  挑戦が生きていれば、`POST /challenges` は新しく作らず、送った人の結果をそこへ足す
  (`200`。§5-4)。理由: デイリーは日付から seed を導くので世界中で同じ 1 盤面になり、
  送った人全員が 1 つの挑戦に集まる — それが Public の順位表である
  (PRODUCT_PRINCIPLES「順位表」)。新しいモードも、サーバ側の盤面生成も要らない。レベルの局も
  同じ seed なら同じ挑戦に集まる。Private でも同じ(友人 2 人が同じデイリーを送れば 1 つ)。
- **`daily` の印**は、結果画面の `Send to Club` が、その局がデイリーで、かつ**そのゲームの
  デイリーが全員同じ盤面**のときだけ付ける(`ClubResultAction` の `daily`、`POST /challenges`
  の `daily`)。Sudoku は付く。Minesweeper のデイリーは初手で地雷が変わる(§6-0)ので付けない
  — 送れるが、普通の挑戦になる。Water Sort のデイリー(6 色・均等な混ぜ)はティアに一致せず、
  そもそも送れない(`challengeTierOf`)。Club の画面は端末のローカル日付で
  `GET /challenges?daily=` を引き、`Today` に並べる(§9)。

### 6-4. `boardDigest`

- 形: `<ゲーム接頭辞><契約版>:<8 桁 hex>`(`sd1:9f3a1c07` / `ms1:…` / `ws1:…`)。
- 計算はゲームの **Pure TypeScript**(`game/`)で、盤面の正規化文字列(Sudoku: givens
  の行優先 81 文字。Minesweeper: 初手適用後の地雷 bit 列。Water Sort: 初期チューブの
  文字列形 — いずれも golden テストが既に使っている文字列形)を、そのゲームの
  `game/rng.ts` にある xmur3(32 bit。Sudoku / Minesweeper は `hashSeed` として export
  済み、Water Sort は同じ 1 行の export を足す)に通す。新しい依存も共通ユーティリティも
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

| 経路                                                             | できること                                                                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 招待 URL をブラウザで開く(SharedHost の Web)                     | nickname → `Join and Play`。**インストール不要**。同じ origin なので CORS の問題が無い                                                                                 |
| アプリの設定 > Advanced > `Club House` > 参加                    | 招待 URL を**貼り付ける**(`inviteFromHref` で endpoint と token を読む)→ nickname → 参加                                                                               |
| アプリ / Web 版の `Play together` > `Join the Public Club House` | 開示(ニックネームと結果が公開される)→ nickname → `POST /join { nickname }`。endpoint はアプリが名前で知る唯一のもの(`club/public.ts` の `PUBLIC_CLUB_ENDPOINT`。§15-1) |
| pixapps.ai の Web 版の `Play together`                           | Public への参加(上の行)と、「招待リンクを開いてください」の説明、Host になる導線(§8)。任意 endpoint への直接接続は無い                                                 |

アプリが招待 URL を直接受け取る経路(App Links / Universal Links)は作らない
([../WEB_VERSION.md](../WEB_VERSION.md)「URL」の判断のまま)。招待された人の最短経路は
ブラウザで、アプリは後から同じ URL を貼れば同じ Club に入れる(別の member として。
§4-1)。

### 7-4. Join の画面(SharedHost の Web)

```text
Join Suzuki Family

Nickname
[ Ken ]

[ Join and Play ]

Simple Games by PixApps
```

- Club 名は `GET /health` では返さない(招待 token の妥当性を確かめる前に名前を
  出さない)。`POST /join` の応答で初めて表示する。画面は最初「Join a Club」と出し、
  参加後に名前が入る。
- 参加後はそのまま Club の画面(§9)。Web 版の Core(30 ゲーム)は同じページに
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

### Club

```text
Suzuki Family                                  [Invite] [Settings]

Today                                          ← その日のデイリー(§6-3)。無い日は節ごと出ない
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

### Challenge

```text
Sudoku · Hard
by Yoh · Sep 7

When you finish, your result is sent to Suzuki Family.   ← 開示が先(§2-2)

[ Play ]

Results
  Ken    4:31   Mistakes 0   Hints 1
  Yoh    5:05   Mistakes 2   Hints 0
  Mika   played                              ← Minesweeper の敗北など
```

- `Play`(2026-10-02 以降、Today のデイリーの挑戦)→ `App.tsx` の `enterGame(gameId,
'collection')` でそのゲームを開き、シェルが挑戦を `ActiveChallenge` として覚える。プレイヤーが
  そのゲームのデイリーを遊んで終えると、結果画面の `ClubResultAction` が盤面の digest を
  突き合わせて自動送信する(§2-2)。開く前の 1 行は `Open Sudoku and play today's Daily. When
you finish, your result is sent to Suzuki Family.`。club モードの `challenge` prop(§6-2)は
  spike の 3 本に残っているが、この経路では使わない(§16-3)。
- Results は §6-1 の `order` で並び、**順位の数字が付く**(2026-09-30)。メダル・称号・
  挑戦をまたいだ差分は無い。自分の行は `You` で示す。
- 自分が遊んだ後にだけ他の人の結果を見せる、という隠し方は**しない**(隠すのは
  「遊ばせるための仕掛け」であり、Solo by default に反する)。見たい人は見る。
- 自分の結果がある Challenge の `Play` は `Play again`(ローカルで同じ盤面を遊べるが、
  結果は送られない。§6-3「1 人 1 回」)。

### Settings(Club ごと)

nickname の変更(`PATCH` は v1 に無い — 変えたいときは再参加。v1 の制約)、
`Disconnect this device`(§8-5)、Owner: Club 名の変更、招待の作り直し、Owner 端末の
追加(§8-3)。

### 後続(v1 では作らない)

#161 comment の Private Game Club 拡張のうち、v1 の契約に**入れない**もの:
掲示板 / スレッド / リアクション / pin、投票、Club の書き出し、Group identity
(アイコン・色)、Member プロフィール。入れるときは §5 の版を上げる(`X-Club-Api: 2`)。
DM / リアルタイムチャット / フォロー / アルゴリズムフィード / 無限フィード /
Push は後続でも作らない(PRODUCT_PRINCIPLES「Club House」)。**公開の Club House は
2026-09-30 に「作らない」から外れた** — ただし作るのは PixApps が運用する 1 デプロイ
だけで、利用者の Private を公開に切り替える機能は作らない。

## 10. 通信・オフライン・障害

- **通信が起きる契機**(すべて本人の操作の直後、1 操作 1 リクエスト):
  Club / Challenge / Ranking の画面を開く・明示の再読み込み(GET。Club の画面は club /
  challenges?daily=今日 / rankings の 3 本)、参加 / claim(POST)、
  結果画面の `Send to Club`(POST)、Challenge の局の終了(POST、§2-2)、Owner の操作。
  ホームを描く・ゲームを開く・盤面を遊ぶ・設定を開く、では**通信しない**。
- **ポーリング・バックグラウンド同期・常時接続・Push は無い**。`setInterval` /
  `WebSocket` / `EventSource` は `club/` にも書かない(`check-principles.sh` §1 は
  `club/` を除外しているので、これは文書とレビューの約束。§12 で `WebSocket` /
  `EventSource` / `sendBeacon` については `club/` を含めた不在検査を足す)。
- タイムアウト 10 秒。失敗はその画面の 1 行(`Could not reach Suzuki Family`)で、
  ダイアログ・トースト・再試行ループは無い。**ゲームは止まらない** — Challenge の局は
  端末内で完結しており、サーバが落ちていても遊べる。
- **未送信キュー**(§4-2): 結果の POST が失敗したら `sg.clubOutbox` へ。次に
  その Club の画面を開いたとき、または次の結果を送るときに、古い順に送る
  (タイマー無し)。`already_submitted` / `board_mismatch` / `not_found` /
  `unauthorized` が返ったら**捨てる**(再送しても通らない)。body そのものが拒まれた
  `invalid_request` / `forbidden` / `too_large` / `unsupported_version` も同じ(先頭で
  詰まると、その Club の後続が一つも送れないため)。`X-Club-Api` が知らない版のサーバも
  同じ(次項: その Club へは何も送らない。残せば開くたびに送ってしまう)。応答が無い・
  429・5xx・形の崩れた応答は再送の対象。結果画面の 1 行は、送れたら `Sent to <club>`、キューに入ったら
  `Will send when you open the Club`、捨てたら `Could not send to <club>`。Club との接続を
  切ったら、その Club 宛てのキューも捨てる(§4-2)。
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
  `playTogetherBody`)と、`ClubResultAction` の 4 つ(`clubSendResult` /
  `clubResultSent`(`{club}`)/ `clubResultPending` / `clubResultNotSent`(`{club}`))だけ。
- **高リスクキー**(`src/i18n/highRiskKeys.ts` に足す。門は `gateRecord.json`):
  §8-2 の説明画面の 4 箇条、§8-5 の Disconnect の本文、§9 Challenge の
  「終えたら結果を {club} へ送る」の 1 文、§8-4 の「削除は事業者側で」の 2 文、§15-1 の
  Public の開示(`clubPublicDisclosure`: ニックネームと結果が公開される)。
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

接続済みの端末の対応ゲームだけ。`Send to Club` が #164 の `Challenge a friend` である。
未接続の端末には**置かない**(#176)。毎回強調しない・点滅しない・バッジを付けない。

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
インストールを条件にしない。ページの brand 表示は 1 行。

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

14. **入る前の局の記録は要らない。** 結果画面で `Send to Club` を押し忘れた局を後から
    送る仕組み(デイリーの後送り、直近の局の保持)は作らない。Club から入った挑戦の局が
    自動送信であれば足りる(§2-2)。
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
    spike の 3 本(§6-0)。§6-0 の 3 条件を満たすゲームは順次 `challenge` を宣言する
    (段取りの PR E2。盤面が揃わないゲームの扱いは別の判断)。

**2026-10-02 に製品オーナーが確認した判断(ランキング。段取りの PR R)**:

28. **デイリー以外は盤面が揃っていなくてよい。** ゲーム × モードごとのランキングに、各メンバーの
    自己ベスト 1 行(§16、PRODUCT_PRINCIPLES「順位表」の改定)。ランダム性はゲームの一部で、
    何度も遊んで自己ベストを更新するのが競い方。Private も同じ。
29. **デイリーの結果はランキングに入れない。** デイリーは `Today` の挑戦の中で順位(同じ盤面)。
30. **対 CPU のスコア系も入れる**(Yacht / Hearts / Gin Rummy / Dominoes / Mancala / Reversi /
    Dots and Boxes)。勝ち負けしか無い 4 本(Checkers / Connect Four / Gomoku / Ludo)は入れない。
31. **表は上位 50 + 自分の行**。

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
    現実的かを決める。

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
  (`clubPublicDisclosure`、高リスクキー §11)→ nickname → `Join and Play`。
- Web 版(pixapps.ai)からも同じ画面で参加できる。そのために Public のサーバは
  `CLUB_CORS_ORIGINS` に `https://pixapps.ai` を持つ(アプリの origin 2 つは常に許可。
  `src/http/cors.ts`)。
- 1 端末 1 ニックネームで、アカウントは無い(PRODUCT_PRINCIPLES)。表示名の制約・通報・
  削除は PR F(§14 外部確認 11)。

### 15-2. デイリーの順位表 — 盤面ごとに 1 つの挑戦

§6-3 のとおり。新しいモードもサーバ側の盤面生成も無く、`POST /challenges` が同じ盤面を
1 つにまとめ、`daily` の印で Club 画面の `Today` に集まる(§9)。いま `daily` が付くのは
Sudoku のデイリーだけ(Minesweeper は初手で盤面が変わる、Water Sort のデイリーはティアに
無い。§6-3)。対応ゲームが増えれば、全員同じ盤面のデイリーを持つゲームはそのまま `Today`
に加わる。

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

### 16-1. 契約

- 表の鍵は `gameId` + `paramsKey`(§6-1。難易度・ティア・設定。1 つしか無いゲームは
  `standard`)。`paramsKey` は**クライアントの契約が計算して送る**(`^[a-z0-9-]{1,40}$`)。
  サーバは形だけ検査し、`params` も形(小さな JSON)だけ見て保存しない。並べる軸は `order`、
  向きは `direction`(§6-1 の表)。同値は先に出した人が上。
- 送るのは結果画面が表示した事実だけ(§5-5)。`outcome: 'played'`(負け・ギブアップ)は表に
  入らないが、送ってよい(サーバは何も変えずに現状の行を返す)。
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

### 16-3. 3 本の club モードと `Today` の `Play`

spike の 3 本(§6-2)が持つ `mode: 'club'` と 4 つ目の保存枠は、デイリー以外の局を Challenge
にしていた v1 の名残である。`Today` の `Play` はゲームのデイリーを開く(§9「Challenge」)ので、
新しいゲームには足さず、3 本からも**出荷前に取り除く**(段取りの PR R の後。`saveClub` キーは
未出荷なので golden から外せる — 出荷後なら外せない)。
