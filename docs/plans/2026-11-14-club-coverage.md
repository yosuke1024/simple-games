# Club House の対応ゲームを広げる(2026-11-14)

状態: **決定(2026-11-15、製品オーナー「推奨通り」)** — A 群 14 本を入れる(Tangram のデイリーも Today へ)、
B 群・C 群は入れない(各 RULES に理由を書く)、D 群は RULES に理由を書く、E 群は何もしない。正典への記録は
club.md §14 判断 57。正典は `docs/architecture/club.md` と `docs/PRODUCT_PRINCIPLES.md`「順位表」で、
この文書はそれを未対応の 47 本へ当てはめた結果と段取りである。

## 1. 現状

- 82 本中、Club House の契約(registry の `challenge`)を持つのは 35 本(2026-10-02 の 4 群 35 本から増えていない)。
- 未対応 47 本の内訳:
  - 方針で外した 6 本 — 勝ち負けしか無い対 CPU の Checkers / Connect Four / Gomoku / Ludo、結果画面に数字が無かった Brick Breaker / Bubble Pop(club.md §6-0、判断 30)。
  - 2026-10-17 以降の新作 41 本 — 各計画書が「結果と比較軸が固まり、契約テストを通せるまで登録しない」とした(`docs/plans/2026-10-17-*`、`2026-10-19-*`、`2026-10-20-*` ほか)。うち 2 本(Falling Blocks / Marble Weave)は `in-development` で未公開。
- 調べ方: 1 本ごとに結果画面・共有の `details`・モード・デイリーの盤面・RULES を読む調査役と、それをコードで反証する検証役を当てた(47 × 2)。

## 2. 物差し(正典のまま)

1. 順位表に要るのは「結果画面に、成績を表す数字(時間・手数・スコア)が出る」こと。`facts` は `details` と同じ変数から作り、Club のために計算しない(club.md §6-1)。
2. 勝ち負けしか無いゲームには表を作らない — 勝った回数は熱心さの数(PRODUCT_PRINCIPLES「順位表」、判断 30)。
3. デイリーが全員同じ盤面なら `Today`(`daily` + `boardDigest`)、そうでなければランキングへ(§6-3)。
4. 今回の調査で、2 に近い形がもう 1 つ見つかった: **数字は出るが、ほぼ全員が同じ値に揃う**(上限・最短手数・5–0 など)。同値は先に出した人が上なので、表は「早く送った順」になり、2 と同じく成績を比べない。これを「飽和」と呼び、2 と同じ扱いを既定にする。

## 3. 分類

### A. そのまま入る — 14 本(コードの変更は Club の配線と RULES の節だけ)

| ゲーム          | 軸(向き)               | 表(`paramsKey`)                 | `facts`                      | Today        |
| --------------- | ------------------------ | --------------------------------- | ---------------------------- | ------------ |
| Unblock Puzzle  | 時間(短い順)           | easy / medium / hard              | 時間・手数・ヒント           | 入る(`ub1`) |
| Loop Puzzle     | 時間(短い順)           | easy / medium / hard              | 時間・ヒント                 | 入る(`lp1`) |
| Bridges         | 時間(短い順)           | easy / medium / hard              | 時間・ヒント                 | 入る(`bg1`) |
| Pipe Link       | 時間(短い順)           | easy / medium / hard              | 時間・ヒント                 | 入る(`pn1`) |
| Make the Target | 時間(短い順)           | easy / medium / hard              | 時間                         | 入る(`tg1`) |
| Tangram         | 時間(短い順)           | easy / medium / hard              | 時間                         | 判断 A-1     |
| Snake           | スコア(高い順)         | slow / normal / fast              | スコア                       | —            |
| Gem Swap        | スコア(高い順)         | easy(5 色)/ normal(6 色)      | スコア                       | —            |
| Bounce Up       | スコア(高い順)         | normal / wide                     | スコア                       | —            |
| Formation Fire  | スコア(高い順)         | standard                          | スコア・ステージ             | —            |
| Scopa           | 自分の得点(高い順)     | standard                          | 自分・CPU の得点             | —            |
| Light Grid      | 手数(少ない順)         | 3x3 / 4x4 / 5x5                   | 手数                         | —            |
| Color Flood     | 手数(少ない順)         | 6x6 / 10x10 / 14x14               | 手数                         | —            |
| Chain Territory | 勝った局の手数(少ない順) | easy / normal / hard            | 手数                         | —            |

