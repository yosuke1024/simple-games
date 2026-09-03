# 計画: 結果画面の共有に「結果」と「画像カード」を載せる

作成 2026-09-03。issue #86 の共有導線(ゲーム名+リンクだけ)の**続き**であり、
#86 が「非目標」に置いた 2 点(結果の数値・画像の自動生成)を、製品判断として
撤回して実装する。着手前に [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md) /
[ARCHITECTURE.md](../ARCHITECTURE.md)「レイヤー規則」/ [BRAND.md](../BRAND.md) を読むこと。

## 0. 決定事項(確定)

- **「共有文に数値を入れない」規則を撤回する**(2026-09-03、製品オーナー判断)。
  共有文と共有画像は、そのプレイの結果(結果画面が表示した時間・スコア・ミス・
  ヒント回数など)を載せる。
- **変えないもの**: 共有 URL(`WEB_PLAY_URL?game=<id>`、結果は URL に載らない)/
  報酬・解放・再催促なし/計測なし(どの版でも)/`completed`(「クリアしました」)は
  勝ち・クリアが確定した結果だけ/ゲーム固有の共有フォーマッタを 30 個作らない/
  サーバー・短縮 URL・動的 OG 生成なし/ランキング・ストリーク・招待ボーナスなし。
- 段階 1(文面に結果)と段階 2(画像カード)を **同じ PR で** 入れる。段階 2 は
  Web Share API の `files` が使える環境だけに効き、使えない環境では段階 1 の
  文面共有に落ちる(何も退化しない)。

## 1. なぜ

- 結果のない共有文は「このゲームやったよ」という**推薦文**で、ゲームを終えた直後に
  人へ推薦する人はほとんどいない。人が共有するのは「見て、これできた」か
  「これ超えられる?」であり、結果か挑戦のどちらかが要る。docs 自身が
  「発見経路は口コミだけ」と書いている以上、押されないボタンは問題である。
- 旧規則の根拠は「プライバシー」だったが、本人がボタンを押して送り先を選ぶ行為は
  漏洩ではない。残すべきなのは**正直さ**(勝っていないのに勝ったと言わない、
  画面に無い数字を作らない)であって、数値の不在ではない。
- **スクリーンショットは採らない。** Web 版の結果画面には 3 回に 1 回広告が乗る/
  DOM と canvas が混ざる画面の撮影には html2canvas 級の依存が要り、サイズ予算と
  2021 年 WebView 下限に響く/描画カードなら 30 タイトルで見た目が揃い、広告も
  写らない。

## 2. 契約(コード)

```
ui/components/ShareAction.tsx      <ShareAction gameId outcome details />
services/share/message.ts          ShareDetail { label?: string; value: string }
                                   MAX_SHARE_DETAILS = 3
                                   buildShareMessage({ gameId, outcome, details }, t)
services/share/card.ts             renderShareCard(...) → File | null(同期・例外なし)
services/share/share.ts            shareGame(message, card?) — files 付きシート → 文面
                                   シート → clipboard → 無音
```

- `details` は**必須**。結果画面が「何を送るか」を決めなければならない。`[]` も決定
  (図の無い敗北、放棄されたエンドレス)。
- 渡してよいのは**同じ結果画面が同じ描画で表示している事実だけ**。ラベルは同じ
  `t(...)`、値は同じ整形式(`formatDuration` 等)を使い、文字列で渡す。
  ここで数字を計算しない。**履歴は渡さない**(自己ベスト・NEW BEST・通算成績)。
- 最大 3 件、見出しの数字(時間 or スコア)を先頭に。
- 文面:
  ```
  Simple Games で Sudoku をクリアしました。      ← shareCleared / sharePlayed
  時間 4:32 · ミス 0 · ヒント 0                 ← details を「ラベル 値」で " · " 連結
  あなたも挑戦してみて。                          ← shareChallenge(details があるとき)
                                                   / shareInvite(無いとき)
  https://pixapps.ai/simple-games/play/?game=sudoku
  ```
