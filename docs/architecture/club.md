# Shared(Private Game Club)— クライアント側の契約

作成 2026-09-09。issue #161(Optional Shared Server / Private Game Club)の**設計**であり、
Epic #175 の段 2(原則の境界 #176 → **#161 の設計** → #164 の発見導線)に当たる。
境界の正本は [../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Shared」で、この文書は
その境界の**内側で #161 と #164 をどう作るか**を固定する。索引と要約は
[../ARCHITECTURE.md](../ARCHITECTURE.md)。

**実装はまだ無い**(2026-09-09 時点。`apps/simple-games/src/club/` は存在しない)。
段取りは [../plans/2026-09-09-private-game-club.md](../plans/2026-09-09-private-game-club.md)。
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

| 語               | 意味                                                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**         | Shared を有効化していない状態のアプリと Web 版。PRODUCT_PRINCIPLES の全約束の主語                                                                                                                                   |
| **Shared**       | 利用者が自分で建てたサーバへ明示的に接続したときだけ現れる任意の層。製品名は **Private Game Club**。UI と公開文面では **Club** と呼び、Shared / SharedHost / Server はコード・文書の語                              |
| **サーバ**       | 利用者(または招待した知人)が建てた 1 台。**1 台 = 1 Club**(v1)。複数の Club に入る = 複数のサーバに接続する。API に Club の id を持たせるのはこの固定を将来ほどけるようにするためで、v1 のサーバは 1 つしか返さない |
| **Host / Owner** | サーバを建てた人。`role: 'owner'` の member。建てる・払う・消すのはこの人で、PixApps は関与しない                                                                                                                   |
| **Member**       | 招待で参加した人。端末ごとに member token を持つ。同じ人が別の端末で入れば別の member(§4)                                                                                                                           |
| **Challenge**    | 「このゲームを、このモードで、この seed で」を Club に置いたもの。**終わった 1 局から作る**(§6)。締切は無い                                                                                                         |
| **Result**       | 1 つの Challenge に対する member 1 人の結果。結果画面が表示した事実だけ(§6)。**1 人 1 回**                                                                                                                          |
| **Club 記録**    | そのゲーム・そのモードでの Club 内ベストとその持ち主。自己ベストと同じ意味の「記録」で、順位ではない(PRODUCT_PRINCIPLES「ランキングの縮め方」)                                                                      |
| **接続**         | 端末が 1 つのサーバについて持つ endpoint + member token。`sg.club` の 1 要素(§4)                                                                                                                                    |

## 2. Core に現れるもの — 入口 3 つの具体形

PRODUCT_PRINCIPLES「Core が Shared から受け取る変更は次の 3 つまで」を、画面と
コードの単位に落とす。**これ以外に Core の画面・文言・保存・通信は増えない。**

### 2-1. 設定 > Advanced の入口 1 つ(常に在る)

- 設定画面に **Advanced** の節を 1 つ足し(現状この節は無い。Backup & Restore の
  下、ローカルデータ削除の上)、行を 1 つ置く: `Private Game Club`。副題は無し。
- 押すと `src/app/` が `club/` を動的 import し(§3)、Club の入口画面(§9「入口」)
  を開く。接続が 1 つも無ければ「参加する / 自分の Club を作る」、あれば Club 一覧。
- Core が持つ文言はこの 2 キー(`advancedTitle` / `clubEntry`)だけ。
- 設定画面はコレクションホームからしか到達しないので、ゲームが起動中にこの行が
  描かれることはない(既存の `SettingsSection` と同じ性質)。

### 2-2. 接続済みの端末だけ — ホームの入口 1 つ + 結果画面の操作 1 つ

**接続済み** = 起動時に `sg.club` の接続が 1 つ以上ある(§4)。判定は Core の
`src/app/` が保存の有無だけで行い、通信しない。

- **ホームの入口**: 「最近遊んだ」の下・カテゴリ節の上(Web 版のアプリ案内カードと
  同じ流れの中の 1 枚。`CollectionHomeScreen` の `appPrompt` と同じ位置に、同じく
  「無ければ場所を取らない」形)。内容は見出し `Private Game Club` と、`sg.club` に
  キャッシュされた Club 名を「 · 」で連結した 1 行(`Suzuki Family · Pune Office`)。
  **数字を出さない** — #161 の例にある「3 active challenges」は置かない。件数を出す
  にはホームを描くたびに通信する必要があり(PRODUCT_PRINCIPLES「通信は…本人の操作の
  直後にだけ」に反する)、出せたとしてもそれはバッジであり「まだ手に入れていないもの
  を見せて呼び戻す」仕掛けになる。押すと `club/` の Club 一覧(1 つなら直接その Club)。
- **結果画面の操作**: 挑戦が自然に成立するゲーム(§6-1 の 3 本から)の結果画面に、
  `ShareAction` と同じ位置・同じ格の副次操作を 1 つ。実体は Core の 1 コンポーネント
  `ui/components/ClubResultAction.tsx` で、`ShareAction` と同じくゲームが自分の結果
  カードに置く。描くものは局の種類で 1 つに決まる:
  - **通常の局**(レベル / デイリー / フリー): `Send to Club`。押すと Club を選び
    (1 つなら選ばない)、この局から Challenge を作って自分の結果を最初の Result
    として送る(§6-3)。送信は押した直後に 1 回。
  - **Challenge の局**(Club から入った局): 操作ではなく**状態 1 行** —
    `Sent to Suzuki Family` / 失敗時 `Will send when you open the Club`(§10)。
    結果は局の終了で自動送信する。自動でよいのは、Challenge を開くときに
    「終えたら結果を Suzuki Family へ送る」と**先に**書いてあるから(§9「Challenge」。
    「開示が先、送信が後」)。結果画面で改めて押させるのは手数であって同意ではない。
- 接続していない端末では、このコンポーネントは **null を描き、何も知らない**。
  結果画面の他の要素(主要操作・共有・広告枠)の位置は接続の有無で変わらない。
- 全 30 ゲームへ機械的に足さない。置くのは §6-1 の対応ゲームだけで、
  `src/test/shareWiring.test.ts` と同型の静的テストが「対応ゲームにだけ在り、
  自分の id を名乗る」ことを見る。

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
- サーバはレスポンスに `X-Club-Api: 1` を付ける。クライアントは**この値を見て**、
  知らない版なら「このサーバは新しすぎます」を出して何も送らない(§10)。
- エラーは `{ "error": { "code": "<snake_case>", "message": "<英語 1 文>" } }`。
  `message` は開発者向けで、画面には出さない(画面の文言は `code` から
  クライアントのカタログで引く。§11)。

| HTTP | code                  | いつ                                                                 |
| ---- | --------------------- | -------------------------------------------------------------------- |
| 400  | `invalid_request`     | body が契約に合わない                                                |
| 401  | `unauthorized`        | token が無い / 不正 / **revoke 済み**(Member 削除)                   |
| 403  | `forbidden`           | Owner 専用の操作を Member が呼んだ                                   |
| 404  | `not_found`           | Challenge / Member が無い                                            |
| 409  | `already_submitted`   | その Challenge にこの member の Result が既にある(§6-3「1 人 1 回」) |
| 409  | `board_mismatch`      | Result の `boardDigest` が Challenge のものと違う(§6-4)              |
| 409  | `invite_expired`      | 招待 token が無効(再発行済み)                                        |
| 409  | `setup_key_used`      | Setup Key が既に使われた / 一致しない(§8)                            |
| 413  | `too_large`           | body が 16KB を超えた                                                |
| 429  | `rate_limited`        | 下記の上限                                                           |
| 501  | `unsupported_version` | `contractVersion` をサーバが知らない                                 |

- rate limit は最小限: `/join` と `/claim` は IP あたり 10 回 / 分、それ以外は
  member あたり 60 回 / 分。超えたら 429 で、クライアントは再試行しない(次の操作まで)。
- CORS: サーバは自分の origin、`https://localhost`(Android の Capacitor)、
  `capacitor://localhost`(iOS)を許可する。pixapps.ai は v1 では許可しない(§7-3)。
- token の生成と保存: invite token は 128 bit、member token と Setup Key は 256 bit の
  乱数を base64url で。サーバ DB には **SHA-256 の hash** だけを置く(server secret を
  pepper として連結)。平文は発行時のレスポンスにしか存在しない。

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
interface Hosting {
  provider: string | null; // 'railway' 等。サーバの環境変数から
  manageUrl: string | null; // 事業者側の管理画面
  referralUrl: string | null; // Owner が置いた事業者の referral(§8-4)。無ければ null
  lastActivityAt: string | null; // 最後の書き込み(join / challenge / result)
}
```

### 5-3. エンドポイント

| Method / Path                  | 認証   | 目的                                                                      |
| ------------------------------ | ------ | ------------------------------------------------------------------------- |
| `GET /health`                  | 不要   | `{ ok: true, api: 1 }`。接続画面の疎通確認とテンプレートの healthcheck    |
| `POST /join`                   | invite | 招待 token + nickname → member token                                      |
| `POST /claim`                  | setup  | Setup Key + nickname → **owner** の member token(§8-3)                    |
| `GET /club`                    | member | `{ club, me, members[] }`                                                 |
| `GET /challenges`              | member | 新しい順。`?after=<id>` で続き。最大 50 件                                |
| `POST /challenges`             | member | 作成 + 作成者の Result を同時に(§6-3)                                     |
| `DELETE /challenges/:id`       | member | 作成者本人か Owner だけ。Result ごと消える                                |
| `GET /challenges/:id`          | member | 1 件                                                                      |
| `GET /challenges/:id/results`  | member | 提出順。**並べ替えはクライアント**(§6-1 の `order`)。最大 200 件          |
| `POST /challenges/:id/results` | member | 自分の Result を 1 回だけ                                                 |
| `GET /records`                 | member | `{ gameId, paramsKey, facts, memberId, nickname, challengeId }[]`。導出値 |
| `GET /hosting`                 | member | `Hosting`。`manageUrl` は **Owner にだけ**返す(Member には null)          |
| `PATCH /hosting`               | owner  | `{ referralUrl }` の設定 / 解除(`null`)                                   |
| `GET /invite`                  | owner  | 現在の招待 `{ token, url }`                                               |
| `POST /invite`                 | owner  | 招待を**作り直す**(前のものは即無効)                                      |
| `DELETE /members/:id`          | owner  | Member を外す。その token は即 401。Result は残る(nickname 付き)          |
| `PATCH /club`                  | owner  | `{ name }`                                                                |

### 5-4. 主な request / response

`POST /join`

```json
{ "inviteToken": "…", "nickname": "Ken" }
```

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
Result 以外の集計(通算・ポイント・回数の順位)を持たない**。持てばそれは順位表の
材料になる(PRODUCT_PRINCIPLES「挑戦をまたいで積み上げない」)。

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
この 3 通りを表せれば残りのゲームは同じ形に収まる。次の候補は Nonogram / Takuzu /
Kakuro / Futoshiki(時間、seed 決定的、golden あり)と Sliding Puzzle(手数)。
スコア系のエンドレス(2048 / Block Puzzle)と対 CPU は**入れない** — 盤面が seed で
同じでも入力で分岐し、比べているのが同じ局ではなくなる。

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
  /** 一覧の並べ替え: 比較軸 1 つ。昇順。`played` は末尾に提出順 */
  order: keyof F;
  /** Challenge の局に使う seed の接頭辞(§6-2) */
  seedPrefix: string;
}
```

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
- `order` は 1 軸だけ。同値は提出順のまま。**順位の数字・ポイント・称号は付けない**
  (PRODUCT_PRINCIPLES)。2 軸目(Sudoku のミス、Water Sort の時間)は表示するが
  並べ替えに使わない — 「時間は速いがミスが多い」をどう順位付けるかを製品が決めた
  時点で、それは採点であり順位表である。

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

3. **4 つ目の中断スロット** — Challenge の局は `mode: 'club'` として、そのゲームの
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

### 6-3. Challenge は終わった 1 局から作る

#161 の「誰かが Challenge を作る」を、**フォームではなく結果画面**に置く。

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
- Web ビルド側(`club/invite.ts`)は `location.pathname` が `/join` で終わり、hash に
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
  (`409 invite_expired`)。

### 7-3. どこで参加できるか

| 経路                                                 | できること                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 招待 URL をブラウザで開く(SharedHost の Web)         | nickname → `Join and Play`。**インストール不要**。同じ origin なので CORS の問題が無い        |
| アプリの設定 > Advanced > `Private Game Club` > 参加 | 招待 URL を**貼り付ける**(`inviteFromHref` で endpoint と token を読む)→ nickname → 参加      |
| pixapps.ai の Web 版の `Play together`               | 「招待リンクを開いてください」の説明と、Host になる導線(§8)。任意 endpoint への直接接続は無い |

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
  (`services/webAppPrompt.ts`、3 局目の後に 1 回)のままで、Shared のために増やさない。

## 8. Host になる — 説明画面・Setup Key・claim・Hosting

### 8-1. 入口

設定 > Advanced > `Private Game Club` > `Create my Club`(2-1)、`Play together` >
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
- Member が置いた referral(§8-4)があるとき、`Continue` の**下**に 1 行:
  `Opens the provider through <nickname>'s referral link.` — 金銭の文言はこれ以上
  出さない(「稼げる」を言わない)。

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
  → POST /claim { setupKey, nickname }
                                              hash 照合 → owner member 作成 → Setup Key 失効
  ← memberToken(role: 'owner')→ sg.club へ
```

- Setup Key は**初回 claim 専用**。claim が成功した瞬間にサーバは hash を捨て、
  端末も一時保存を消す。2 回目は `409 setup_key_used`。
- Setup Key を Simple Games が発行する理由は、利用者が「秘密を作って貼る」以外の
  技術操作をしないで済ませるためで(#161「Setup / Claim flow」)、Simple Games が
  そのサーバに対して持つ権限はこの 1 回の claim だけである。**事業者の API token を
  Simple Games に保存しない**。事業者側の project を Simple Games から操作する経路は
  一切作らない。
- claim の前に `GET /health` で `X-Club-Api` を見る。知らない版なら止める(§10)。
- Owner も他の端末では Member として招待から入る(Owner の token を配らない)。
  Owner 権限のある端末を増やしたいときは、v1 では**その端末で claim し直す**ことが
  できない(Setup Key は 1 回)ので、Owner 端末は 1 台。これは v1 の制約として文書化
  し、必要が確認されたら「Owner が 2 台目用の Setup Key を発行する」を後続にする。

### 8-4. Hosting(Owner の画面)

```text
Hosting

Server: Online            ← 直前の GET /hosting が通ったかどうか。常時監視ではない
Last activity: Sep 7, 2026

[ Manage server ]          ← hosting.manageUrl を外部ブラウザで開く(openExternal)
Referral link  [ none ]    ← PATCH /hosting。任意。無くても同じ UX

To stop future hosting usage, delete the server in your hosting provider's dashboard.
Hosting costs are paid to the provider and depend on usage.
```

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

Owner が Disconnect しても、サーバは動き続ける。Owner 端末を切断すると Owner 権限を
持つ端末が無くなる(§8-3 の制約)ので、Owner にはその 1 文を足す。

## 9. Club の画面 — 情報設計

`club/ui/`。すべて `club/` の中で、Core の画面は §2 の 3 つ以外変わらない。

### 入口(`ClubRoot`)

`entry: 'settings' | 'home' | 'discover' | 'invite'` で最初の画面が決まる。

- 接続 0 件: `Join a Club`(招待 URL を貼る)/ `Create my Club`(§8)。
  `entry: 'invite'` なら §7-4 の Join 画面。
- 接続 1 件: その Club。
- 接続 2 件以上: **All Clubs** — Club 名の一覧だけ(件数・未読・バッジ無し)、末尾に
  `Join another Club` と `Create your own Club`(§13-3)。

### Club

```text
Suzuki Family                                  [Invite] [Settings]

Challenges                                     [ New Challenge ]
  Sudoku · Hard · by Yoh                       ← まだ遊んでいない(mine: false)
  Water Sort · Medium · by Ken
Played
  Minesweeper · Medium · by Yoh   4:31         ← 自分の結果(mine: true)
Records
Members
Hosting                                        ← Owner だけ
```

- **Challenges が主役**で、順位表は無い。`Played` は「自分の結果がある Challenge」。
- `New Challenge` は対応ゲーム(§6-1)を選んでフリープレイを開くだけ(§6-3)。
- 一覧は開いたときと明示の再読み込みで取る(§10)。件数・未読・「新着」を Core へ
  持ち出さない。
- Members: nickname と参加日。Owner には各行に `Remove`。プロフィール・アバター・
  通算は無い。
- Records: ゲーム・モードごとに 1 行(`Sudoku · Hard  3:58  Ken`)。順位ではなく記録。

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

- `Play` → `App.tsx` の `enterGame(gameId, 'collection', challenge)` → 対応ゲームの
  Root に `challenge` が渡る(§6-2)。
- Results は §6-1 の `order` で並ぶ。**数字の順位・メダル・称号・差分は無い**。
  自分の行は太字で示すだけ。
- 自分が遊んだ後にだけ他の人の結果を見せる、という隠し方は**しない**(隠すのは
  「遊ばせるための仕掛け」であり、Solo by default に反する)。見たい人は見る。
- 自分の結果がある Challenge の `Play` は `Play again`(ローカルで同じ盤面を遊べるが、
  結果は送られない。§6-3「1 人 1 回」)。

### Settings(Club ごと)

nickname の変更(`PATCH` は v1 に無い — 変えたいときは再参加。v1 の制約)、
`Disconnect this device`(§8-5)、Owner: Club 名の変更、招待の作り直し。

### 後続(v1 では作らない)

#161 comment の Private Game Club 拡張のうち、v1 の契約に**入れない**もの:
掲示板 / スレッド / リアクション / pin、投票、Club の書き出し、Group identity
(アイコン・色)、Member プロフィール。入れるときは §5 の版を上げる(`X-Club-Api: 2`)。
DM / リアルタイムチャット / 公開 Club / フォロー / アルゴリズムフィード / 無限フィード /
Push は後続でも作らない(PRODUCT_PRINCIPLES「Shared」)。

## 10. 通信・オフライン・障害

- **通信が起きる契機**(すべて本人の操作の直後、1 操作 1 リクエスト):
  Club / Challenge の画面を開く・明示の再読み込み(GET)、参加 / claim(POST)、
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
  `unauthorized` が返ったら**捨てる**(再送しても通らない)。
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
  `playTogetherBody`)と、`ClubResultAction` の 3 つ(`clubSendResult` /
  `clubResultSent`(`{club}`)/ `clubResultPending`)だけ。
- **高リスクキー**(`src/i18n/highRiskKeys.ts` に足す。門は `gateRecord.json`):
  §8-2 の説明画面の 4 箇条、§8-5 の Disconnect の本文、§9 Challenge の
  「終えたら結果を {club} へ送る」の 1 文、§8-4 の「削除は事業者側で」の 2 文。
  どれも誤訳が「お金の約束の反故」か「同意していない送信」になる。機械翻訳で配らない
  とは「門を通さずに配らない」の意味で、来歴は他のキーと同じ `machine` のまま
  ページと設定が開示する([../I18N_POLICY.md](../I18N_POLICY.md))。
- Club 内の結果の表示に `leaderboard` / `ranking` /「ランキング」を使わない
  (`Results` /「結果」。[../BRAND.md](../BRAND.md))。**14 言語ぶんの訳語にも**同じ規則
  を当て、`check-principles.sh` §6 に英日の禁止語(`leaderboard` / `ranking` /
  「ランキング」)を **`club/` と `i18n/` に対してだけ**足す。Core のカタログにこの語が
  入る余地は今も無いが、Shared の文言を書く人が最初に踏む場所がここだからである。

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
- referral(§8-4)は Owner が置いたときだけ、説明画面の `Continue` の下に 1 行。
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

## 14. 決めていないこと / 外部確認

この文書で決めた判断は、この文書を直す PR で変えられる。決めていないものは次のとおり。

**製品オーナーの確認が要るもの**(段取りの PR C に入る前に決める):

1. 最初の 3 本(Sudoku / Minesweeper / Water Sort)でよいか。
2. 「1 人 1 回、最初に終わった局が数える」(§6-3)でよいか。代案は「自己ベストを
   送れる」だが、それは同じ盤面を繰り返す圧力になる。
3. Owner 端末は 1 台(§8-3)でよいか。
4. Minesweeper の Challenge が初手を固定して始まる(§6-0)体験でよいか(参加者は
   最初のひと開きを自分で選べない)。
5. ホームの入口の位置(「最近遊んだ」の下、§2-2 / §2-3)。

**外部の事実確認**(#161 Phase 0 の未完了項目。確認できるまで文言と数字を出さない):

6. ホスティング事業者の one-click template で、persistent volume / healthcheck /
   環境変数 `CLUB_SETUP_KEY` の 1 回入力 / serverless 既定 OFF が実現できるか。
7. 少人数(5〜10 人、週数回)での実コスト。**計測値が出るまで金額を書かない**。
8. referral commission と template kickback の**併用可否**(#161 comment)。未確認のまま
   収益に数えない。
9. 事業者の referral URL を template の deploy 導線へ安全に引き継げるか(§8-4)。

**このリポジトリの外**: サーバの実装(Node + SQLite + 1 volume)と template は別
リポジトリ。§5 の契約テストをそちらに置き、`X-Club-Api: 1` を返す最初の版が
デプロイできた時点で、こちらの段取りの PR C に入る。
