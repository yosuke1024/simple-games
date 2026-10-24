# Managed Club Houses

2026-10-23 の製品オーナー判断。既存の [club.md](club.md) を拡張し、PixApps が
Cloudflare 上でホスティングする複数クラブを、オーナーが管理する。Core の無料・
オフラインのゲーム機能と、一般メンバーの記録の閲覧はそのまま。

## 1. プランと公開の境界

| プラン | 1 クラブのメンバー数 | 作成できるクラブ数 | 今回の扱い                                 |
| ------ | -------------------: | -----------------: | ------------------------------------------ |
| Trial  |                    5 |                  1 | 無料・期限なし。本人が開始できる           |
| Basic  |                   50 |                  3 | 初期提供の契約枠                           |
| Plus   |                  100 |                  5 | 将来のプラン定義                           |
| MAX    |               無制限 |                100 | 将来のプラン定義。処理量・保存量は別途設計 |

人数はオーナーも含む有効なメンバーの数。クラブごとの端末トークンを数えるため、
複数端末・入り直しによる別メンバーを同一人物とは推測しない。料金、決済事業者、
購入フローは未決定。この変更だけで課金や本番提供を開始しない。

Trial の枠は契約キーごとに与える。メールや個人 ID による本人認証を追加せず、
1 人が複数のキーを作れない仕組みとは表現しない。公開の開始 API は IP ごとの
レート制限を持つが、本人の一意性を保証するものではない。Trial から Basic へは
同じクラブ・メンバー ID・記録・メンバーキーを保って移行する。

**所有クラブの合計が 50 名以上ならオーナーの広告を非表示にする。** 作成済みの
所有クラブに現在在籍する有効なメンバーを合算する。オーナーもクラブごとに含め、
承認待ち・無効化済みは含めない。クラブをまたいだ実人数ではなく延べ在籍数である。
ホスティングが有効で人数条件を満たす間の資格とし、永久の購入資格には変えない。
オーナー画面に `現在の人数 / 50` と有効状態を表示する。端末への適用は §8 に定める。

公開範囲と参加承認は別の設定である。一般公開はクラブ名・人数・対象ゲームを
ディレクトリで見つけられることを意味し、結果やアルバムを未参加者に公開することを
意味しない。一般公開・承認不要では誰でも参加して記録を読めることを参加前に伝える。
非公開は招待キーが必要で、承認が必要な設定ならキーだけで承認を迂回できない。

対象ゲームは `allowedGameIds: null` がすべて、配列が選択したゲームだけ、空配列は
どのゲームも受け付けない。クラブ外の Core で遊べるゲームは変わらない。

## 2. オーナーの記録帳

`GET /api/v1/owner/records` は owner 認証を必要とする。現在保持されている結果を
ゲーム × モードごとにまとめ、各メンバーの最良の 1 件だけを比較する。通常の順位表は
結果 1 件ずつの順位なので、この記録帳の本人順位とは意味が異なる。

クエリ:

- `limit`: 既定 25、最大 50 の表。正の整数。
- `after`: 前ページの `nextAfter`。`gameId:paramsKey` の形。
- `daily`: 任意の実在日付 `YYYY-MM-DD`。指定した日の盤面を読む。
- `dailyAfter`: 前ページの `nextDailyAfter`。その日の challenge ID。

レスポンス:

```ts
{
  club: { id: string, name: string },
  generatedAt: string,
  memberCount: number,
  basis: 'retained-member-bests',
  tables: {
    gameId: string,
    paramsKey: string,
    participantCount: number,
    axis: { fact: string, direction: 'asc' | 'desc' },
    leader: RankingEntry | null,
    medianBestValue: number | null,
    me: { rank: number, entry: RankingEntry } | null,
  }[],
  nextAfter: string | null,
  daily: {
    challengeId: string,
    gameId: string,
    contractVersion: number,
    params: object,
    seed: string,
    boardDigest: string,
    daily: string,
    participantCount: number,
    axis: { fact: string, direction: 'asc' | 'desc' } | null,
    leader: Result | null,
    me: { rank: number, entry: Result } | null,
  }[],
  nextDailyAfter: string | null,
}
```

`RankingEntry` と `Result` は [club.md](club.md) の既存の形。`participantCount` は
現在有効なメンバーのうち、現在保持されている対象の記録を持つ人数であり、総参加者・
プレイ回数・アクティブユーザー数ではない。`medianBestValue` もその各人のベストの中央値。
無効なメンバーの記録は集計しない。ゲームの選択から外れた表・盤面は返さない。

