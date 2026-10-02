# 計画: Club House のアプリ側 — 参加・送信・挑戦・順位(段取りの PR D + E)

作成 2026-10-02。[2026-09-30-public-club-house.md](2026-09-30-public-club-house.md) の
**PR D(`club/` が生まれる)と PR E(3 本の対応と順位の画面)を 1 本で**進める段取り。
正典は [../architecture/club.md](../architecture/club.md)(以下 club.md)と
[../PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Club House」。この文書は**計画**で、
正典と食い違えば正典が勝つ。サーバは `simple-games-club#2`(2026-10-02 マージ)で
Node と Cloudflare の両方が club.md §5 を通している。

## 0. できあがると何ができるか

1. 招待リンクを開く(Web)か、設定 > Advanced > Club House に貼る(アプリ)→ 表示名 → 参加。
2. Sudoku / Minesweeper / Water Sort の結果画面に `Send to Club`。押すとその局が挑戦になる。
3. ホームと設定の入口 → 挑戦の一覧 → `Play` で同じ盤面を遊ぶ → 終わると自動送信 → 順位。

PR H(Create my Club、Hosting、QR、Owner リンク)はこの計画に**入れない**。Owner が招待
リンクを配る `Invite`(読むだけ・共有)と Member の削除は入れる。

## 1. 製品オーナーの確認(2026-10-02)

- 入る前の局の記録は不要。「Club から入った挑戦は自動送信」で足りる。
- 盤面が揃わないゲームのハイスコア表は **2 段目**。正典の文言を直してから別に足す。
- Durable Object の置き場所は EU のまま(法的に動かす理由なし)。

## 2. 継ぎ目(Core が持つ型) — 先に固定し、本体はこれに合わせる

| 置き場所                                 | 何                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/registry.ts`                    | `ChallengeStart`、`GameChallengeContract`、`GameDefinition.challenge?`、`GameRootProps.challenge?`                                          |
| `src/ui/clubBridge.ts`                   | `ClubBridge`(context の値)、`ClubBridgeContext`、`ClubRootProps`、`ClubModule`(動的 import の結果の形)                                      |
| `src/ui/components/ClubResultAction.tsx` | 結果画面の 1 操作。context が無い・未接続なら null。挑戦の局なら自動送信して状態 1 行                                                       |
| `src/storage/schemas.ts`                 | `sg.club` / `sg.clubOutbox` の `SchemaDef`(要素ごとに validate、壊れた要素だけ落とす)                                                       |
| `src/app/clubGate.ts`                    | 起動時の `sg.club` 読み、`isConnected()`、`loadClub()`(動的 import、失敗は握りつぶして null)、招待 URL の検出と fragment 除去               |
| `src/i18n/locales/*`                     | Core の 7 キー(§11): advancedTitle / clubEntry / playTogetherTitle / playTogetherBody / clubSendResult / clubResultSent / clubResultPending |
| `src/games/<id>/challenge/contract.ts`   | import ゼロの葉。§6-1 の validateParams / validateFacts / paramsKey / order / seedPrefix                                                    |

club.md からの**実装上の決定**(食い違いではなく、文書が決めていなかった細部):

- `ClubRoot` の props 型と `club/` モジュールの形は Core(`ui/clubBridge.ts`)が宣言する。
  規則 5 は `import type` も禁じるので、`src/app/` は動的 import の結果を `ClubModule` として受ける。
- 挑戦の局を終えて戻る先は **Club のその挑戦の画面**(`View.game.from === 'club'`)。
  `exitGame` はコレクションへ戻すのが既定だが、挑戦から入った局だけは戻り先を覚える。
- `ClubResultAction` が「挑戦の局か」を見分けるのは `activeChallenge.boardDigest === boardDigest`。
  Root の中で別の局を始めても、digest が違えば `Send to Club` 側になる。
  `Play again`(既に結果がある挑戦)は `activeChallenge.submitted = true` で、操作も状態も描かない。
- 挑戦の局の保存先は `saveClub`(mode `'club'`)。resume は「保存の seed が挑戦の seed と同じ」とき
  だけで、違えば新しく生成する。統計・自己ベスト・レベル進行・レビュー計数には触れない。
- 版ずれ(digest 不一致)はゲームの Root が 1 行で伝える(キーは各ゲームのカタログに 1 つ)。

## 3. 作業の分け方(ディレクトリごと、並列)

| 束  | 範囲                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | `src/club/api/*`、`contract/*`、`storage/*`、`invite.ts`、`index.ts`(`ClubModule` を満たす)、`api/types.test.ts`                                                                                                                                                         |
| B   | `src/club/ui/*`、`src/club/i18n/*`(14 言語。高リスクは Disconnect の本文)                                                                                                                                                                                                |
| C   | 3 ゲーム: `challenge/contract.ts`、`GameMode` に `'club'`、`storage/keys.ts` の `saveClub`、schemas / gamePersistence / slots.test、Root の `challenge`、digest、結果画面の `ClubResultAction`、RULES 文書                                                               |
| D   | 門: `vite.config.ts`、`scripts/bundle-size.mjs` + baseline、`importBoundaries.test.ts`(契約の葉・規則 4 の許可)、`clubResultWiring.test.ts`、`clubGate.test.ts`、`resetLocalDataWiring`、`backup/keys`、`check-principles.sh`、`RELEASE_CHECKLIST.md`、`storage-keys.md` |
| E   | `App.tsx`(view `club`、`from: 'club'`、bridge の provider、招待の起動経路)、`SettingsScreen` の Advanced、`CollectionHomeScreen` の 1 行、App の各テスト                                                                                                                 |

## 4. 受け入れ

club.md §12 の 1〜7(8 の実機は「未確認」と書く)。加えて `pnpm verify:changed`、
`pnpm lint && pnpm typecheck && pnpm test && pnpm build`、`size:check`、`check-principles.sh`。
`gameKeys.test.ts` には 3 本の `saveClub` を**追記**する(既存キーの意味・位置は変えない。
ゴールデンの編集なので PR で明示する)。
