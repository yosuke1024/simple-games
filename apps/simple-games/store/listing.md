# Simple Games: Offline Games — Google Play 掲載ドラフト

> 公開前に人間が確認: タイトル文字数制限(30字)と検索性、スクリーンショット、
> Data Safety フォーム、Privacy Policy のホスティング URL。
> あわせて Play Console でアプリ内商品(管理された商品)`remove_ads` を
> 基準価格 USD 3.99 で作成すること(国別価格は自動調整に任せる)。

> **Play Console / App Store Connect 未反映(2026-09-06 時点)。** Takuzu /
> Futoshiki / Kakuro に続いて Mahjong Solitaire / Bubble Pop / Ludo の 3 本を
> 加えたこのドラフトは**このリポジトリの中だけの更新**で、ストア側の掲載情報
> (説明文・スクリーンショット・キーワード)にはまだ反映していない。
> 反映は手動作業であり、**実行には人間の明示的な承認が必要**(タグ発行・
> versionCode・ストア公開と同じ扱い)。承認より先に Console を編集しないこと。
> Hearts / Gin Rummy も同じ状態である。2026-09-06 の「引き算」の改稿(issue #123、
> 冒頭の要約 6 行と短い説明の候補 4)も同じくリポジトリの中だけの更新で、
> Console 側には未反映。
> **2026-10-02 に Web 先行公開(ベータ)だった 11 本を加えて 41 本にした改稿
> (下の収録リスト・キーワード優先順位・INCLUDED GAMES)と、Club House の段落も
> リポジトリの中だけの更新である。Console にはまだ反映していない。** 反映は上と
> 同じく人間の明示的な承認の後に、手動で行う。**時期は、この 11 本と Public Club House を
> 載せた版(v1.4.0)が公開されるのと同時** — それより前に出すと、未収録のゲームと未出荷の
> Club House を掲載文に書くことになる(BRAND.md「表現ルール」)。v1.3.2 は内部テストと
> TestFlight だけなので、掲載文は変えない。

> 掲載は収録ゲーム 41 本(Sudoku / Solitaire / Spider Solitaire / FreeCell /
> Mahjong Solitaire / Hearts / Gin Rummy / Minesweeper / Ludo / 2048 /
> Block Puzzle / Checkers / Reversi / Connect Four / Gomoku / Bubble Pop /
> Brick Breaker / Nonogram / Takuzu / Futoshiki /
> Kakuro / Number Match / Quick Math / Schulte Table / Number Recall /
> Water Sort / Sliding Puzzle / Memory Match / Sky Fighter / Bunny Hop /
> Crown Grid / Number Path / Shape Regions / Yacht / Mancala / Dominoes /
> Hit & Blow / Dots and Boxes / Binary Balance / Sudoku 6×6 / Box Regions)の
> 状態で書いてある。`src/app/registry.ts` の収録数と食い違ったらこちらが古い。
>
> **ドリル 3 本(Quick Math / Schulte Table / Number Recall)の掲載文では、
> このジャンルの定番である効能の主張を一切しない。日本語のジャンル名そのものも
> 書かない**(名前の形をした主張であるため)。禁じている表現の一覧と理由は
> [docs/SCHULTE_TABLE_RULES.md](../../../docs/SCHULTE_TABLE_RULES.md) §14-2 にあり、
> **このファイルは `.github/scripts/check-principles.sh` §7 の検査対象なので、
> ここに一覧を書き写すことはできない**(規則を書くこと自体が違反になる)。
> 書けるのは「制限時間なし」「減点なし」「自己ベストだけを記録」といった、
> 実際にそうである事実だけである。
> 未収録のゲームは名前も含めて掲載文に出さず、**実際に収録できた時点で**
> 説明・スクリーンショットへ追加する(未収録のゲームを "Coming Soon" として
> 掲載しない)。Web 版だけで先行公開(ベータ)中のタイトルも未収録である — アプリには
> 出ないので、正式収録(registry から `channel` を外すリリース)まで名前を書かない
> (`docs/WEB_VERSION.md`「先行公開」)。2026-10-02 に 11 本が正式収録になったので、
> 今は先行公開中のタイトルは無い。
>
> **練習セット 5 本(Crown Grid / Number Path / Binary Balance / Sudoku 6×6 /
> Box Regions)と Yacht・Hit & Blow の掲載文は、他社の商品名を一切使わない**
> (名前の規則は下の「使用禁止表現」と [docs/BRAND.md](../../../docs/BRAND.md)
> 「自社タイトルと比較対象の名前」)。LP や専用入口では「どれに近いか」を説明に
> 必要な範囲で書いてよいが、ストアの掲載文はゲーム名の一覧と事実だけにとどめる。