クラブ間で人物を同定しない。人数を足す場合は延べ人数。同じ日付だけを根拠に盤面が
同じとはみなさず、デイリーの横断比較は game ID、contract version、params、seed、
board digest が一致する場合に限る。通常の表は game ID と paramsKey が同じものだけを
並べ、ゲーム全体を横断した能力点にはしない。

履歴の全局は保持されていない。各メンバーの良い 50 件という上限から、総プレイ数・
クリア率・全プレイの平均・過去の成長曲線を再構成しない。`submittedAt` は受信時刻で、
オフラインの再送を実際に遊んだ日時とは扱わない。

## 3. 記録アルバム

オーナーが現在の記録を選んで発行し、同じクラブのメンバーが読む。一般公開クラブでも
アルバムの読み取りは member 認証が必要で、公開ディレクトリや既存の `/public` へは
載せない。プッシュ、定期実行、AI API、追加の端末計測は使わない。

| API                         | 認証   | 結果                                               |
| --------------------------- | ------ | -------------------------------------------------- |
| `GET /api/v1/albums`        | member | `{ albums: AlbumSummary[] }`。新しい順、最大 24 件 |
| `POST /api/v1/albums`       | owner  | 現在の記録を選択し発行。201、再送は 200            |
| `GET /api/v1/albums/:id`    | member | `Album`。ない ID は 404                            |
| `DELETE /api/v1/albums/:id` | owner  | 204。ない ID は 404                                |

発行リクエスト:

```ts
{
  title: string,                              // 1〜60 文字
  tables: { gameId: string, paramsKey: string }[],
  challengeIds?: string[],                    // デイリー盤面だけ
  clientId?: string,                          // 既存の結果と同じ 8〜64 文字の再送キー
}
```

表と盤面の合計は 1〜50 件、重複不可。現在対象外のゲーム、記録のない表、削除済みの
盤面は発行できない。アルバムは 1 クラブ 24 件まで。上限を超えたら 413 `too_large`。
古いものを勝手に消さず、持ち主が削除してから発行する。`clientId` が同じ再送は新しい
アルバムを作らず既存のものを返す。

```ts
type AlbumSummary = {
  id: string;
  title: string;
  createdAt: string;
  itemCount: number;
};
type Album = AlbumSummary & {
  tables: { gameId: string; paramsKey: string; entry: RankingEntry }[];
  daily: {
    challengeId: string;
    gameId: string;
    contractVersion: number;
    params: object;
    seed: string;
    boardDigest: string;
    daily: string;
    entry: Result;
  }[];
  unavailableCount: number;
};
```

**発行時点の最良の記録への参照を固定する**。後の新記録へ置き換えない。名前や facts の
複製を独立した履歴として残さず、読むときに原記録を参照する。原記録の本人削除・
最良 50 件からの脱落・メンバーの無効化・盤面の削除で参照先が使えなくなった場合は
その項目を省く。表示名を変更した場合は現在の名前になる。対象ゲームから外れた項目も
外れている間は表示せず、再選択すれば原記録が残っているものは再表示する。
`unavailableCount` は省いた項目数で、消えた名前・facts・本人 ID は返さない。

この性質を「消せない完全保存のアルバム」と宣伝しない。発行時点の人数・回数・順位等の
個人データの履歴を別に蓄積せず、アルバムは選んだ記録だけを扱う。

## 4. マネージド契約と複数クラブ

契約を表すオーナートークンと、クラブに参加するメンバートークンは別物。オーナー用の
画面だけが契約トークンを使い、ゲームの記録・クラブ設定・メンバー管理は各クラブの
メンバートークンを使う。一般メンバーにアカウント・メールアドレス・支払いは要求しない。
トークンはランダムな秘密値で、URL のクエリ・ログへ入れない。端末バックアップには入る
(2026-10-24 判断。§「秘密値とローカルデータの削除」)。

共通のプレフィックスは `/api/v1/managed`。既存単独デプロイの `/api/v1/*` は互換を
保つ。マネージドのクラブエンドポイントは `https://<host>/clubs/<clubId>` で、その下の
`/api/v1/*` が同じクラブ API。招待リンクは
`https://<host>/join#club=<clubId>&invite=<token>` とし、招待キーは fragment の中。

