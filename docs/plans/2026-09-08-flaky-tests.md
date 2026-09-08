# 記録: 既知の flaky test を解消し「赤 = 本物の回帰」を取り戻す(issue #158)

作成 2026-09-08。issue #158 の実施記録である。恒久的な方針は
[ARCHITECTURE.md](../ARCHITECTURE.md)「CI / リリース」に置き、この文書は
**何が flaky で、どう再現し、何が原因で、何を変えたか**を残す。完了後は履歴であり、
canonical document と食い違えばそちらを正とする。

計測環境: Linux コンテナ、4 vCPU、Node 22、vitest 4.1。`pnpm test` = 337 ファイル /
4,750 テスト、改修前のフル実行は 267s / 269s(2 回とも緑)。負荷の再現には
4〜24 本の busy loop(`node -e 'while(...)'`)を並走させ、load average 15〜45 を作った。

## 0. 何が起きていたか

直近 PR の記録に、変更と無関係なファイルが**負荷時だけ**落ち、単独再実行で通る例が
複数あった。

| PR         | 落ちたテスト                                            | 記録された状況                                                                      |
| ---------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| #140       | `bubble-pop/ui/BubblePopRoot.pop.test.tsx`(cluster pop) | `verify:changed` で 2 回とも `expected 38 to be less than 38`。単独でもフルでも通る |
| #145       | 同ファイル(pointerCancel)                               | load average 50 超で 1 回失敗、単独 4 回連続 pass                                   |
| (コメント) | `gin-rummy/game/session.test.ts` の保存スイープ         | 「単独 2 秒、スイート内で 3 回 5 秒を超えた」→ timeout を 20 秒へ                   |
| (コメント) | `checkers` / `gomoku` の compatibility・cpu テスト      | 同上 → timeout を 60 秒へ                                                           |

「単独では通る」は無関係の証拠ではなく、**壁時計に依存したテスト**の症状である。

## 1. 候補一覧と再現条件