前例に合わせて既定にした小さな判断(オーナーが変えない限りこのまま):

- Today の 5 本は、デイリーを `Today` へ、フリープレイを難易度別の表へ送る(Crown Grid / Box Regions と同じ。デイリーは `{ difficulty: 'medium' }`)。
- Scopa は負けた試合も自分の得点で送る(Gin Rummy / Yacht と同じ)。Chain Territory は勝った局だけ送る(負けの手数は「粘った長さ」で成績ではない)。
- Light Grid / Color Flood は、結果画面から Undo して同じ盤をもう一度クリアしても 2 行目を送らない。ゲーム自身の統計が数える「最初のクリア」だけ送る(2 タップで同じ行が増えるのを防ぐ)。
- アーケードの game over(Snake・Bounce Up・Formation Fire)は `completed` で送る(Bunny Hop / Sky Fighter と同じ)。Gem Swap の連鎖の段数の上限(`cap`)での終わり方だけは送らない(ゲーム自身も記録に数えない)。
- モード語は、Snake の速さ・Bounce Up の足場の幅・Chain Territory の CPU の強さを、ゲーム自身の語の写しとして Club の文言に足す(14 言語とも写しなので新しい翻訳ではない。i18n.test の写しの門に載せる)。Gem Swap はホームの切り替えと同じ Easy / Normal。
- 盤の運(Light Grid 3×3 の 1 手盤、Chain Territory Easy の 2 手勝ち)は判断 28「運も含めて比べる」のまま表を作る。

### B. 結果画面に数字を足せば入る — 8 本(Core の変更。オーナー判断)

| ゲーム                                                | いまの結果画面                         | 入れるなら                                   | RULES の現状                          |
| ----------------------------------------------------- | -------------------------------------- | -------------------------------------------- | ------------------------------------- |
| Peg Solitaire                                         | 残りのペグ(クリアは常に 1)           | クリア時間を足す                             | 「時計を出さない」                    |
| Knight’s Tour                                         | 盤の大きさだけ                         | クリア時間を足す                             | 「時計なし・自分のペースで」          |
| Three Peaks                                           | 残りのカード(勝ちは常に 0)           | 時間(または山札の残り)を足す               | 「時計は統計だけ」                    |
| Hanoi Towers                                          | 手数(最短 2ⁿ−1 に揃う)               | 時間を足す                                   | 「時間は端末の統計だけ」              |
| River Cargo                                           | 手数(ヒントで最短に揃う)             | 時間を足す                                   | 「Club・Nearby には加えない」(11/07) |
| Road Weave                                            | 着順と Bumps だけ                      | 完走タイムを足す(タイムアタックの否定を撤回) | 「時計もタイムアタックも作らない」    |
| Crazy Eights / Indian Rummy                           | 自分の残り点(勝ちは常に 0)           | 勝者の得点の行を足す                         | 記述なし                              |

既定の推奨は **入れない**(各 RULES の「時計を出さない」判断と、「情報量は足さない」を優先)。入れる場合はゲームごとに RULES の改定を先に書く。

### C. 数字はあるが表にならない — 10 本(オーナー判断)

| ゲーム                    | 理由                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Brick Breaker / Bubble Pop | クリア時間は出るが、レベルごとに難しさが違い 100 表になる。時間は端末の速さ(Brick)・Reduced Motion(Bubble)で変わる |
| Echo Pads                 | 「得点」はクリアしたレベルの固定の長さ。最上位で全員揃い、レベルの到達度(熱心さ)を並べる表になる |
| Maze Escape               | 一本道の迷路で、無料のヒントで誰でも最短手数に揃う                                                    |
| Frost Route               | ヒントが最短手順を返すので、手数が盤の最短に揃う。ヒントの回数は結果画面に出ない                      |
| Ridge Cannons             | 残り装甲が 100 に揃う(Easy で約 73%、Normal で約 48% の盤)                                           |
| Paddle Rally              | 勝ちは常に 5–n。決まった打ち方で Hard でも 5–0 になる                                                  |
| Fleet Search              | 結果画面が CPU の艦を全部見せ、同じ局の再挑戦で誰でも最小の 11 発になる                               |
| Spades                    | 得点がチームの合計(CPU の相棒の分を含む)で、負数になる(サーバの軸の型を変える必要)。共有に数字が無い |
| Blackjack                 | 疑似ギャンブル(iOS では 2.3.6 で隠している)。賭け金の構造の勝ち額を並べることになる                 |