| API                         | 認証               | 結果                                                                                  |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------------- |
| `GET /plans`                | なし               | `{ plans: Plan[] }`。価格を返さず、Plus/MAX は `available: false`                     |
| `POST /trial`               | 新しい owner token | `{}` から無料 Trial を開始。201、同じキーの再送は 200。`OwnerSpace` を返す            |
| `GET /owner`                | owner token        | 契約状態・枠・所有クラブ・広告非表示特典を含む `OwnerSpace`                           |
| `POST /clubs`               | owner token        | `{ name, nickname, clientId }` から作成。201、同じキーの再送は 200                    |
| `POST /clubs/:id/connect`   | owner token        | 空オブジェクトを送り、所有クラブの owner メンバー接続を復旧。途中で止まった作成も再開 |
| `GET /directory?after=<id>` | なし               | 公開かつ有効な契約のクラブの安全なメタデータ、1 ページ最大 50 件                      |

```ts
type Plan = {
  id: 'trial' | 'basic' | 'plus' | 'max',
  maxMembersPerClub: number | null,
  maxClubs: number,
  available: boolean,
};

// OwnerSpace: GET /owner, POST /trial
{
  owner: { id: string, plan: 'trial' | 'basic', validUntil: string | null, status: 'active' | 'expired' },
  limits: { maxClubs: number, maxMembersPerClub: number },
  clubs: {
    id: string,
    name: string,
    endpoint: string,
    createdAt: string,
    memberCount: number,
    visibility: 'public' | 'private',
    approvalRequired: boolean,
    allowedGameIds: string[] | null,
    status: 'ready' | 'provisioning',
  }[],
  benefits: {
    adRemoval: {
      requiredMembers: 50,
      memberCount: number,
      active: boolean,
      validUntil: string | null,
    },
  },
}

// POST /clubs, POST /clubs/:id/connect
{
  club: Club,
  member: Member,
  memberToken: string,
  endpoint: string,
}

// GET /directory
{ clubs: SafeClubMetadata[], nextCursor: string | null }
```

`SafeClubMetadata` はクラブ ID・名前・エンドポイント・人数・公開範囲・承認要否・対象
ゲーム等のクラブ設定だけ。契約オーナーの ID、契約の秘密値、メンバーの ID や表示名、
記録、facts、アルバムは返さない。非公開クラブは一覧に現れない。公開設定の変更は
ディレクトリにも反映する。クラブを作るときに契約側で枠を確保し、再送キーの再利用や
同時作成がプランの枠(Trial は 1、Basic は 3)を増やさないようにする。

`clientId` は既存の結果と同じ 8〜64 文字の形。作成の途中で切れた場合は同じキーで
同じクラブの処理を続ける。所有者以外はクラブの owner 接続を発行できない。

### 無料 Trial の開始

クライアントで暗号学的な乱数 32 byte を小文字の 64 桁 hex にし、新しい契約キーを
作る。`pendingTrial: true` とともに**リクエスト前に端末へ保存**し、
`Authorization: Bearer <ownerToken>` で `POST /trial` に空オブジェクトを送る。
応答が失われても同じキーで再送すれば同じ契約を返す。サーバーはキーのハッシュを
保存し、本文・応答・URL にキーを入れない。応答を検証してから `pendingTrial` を外す。
途中で画面を閉じた場合も、次に開いて同じキーで再開できる。

新しい Trial の作成は IP ごとに 1 分 10 件まで。既存のキーの再送はオーナー側の
レート制限を使う。再発行済みの古いキーで開始 API を再送しても、新契約を作らず 401 とする。
キーはオーナー画面から本人が表示・コピーして保管できる。通常のバックアップには入らない。
キーを紛失したときに本人を自動で同定・復旧するアカウント機能は作らない。

### 契約の付与・移行と期限

決済をまだ接続しない段階では、Basic の付与・更新・Trial からの移行は運用者だけが
`CLUB_MANAGED_ADMIN_KEY` で行う。通常の契約オーナートークンをこの権限の代わりにはできない。