| #   | テスト                                                                                                                                                                                      | 依存していたもの                                                                                 | 再現条件                                                                                                                                             | 原因                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `bubble-pop/ui/BubblePopRoot.pop.test.tsx`(2 件)                                                                                                                                            | jsdom の実 RAF と手回しシームが同じ `lastTime` を共有                                            | pump 前に 300ms の遅延を挟むと**決定的に**失敗(`expected 38 to be less than 38`)。負荷下では `await user.click` 中に実 RAF が 1 回でも発火すれば同じ | vitest の jsdom は `pretendToBeVisual` で RAF が実在し、そのタイムスタンプは window 生成基準で `performance.now()` より常に小さい。`dt = Math.min(now - lastTime, 250)` は負方向に無制限なので、実フレームが `lastTime` を進めた後の手回しフレームは飛翔を**巻き戻す** |
| 2   | `ui/components/GameLoadingFallback.test.tsx`(load finishes first)                                                                                                                           | 実タイマーの 200ms 門と、`await act()` を挟んだテスト自身の進行の競争                            | render→assert の間に 250ms 止めると失敗。負荷 19 で実測 7〜63ms(予算の最大 32%)                                                                      | 「速く終わる読み込み」を「壁時計で 200ms 以内に assert する」で表していた                                                                                                                                                                                              |
| 3   | `app/App.test.tsx`(Sudoku / Number Match を開く)                                                                                                                                            | 実チャンクの transform + 評価が `findBy` の 1000ms 予算内                                        | 負荷 26〜45 で 12 回中 5 回失敗(Loading… のまま timeout)。読み込み実測 361〜941ms                                                                    | このファイルだけ `lazyRoots` を stub せず本物のチャンクを読む。runner の仕事が deadline の中に入っていた                                                                                                                                                               |
| 4   | `app/App.load.test.tsx`(Suspense reveal 5 箇所)                                                                                                                                             | `findBy` が act 環境を切る間、react-dom の `FALLBACK_THROTTLE_MS`(実時間 300ms)                  | 毎回 296〜306ms を deadline から消費(残り 700ms が負荷への全マージン)                                                                                | fallback を一度 commit した Suspense は、act の外では 300ms の実タイマーで reveal を遅らせる                                                                                                                                                                           |
| 5   | CPU 対戦 7 本の Root テスト(`checkers` / `gomoku` / `reversi` / `connect-four` ほか)の `waitFor`                                                                                            | `CPU_DELAY_MS = 450` の実 `setTimeout` + 探索 + commit を `waitFor` の 1000ms(一部 3000ms)で待つ | 負荷下・遅延注入で再現(詳細は各ファイルのヘッダー)                                                                                                   | 製品タイマーを壁時計で待っていた。予算の半分は待つ前に消える                                                                                                                                                                                                           |
| 6   | 1 秒級の決定的テスト(`gin-rummy/game/session.test.ts` 1.9s、`gomoku/game/cpu.test.ts` 1.4s、`checkers/game/compatibility.test.ts` 1.1s×2、`ludo/game/session.test.ts` 1.0s、ほか 0.6〜0.8s) | vitest の per-test timeout 5s に対する余裕 3〜5 倍                                               | §7 の実測どおり並列実行の壁時計は数倍ぶれる。過去に 3 件が timeout を 20s / 60s に上げて凌いでいた                                                   | 同じ replay を複数 case で重複計算、独立な seed を 1 つの `it` に束ねる                                                                                                                                                                                                |
| 7   | `bubble-pop/game/autoplay.test.ts`                                                                                                                                                          | 1 テスト 171.6s(スイート最長。timeout 10 分に対し 3.5 倍)                                        | 負荷 25〜40 で旧コードは約 1,150s 相当(timeout 超過)                                                                                                 | `simulateShot` が飛翔の全ステップで盤上の全バブルへ `Math.hypot`。ステップの 99% は衝突不可能な空間                                                                                                                                                                    |
| 8   | `connect-four/game/session.test.ts`、`water-sort/game/generator.test.ts`                                                                                                                    | `Date.now()` / `performance.now()` の差を `expect`                                               | 壁時計そのもの(Water Sort の rule doc は「忙しいと赤くなる、再実行して判断」と書いていた)                                                            | 仕事量カウンタが無かった                                                                                                                                                                                                                                               |
| 9   | `services/ads/banner.test.ts`                                                                                                                                                               | `resetBannerForTesting()` が各テスト本文の末尾だけ                                               | 途中で throw すると `window` の resize リスナーが次のテストへ残る                                                                                    | isolation 漏れ(順序依存)                                                                                                                                                                                                                                               |
| 10  | `AdUnit.test.tsx` / `WebAdSlot.test.tsx` / `WebChromeSlot.test.tsx`                                                                                                                         | `render` するのに `cleanup` なし                                                                 | test globals が無効なので RTL の自動 cleanup は走らない                                                                                              | DOM が同一ファイル内で累積                                                                                                                                                                                                                                             |

## 2. 何を変えたか

方針は 1 つ: **壁時計を判定から外す**。timeout を上げた箇所は無く、skip / quarantine も無い。

1. **Bubble Pop の手回しフレーム** — `src/test/lifecycle.ts` に `stubAnimationFrames()` を
   追加(RAF はハンドルを返すだけで発火しない。restore は global ごとの stack で行い、遅れて来た restore は自分の
   installation を inactive にするだけで、今も active な最上位(次のテストの stub、
   無ければ実値)へ戻す — identity guard だと A timeout → B stub → A.finally →
   B.finally の順で stubA が残留する。`lifecycle.test.tsx` がこの順序を回帰テストにする)。pop テストは board を mount する前にこれを入れ、シームだけが時計を進める。
   `simNow` は 0 から単調増加。製品コードは変えない — ブラウザの RAF は単調で、
   `start()` が `lastTime` を毎回 null に戻すので、負の dt は出荷コードでは到達不能。