- 画像カード: 1080×1080 PNG、Canvas 2D、依存ゼロ。常にライトパレット(見るのは
  相手であって本人のテーマではない)。背景 = タイトルのアクセント `light`、文字 =
  `onLight`。左上に `seriesColors.surface` のタイルとゲームの glyph、"Simple Games"、
  タイトル(幅に収まるまで縮小)、`completed` のときだけ「クリア!」のピル、
  details の行(ラベル小・値大、最大 3 列)、下端に `pixapps.ai/simple-games`。
  文字は Nunito 800/700(ラテン)、それ以外の文字はシステムフォントに落ちる
  (DOM と同じ)。
- **同期で描く理由**: `navigator.share` はクリックの user activation の中で呼ぶ
  必要がある。`toBlob` や `document.fonts` を await すると古い Safari で失う。
  `toDataURL` → `atob` → `File` は同期で済む。
- 共有シートの梯子: `canShare({ files, text, url })` が真なら files 付き → 取り消しは
  `dismissed` で終了、それ以外の失敗は文面シートへ → 文面シート → clipboard(文面
  のみ)→ 無音。ネイティブ WebView で files が通らなくても、今日までの挙動に
  そのまま落ちる。plugin(公式 Share + Filesystem)は実機で「開かない」と分かって
  から入れる(RELEASE_CHECKLIST 5.7)。
- アクセントの引き当て: `titleAccents` のキーは camelCase(`numberMatch`)、
  ゲーム id は kebab(`number-match`)。`accentKeyOf` で変換し、`'2048'` だけ
  `game2048`。全 `GAMES` が実在キーに解決することをテストが見る(新作の門)。

## 3. i18n

- シェルに 2 キー追加: `shareChallenge`(結果があるときの締めの 1 行)、
  `shareCardCleared`(カード上の 1 語)。高リスクキーではない(門の対象外)。
- 既存の `shareCleared` / `sharePlayed` / `shareInvite` / `shareCopied` は変えない
  (14 言語ぶんの訳をそのまま使う)。

## 4. ゲームごとの判断(30 タイトル)

| 分類                                                                                                                              | 渡すもの                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 時間系パズル(Sudoku / Kakuro / Futoshiki / Nonogram / Takuzu / Mahjong / Minesweeper 勝ち / Quick Math / Schulte / Number Recall) | 時間 → ミス or ヒント                                                                                       |
| 手数系(FreeCell / Solitaire / Spider / Memory Match / Sliding / Water Sort)                                                       | 手数, 時間(, ヒント: 画面が出す条件と同じ)                                                                  |
| スコア系(2048 / Block Puzzle / Bunny Hop / Sky Fighter / Number Match)                                                            | スコア(→ 最大タイル / ライン / 障害物 / ステージ / 時間・手数) — 敗北・終了でも渡す                         |
| 対 CPU(Checkers / Reversi / Gin Rummy / Hearts)                                                                                   | 画面が出す最終スコア・駒数「あなた n · CPU n」— 勝ち負け引き分けとも                                        |
| 対 CPU で数字を出さない(Connect Four / Gomoku / Ludo)                                                                             | `[]`(通算成績は履歴なので渡さない)                                                                          |
| 失敗ランに数字が無い(Brick Breaker / Bubble Pop の失敗、Minesweeper の敗北)                                                       | `[]`                                                                                                        |
| デイリー(Quick Math)                                                                                                              | 日付は**載せない** — 結果画面が日付を表示していないため(表示するなら画面に行を足してから)。ストリークは無い |

## 5. 検証

- `pnpm lint` / `pnpm typecheck` / `pnpm --filter simple-games test` / `pnpm size:check`
  / `pnpm build`。
- ブラウザ(`--mode web`)で結果画面 → 共有 → カードの見た目を確認(長いタイトル、
  ドイツ語ラベル、日本語)。
- 実機は RELEASE_CHECKLIST 5.7 に追記した項目(iOS Safari / Android Chrome で画像が
  付く、アプリでは付くか文面に落ちるか)。ここは PR では確認できない。

## 6. 非目標(今回も作らない)

Wordle 型の絵文字グリッド/動画/ゲーム別 OG 画像/画像のクリップボードコピー/
共有回数の計測/共有報酬・招待コード/ランキング・ストリーク。