| API                                       | 本文                              | 結果                                                 |
| ----------------------------------------- | --------------------------------- | ---------------------------------------------------- |
| `POST /admin/owners`                      | `{ reference, plan, validUntil }` | Trial / Basic の `{ owner, ownerToken }`             |
| `GET /admin/owners?reference=<reference>` | なし                              | `{ owner }`。付与時の reference から契約 ID を復旧   |
| `GET /admin/owners/:id`                   | なし                              | `{ owner }`。現在の契約状態                          |
| `PATCH /admin/owners/:id`                 | `{ plan?, validUntil }`           | 契約の更新・停止、Trial から Basic への移行          |
| `POST /admin/owners/:id/rotate-token`     | `{}`                              | 紛失した契約トークンを無効にし、新しいトークンを発行 |

`reference` は運用者が管理する 1〜128 文字の英数字・`_`・`-` の参照値で、秘密の認証情報
ではない。同じ参照値への二重付与は 409 `owner_exists`。付与の応答を受け取れなかった
場合は参照値で契約 ID を調べ、トークンの再発行へ進む。読み取り API は秘密値を返さず、
存在しない参照値・契約 ID は 404 にする。

通常の Trial は `validUntil: null` で期限なし。運用者が日時を設定して停止することは可能。
Basic には有効期限を必須とし、`{ plan: 'basic', validUntil: <日時> }` で Trial を移行する。
プラン変更ではメンバーキーを再発行しない。既存クラブの人数枠は、各リクエストで registry から
渡す信頼された値で 5 名から 50 名へ変わり、クラブの再作成や再接続を必要としない。
Basic から Trial への縮小は 409 `plan_unavailable`。将来プランも同じエラーで未提供とする。

契約トークンの再発行では、その契約の各クラブで**契約オーナー本人のメンバートークンも
再発行する**。以前の契約キーで取得したクラブの権限を使い続けられないようにするためで、
メンバー ID・表示名・記録はそのまま。一般メンバーや別の共同オーナーのトークンは
変えない。新しい契約トークンで `connect` を呼ぶと同じメンバーへ復帰する。

契約の credential version はサーバー内部で単調に増え、各クラブも適用した版を持つ。
再発行中に古い作成・接続リクエストが完了しても、古い版へ戻さず、新しい秘密値を古い
契約キーの呼び出しへ渡さない。すでに権限を確認して実行中の操作を遡って取り消す機能
ではない。途中のクラブの更新が失敗した場合は成功扱いにせず、運用者が同じ再発行 API を
再度呼び出す。クラブへの各リクエストにも registry から現在の版を内部で渡すので、
更新が途中で止まったクラブでも古いオーナーキーが使い続けられることはない。
この内部値をブラウザから指定して権限を取得する API は設けない。

期限切れでも既存の記録の読み取りと削除は可能。新しいクラブの作成・参加・結果の
受け取り・アルバム発行は止める。単に期限が切れたことを理由に保存データを消さない。
購入・解約・更新・返金の UI やストアの商品を、この運用 API の存在だけで実装済みと
表現しない。運用者による付与は決済の成功を推測する仕組みでもない。

## 5. 配置と処理量

Cloudflare は共有 Worker の後ろに契約とディレクトリの registry Durable Object を置き、
各クラブに 1 個の SQLite Durable Object を割り当てる。任意の ID をそのまま作成先へ
渡さず、存在するクラブと契約を確認してから転送する。公開一覧のためにすべての
クラブを起こして走査しない。Node も共有のマネージドハンドラとクラブごとの SQLite で
同じ契約を扱う。本番は公式 Public Club と同じ `wrangler.toml`(club.pixapps.ai)に
マネージドの Durable Object を migration `v2` として足し、`v1` は書き換えない。
`wrangler.staging.toml` は同じ Worker を workers.dev に置く検証環境で、本番と別の
Durable Object と秘密値を持つ。

オーナー画面の読み込みでは、本人の作成済みクラブだけ(Trial は最大 1、Basic は最大 3)の
人数を各クラブから読み直し、変更操作と同じロックの下で registry の値を更新する。
ディレクトリへの更新応答を失っても、古い人数から新しい特典を発行しないためである。
読み直せない場合はエラーとし、応答のクラブ一覧と特典人数には同じ registry の値を使う。
この追加読み取りの費用も Managed の計測に含める。公開一覧を全クラブ走査へ変えるものではない。

