# 計画: Club House のメンバー一覧を別画面にし、名前からプレイヤー別ビューへ

作成 2026-10-22。製品オーナーの 2 つの要望 — 「Club 画面のメンバー一覧が今後長くなりすぎる」
「名前を押したら報告だけでなく、その人がどのゲームをやってどの順位かを見たい」 — への段取り。
正典は [../architecture/club.md](../architecture/club.md)(以下 club.md)と
[../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Club House」で、この文書は**計画**。食い違えば正典が勝つ。
サーバは [yosuke1024/simple-games-club](https://github.com/yosuke1024/simple-games-club)(Node + SQLite と
Cloudflare Workers + Durable Object。同じ `src/` と同じ契約テスト)。

## 0. 製品オーナーの判断(2026-10-22。同日マージの後に確認済み)

| #   | 判断                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 退けた案                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 52  | **メンバー一覧は Club 画面から別画面へ。** Club 画面には `Members · {n} 人 ›` の 1 行だけ残し、押すと Members 画面。持ち主の `Reported` 節も Members 画面の先頭へ移す(Club 画面は「遊び」、Members 画面は「人」)                                                                                                                                                                                                                                                                                                            | 一覧をその場で畳む(先頭 5 人 + 「すべて見る」。畳んでも 50 行は 50 行)/ 名前の検索欄(探す機能は公開プロフィール化への一歩で、今は要らない)/ 一覧を無くし人数だけ(「誰が居るか」が消える) |
| 53  | **Members 画面は新しい順 50 人 + 「これより前のメンバーを見る」で 50 人ずつ。** `GET /members?before=<id>`。無限スクロールではなく、押した分だけ(PRODUCT_PRINCIPLES「無限フィード」禁止の線の内側)                                                                                                                                                                                                                                                                                                                          | 50 人で打ち切り(Private の 51〜100 人目が一覧から永遠に消える)                                                                                                                           |
| 54  | **名前を押すとプレイヤー別ビュー(Member 画面)。** 名前・参加日・その人が入っている表(「あなたの順位」と同じ行: ゲーム · モード、順位、件数、最良の値、1 つ上との差)。載せるのは**表に既に出ているものだけ**。通算・局数・最終プレイ日時・デイリーの結果・アバター・自由文は無い(§14 判断 49「公開プロフィールに寄せない」の線はここで引き直す: 表の寄せ集めまでは可、それ以外は不可)。報告はビューの末尾の 1 つ(シートは廃止)。持ち主の端末でも名前は押せ、ビューの末尾に `Rename` / `Remove`(一覧に居ない人にも対処できる) | 名前のシートに表を足す(シートが伸びて画面になるだけ)/ ビューに「N 局」「最近の結果」(履歴の別画面は判断 45 で退けた)                                                                     |

## 1. 画面(club.md §9 の改定)

```text
Club 画面(変更後)
  PixApps Club                                   [Settings]
  Your rankings …                                ← 変わらない
  Today …                                        ← 変わらない
  Rankings(棚)…                                 ← 変わらない
  Members                             18 人  ›   ← 1 行。押すと Members 画面(新規の要求なし)

Members 画面(新規 `club/ui/MembersScreen.tsx`)
  ← Members
  Reported                                       ← 持ち主だけ。今までの Club 画面の節をそのまま移す
    Mika                        2 reports  [Rename] [Remove]
  18 人
    Harry                       Oct 21 に参加    ← 名前を押すと Member 画面。持ち主には [Rename] [Remove] が今までどおり
    Zengetsu17                  Oct 21 に参加
    …(新しい順 50 人。`GET /club` が返した分で、開いても要求しない)
  [ これより前のメンバーを見る ]                  ← 残りがあるときだけ。押すと `GET /members?before=<末尾の id>` → 50 人を足す
                                                   古いサーバ(404)なら黙って消す

Member 画面(新規 `club/ui/MemberScreen.tsx`。`GET /members/:id` 1 回)
  ← Harry
  Oct 21 に参加                                  ← `clubJoinedOn`
  Rankings                                       ← `clubRankings`。無ければ `clubNothingYet`
    [▦] Sudoku · Hard     ① · 24 件 · 4:31 · 1 つ上まで 0:33   ← 「あなたの順位」と同じ行。押すとその表(そのモード)
    [♠] FreeCell          #5 · 12 件 · 手数 98
  Report                                         ← メンバーの端末。確認 → POST /members/:id/report → `role="status"` の 1 行
  [Rename] [Remove]                              ← 持ち主の端末。今までの RenamePanel / RemoveDialog
```

- **名前を押せる場所**: Members 画面の行、ランキングの表の行、デイリー(Today の挑戦)の結果の行。**自分の名前は押せない**
  (今までどおり `You` / 素の文字)。持ち主の端末でも他人の名前は押せる(今までは素の文字だった)。
- `NameSheet.tsx` は削除する。報告の確認(`clubReportTitle` / `clubReportBody`)と結果の 1 行(`clubReported`)はそのまま
  Member 画面で使う。
- Member 画面の行の並びは「あなたの順位」と同じ(棚の順: カテゴリ → registry の順 → `compareModes`)。この端末で遊べない
  ゲーム(web-beta)の表は出さない(同じ `shelfGames()` の篩)。
- 古いサーバ(`GET /members/:id` が 404)では、題は押した名前のまま、本文に `clubErr_not_found` の 1 行。Report は出る
  (通報の経路は PR F 以降の全サーバにある)。
- Member 画面から表を開くときの `tables`(チップ)は Club 画面が読んだ `rankings` を ClubRoot が渡す(無ければ `[]`。
  RankingScreen は今のモードをチップに必ず足すので壊れない)。
- 通信は開いたときだけ(§10)。Member 画面に Reload は置かない(戻って開き直す)。

## 2. 契約(club.md §5-3 に 2 行)

| Method / Path              | 認証   | 目的                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /members/:id`         | member | `{ member: Member, rankings: [{ gameId, paramsKey, entryCount, leader, best: { rank, entry, nextValue } }] }`。`rankings` は `GET /rankings/mine` と同じ形・同じ読み量(`rankingsMine(id, rankingMineScan)`)。外された人・知らない id は `404 not_found`。`GET /members/reported` より**後に**登録する(同じ GET で `reported` が `:id` に食われないため) |
| `GET /members?before=<id>` | member | `{ members: Member[], memberCount }`。`before` の人より**前に**参加した(seq が小さい)有効なメンバーを新しい順に `membersPage`(50)件。`before` 無しは `GET /club` と同じ先頭ページ。`before` が知らない id なら `400 invalid_request`(外された人は cursor としては有効 — ページの途中で外されても続きが読める)                                           |

`Member` の形は変えない。読み量は Club の大きさに比例しない(§15-3)。

## 3. クライアント(`apps/simple-games/src/club/`)

- `api/types.ts`: `MemberView { member: Member; rankings: RankingMine[] }` と `MembersPage { members: Member[]; memberCount: number }`、
  それぞれの validator(`validateMemberView` / `validateMembersPage`。`rankings` は `validateList(…, validateRankingMine)`)。
- `api/client.ts`: `member(id): Promise<MemberView>`、`membersBefore(id): Promise<MembersPage>`。
- `ui/ClubRoot.tsx` の stack に 2 種: `{ kind: 'members'; endpoint }` と `{ kind: 'member'; endpoint; memberId; nickname }`。
  Members 画面は Club の step が持つ `data`(members / memberCount / reported)を**そのまま読む**(自前で要求しない)。
  持ち主の Rename / Remove は ClubRoot の `patchClubData(endpoint, fn)` で Club の step の `data` を直す
  (rename: 両一覧の名前。remove: 両一覧から外し `memberCount - 1`。purge: 加えて `stale`)。Member 画面の Remove は
  画面を 1 つ戻す。
- `ui/ClubScreen.tsx`: Members 節と Reported 節を外し、`Members` の 1 行(`settings-row club-line` + chevron。`aria-label` は
  `Members · 18 人`)を置く。`MyRankingRow` と棚順の並べ替えは `ui/standings.tsx` へ出して Member 画面と共用
  (`StandingRow`、`sortByShelf`)。`RenamePanel` / `RemoveDialog` も共用できる場所へ(`ui/memberActions.tsx` など)。
- `ui/MembersScreen.tsx` / `ui/MemberScreen.tsx`: 上の図のとおり。
- `ui/RankingScreen.tsx` / `ui/ChallengeScreen.tsx`: `NameSheet` を外し、他人の名前は `onOpenMember(memberId, nickname)`。
  持ち主の端末でも押せる。報告の状態・エラーの state はこれらの画面から消える。
- `ui/NameSheet.tsx`: 削除。`.club-name-sheet*` の CSS も。
- i18n(14 言語): `clubOlderMembers`(en `Show older members` / ja `これより前のメンバーを見る`)の 1 キー。高リスクではない。
- テスト: `ClubRoot.test.tsx` のシートの試験(Members / Ranking / Today の 3 か所と、持ち主の端末で開かない試験)を
  Member 画面の試験へ書き換え。足す試験: Club 画面の Members 行 → Members 画面(要求 0)/ 「これより前」で
  `GET /members?before=` と追加表示、残りが無ければボタン無し、404 で黙って消える / Member 画面は `GET /members/:id` 1 回で
  名前・参加日・表の行、行を押すとその表(そのモード)、Report → 確認 → POST → status / 404 のサーバ / 持ち主の端末で名前が押せ
  Rename・Remove(purge)が Club の一覧に反映、Remove で画面が戻る / 自分の名前は押せない。`client.test.ts` / `types.test.ts` に
  2 メソッドと validator。

## 4. サーバ(`~/repo/simple-games-club`、branch `claude/member-view`)

- `src/api/members.ts`: `GET /api/v1/members`(`?before=`)と `GET /api/v1/members/:id`。後者は `GET /members/reported` の後。
- `src/db/store.ts`: `membersBefore(seq: number, limit): MemberRow[]`(`WHERE revoked_at IS NULL AND seq < ? ORDER BY seq DESC LIMIT ?`)。
  cursor の seq は `memberById`(外された人も返す)から。`MemberRow` に `seq` が無ければ足す(wire には出さない —
  `memberShape` は変えない)。
- `test/members.test.ts`: 両ルート(本人・他人・外された人 404・知らない id・ページの境界・`before` に外された人・
  Workers でも同じ)。
- `README.md` の API 一覧に 2 行。`docs/cloudflare.md` の読み量の表には「`/rankings/mine` と同じ」の 1 行。

## 5. 文書の改定

- club.md: §5-3(2 行)、§9「Club」(図と Members の説明、新しい「Members」「Member」の小節)、§17-2(ページ送り)、
  §17-3(シート → Member 画面。持ち主の端末でも開く)、§14 に判断 52〜54(2026-10-22 に確認済み)、§9「後続」の「Member プロフィール」に
  「2026-10-22 の Member 画面は表の寄せ集めで、ここでいうプロフィールではない」の注記。
- PRODUCT_PRINCIPLES「Club House」「順位表」: 「名前を押すと、その人が入っている表の一覧(順位・最良)。それ以外は載せない」の 1 文。

## 6. 検証

- アプリ: `pnpm verify:changed`、`pnpm lint && pnpm typecheck && pnpm test && pnpm build`、`pnpm size:check`(club チャンクの
  予算 200 KB gzip)。
- サーバ: `pnpm lint && pnpm typecheck && pnpm test`(node と workers の両方。workers は単独で回す)。
- ブラウザ: ローカルの Node サーバ + 見本データで、Club → Members → 「これより前」→ 名前 → Member 画面 → 行 → 表、報告、持ち主の
  Rename / Remove、ダーク、320px。
