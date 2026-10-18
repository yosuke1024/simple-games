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

アンマウントで走らせる同期には `src/ui/useOnUnmount.ts` を使う(下の
「アンマウントで計上する」)。

## アンマウントで計上する(プレイ時間)

リソースを残さないことと対になる約束: **アンマウントされたゲームは、最後の同期以降に
遊ばれた秒を落とさない。**

- **ゲームが聞かない扉がある。** ゲームが画面から外れるのは、ゲーム自身の戻る・ホーム
  (`goHome` / `exitToCollection`)だけではない。Web 版のブラウザの戻る・進む
  (`app/App.tsx` の `popstate`、`app/webRoute.ts`)と、Android / iOS で別のゲームへの
  ホーム画面ショートカット(`appUrlOpen`)では、シェルが view を替えるだけで Root は
  そのままアンマウントされ、visibilitychange も来ない。2026-10-18 まで、アーケード 4 本
  以外はこの経路で最後の同期以降の秒を盤面の時計からも `totalPlaySeconds` からも
  失っていた(Web 版のレビューで複数のゲームについて観察された)。
- **決定: シェルの hook ではなく、ゲームが自分のアンマウントで計上する。** シェルは
  ゲームの state に踏み込まない(`PROJECT_CONTEXT.md` §8)ので、シェル側に置けるのは
  「ゲームに同期を頼む」新しい契約(Root の props やレジストリへの登録)だけになる。
  それはシェルが知っている扉しか覆えず、扉が増えるたびに配線が要る。React の
  アンマウントはどの扉でも必ず起きる(エラー境界の作り直しも含む)ので、ゲームは
  そこで、自分の退出とバックグラウンドで既に走らせている同期をもう一度走らせるだけでよい。
- **形は 1 行。** provider のバックグラウンドの effect の直後に
  `useOnUnmount(syncActiveGame);`。ラウンドを保存しない Number Recall(§12)と
  Schulte Table(§11)は離脱と同じ `useOnUnmount(abandonActiveRound);`。
  `useOnUnmount` は最新の関数を ref に持ち、cleanup をアンマウントだけに結びつける。
  `useEffect(() => () => sync(), [sync])` と書かないのは、sync の identity が変わる
  たびにプレイ中にも cleanup が走るからで、state を書いてその state に依存する sync なら
  書く → 再描画 → また書く、のループになる。
- **二重計上しない。** 同期は冪等である: `bookedRef` との差(まだ計上していない秒)
  だけを足し、足した分だけ `bookedRef` を進める。だから自分の退出やバックグラウンドの
  直後に来たアンマウントは何も足さない。アンマウントの同期は盤面も(時計ごと)保存し、
  次のマウントは `elapsedRef` と `bookedRef` を同じ `elapsedSeconds` で積む
  (docs/ARCHITECTURE.md「状態と ref」、`src/test/playClockSeed.test.ts`)ので、同じ秒を
  もう一度数えない。保存は fire-and-forget だが `storage/repo.ts` がキーごとに直列化する
  ので、すぐ戻ってきた次のマウントの読み込みはこの保存の後ろに並ぶ。
- **計上の経路を増やさない。** 足すのは既存の同期の「呼び出し」だけで、アンマウント
  専用の計上を書かない — 2 本目の経路は 2 度目の計上の入口になる。
- Number Match は統計への計上が終局時の 1 回だけ(盤面の `elapsedSeconds` から)なので、
  アンマウントで守るのは盤面の時計である。
- アーケード 4 本(Brick Breaker / Sky Fighter / Bubble Pop / Bunny Hop)はランを盤面
  コンポーネントの ref に持ち、ループの effect の cleanup で `flushSeconds()` を呼ぶ。
  以前からこの形で、変えていない。
- 門: `src/test/unmountBookingWiring.test.ts`(provider ごとに `useOnUnmount(<退出の同期>)`
  がちょうど 1 回、無ければ盤面の cleanup の `flushSeconds()`)。挙動は各ゲームの Root
  テストが「N 秒遊ぶ → アンマウント → 統計が N 増える → 再マウントしても増えない」で見る。
  変換は `scripts/codemods/2026-10-18-book-play-seconds-on-unmount.mjs`。
- **テストの `cleanup()` もアンマウントである。** 遊んでいる最中の盤面を残したまま
  `cleanup()` すれば、いまは盤面と統計の保存が起きる。保存は fire-and-forget なので、
  store を消す `afterEach` は `cleanup()` の後に `await act(async () => undefined);` で
  保存を着地させてから消す(消してから着地すると、次のテストは遊んでいない盤面の上に
  起動する)。「プロセスが死ぬ」を `cleanup()` で表しているテストは、死の前に何が保存
  されていたかを `cleanup()` より前に読む — 本物のプロセス死はアンマウントを通らない。