オーナーの記録帳は本人が画面を開いたときに必要なクラブ・表のページを読む。現在の
Basic の小さなクラブを対象に、各表で保持中のメンバーのベストを集計する。MAX を
提供する前には、結果の受理時に小さな要約を更新する方式・過去の記録の保持量・
読み取り上限・契約全体の費用を設計して検証する。「人数無制限」は実行時間・保存量・
通信量が無制限という意味ではなく、この PR で利用可能にはしない。

## 6. クラブ設定と参加承認

この節の API は各クラブのエンドポイントの下に置く。設定の形は次のとおり。

```ts
type ClubSettings = {
  visibility: 'public' | 'private';
  approvalRequired: boolean;
  allowedGameIds: string[] | null;
};
```

| API                      | 認証   | 本文・結果                                                                           |
| ------------------------ | ------ | ------------------------------------------------------------------------------------ |
| `GET /api/v1/settings`   | member | 200、`ClubSettings`                                                                  |
| `PATCH /api/v1/settings` | owner  | 変更する設定を 1 個以上送る。200、変更後の `ClubSettings`                            |
| `GET /api/v1/admission`  | なし   | 一般公開クラブの参加前情報。非公開は 404                                             |
| `POST /api/v1/admission` | なし   | `{ inviteToken }`。有効な招待を持つ人に参加前情報を返す。無効は 409 `invite_expired` |

`allowedGameIds` の配列は最大 128 個で、ゲーム ID の重複を除いてソートする。未指定の設定は
PATCH で変えない。従来の単独クラブに保存済みの設定がなければ、既存の `openJoin` に応じた
公開範囲、承認不要、すべてのゲームを既定値にする。新しいマネージドクラブは非公開・
承認不要・すべてのゲームで始まり、オーナーが変更する。

参加前情報は次の形で、メンバー ID・表示名・記録は含まない。非公開のプレビューも
招待トークンを本文で受け取り、URL のパスやクエリへ入れない。

```ts
type Admission = ClubSettings & {
  club: { id: string; name: string };
  memberCount: number;
};
```

公開範囲と承認の組み合わせは、通常メンバーの参加に対して次のように働く。

| 公開範囲 | 承認 | 発見・プレビュー                     | `POST /api/v1/join` の結果                 |
| -------- | ---- | ------------------------------------ | ------------------------------------------ |
| 一般公開 | 不要 | 公開一覧・招待なしのプレビュー       | 招待なしで 201、メンバーになる             |
| 一般公開 | 必要 | 公開一覧・招待なしのプレビュー       | 招待なしで 202、オーナーの承認待ちになる   |
| 非公開   | 不要 | 公開一覧には載らず、有効な招待が必要 | 招待を添えて 201、メンバーになる           |
| 非公開   | 必要 | 公開一覧には載らず、有効な招待が必要 | 招待を添えて 202、オーナーの承認待ちになる |

参加の本文は `{ nickname, inviteToken? }`。承認不要の 201 は従来の
`{ club, member, memberToken }` を返す。一般公開でも招待を添えた場合はその有効性を検査し、
無効な招待を黙って無視しない。通常のメンバー招待は承認を迂回できない。既存の owner
招待は、オーナーが共同オーナーを任命する 1 回限りの別操作なので、通常の承認待ちには
入れない。公開範囲・承認設定の変更や招待キーの再発行は、既存メンバーを退会させず、
すでに受け付けた申請を自動で承認・取消ししない。

### 承認待ちの受領証

承認が必要な参加では 202 と次の受領証を返す。

```ts
type JoinRequest = {
  id: string;
  nickname: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  createdAt: string;
  expiresAt: string;
};

// POST /api/v1/join → 202
{
  status: 'pending',
  club: Club,
  request: JoinRequest,
  requestToken: string,
}
```

`requestToken` は申請者の秘密値で、サーバーはハッシュだけを保存する。承認前には
メンバー認証に使えず、記録の読み書きもできない。状態確認・取消しは、メンバー用の
Bearer 認証の代わりに本文の `{ requestToken }` で対象の申請を識別する。

| API                                      | 認証・本文         | 結果                                                |
| ---------------------------------------- | ------------------ | --------------------------------------------------- |
| `POST /api/v1/join-requests/status`      | `{ requestToken }` | 200、現在の状態。承認済みならメンバー接続を返す     |
| `POST /api/v1/join-requests/cancel`      | `{ requestToken }` | 204。承認済みは 409 `request_decided`               |
| `GET /api/v1/join-requests`              | owner              | 200、承認待ちの `JoinRequest[]`。古い順             |
| `POST /api/v1/join-requests/:id/approve` | owner              | 200、`{ status: 'approved', request: JoinRequest }` |
| `POST /api/v1/join-requests/:id/reject`  | owner              | 200、`{ status: 'rejected', request: JoinRequest }` |