## タイトル候補(優先順)

1. `Simple Games: Offline Games`(appName として決定済み。27 字。
   アーケード 2 本の収録で "Puzzles" が正確でなくなったため 2026-08-03 に変更)
2. `Simple Games — Offline Games`
3. `Simple Games: Sudoku & More`

キーワード優先順位: Offline > Sudoku > Solitaire > Spider Solitaire > FreeCell >
Mahjong Solitaire > Hearts > Gin Rummy > Minesweeper > Ludo > Checkers > 2048 >
Block Puzzle > Reversi >
Connect Four > Dominoes > Mancala > Yacht > Gomoku > Dots and Boxes >
Hit & Blow > Bubble Pop > Brick Breaker > Nonogram > Kakuro >
Cross Sums > Futoshiki > Sudoku 6×6 > Puzzle >
Number Match > Quick Math > Schulte Table > Number Recall > Water Sort >
Sliding Puzzle > Memory Match > Binary Puzzle > Takuzu > Binary Balance >
Crown Grid > Number Path > Shape Regions > Box Regions > Sky Fighter >
Bunny Hop > Simple Games > PixApps
(ゲーム名は検索流入の中核。収録済みの名前だけを、検索需要の大きい順に置く。
**Checkers は英連邦圏では Draughts、Gomoku は英語圏では Five in a Row、
Kakuro は Cross Sums、Takuzu は Binary Puzzle とも呼ばれる**ので、掲載文の本文に
その一般名も一度ずつ置く — 別名の併記であってキーワードの詰め込みではない。
Takuzu だけは別名のほうが検索されるため、Binary Puzzle を先に置いた。
**2026-10-02 に加えた 11 本の置き場所**: Dominoes / Mancala / Yacht は一般名で
検索需要が大きい対局ゲームなので Connect Four の直後、Dots and Boxes と Hit & Blow は
需要が小さい古典なので Gomoku の後ろに置いた。Sudoku 6×6 は Sudoku の派生を探す
検索に当たるので Futoshiki の隣、Binary Balance は Takuzu / Binary Puzzle の隣。
Crown Grid / Number Path / Shape Regions / Box Regions は独自名で、名前そのものの
検索需要はまだ無いので、ゲーム名の最後尾(Sky Fighter の前)に置いた。
**一般名の併記は 3 つだけ**: **Mancala は Kalah**(アプリで遊ぶのは Kalah の規則で
あり、[MANCALA_RULES.md](../../../docs/MANCALA_RULES.md) 冒頭と §11 のとおり一般名)、
**Hit & Blow は Bulls and Cows**(同じ数当ての古典の呼び名。
[HIT_AND_BLOW_RULES.md](../../../docs/HIT_AND_BLOW_RULES.md))、
**Crown Grid は Star Battle**(メカニクスの古典的なジャンル名。
[CROWN_GRID_RULES.md](../../../docs/CROWN_GRID_RULES.md))。
それ以外の 8 本は併記しない — 他社の商品名や商標を別名として置かないための線引きで、
Yacht にも商標のある派生ゲームの名前を併記しない
([YACHT_RULES.md](../../../docs/YACHT_RULES.md) §11)。
日本語の掲載文でも Kakuro の併記に「カックロ」は使わない — ニコリの商標であり、
Sudoku の併記を「数独」でなく「ナンプレ」にしたのと同じ理由。一般名の
「クロスサム」を使う)