2. **読み込み画面** — `GameLoadingFallback.test.tsx` は render → assert → unmount を
   同期 1 ターンで行う(200ms 門が割り込む余地が無い)。`App.test.tsx` は本物の
   チャンクを `beforeAll` で先に読む(遅い機械は**その行が遅くなる**だけで、テストは
   赤くならない)。`App.load.test.tsx` は `findBy` をやめて既存の `flushMicrotasks`
   (`act`)で settle し、同期に読む。reveal は 300ms → 1〜12ms。
3. **CPU の返し手** — 7 本の Root テストは fake timers で `advance(CPU_DELAY_MS)` し、
   その拍に返し手が載ることを assert する(1 拍手前では載っていないことも)。
   `userEvent` は実 0ms タイマーで自分を drain するので、時計を止める case は
   `fireEvent` で操作する。
4. **1 秒級の決定的テスト** — 重複していた replay は `beforeAll` で 1 回だけ
   (`checkers` / `gomoku` の compatibility)、独立な seed は `it.each`
   (`gomoku/cpu`、`ludo/session`、`ludo/rollDistribution` は 30 seed ずつのブロック)、
   gin-rummy のスイープは `beforeAll` で歩いて各 case が読む。上げていた timeout
   (20s / 60s)は撤去。seed 数・サンプル数は減らしていない。
5. **autoplay** — `engine.ts` の `simulateShot` を結果ビット同一のまま高速化
   (軸ごとの棄却で `Math.hypot` を減らす、最深バブルより下では走査しない、ループ不変量の
   hoist)、`grid.ts` の `cellFromKey` を配列確保なしに。`aimGuide` 253µs → 9.3µs。
   全 100 レベル 3,991 手の着弾セルと swap が改修前後で完全一致、735,105 ショットの
   軌跡座標の差分比較も一致。autoplay 184s → 14〜17s(負荷下 85s)、guide 12s → 1.3s。
   hang guard は 10 分 → 4 分、3 分 → 30s、60s → 10s へ**下げた**。
6. **壁時計 assert の置換** — Connect Four は `searchCost.nodes`(30,000 ちょうど =
   上限を使い切る)、Water Sort は `Puzzle.solverNodes`(全 100 レベル最悪 2,426 に対し
   予算 5,000)。ミリ秒は出力のみ。`docs/WATER_SORT_RULES.md` §5 を更新。
7. **isolation** — banner のリセットを `afterEach` へ、3 ファイルに `cleanup()`。

## 3. 検証

- 変更ファイルは単独 10 回 + busy loop 下 5 回(一部は load 25〜40 で 6 回)すべて緑。
- 改修前のファイルに同じ遅延注入をすると決定的に落ちることを確認してから直した
  (#1, #2, #5)。#3 は負荷下 A/B で 5/12 → 0/12。
- フル `pnpm test`(既定並列)を 3 回連続: 337 ファイル / 4,825 テストすべて緑、
  205s / 205s / 203s(改修前 267s / 269s、4,750 テスト。増分は `it.each` への分割で、
  seed 数は変えていない)。
- 同じフルスイートを 4 本の busy loop と並走(load average 8〜10): すべて緑、349s。
- `pnpm verify:changed --base main` を 2 回: `--changed` が選ぶ 177 ファイル / 2,655
  テストと常時ゲート 28 ファイル / 652 テストがどちらも緑。
- `pnpm lint && pnpm typecheck && pnpm build`、`build:web`、広告分離、`ios:version check`、
  サイズ Gate、`check-principles.sh` すべて緑。

## 4. 変えなかったこと

- `*.leak.test.tsx` の 50ms 実スリープ: 何フレーム発火したかに依存する assert が無く、
  `trackResources` は実 RAF が要る(発火したフレームで「全部 cancel されたか」に答える)。
- `gomoku/game/session.test.ts` の undo テスト(0.6〜0.7s): hard 探索 2 回が本体で
  分割できない。
- `lifecycle.test.tsx` / `tutorialBackWiring.test.tsx` の 25ms スリープ: mock した
  Preferences は microtask で解決し、待っているのはマクロタスク境界であって時間ではない。
- 製品コードの負 dt ガード、テスト安定のためのポーリング・ログ・telemetry: 追加しない。