状態確認の応答は、承認前・却下・取消し・期限切れでは
`{ status, club, request }`。承認済みなら
`{ status: 'approved', club, member, memberToken }` で、`request` は必須ではない。
承認時に受領証の秘密値がそのメンバーのトークンになり、`memberToken` は
`requestToken` と同じ値になる。承認後は有効なメンバー自体を受領証にできるため、
申請履歴を長期保存しなくても接続を復旧できる。

承認待ちは **7 日間、1 クラブ最大 100 件**。満杯なら 409 `too_many_requests`。
待っている人はメンバー数に含めず、席を予約しない。承認する瞬間にクラブの人数枠
（Trial は 5 名、Basic は 50 名）を再確認し、満員なら 409 `too_many_members` として申請は承認待ちに
残す。同じ承認・却下の再送は
同じ決定を返し、異なる決定が済んでいれば 409 `request_decided` とする。
知らない申請 ID は 404、不明な受領証は 401。決定済み履歴も、整理時に決定後 7 日以内かつ
最大 200 件に制限する。期限切れの反映と履歴の整理は関連 API が呼ばれたときに行い、
バックグラウンド処理を追加しない。

### 対象ゲームから外したとき

サーバーは対象外のゲームへの新しい盤面・結果の投稿と、そのゲームの個別の表・盤面の
読み取りに 403 `game_disabled` を返す。一覧、オーナーの記録帳、アルバムでは対象外の
項目を省く。設定を変えただけで既存のデータを消さず、再び対象にすれば残っている記録を
読める。**既存データの DELETE は対象ゲームの設定で禁止しない**。本人・オーナーの
削除権限の検査は従来どおりに行う。

## 7. クライアントの保存・同意・有効化

`sg.club` の `schemaVersion: 1` を保ち、既存の接続に加えて次の任意フィールドを持つ。
フィールドのない従来のデータも読める。

```ts
type PendingClubJoin = {
  endpoint: string;
  requestId: string;
  requestToken: string;
  clubName: string;
  nickname: string;
  createdAt: string;
  expiresAt: string;
};
type ManagedClubOwner = {
  origin: string;
  ownerToken: string;
  pendingTrial?: true;
  adRemoval?: {
    requiredMembers: 50;
    memberCount: number;
    active: boolean;
    validUntil: string | null;
  };
};
type ClubConnections = {
  schemaVersion: 1;
  connections: ClubConnection[];
  departed?: ClubConnection[];
  pending?: PendingClubJoin[];
  managedOwner?: ManagedClubOwner;
};
```

`ClubConnection` の既存フィールドは維持し、`allowedGameIds?: string[] | null` を追加する。
`endpoint` は従来の origin、またはマネージドの `/clubs/<clubId>` までの URL。
`pending` は同じ endpoint ごとに 1 件、端末全体で最大 10 件。申請中の情報を
`connections` に混ぜず、記録の送信対象や起動時に Club レイヤーを読み込む理由にしない。
`managedOwner` も契約管理用の秘密値であり、それだけではクラブ参加や結果送信にはならない。
入力した既存の契約キーは `/managed/owner` で検証してから保存する。新しく生成する
Trial のキーは、応答を失っても再開できるよう §4 のとおり送信前に保存する。
`pendingTrial` の間は広告資格を持たず、検証済みの応答を保存するときに外す。
キーの置換で以前の `adRemoval` を引き継がない。

### 同意と送信

参加・参加申請の画面で、承認後にそのクラブへ結果を自動送信することと、クラブ内で
見える情報を示す。一般公開で承認不要のクラブには誰でも参加できることも伝える。
即時参加ではその操作に基づき接続に `autoSend: true` を設定する。申請した人は
「状態を確認」から承認済みの接続を受け取り、その時点で同じ設定を持つ接続になる。
承認が済んだだけで端末が勝手に接続を追加したり、送信を始めたりはしない。

