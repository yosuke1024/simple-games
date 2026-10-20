# Phase 0 の試作(使い捨て)

[docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md](../../../../docs/plans/2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md)
「共通要件」の **実機の Phase 0** のための試作。アプリの一部ではない — registry に無く、ビルドに
入らず、翻訳も保存も通信も無い。1 ファイルで完結する HTML で、Chromium 88 相当の WebView と
iOS 14 の Safari で動くように書いてある(ES モジュール・新しい API・新しい CSS は使わない)。
`eslint.config.js` で `prototypes/` は lint の対象外にしてある。

| ファイル              | 何を測るか                                                                                                                                                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overtake-input.html` | Overtake の 2 軸 1 本指の入力マッパーとスロットル表示だけの空コース。**30 秒走って、意図しない減速の時間が 3% 未満**が通過条件(計画書「共通要件」)。比較用に「横ドラッグ + ▼ 長押し」モードもある                           |
| `tangram-board.html`  | Tangram の入力マッパーと最小の盤(Easy の影絵 3 つ・駒 7 枚・トレイ・回転 / 裏返し / Undo)。**7 枚を 45° 刻みで回し・裏返し・吸着させて、Easy の影絵 3 つを 360 幅で誤操作なく埋められる**が通過条件。誤操作の集計ボタン付き |
| `check-overtake.mjs`  | `overtake-input.html` を Playwright のヘッドレス Chromium(360×640・タッチ)で駆動する検査                                                                                                                                    |
| `check-tangram.mjs`   | `tangram-board.html` を同じく駆動する検査                                                                                                                                                                                   |

## 実機で触る手順(オーナー)

1. PC でこのディレクトリを配信する。どちらでもよい:
   - `python3 -m http.server 8000 --directory apps/simple-games/prototypes/phase0`(リポジトリの
     ルートで)。
   - `pnpm --filter simple-games dev --host` の後、`/prototypes/phase0/<ファイル>.html`。
2. 同じ Wi-Fi の実機 2 台(低スペックの Android — Chromium 88 相当・システムフォントのみ — と iOS の
   Safari。どちらも 360 幅の縦持ち)で `http://<PC の IP>:8000/overtake-input.html` と
   `http://<PC の IP>:8000/tangram-board.html` を開く。平文の http なので「コピー」ボタンは効かない
   ことがある — その場合はログのテキストエリアを全選択してコピーする。
3. **Overtake**: モード A(2 軸 1 本指)のまま「30 秒の計測を開始」。**30 秒間、減速するつもりなく**走る
   (コーンの間を通るように左右だけ操る)。終わったら結果(意図しない減速の時間の %・回数・最長・
   端末情報)がログに出る。gain(1.0 / 1.2 / 1.4)とラチェットの戻り速度を変えて 2〜3 回ずつ。
   比較のためにモード B でも 1 回。
4. **Tangram**: E1 → E2 → E3 の順に、各 1 回ずつ完成させる。**誤操作が起きたら直後に該当のボタンを
   押す**(ボタンの表記は短く「誤回転 / 誤置き直し / 吸着取り違え」= 意図しない回転 / 意図しない
   置き直し / 吸着先の取り違え)。完成ごとにログに 1 行出る。余裕があれば Medium のトグルでも 1〜2 図形。
   - 通過条件は既定の規則(`rule=snap14/edge1/guide0/slop6` — 影絵と置いた駒にだけ吸着)で測る。
     `?guide=1`(Easy の境界線にも吸着)は比較用の別の規則で、取り違えがほぼ起きなくなるので通過の
     判定には使わない。START / DONE の行に `rule=…` が必ず入る。
   - ドラッグして離した直後(およそ 0.3 秒以内)のタップは、ブラウザが click を出さず「回らない」ことが
     ある(素早く払うように離した直後は特に)。試作はこれを `lostTaps` と「(lost tap)」の行で数える。
     回らなかったのは端末の挙動として**測れた結果**なので、誤操作の集計ボタンとは別に、ログの
     `lostTaps` を表に写す。
5. 2 台 × 2 本のログを、計画書の「Phase 0 の試作」の節の表に写す(通過 / 不通過と数)。

## ヘッドレスの検査(開発機)

```bash
# どちらも Playwright(1.56 以降)と Chromium が要る。PW_MODULE で playwright の場所を指定できる。
PW_MODULE=/path/to/node_modules/playwright node apps/simple-games/prototypes/phase0/check-overtake.mjs
PW_MODULE=/path/to/node_modules/playwright node apps/simple-games/prototypes/phase0/check-tangram.mjs
```

ヘッドレスの検査は「試作が仕様どおりに動く」ことを確かめるだけで、**通過条件の判定は実機でしか
できない**(手触り・親指のずれ・誤操作は合成イベントでは出ない)。