## 訴求の順序(BRAND.md と同一。この順で書く)

1. 1 つのアプリで複数のクラシックゲーム
2. 完全オフライン
3. ログイン不要
4. サブスクリプションなし
5. 全ゲーム機能が無料
6. 広告は小さなバナー 1 つだけ
7. $3.99 の一度だけの購入で広告を永久に削除
8. ソースコード公開(常に最後段)

## 短い説明(80字以内)— 候補

1. `No rush, no connection needed. Classic games gathered into one simple app.`(74字)
2. `Classic games in one quiet, offline app. No subscriptions or paywalls.`(70字)
3. OSS 行(補助): `Built in public. The source code is available on GitHub.`(56字)
4. 引き算の行: `Less between you and the game. Offline classics, no account, no subscription.`(77字)

## 詳細説明

```text
I made this app because I wanted games I could play on a long flight, without worrying about a connection.

Simple Games is a simple collection of classic games in one app. Where most game apps keep adding things, this one takes them away — everything that gets between you and the game. More games will be added gradually, as long as they fit this idea.

• Plays offline, from the very first launch
• No subscription, and no account to create
• Nothing interrupts play: one small banner while you're online, never a full-screen or video ad
• Every game feature is included, and hints and undo are free wherever a game has them
• A small download — quick to install, light on storage
• Favorites pin your games to the top; search finds the rest by name

Nothing rushes you.
No login bonuses, no day-streak counters, no limited-time events. No clock runs on screen while you play. Skip a day and you lose nothing.

The games never go online.
All of them run offline, from the very first launch. Your progress stays on your device and nowhere else. No account and no cloud sync, and no game ever waits on a server — so there is nothing that can go down in the middle of a game. To keep the app usable far from a charger, I left out anything power-hungry.

Club House is the one optional exception, and only if you choose it.
Join a Club with a nickname — there is no account — and the daily puzzles become one board for everyone, so you can see how others did on the very same board; in every other game, your personal bests sit next to theirs, game by game. PixApps runs the Public Club House, and anyone can run a private one for their own group. A device that never joins never connects to it.

INCLUDED GAMES
• Sudoku
• Solitaire
• Spider Solitaire
• FreeCell
• Mahjong Solitaire
• Hearts
• Gin Rummy
• Minesweeper
• Ludo
• 2048
• Block Puzzle
• Checkers (Draughts)
• Reversi
• Connect Four
• Gomoku (Five in a Row)
• Bubble Pop
• Brick Breaker
• Nonogram
• Takuzu (Binary Puzzle)
• Futoshiki
• Kakuro (Cross Sums)
• Number Match
• Quick Math
• Schulte Table
• Number Recall
• Water Sort
• Sliding Puzzle
• Memory Match
• Sky Fighter
• Bunny Hop
• Crown Grid (Star Battle)
• Number Path
• Shape Regions
• Yacht
• Mancala (Kalah)
• Dominoes
• Hit & Blow (Bulls and Cows)
• Dots and Boxes
• Binary Balance
• Sudoku 6×6
• Box Regions

No game feature is locked behind a payment, and there is no subscription. Hints and undo are free wherever a game has them — no limit on how often you use them, and never an ad to watch first.

While you are online, the app shows one small banner ad. It helps me maintain and improve the app, and it never covers the board or interrupts play. Prefer no ads? A one-time purchase removes them permanently, including in every game added later.

The source code is public.
Everything said above is something you can check for yourself.

Simple Games by PixApps
```

## 構成の意図(短くしたのは意図である)

以前ここには収録ゲームごとの `INCLUDED GAME:` ブロックがあり、ルール・レベル数・
Hint / Undo の詳細を 5 本ぶん並べていた。**それをやめた。**