契約キーの入力、クラブの作成、オーナー接続の復旧は、自動送信への同意の代わりにしない。
新しいオーナー接続には `autoSend` を付けず、クラブ画面の説明を受け入れてから有効にする。
同じメンバーの接続を開き直した場合は、すでに行った明示的な同意を保つ。従来の接続に
`autoSend` がなければ、それまでと同じく同意を得るまで送信しない。

`allowedGameIds` は最後に取得した設定のキャッシュで、権限を決める根拠はサーバーにある。
参加前情報・クラブ画面・設定変更から更新し、既知の対象外ゲームは新しく送信待ちに
入れない。古い送信待ちも再送時に確認する。キャッシュが古くてもサーバーが
`game_disabled` を返すので、その項目は再送しない。契約期限による
`subscription_inactive` は更新後に再送できる一時的な停止として扱い、既存の送信待ち上限を
維持する。これによって Core の保存やゲームの利用を止めない。

### 秘密値とローカルデータの削除

メンバートークン、申請の受領証、契約キーと広告非表示資格は同じ `sg.club` に保存する。
**2026-10-24 のオーナー判断で、`sg.club` は端末バックアップに入る**(参加中・退会済みの
接続、承認待ちの受領証、契約キー)。広告非表示資格だけは書き出し・復元の両方で取り除き、
復元後はオーナー画面の読み込みでサーバーに確かめ直す。`sg.clubOutbox` は入れない。
この項目を持たない古いバックアップの復元は、端末の `sg.club` を変えない
(docs/architecture/backup.md)。書き出し画面には「オーナーキーと参加中の Club も含まれる、
ファイルを人に渡さない」を 1 文で出す(`backupClubNote`)。
Reset Local Data はこれらを端末から削除するが、サーバー上のメンバー・記録・申請の削除や
契約の解約を意味しない。申請を取り消したい場合は、そのための操作を行う。

`sg.club` の変更は `updateRecord` で読み取りから書き込みまでを 1 回の操作にし、通常保存・
Reset と同じキューに載せる。接続・申請・契約キーの更新が互いを上書きしないようにし、
画面を閉じた後に届いた参加・接続の応答で、Reset 済みの秘密値を書き戻さない。

### ビルドでの有効化と読み取りのきっかけ

マネージドのサービスは Public Club House と同じデプロイ・同じ origin
`https://club.pixapps.ai` に置く(2026-10-24 判断。Club House の接続先を 2 つに分けない)。
クラブの endpoint は `https://club.pixapps.ai/clubs/<clubId>`、Public は従来どおり origin
そのもので、両者は endpoint の完全一致と `/clubs/` 接頭辞で区別する。

`ui/clubFeatures.ts` の `MANAGED_CLUBS_ENABLED` を true にしたビルドだけに(2026-10-24、
稼働確認用の v1.4.2 から true)、マネージドの
公開一覧・オーナー管理の入口を出す。origin は同ファイルの `PIXAPPS_CLUB_ORIGIN` で、
`club/public.ts` の `PUBLIC_CLUB_ENDPOINT` と一致することをテストで固定する。ビルド変数や
リリースワークフローの設定は要らない。false の間は入口を出さず、未参加の端末から
サービスへ問い合わせない。サーバーがマネージドを載せてから 1 行で切り替える。

検証用のビルドに限り、`VITE_MANAGED_CLUB_ORIGIN` で接続先を上書きできる(ステージングの
workers.dev や開発サーバー)。値はパス・末尾スラッシュ・クエリのない HTTPS origin とし、
開発用の `localhost`・`127.0.0.1` だけ HTTP を許す。無効値は無視する。アプリと
pixapps.ai の Web 版のリリースワークフローはこの変数を設定しない。

例外は、サーバーが `/join` で配る Web ビルド(club.md §7-1)。simple-games-club の
`pnpm build:web` がこの変数に配信先の origin を入れて作るため、そのコピーは
`MANAGED_CLUBS_ENABLED` が false の間もその origin のマネージド招待を受け付ける。
広告と計測の変数は空にし、広告も計測も載せない。配信先と違う origin のコピーは
`pnpm deploy:production` が拒む。従来の `PRIVATE_CLUBS_ENABLED = false` は
そのままで、この origin のマネージド招待だけを別に有効化する。

