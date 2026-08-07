# ゲームのライフサイクル契約(リソース解放)

ゲームは同時に 1 つだけマウントされ、離れたらアンマウントされる(docs/ARCHITECTURE.md、
電池の節)。この文書はその続き — **アンマウントされたゲームは、何も残さない** — を
契約として定める。ホーム画面の裏でゲーム由来の処理が 1 つでも動いていれば、それは
「画面外のゲームは描画しない」という約束の静かな違反であり、ゲームが 50 本に増えた
とき 50 通りの電池漏れになる(issue #26)。

## 契約

ゲームの Root がアンマウントされた時点で、そのゲームが登録した以下がすべて
停止・解放されていること。

- `requestAnimationFrame`(Canvas ゲームループを含む)
- `setTimeout` / `setInterval`(プレイ時計、トースト、フラッシュ演出)
- `window` / `document` のイベントリスナー(キー入力、visibilitychange)
- `MutationObserver` などのオブザーバ
- Capacitor のリスナー(`App.addListener` の handle は必ず remove)
- ゲーム固有の購読・進行中の非同期処理(結果を捨ててよい形にする)
- 開発専用の window シーム(`__bbFrame` など)— DEV ガード内でも cleanup で delete

### 道具

一時 UI(トースト、ヒントマーク、フラッシュ)には `src/ui/useTransientTimeout.ts` を
使う。再設定で前のタイマーを取り消し、アンマウントで残りを取り消す。裸の
`window.setTimeout` にハンドルを持たせず放置しない — アンマウント後に発火して
存在しないツリーへ setState する。

### 音はシェルの持ち物、静けさはゲームの責任

`services/sound.ts` の AudioContext はプロセス共有のシングルトンで、ゲームが
close することはない。代わりにシェルがゲーム退出時に `releaseSound()` を呼び
(`app/App.tsx` の `exitGame`)、30 秒のアイドルタイマーを待たずに即座に suspend
する。サービス自身が import 時に張る visibilitychange リスナーはシェル常駐であり、
ゲームの解放義務の対象外。

### CPU 探索(ソルバー・ヒント・CPU 対戦)

- 探索は**明示的な操作(タップ)のときだけ**走らせる。ポーリングも先読みもしない。
- 探索には**上限**を付ける。手本は water-sort のノード上限付きソルバー
  (`games/water-sort/game/solver.ts`、docs/WATER_SORT_RULES.md §5・§8):上限に
  達したら「見つからなかった」と正直に返す。
- **CPU 対戦 2 本(Reversi / Connect Four)がこの形の実例である。**
  - 探索はプレイヤーの着手を起点にしてのみ走る。CPU の手番は 1 本のタイマー
    (`CPU_DELAY_MS` = 450ms)として `state/GameContext.tsx` の effect が張り、
    **セッション自体を依存に取る** — アンマウント・Undo・新規対局・画面遷移の
    どれでも cleanup がタイマーを外す。着地したタイマーも「いま本当に CPU の
    手番か」を ref で確かめてから打つので、取り残しは無害に落ちる。
  - ノード上限は**実測で 450ms の間に収まる値**にしてある(Reversi 12,000 /
    Connect Four 30,000)。上限に達したら完了済みの深さの最善で打つ。
  - 探索は同期で走りきる(Worker は使わない)。上限がこの短さである以上、
    低スペック端末でもフレームを落とさない範囲に収まり、Worker を足せば
    アンマウント時に止める対象が 1 つ増えるだけである。
- 長時間 CPU を占有する「強い CPU」は作らない(issue #26 非目標)。

## Enforcement

文書だけの契約は守られない。実体はテストにある。

- `src/test/lifecycle.ts` — 計測ハーネス。タイマー・RAF・window/document リスナーの
  登録をスパイでラップし、アンマウント後の生き残りを登録元スタック付きで報告する。
  fake timers は React 自身のスケジューリングと衝突するので使わない。
- `src/test/lifecycle.test.tsx` — レジストリの全ゲームを 1 本ずつ mount →
  settle → unmount して検査する掃引。新しいゲームはレジストリに載った時点で
  自動的に対象になる。
- `games/brick-breaker/ui/BrickBreakerRoot.leak.test.tsx` /
  `games/sky-fighter/ui/SkyFighterRoot.leak.test.tsx` — Canvas スタブでゲーム
  ループを実際に走らせ、プレイ中のアンマウントで RAF・リスナー・DEV シームが
  消えることを検査する(jsdom の canvas は 2D コンテキストを返さないため、
  掃引テストではループが始まらない)。

module レベルで一度だけ登録されるもの(sound の visibilitychange、Capacitor の
web shim)は「シェルの寿命」であり、テストは計測前に一度ウォームアップ mount を
してこれらを除外している。**ゲーム側に**同種の module レベル登録を作らないこと —
ウォームアップに紛れて検査をすり抜け、実機ではアンマウント後も残り続ける。

## 新しいゲームを足すときのチェックリスト

1. ループ・演出・時計を持つなら、cleanup で必ず対にする(このファイル冒頭の一覧)。
2. 一時 UI のタイマーは `useTransientTimeout`。
3. `pnpm test` — lifecycle 掃引が新ゲームを自動で検査する。
4. Canvas ループを持つゲームは、arcade 2 本に倣った `*.leak.test.tsx` を 1 本足す。
5. CPU の手番を持つゲームは、タイマーをセッション依存の effect にする
   (上記「CPU 探索」)。`setTimeout` を着手ハンドラの中から直接張ると、
   Undo や退出で取り消す相手を見失う。
