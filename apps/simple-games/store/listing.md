# Simple Games: Offline Puzzles — Google Play 掲載ドラフト

> 公開前に人間が確認: タイトル文字数制限(30字)と検索性、スクリーンショット、
> Data Safety フォーム、Privacy Policy のホスティング URL。
> あわせて Play Console でアプリ内商品(管理された商品)`remove_ads` を
> 基準価格 USD 3.99 で作成すること(国別価格は自動調整に任せる)。

> 掲載は収録ゲーム 2 本(Sudoku / Number Match)の状態で書いてある。未収録のゲーム
> (2048 以降)は名前も含めて掲載文に出さず、**実際に収録できた時点で**説明・
> スクリーンショットへ追加する(未収録のゲームを "Coming Soon" として掲載しない)。

## タイトル候補(優先順)

1. `Simple Games: Offline Puzzles`(appName として決定済み。29 字)
2. `Simple Games — Offline Puzzles`
3. `Simple Games: Number Match`

キーワード優先順位: Offline > Sudoku > Puzzle > Number Match > Simple Games > PixApps
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

1. `Classic games in one quiet, offline app. No subscriptions or paywalls.`(70字)
2. `Simple offline games with one small banner. Remove it forever with a single purchase.`(85字 — 採用時は 80 字以内へ要調整)
3. OSS 行(補助): `Built in public. The source code is available on GitHub.`(56字)

## 詳細説明

```text
I made this app because I wanted simple games to play during long flights.

Simple Games is a quiet collection of classic puzzles in one small app. It
works without internet, requires no account, and has no subscriptions.

Every game feature is free and available offline, including hints, undo,
daily challenges, and statistics. Your progress stays on your device.

While you are online, the app shows one small banner ad. It never covers the
board and never interrupts play. A single one-time purchase removes ads
permanently — including in every game added later.

INCLUDED GAME: SUDOKU
• Fill every row, column and 3x3 box with 1 to 9.
• 999 levels and a new daily puzzle, all generated on your device — each one
  has a single solution and can be solved by logic, never by guessing.
• Pencil in notes while you narrow a cell down.
• Hints are free and unlimited, and show you which cell is decided and why.
• No mistake limit and no game over. The clock never runs on screen.

INCLUDED GAME: NUMBER MATCH
• Match two numbers that are equal or add up to 10.
• Pairs connect across, down, diagonally, or from the end of one row to the
  start of the next — cleared cells are no obstacle.
• Clear the whole board to win. Stuck? Add Numbers appends the remaining
  numbers. Undo and hints are always free and unlimited.

999 LEVELS IN EACH GAME, GENTLY RISING
• Difficulty grows slowly — no sudden walls, no countdowns
• Replay any cleared level, or an earlier day, to beat your own best
• Number Match scoring rewards sharp eyes and planning, never speed

MADE FOR LONG FLIGHTS
• Fully playable offline, from the very first launch
• No account required
• No subscriptions, no paywalls — every game feature is free
• Unlimited Undo and Hints
• Daily puzzles generated on your device
• Personal bests kept on your device
• One small banner ad while online; a single purchase removes it forever
• Light and dark themes, 5 languages

Built in public. The source code is available on GitHub.

A Simple Games app by PixApps.
```

## アプリ内購入の開示

- 掲載には広告とアプリ内購入の存在を正しく申告する:
  広告あり(バナーのみ)/ アプリ内購入あり(広告削除の買い切り 1 商品のみ)。
- 商品名: `Remove Ads & Support Simple Games` / 「広告を削除して Simple Games を支援」
- 商品説明文(候補):
  - EN: `One small purchase removes banner ads permanently and supports future games and improvements.`
  - JA: 「一度だけの購入でバナー広告を永久に削除し、今後のゲーム追加と改善を支援できます。」
- サブスクリプションではない。ゲーム機能は購入の有無で変わらない。

## 収録ゲームごとの掲載文

- 収録ゲームの説明ブロック(上の `INCLUDED GAME:` 節)はゲーム単位で書き、
  ゲームを追加するたびにブロックを追加する。並び順は検索需要の大きい順
  (現在は Sudoku → Number Match)。
- ルールの正式定義は
  [docs/NUMBER_MATCH_RULES.md](../../../docs/NUMBER_MATCH_RULES.md) と
  [docs/SUDOKU_RULES.md](../../../docs/SUDOKU_RULES.md)。掲載文がルール文書と
  食い違ったらルール文書を正とする。
- 未収録のゲーム(2048 以降)はブロックも名前も置かない。

## ローカライズ管理

- M-L10N(リリース前の多言語マイルストーン)でこのファイルを言語別に分割する:
  `store/listing/<locale>.md`。現状はこの単一ファイルのみ。
- 各言語ファイルで管理する項目: ①アプリ名 ②短い説明 ③詳細説明
  ④スクリーンショットキャプション ⑤リリースノート ⑥IAP 商品名 ⑦IAP 説明文。
- スクリーンショットの訴求文は短句に限る:
  "Many games. One app." / "Fully offline." / "No subscriptions." /
  "Banner ads only." / "Open source."
- 不自然なキーワード詰め込みをしない。方針は
  [docs/I18N_POLICY.md](../../../docs/I18N_POLICY.md)。

## 使用禁止表現

- 広告が存在するため:
  "Ad-free" / "No ads" / "Completely free of ads" / "No popup ads" / "No forced ads"
- 広告削除の買い切りが存在するため:
  "No purchases" / "No in-app purchases" / 「課金なし」の無条件表現
  (代わりに "No paywalls" / "No subscriptions" を使う)
- "Lifetime Access"(無期限なのは広告削除権であって、アプリのサービス存続期間ではない)