公開一覧、管理画面、記録帳、アルバムは、本人が画面を開く・更新する・次のページを
求める・操作を完了する、というきっかけで読む。申請の状態は、本人が Club House を開いた
とき(入口・招待リンク・設定のどこからでも 1 回)と確認ボタンを押したときに読み、承認済み
ならそのままメンバー接続にする(2026-10-24 判断。確認ボタンを押さなくても参加できる)。
オーナーには、所有クラブの画面を開いた・更新したときに承認待ちの件数を一緒に読み、
クラブ画面の先頭に「参加リクエストが N 件あります」を出す。設定画面では承認待ちを
フォームより前に並べる。定期ポーリング、バックグラウンドの契約確認、承認通知(プッシュ・
ホームのバッジ)は追加しない。

管理画面の承認の設定は「新メンバーを自動で承認する」と表示する(2026-10-24 判断)。
チェックありが `approvalRequired: false`、なしが `true` で、保存する値は変えない。

招待リンク `https://club.pixapps.ai/join#…` は、アプリが入っている端末ではアプリで、
入っていない端末では Web の参加画面で開く(Android App Links / iOS Universal Links、
2026-10-24)。サーバーは `/.well-known/assetlinks.json` と
`/.well-known/apple-app-site-association` を、デプロイの設定(`CLUB_ANDROID_PACKAGE`・
`CLUB_ANDROID_CERT_SHA256`・`CLUB_IOS_APP_IDS`)があるときだけ返し、対象は `/join` だけ。
アプリは起動時の URL(`getLaunchUrl`)と起動中の `appUrlOpen` から、ブラウザと同じ規則
(`app/clubGate.ts` の `inviteFromAppLink`)で招待を読み、参加画面を開く。記録の送信も
既存の同意と明示的な操作に結び付いた再送の範囲にとどめる。

## 8. オーナー特典の広告への適用

`benefits.adRemoval.active` は、作成済みの所有クラブの有効なメンバー数が合計 50 名以上で、
契約が有効なときだけ true。`memberCount` は応答の ready クラブの人数合計と一致し、
`validUntil` は契約の同じ値を返す。現在の無料 Trial は人数上限からこの特典を満たせない。
クライアントはプランごとの枠・人数合計・条件・期限が矛盾した応答を資格として保存しない。

広告資格はオーナー本人が接続した端末のアプリと Web ゲームに適用する。通常メンバーへ
移譲せず、PixApps の LP や別ページは対象にしない。購入資格 `sg.iap` に混ぜず、既存の
広告削除 IAP は独立して効き続ける。画面に「購入済み」とは表示しない。

`sg.club.managedOwner.adRemoval` を現在の origin と契約キーに結び付け、起動時に
`monetization/` がローカルで読む。ビルドで指定したサービスと違う origin、未完了の
Trial、壊れた資格、過去の期限は特典を有効にしない。起動時に契約確認を送信せず、
Core から `club/` を静的 import しない。オーナー画面の読み込み・更新で得た資格を保存し、
保存を読み直して確かめた後に広告判定へ通知する。キーがその間に削除・置換された場合は
応答を採用しない。Reset と同じ保存キューで扱う。

一度の達成で永久に得られる特典ではない。人数低下・契約停止は次の明示的な確認で反映し、
ローカルでも契約期限を過ぎれば無効にする。通信失敗だけで期限内の確認結果を消さない。
無効なキーへの 401、キーを忘れる操作・交換、Reset はその資格を外す。キャッシュを
読むためのストレージ自体に障害がある起動は、購入キャッシュと同じ向きで広告を止め、
資格が確認できたと表示することはしない。特典キャッシュを通常のバックアップには入れない。

有効な資格は広告 SDK の開始前に使い、バナー・Web の手動枠・アンカー・フォールバックと
予約領域を非表示にする。すでに Web の広告 SDK が始まっていた場合は、資格の保存後に
1 回だけページを再読み込みし、次の起動では SDK を読み込まない。秘密値を含まない
sessionStorage の 1 回限りの印でオーナー画面へ戻る。印だけでは資格にならず、設定済みの
サービスについて有効なローカル資格がある場合だけこの画面を再開する。通常の Core 起動で
契約を読み込む導線は増やさない。

失効だけを理由にゲーム中のページを再読み込みしない。Web の広告 SDK を後で新しく
読み込む場合は、アンカー用の余白も先に確保する。Native で起動時の SDK 初期化を
省いた場合は、資格失効後の実際の広告再開が次回起動になる。失効後に通常の空き
バナー領域が現れることはあるが、ゲーム中に新しい同意操作を開始しない。