- 掲載文が長いほど読まれない。読まれない段落に書かれた約束は、守っていても届かない
- ルールの詳細はゲーム別 Landing Page の役割であり、掲載文で二重に持たない
  (二重に持つと、ルール変更のたびに 2 か所が食い違う)
- 空いた場所には、機能一覧では出てこない**コンセプト**を置く。「急かさない」
  (ログインボーナス・連続日数・期間限定イベント・プレイ中のタイマーがない)と
  「通信しない」(初回起動からオフライン・端末内生成・端末内保存)がそれで、
  どちらも PRODUCT_PRINCIPLES.md の必須原則をそのまま文にしたものである

収録ゲームは**名前だけ**を並べる。ゲームを追加したらこのリストに 1 行足す。
並び順は `src/app/registry.ts` と同じ(検索需要の大きい順)。
未収録のゲームは名前も置かない。

**冒頭の要約 6 行(2026-09-06、issue #123)。** 掲載文は上から読まれ、下まで読まれない。
そこで 2 段落目の直後に、ユーザーが受け取るものを 1 行ずつ置いた —— オフライン /
サブスクとアカウントの不在 / 中断しない広告 / 全ゲーム機能と無料の助け / 小さな
ダウンロード / お気に入りと検索。ブランドの思想(「足すのではなく、削る」)は 2 段落目の
1 文だけで、残りは実利である。**思想 2 割・実利 8 割**が目安で、ストアで思想の説明を
長くしない([docs/BRAND.md](../../../docs/BRAND.md)「設計思想」)。要約と下の段落が
同じ事実を二度言うのは意図で、要約は読まれる場所に置いた見出し、段落はその限定語
(`wherever a game has them` / `while you're online`)を運ぶ本文である。要約の行を
増やすときは、下の段落に対応する事実があること —— つまり**すでに実装されている**こと —— を
先に確かめる。

**トレードオフ**: ゲーム名の本文中の出現回数が減るため、Play の検索流入は理論上
下がりうる。名前自体は残しているので消えはしない。もし取り戻す必要が出たら、
ブロックを復活させるのではなく、名前の横にアプリ内 Quick Rules 相当の一行説明を
足すこと(5 行増で済む)。

## 表現の約束(誤訳・改稿で壊してはいけない点)

- **助けの書き方**: Hint / Undo は全ゲームに同じ形では存在しない(Minesweeper と
  Nonogram に Undo はなく、Sliding Puzzle に Hint はない)。したがって
  「Undo も Hint も全ゲームにある」と読める書き方をしない。
  英語は `wherever a game has them` のような限定句を必ず伴わせる。
  各言語版も同じ限定を持つこと。
- **通信の書き方**: オンライン時はバナー広告のために通信する。したがって
  「通信しない」を**アプリ全体の無条件の主張として書かない**。主語をゲームに
  寄せる(`The games never go online.`)か、「通信を必要としない」と書く。
  とくに短い説明は検索結果に単独で出るため、打ち消す文脈がないことに注意。
- **Club House の書き方**(2026-10-02、[BRAND.md](../../../docs/BRAND.md)「表現ルール」):
  `The games never go online.` は Core(Club House を使っていない状態)について真のまま
  残し、その直後の段落で Club House を**任意・選んだときだけ**と言い、主語をデプロイの
  持ち主(PixApps か、あなた)にする。Club House について `offline` / `no server` を
  言わない。`no account` は Public でも真(ニックネームだけ)。"leaderboard" / "ranking"
  はストア文面では使わず、「同じ盤面で他の人がどうだったかが見える」「自己ベストが並ぶ」
  と書く。「参加しない端末は接続しない」は実機で確かめた事実としてだけ書く
  ([RELEASE_CHECKLIST.md](../../../docs/RELEASE_CHECKLIST.md) 5.16)。
- **広告視聴の書き方**: 「広告を見る必要がない」はヒント・Undo の利用に限定して
  書く。アプリにバナー広告は存在するため、無条件の否定にしない。
- **文字数を削るときに限定語を落とさない**。短い説明は 80 字上限があり、削る圧力が
  常にかかる。このとき真っ先に落ちるのが「必要とされない」「〜がなくても」に当たる
  限定語で、落とすと無条件の断定に変わる。実際にフランス語で
  `aucune connexion requise`(接続は**必要とされない**)を 80 字に収めるため
  `aucune connexion`(接続はいっさいなし)に縮め、オンライン時の広告表示と矛盾させた。
  **削るなら限定語ではなく名詞側を削る。**
- **中断の書き方**: 「中断しない」はバナーの存在を認めた形で書く —— 要約の 3 行目が
  その形で、バナーが 1 枠あると言ってから、全画面・動画の広告は無いと言う。
  `No ads` に縮めない —— それは使用禁止表現であり、事実でもない。
- **サイズの書き方**: 配布サイズは `A small download` のように数字なしで書く。
  「約 x MB」と数字を書くのは、公開時点の Play Console / App Store Connect の配布
  サイズを確認したときだけで、確認していない数値を固定コピーにしない
  ([docs/PRODUCT_PRINCIPLES.md](../../../docs/PRODUCT_PRINCIPLES.md)「引き算の原則」)。
- **お気に入り・検索の書き方**: 実装済み(issue #109 / #122、2026-09)だから書いている。
  同じ理由で、未実装の機能は要約にも本文にも書かない。

## アプリ内購入の開示

- 掲載には広告とアプリ内購入の存在を正しく申告する:
  広告あり(バナーのみ)/ アプリ内購入あり(広告削除の買い切り 1 商品のみ)。
- 商品名: `Remove Ads & Support Simple Games` / 「広告を削除して Simple Games を支援」
- 商品説明文(候補):
  - EN: `A one-time purchase removes banner ads permanently and supports future games and improvements.`
  - JA: 「一度だけの購入でバナー広告を永久に削除し、今後のゲーム追加と改善を支援できます。」
- サブスクリプションではない。ゲーム機能は購入の有無で変わらない。

## ルール文書との関係

掲載文はルールを説明しないが、書いた事実がルール文書と矛盾してはいけない。
矛盾したらルール文書を正とする:
[SUDOKU](../../../docs/SUDOKU_RULES.md) /
[SOLITAIRE](../../../docs/SOLITAIRE_RULES.md) /
[MINESWEEPER](../../../docs/MINESWEEPER_RULES.md) /
[NONOGRAM](../../../docs/NONOGRAM_RULES.md) /
[NUMBER MATCH](../../../docs/NUMBER_MATCH_RULES.md) /
[WATER SORT](../../../docs/WATER_SORT_RULES.md) /
[SLIDING PUZZLE](../../../docs/SLIDING_PUZZLE_RULES.md) /
[MEMORY MATCH](../../../docs/MEMORY_MATCH_RULES.md) /
[CROWN GRID](../../../docs/CROWN_GRID_RULES.md) /
[NUMBER PATH](../../../docs/NUMBER_PATH_RULES.md) /
[SHAPE REGIONS](../../../docs/SHAPE_REGIONS_RULES.md) /
[YACHT](../../../docs/YACHT_RULES.md) /
[MANCALA](../../../docs/MANCALA_RULES.md) /
[DOMINOES](../../../docs/DOMINOES_RULES.md) /
[HIT & BLOW](../../../docs/HIT_AND_BLOW_RULES.md) /
[DOTS AND BOXES](../../../docs/DOTS_AND_BOXES_RULES.md) /
[BINARY BALANCE](../../../docs/BINARY_BALANCE_RULES.md) /
[SUDOKU 6×6](../../../docs/SUDOKU_6X6_RULES.md) /
[BOX REGIONS](../../../docs/BOX_REGIONS_RULES.md)。

## ローカライズ管理

**言語別の掲載文はこのリポジトリでは管理しない**(ストア運用側で管理する)。
ここに置くのは英語の正文と、上の「表現の約束」だけ。理由は、掲載文が
Play Console の掲載言語スロット単位で必要になり、その単位が**アプリのロケールとは
一致しない**ため。アプリは言語ごとにカタログ 1 つで地域バリアントを親言語へ解決する
(`pt-PT` → `pt-br`)が、Play は地域ごとに別スロットを持ち、埋めないスロットの
利用者にはデフォルト言語のページが出る。対応は 1 対 多になる。

言語別ファイルを書くときの規則:

- **ゲーム名・IAP 商品名は、その端末が実際に解決するアプリのカタログ
  (`src/i18n/locales/*.ts`)に合わせる。** 地域スロット専用の掲載文でも、
  ゲーム名だけは親カタログのまま据え置く。ここを地域語に直すと、ストアで見た名前と
  アプリ内で出る名前が食い違う
- 広告・課金の文言はカタログの `adSupportBody` / `removeAdsTitle` と割れないようにする
- スクリーンショットの訴求文は短句に限る:
  "Many games. One app." / "Fully offline." / "No subscriptions." /
  "Banner ads only." / "Open source."
- 不自然なキーワード詰め込みをしない。方針は
  [docs/I18N_POLICY.md](../../../docs/I18N_POLICY.md)
- en / ja 以外は来歴 `machine`。リリース前に高リスクキーの門
  ([I18N_POLICY.md](../../../docs/I18N_POLICY.md)「リリース前の門」)を通すこと

## 使用禁止表現

- 広告が存在するため:
  "Ad-free" / "No ads" / "Completely free of ads" / "No popup ads" / "No forced ads"
- 広告削除の買い切りが存在するため:
  "No purchases" / "No in-app purchases" / 「課金なし」の無条件表現
  (代わりに "No paywalls" / "No subscriptions" を使う)
- "Lifetime Access"(無期限なのは広告削除権であって、アプリのサービス存続期間ではない)
- **`Mahjong` 単独**(ja / zh / ko で「麻雀 / 麻将」は 4 人対局を指すため、
  単独名は誤誘導になる。掲載名は `Mahjong Solitaire`。日本語の併記に「上海」も
  使わない —— サン電子の商品名。[MAHJONG_SOLITAIRE_RULES.md](../../../docs/MAHJONG_SOLITAIRE_RULES.md))
- **`Bubble Shooter`**(Ilyon Dynamics が米国で出願・行使している商標。
  遊び自体は自由でも実名・ソース公開のプロダクトで権利グレーは名乗らない。
  掲載名は `Bubble Pop`。[BUBBLE_POP_RULES.md](../../../docs/BUBBLE_POP_RULES.md))
- **`Ludo King` 等の他社タイトル名**(`Ludo` は 1896 年の英国のゲームに由来する
  一般名なので単独では使える。[LUDO_RULES.md](../../../docs/LUDO_RULES.md))
- **練習セットの比較対象の他社商品名**(Queens / Zip / Tango / Patches /
  Mini Sudoku。ほかに Othello / Binairo。いずれも他社の商品名で、Simple Games の
  正式名にも、ストア掲載文の本文・キーワードにも使わない。説明に必要な範囲で書いてよいのは
  LP と専用入口だけ。[BRAND.md](../../../docs/BRAND.md)「自社タイトルと比較対象の名前」、
  [PUZZLE_PRACTICE_SET.md](../../../docs/PUZZLE_PRACTICE_SET.md) §2)。
  あわせて、そのサービスの運営会社の公式・提携・公認と読める書き方、
  「〜の全ゲームを収録」と読める書き方をしない
- **`Mastermind`**(他社の商品名。掲載名は `Hit & Blow`。一般名として併記してよいのは
  `Bulls and Cows` だけ。[HIT_AND_BLOW_RULES.md](../../../docs/HIT_AND_BLOW_RULES.md))
- **Yacht の商標のある派生ゲームの名前と、その欄名・点数の呼び名**(書かない。
  どの名前かは [YACHT_RULES.md](../../../docs/YACHT_RULES.md) §11 の規則に従って
  ここにも写さない。掲載名は `Yacht`)
