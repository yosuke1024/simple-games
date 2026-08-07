# Simple Games: Offline Games — Google Play 掲載ドラフト

> 公開前に人間が確認: タイトル文字数制限(30字)と検索性、スクリーンショット、
> Data Safety フォーム、Privacy Policy のホスティング URL。
> あわせて Play Console でアプリ内商品(管理された商品)`remove_ads` を
> 基準価格 USD 3.99 で作成すること(国別価格は自動調整に任せる)。

> 掲載は収録ゲーム 17 本(Sudoku / Solitaire / Spider Solitaire / FreeCell /
> Minesweeper / 2048 / Block Puzzle / Reversi / Connect Four / Brick Breaker /
> Nonogram / Number Match / Water Sort / Sliding Puzzle / Memory Match /
> Sky Fighter / Bunny Hop)の状態で書いてある。
> 未収録のゲームは名前も含めて掲載文に出さず、**実際に収録できた時点で**
> 説明・スクリーンショットへ追加する(未収録のゲームを "Coming Soon" として
> 掲載しない)。

## タイトル候補(優先順)

1. `Simple Games: Offline Games`(appName として決定済み。27 字。
   アーケード 2 本の収録で "Puzzles" が正確でなくなったため 2026-08-03 に変更)
2. `Simple Games — Offline Games`
3. `Simple Games: Sudoku & More`

キーワード優先順位: Offline > Sudoku > Solitaire > Spider Solitaire > FreeCell >
Minesweeper > 2048 > Block Puzzle > Reversi > Connect Four > Brick Breaker >
Nonogram > Puzzle >
Number Match > Water Sort > Sliding Puzzle > Memory Match > Sky Fighter >
Bunny Hop > Simple Games > PixApps
(ゲーム名は検索流入の中核。収録済みの名前だけを、検索需要の大きい順に置く)

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

## 詳細説明

```text
I made this app because I wanted games I could play on a long flight, without worrying about a connection.

Simple Games is a simple collection of classic games in one app. More games will be added gradually, as long as they fit this idea.

Nothing rushes you.
No login bonuses, no day-streak counters, no limited-time events. No clock runs on screen while you play. Skip a day and you lose nothing.

The games never go online.
All of them run offline. Your progress stays on your device and nowhere else. No account, no cloud sync. To keep the app usable far from a charger, I left out anything power-hungry.

INCLUDED GAMES
• Sudoku
• Solitaire
• Spider Solitaire
• FreeCell
• Minesweeper
• 2048
• Block Puzzle
• Reversi
• Connect Four
• Brick Breaker
• Nonogram
• Number Match
• Water Sort
• Sliding Puzzle
• Memory Match
• Sky Fighter
• Bunny Hop

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
- **広告視聴の書き方**: 「広告を見る必要がない」はヒント・Undo の利用に限定して
  書く。アプリにバナー広告は存在するため、無条件の否定にしない。
- **文字数を削るときに限定語を落とさない**。短い説明は 80 字上限があり、削る圧力が
  常にかかる。このとき真っ先に落ちるのが「必要とされない」「〜がなくても」に当たる
  限定語で、落とすと無条件の断定に変わる。実際にフランス語で
  `aucune connexion requise`(接続は**必要とされない**)を 80 字に収めるため
  `aucune connexion`(接続はいっさいなし)に縮め、オンライン時の広告表示と矛盾させた。
  **削るなら限定語ではなく名詞側を削る。**

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
[MEMORY MATCH](../../../docs/MEMORY_MATCH_RULES.md)。

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