既定の推奨は **入れない**。入れる場合は、ゲーム側の変更(Fleet Search の再挑戦をやめる等)を先に決める。

### D. 原則で入れない — 13 本(勝ち負けだけ)

Ludo / Checkers / Connect Four / Gomoku(判断 30 で既に外したもの)と、同じ理由の
Chess / Nested Tic-Tac-Toe / Nim / Backgammon / Daifugo / Sevens / Old Maid / Durak / Texas Hold’em。
結果画面の数字は勝敗に従う付随物(駒数・着順・チップ)で、勝ちでは全員が同じ値になる。
**コードは変えず、各 RULES に「Club House には登録しない」理由の短い節を足す**(Backgammon §15 の書き方)。

### E. 未公開 — 2 本

Falling Blocks / Marble Weave(`in-development`)。何もしない。

## 4. 実装で触る場所(A 群)

ゲームごと(14 本、互いに独立):

- `games/<id>/challenge/contract.ts`(import ゼロの葉)と `contract.test.ts`。モードの値は `const X = [...] as const;` の 1 行で書く(titles.test.ts が読む)。
- `games/<id>/ui/components/*ResultOverlay.tsx` に `ClubResultAction`(`gameId` は文字列リテラル。Nearby が import する overlay には置かない)。
- Today の 5 本: `game/challenge.ts`(`boardDigest` / `boardDigestOf`。golden が使う盤面の文字列を `hashSeed` に通す)と `game/challenge.test.ts`(新しい golden)。`rng.ts` は `hashSeed` の export だけ(列は変えない)。
- `docs/<GAME>_RULES.md` の「登録しない」行を Club House の節に置き換える(同じコミット)。

共有(1 回):

- `app/registry.ts`(import と `challenge:`、「Club に入っていない」群のコメント)。
- `club/ui/common.tsx`(Snake・Bounce Up・Chain Territory のモード語と並び順)、`club/i18n/*.ts`(14 言語)、`i18n/i18n.test.ts`(写しの門)。
- `club/ui/titles.test.ts`(35 → 49、`EVERY_KEY`)、`test/clubResultWiring.test.ts`(`SHARED_DAILY_GAMES` 21 → 26 または 27)。
- `docs/architecture/club.md`(§6-0・§6-1 の群と表・§6-3 の Today 一覧・§14 に判断 57・§16 の本数)、`PRODUCT_PRINCIPLES.md`(Today の本数を日付つきで)、`ARCHITECTURE.md`(Today の本数)。
- D 群 13 本の RULES に「登録しない」節。

別リポジトリ:

- **simple-games-club**: `src/contracts/games.ts` に 14 本、schema 7 → 8(`rerankResults` を呼ぶ upgradeToV8)、`test/migrate.test.ts` の版、`docs/cloudflare.md`。
- **pixapps-landing**: `public/simple-games/index.html` の `NAMES`(載っていないゲームは LP に出ない)・`AXIS`・`club-mode-labels` 区間、`tests/ui.test.js`。

## 5. 出す順序

1. サーバの PR をマージ → 2. アプリの PR をマージ → 3. オーナーが `pnpm build:web ../simple-games` と
`pnpm deploy:production`(サーバと club.pixapps.ai の Web 版を同時に。v8 への移行は戻せない)→
4. landing の PR と Web 版の Publish → 5. ストア版。

サーバより先に新しいクライアントが出ると、新しいゲームのランキング送信は `400 invalid_request` で
**確定的に捨てられる**(再送されない)。だから順序は崩さない。古いクライアントは自分の契約に無いゲームの表を
出さない(オーナーの記録簿だけ値が空になる)。

## 6. 未決

- A-1: Tangram のデイリーを Today に入れるか。デイリーは Medium の 12 図形のどれかで、フリープレイでも遊べ、12 日ごとに決まった順で戻ってくる(練習できる)。入れない場合はデイリーの結果をどこへも送らない。
- B 群・C 群の各本を入れるか(既定は入れない)。
- 実機・本番サーバでの確認は、この計画のどの段階でもまだしていない。