### 音はシェルの持ち物、静けさはゲームの責任

`services/sound.ts` の AudioContext はプロセス共有のシングルトンで、ゲームが
close することはない。代わりにシェルがゲーム退出時に `releaseSound()` を呼び
(`app/App.tsx` の `exitGame`)、30 秒のアイドルタイマーを待たずに即座に suspend
する。サービス自身が import 時に張る visibilitychange リスナーはシェル常駐であり、
ゲームの解放義務の対象外。

### CPU 探索(ソルバー・ヒント・CPU 対戦)

- 探索は**明示的な操作(タップ)のときだけ**走らせる。ポーリングも先読みもしない。
  - 例外は 1 つで、それも「タップの代わり」ではなく「タップの続き」である:
    ホーム画面ショートカットが CPU の手番で中断した対局を盤面へ直接復元した
    とき(issue #113)、その launch には着手が無いまま `CPU_DELAY_MS` 後に
    1 手ぶんの探索が走る。**ホームの Resume を押した場合と同じ 1 本のタイマー・
    同じノード上限**であり(押した側にも同じ 450ms 後の探索がある)、
    アンマウントで cleanup されるのも同じ。増えたのは「そのタップが前回の
    セッションで行われている」ことだけである。
- 探索には**上限**を付ける。手本は water-sort のノード上限付きソルバー
  (`games/water-sort/game/solver.ts`、docs/WATER_SORT_RULES.md §5・§8):上限に
  達したら「見つからなかった」と正直に返す。
- **盤面 4 本(Reversi / Connect Four / Checkers / Gomoku)がこの形の実例である。**
  - 探索はプレイヤーの着手を起点にしてのみ走る。CPU の手番は 1 本のタイマー
    (`CPU_DELAY_MS` = 450ms)として `state/GameContext.tsx` の effect が張り、
    **セッション自体を依存に取る** — アンマウント・Undo・新規対局・画面遷移の
    どれでも cleanup がタイマーを外す。着地したタイマーも「いま本当に CPU の
    手番か」を ref で確かめてから打つので、取り残しは無害に落ちる。
  - ノード上限は**実測で 450ms の間に収まる値**にしてある(Reversi 12,000 /
    Connect Four 30,000 / Checkers 26,000 / Gomoku 8,000)。上限に達したら
    完了済みの深さの最善で打つ。
  - 探索は同期で走りきる(Worker は使わない)。上限がこの短さである以上、
    低スペック端末でもフレームを落とさない範囲に収まり、Worker を足せば
    アンマウント時に止める対象が 1 つ増えるだけである。
- **手番が連なるゲームでも、張るタイマーは 1 本のままにする。**カード 2 本
  (Hearts / Gin Rummy)がこの形の実例で、こちらは探索を持たず(不完全情報のため
  ヒューリスティックで打つ)、代わりに**1 手が 1 応手で終わらない**。
  - Hearts はあなたが 1 枚出すと、残り 3 席の応手とトリックの回収で最大 4 拍が
    450ms 刻みで続き、次のリードが CPU ならそのまま連なる。Gin Rummy は
    CPU のドローと捨てで 2 拍。**拍ごとに effect が張り直されるだけ**で、
    上の規律(effect 1 本・セッション依存・着地時の ref 再確認・ポーリングも
    先読みもしない)はそのまま使う。ループも待ち合わせも書かない。
  - **拍の順序は 1 箇所で定義する**(Hearts の `beatOwed()`)。張るときと着地時の
    再確認が同じ関数を読むので、両者がずれようがない。
  - **次のハンドの配りだけは自動で踏まない。**清算を読む時間はプレイヤーのもので
    あり、そこは拍ではなくタップで進む。
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
- `src/test/unmountBookingWiring.test.ts` — 全 provider がアンマウントでも退出の同期を
  走らせること(「アンマウントで計上する」)。
- ループを dev シーム(`__buFrame` 等)から手で回すテストは、`lifecycle.ts` の
  `stubAnimationFrames()` で jsdom の実 RAF を止めてから盤面を mount する。
  実フレームと手回しが同じ `lastTime` を共有すると dt が負になり、飛翔が巻き戻る
  (issue #158)。leak テストには使わない — `trackResources` は実際に発火した
  フレームで「全部 cancel されたか」に答える。

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
6. プレイ時計を持つなら、退出の同期を `useOnUnmount` にも渡す(上記「アンマウントで
   計上する」)。`scripts/new-game.mjs` の雛形は最初から渡している。
