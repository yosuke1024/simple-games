# Yacht / Mancala / Dominoes / Hit & Blow / Dots and Boxes — Web 先行公開 5 本の実装計画 (2026-09-27)

issue #197 の 5 本を、**Web 版の先行公開(ベータ)チャンネル**として実装する
([WEB_VERSION.md](../WEB_VERSION.md)「先行公開(ベータ)」。前例は issue #194 の 3 本 —
[2026-09-26-crown-grid-number-path-shape-regions.md](2026-09-26-crown-grid-number-path-shape-regions.md))。
アプリ(Android / iOS)には**正式収録しない**。コードは同じバンドルに入るが、シェルの
実行時ガード(`app/gameChannel.ts`)が native では 5 本を隠す。正式収録は
[RELEASE_CHECKLIST.md §0](../RELEASE_CHECKLIST.md) の基準を満たしてから人間が判断する。

**この文書は着手時点の実装計画である。**仕様の正本は各ルール文書
(`docs/YACHT_RULES.md` / `docs/MANCALA_RULES.md` / `docs/DOMINOES_RULES.md` /
`docs/HIT_AND_BLOW_RULES.md` / `docs/DOTS_AND_BOXES_RULES.md`)で、実装と同じ PR で
起こし、以後はそちらが勝つ。issue の狙いは「38 本」ではなく、**遊びの語彙が違う 5 本**
(サイコロ / 種まき / 手札のタイル / 仮説と答え合わせ / 線を引く陣取り)である。
商標名(Yahtzee / Mastermind 等)はアプリ内にもストア文言にも書かない。

## 決定事項

| 項目        | Yacht                     | Mancala                          | Dominoes                   | Hit & Blow                       | Dots and Boxes                   |
| ----------- | ------------------------- | -------------------------------- | -------------------------- | -------------------------------- | -------------------------------- |
| id          | `yacht`                   | `mancala`                        | `dominoes`                 | `hit-and-blow`                   | `dots-and-boxes`                 |
| 保存接頭辞  | `yt.`                     | `mc.`                            | `dm.`                      | `hb.`                            | `db.`                            |
| i18n 接頭辞 | `yacht*`                  | `mancala*`                       | `dominoes*`                | `hitAndBlow*`                    | `dotsAndBoxes*`                  |
| カテゴリ    | `board`                   | `board`                          | `board`                    | `logic`                          | `board`                          |
| グリフ      | `⚄`(U+2684)               | `⊚`(U+229A)                      | `⊟`(U+229F)                | `◉`(U+25C9)                      | `⊡`(U+22A1)                      |
| 対戦        | ひとり(サイコロ)          | CPU(3 段階)                      | CPU(1 段階)                | ひとり(難易度 3 種)              | CPU(1 段階・盤 3 サイズ)         |
| 先攻        | —                         | 選べる(既定は自分。`prefs`)      | 規則で決まる(最大のダブル) | —                                | 常に自分                         |
| 助け        | なし(振り直し 3 回が遊び) | Undo                             | なし                       | なし(推測は無制限)               | Undo                             |
| 保存キー    | saveGame / stats / flags  | saveGame / stats / flags / prefs | saveGame / stats / flags   | saveGame / stats / flags / prefs | saveGame / stats / flags / prefs |
| 統計        | 全体 1 組                 | 難易度別                         | 全体 1 組                  | 難易度別                         | 盤サイズ別                       |
| チャンネル  | `web-beta`                | `web-beta`                       | `web-beta`                 | `web-beta`                       | `web-beta`                       |

- **接頭辞の空きは確認済み**(既存 33: `sd so ss fc ms ng nm ws sp mm bb sf tm bp ck rv
c4 gm bh qm st nr kk ft tk ht gr mj bu ld cg np sr`)。`scripts/new-game.mjs` が衝突を拒否する。
- **アクセント 5 色は BRAND.md「アクセントを選ぶ手順」で機械選定する**(下の Phase 1)。
- **ストア掲載文・landing のガイド・`PUBLISHED_GAME_IDS` には入れない**(正式収録まで)。
- **デイリーは作らない。** 5 本とも「1 局」の単位が短く、CPU 対戦 4 本は既収録の
  CPU 対戦(Checkers / Reversi / Connect Four / Gomoku / Ludo)と同じく保存スロット 1 つ。
  デイリーが無いので `src/test/savedGameSlots.test.ts` の 2 スロット規則は対象外。
- **共通ゲームフレームワークは作らない**(issue「Do not build a five-game abstraction」)。
  Connect Four の骨格(`game/ state/ storage/ ui/ i18n/`)を各ゲームが自分の形で持つ。

## 共通要件(5 本とも)

- 骨格は **Connect Four を写す**: `game/`(`types.ts` / `engine.ts` / `session.ts` /
  `serialize.ts` / `rng.ts`(コピー)/ `index.ts`、CPU があれば `cpu.ts`)、
  `state/GameContext.tsx`(elapsedRef / bookedRef / finalizedRef、`putSession` の 1 本の
  seam、visibilitychange + pause + backButton の `syncActiveGame` 合流、終局時
  `recordGameCompleted()`)、`state/statsLogic.ts`、`storage/gamePersistence.ts`、
  4 スクリーン(home / tutorial / game / stats)、`ui/components/<Pascal>Board.tsx` と
  `<Pascal>ResultOverlay.tsx`(`ShareAction` はここだけ)、`ui/<id>.css`。
- **CPU の手番は 1 本の timeout**(`CPU_DELAY_MS = 450`)で、探索はその中で走る
  (GAME_LIFECYCLE.md「CPU 探索」)。同点はセッションのシードと手数から決定的に選ぶ
  (`createRng(`${seed}:cpu:${moveCount}`)`)。Undo は振り直しではなく取り消し。
- **時計を出さない。**経過秒は統計にだけ残る(bookedRef 方式)。ストリークは数えない。
  放棄した対局は負けに数えない(`played` には数える)。
- 保存は **fail-closed**: 規則から生まれえない盤面・終局済みの盤面は読み捨てて
  ホームへ戻る(勝手に新しい対局を始めない)。Undo 履歴は保存しない。
- 盤面に翻訳の要る文字を置かない(数字は ASCII、記号はアイコン / SVG)。色だけで状態を
  識別させない。操作対象はボタンで、位置と状態を読み上げる。
- Quick Rules は 3 ステップ・図中心・1 文ずつ。Learn More は出ない(ガイド未公開)。
- 高リスクキーは発生させない(ゲーム文言に無料・オフライン・課金・削除の約束を書かない)。
  ホーム画面には `WebBetaNotice`(シェル所有)を置く。
- 各ゲームは **自分のフォルダと自分のルール文書以外に触れない**
  (registry / gameKeys.test / styles.css / brand / README 等は Phase 1・4 で扱う)。
- 通る門(すべて `pnpm test` の中): gameKeys / importBoundaries / gameI18nWiring /
  homeActionsWiring / shareWiring / refLeading / savedGameSlots / lifecycle /
  modalIsolationWiring / gameBackButtonWiring / tutorialBackWiring /
  shortcutResumeWiring / pointerContractWiring / gameChannel / i18n 全カタログ。
- 性能の門は仕事量(探索ノード数)で、壁時計は出力するだけ。

## 1. Yacht(ひとり・サイコロ)

- **用具(§1)**: サイコロ 5 個、1 手番に最大 3 投、12 手番で 1 ゲーム。
- **手番(§2)**: 最初の 1 投は必ず振る(振るまで採点表は押せない)。1 投目・2 投目のあと、
  サイコロをタップして**キープ**(もう一度で解除)し、キープしていないサイコロだけを
  振り直す。3 投目のあとは振れない。5 個すべてキープしたときは振れない(振るものがない)。
  手番を終えるのは**未使用の採点欄を 1 つ選ぶ**こと(0 点でも可)。選ぶとキープは全解除。
- **採点(§3、Yacht の伝統的な 12 欄。上段ボーナスは置かない)**:
  Ones〜Sixes = その目の合計 / Full House = 3 個 + 2 個(ちょうど)で全部の合計 /
  Four of a Kind = 同じ目が 4 個以上でその 4 個の合計 / Little Straight 1-2-3-4-5 = 30 /
  Big Straight 2-3-4-5-6 = 30 / Choice = 全部の合計 / Yacht = 5 個同じで 50。
  条件を満たさない欄は 0。合計は 12 欄の和(最大 297 — 上段 105 + 28 + 24 + 30 + 30 + 30 + 50)。
- **出目(§4)**: `createRng(`${seed}:roll:${rollIndex}`)` から 5 個ぶんの目を生成し、
  キープしていない位置にだけ当てる(`rollIndex` は投擲ごとに +1。同じシードなら
  同じ出目 — `compatibility.test.ts` で固定)。物理エンジンは使わない。
- **助け(§5)**: Undo も Hint も**作らない**。振った目は情報であり、欄の選択は決断である。
  振り直し 3 回がこのゲームの「助け」の形である。
- **統計(§6)**: `played` / `completed` / `bestScore`(null 可)/ `totalScore`(平均用)/
  `totalPlaySeconds`。結果カードは合計と自己ベストの一言(目標にしない)。
- **保存(§7)**: `yt.saveGame` v1 = seed / rollIndex / dice(5、1..6)/ held(5)/
  rollsUsed(0..3)/ scores(12、int | null)/ elapsedSeconds / savedAt。fail-closed:
  rollsUsed 0 なのに held がある・scores の値が欄の取りうる範囲外・12 欄埋まっている。
- **画面(§8)**: 上からサイコロ列(5 個の大きなボタン。キープは持ち上げ + 枠 + 読み上げ)、
  Roll ボタン(残り投数を併記)、採点表(2 列 × 6 行のボタン。未使用欄は「今の目で入る点」を
  淡く先読みして表示、使用済みは確定点)。合計は常に表示。360×640 でスクロールなしに収める。
  出目のアニメーションは Ludo と同じ 220ms 以内の CSS(`rollIndex` をキーに 1 回)、
  Reduced Motion では出さない。キーボード: 1〜5 でキープ切替、R で振る。
- Quick Rules: ① 振って、残したいサイコロをタップ ② 3 回まで振れる ③ 欄を 1 つ選んで
  手番を終える。12 欄で合計。
- テスト: 各欄の採点(境界: Yacht は Four of a Kind にも入る・Full House は 5 個同じでは
  成立しない)/ キープと振り直し / 欄は 1 回だけ / 3 投上限 / 12 手番で終局と合計 /
  途中保存と復元 / 出目の golden。

## 2. Mancala(Kalah 6 穴 4 石・CPU)

- **盤面(§1)**: 片側 6 穴 × 各 4 石 = 48 石、両端に店(ストア)。`pits[14]`:
  0〜5 = 自分の穴(自分から見て左→右)、6 = 自分の店、7〜12 = CPU の穴、13 = CPU の店。
  向かいの穴は `12 − i`。自分は下側、CPU は上側。先攻はホームで選ぶ(既定は自分、
  `mc.prefs`、進行中の対局には触れない — Connect Four §1 と同文)。
- **一手(§2)**: 自分の穴を 1 つ選び、石を全部取って反時計回りに 1 個ずつまく。
  自分の店には入れ、**相手の店は飛ばす**。周回で元の穴を飛ばす規則(Oware 式)は採らない。
  - **もう 1 手(§2.1)**: 最後の石が自分の店に入ったら、続けてもう 1 手。
  - **捕獲(§2.2)**: 最後の石が自分側の**空だった穴**に入り、向かいの穴に石があれば、
    その石と自分の最後の 1 個を自分の店へ。向かいが空なら捕獲しない。
- **終了(§3)**: 一手のあと、どちらかの側の穴が全部空なら終局。残った側の石は
  その側の店へ。店の多い方が勝ち、24-24 は引き分け。
- **CPU(§4)**: α–β negamax。easy = 1 手読み / normal = 4 手 / hard = 反復深化で最大 8 手、
  `HARD_NODE_LIMIT`(30,000)で完了済みの深さの最善(Connect Four §4 と同型)。
  もう 1 手が出た局面は同じ側が続けて読む。評価 = 店差 × 4 + 自側の石数差。
  同点は seed + moveCount のシャッフルで決定的に。
- **Undo(§5)**: 無料・無制限。自分の直前の決定点まで(CPU の応手の連鎖ごと戻る)。
- **助け(§6)**: Undo だけ。Hint は作らない(完全情報 — Reversi §7 と同じ判断)。
  石のある自分の穴だけ押せる(合法手の可視化)。
- **統計(§7)**: 難易度別 played / wins / losses / draws + totalPlaySeconds。
- **保存(§8)**: `mc.saveGame` v1 = seed / difficulty / first / pits(14)/ toMove
  (もう 1 手があるので手番は導出できない — 保存する)/ moveCount / elapsedSeconds /
  savedAt。fail-closed: 負数・合計 ≠ 48・終局済み。
- **画面(§9)**: 店 | 6 穴 | 店 の横並び。各穴に数字(ASCII)と 12 個までの点で石を描く。
  直前の一手でまかれた穴に短い強調(moveCount キー、Reduced Motion では出さない)。
  石を 1 個ずつ飛ばすアニメーションは作らない(低スペックの床)。手番行は 1 行固定。
  キーボード: 1〜6 で穴、Ctrl+Z で Undo。
- Quick Rules: ① 自分の穴をタップして反時計回りにまく ② 最後の 1 個が自分の店なら
  もう 1 手 ③ 最後の 1 個が自分側の空の穴なら向かいの石をもらう。
- テスト: 周回のまき / 相手の店を飛ばす / もう 1 手 / 捕獲(向かいが空なら不成立)/
  片側が空で終局と回収 / 勝敗と引き分け / CPU が常に合法手を返す(全難易度・ノード上限)/
  Undo で CPU の連鎖ごと戻る / 保存と復元 / CPU 応手の golden。

## 3. Dominoes(Draw Dominoes・CPU)

- **用具(§1)**: ダブル 6 の 28 枚(`[a, b]`、a ≤ b で正規化)。seed でシャッフルし、
  7 枚ずつ配り、残り 14 枚が山(ボーンヤード)。CPU の手札は枚数だけ見える。
- **開始(§2)**: 両手札のうち**最大のダブル**を持つ側がそれを出して開始。ダブルが無ければ
  最も重い牌(目の合計、同点なら大きい目)。開始牌はセッション生成時に自動で置かれ、
  相手の手番から遊びが始まる(規則で先攻が決まり、`prefs` は持たない)。
- **一手(§3)**: 列の**どちらかの端**に、端の目と同じ目を持つ牌を置く。向きは自動。
  両端に置けて端の目が違うときだけ、置く端を選ぶ(端がボタンになる。同じ牌をもう一度
  タップで取り消し)。両端の目が同じなら右端に置く。
  - **出せる牌があれば出さねばならない**(Draw は無効)。無ければ山から 1 枚引く
    (1 タップ 1 枚。出せるまで繰り返す)。山が空で出せなければパス。
  - CPU は 1 手番を 450ms ごとの 1 動作(引く / 出す / パス)で進める。
- **終了(§4)**: 手札を出し切った側の勝ち。得点 = 相手の残り牌の目の合計。
  両者が連続してパス(山が空)したら手詰まり: 残りの目の合計が少ない側の勝ち、
  得点は差。同数なら引き分け。**1 局 = 1 ゲーム**(100 点マッチは作らない — §意図的な差分)。
- **CPU(§5)**: 1 段階。合法手のうち「目の合計 + ダブルなら 3」が最大の牌。同点は
  seed + moveCount で決定的に。難易度は作らない(弱い CPU = 乱数はつまらない)。
- **助け(§6)**: Undo も Hint も作らない。引いた牌は情報であり、戻せば山を覗くことになる。
- **統計(§7)**: played / wins / losses / draws / totalPlaySeconds。
- **保存(§8)**: `dm.saveGame` v1 = seed / line(置かれた向きで `[l, r]` の列)/
  playerHand / cpuHand / boneyard(順序つき)/ toMove / passes(連続パス数 0..2)/
  moveCount / elapsedSeconds / savedAt。fail-closed: 28 枚が過不足なく 1 回ずつ現れない・
  列の隣接が一致しない・終局済み。
- **画面(§9)**: 列は `flex-wrap` で折り返す(スクロールしない)。牌は横向き(2 マス)、
  **ダブルは縦向き**に描いて区別する。目は Ludo の目と同じ 3×3 の点。両端に「端」の
  印と目。自分の手札は下に折り返し並び(出せる牌だけ有効)、山の残り枚数と Draw / Pass
  ボタン。CPU の手札は裏向きの枚数。
- Quick Rules: ① 端の目と同じ目の牌をつなぐ ② 出せなければ山から引く ③ 先に出し切ったら
  勝ち。相手の残りの目が得点。
- テスト: 28 枚の一意性 / 配札 / 合法・非合法の配置 / 両端 / ダブル / 引く・パスの規則 /
  手詰まりの解決 / 得点 / CPU が常に合法 / 長い列の折り返し(DOM に横スクロールが無い)/
  保存と復元 / 配札と CPU の golden。

## 4. Hit & Blow(ひとり・推理)

- **用具(§1)**: 記号 8 種(丸・三角・四角・ひし形・星・十字・六角・ハート)。それぞれ
  **形 + 色**で区別し、読み上げ名は i18n(色だけに頼らない)。記号はインライン SVG。
- **難易度(§2)**: easy = 4 マス / 6 種、normal = 4 マス / 8 種、hard = 5 マス / 8 種。
  **秘密の答えにも推測にも同じ記号は入らない**(明示の方針。テストで固定)。
- **答え(§3)**: seed から記号の候補をシャッフルして先頭 N 個。保存には書かず導出する。
- **推測(§4)**: 下のパレットから記号をタップして空きマスに順に入れる。埋まったマスを
  タップすると空く。すでに入れた記号はパレットで無効。全部埋まったら Check。
  キーボード: 1〜8 で記号、Backspace で最後を消す、Enter で Check。
- **判定(§5)**: Hit = 記号も位置も一致、Blow = 記号は入っているが位置が違う。判定関数は
  重複があっても正しい multiset 方式で書き、重複入りの入力もテストする(UI は作らない)。
  履歴は 1 行 = 推測 + ペグ(塗り = Hit、白抜き = Blow)+ 読み上げ文。
- **終了(§6)**: Hit = N で勝ち。**推測回数の上限は置かない**(ゲームオーバーなし)。
  スコアは推測回数(少ないほど良い)。
- **助け(§7)**: Undo も Hint も作らない。推測は情報であり、消せば推理が壊れる。
  履歴が常に見えていることがこのゲームの助けである。
- **統計(§8)**: 難易度別 played / solved / bestGuesses(null 可)/ totalGuesses +
  totalPlaySeconds。
- **保存(§9)**: `hb.saveGame` v1 = seed / difficulty / guesses(記号 index の列の列)/
  elapsedSeconds / savedAt。fail-closed: 長さ ≠ N・重複・範囲外・最後の推測が答え
  (終局済み)。`hb.prefs` は最後に選んだ難易度。
- **画面(§10)**: 履歴が上(新しい行が下に増え、自動でスクロール)、入力行とパレットが
  下に固定。記号の色は `hit-and-blow.css` に 8 色(ライト / ダーク)を持ち、
  `contrast.test.ts` で地色に対して 3:1 以上を固定する(Crown Grid と同型)。
- Quick Rules: ① 隠れた並びを当てる ② 記号を並べて Check ③ ●は位置も合う、○は
  記号だけ合う。何回でも。
- テスト: 答えの生成(重複なし・範囲内・決定的)/ 重複方針 / Hit・Blow の計算(重複入り)/
  勝利判定 / 推測の検証 / 保存と復元 / golden。

## 5. Dots and Boxes(CPU)

- **盤面(§1)**: 箱 3×3(小)/ 4×4(中)/ 5×5(大)。点は (N+1)²。辺は横 (N+1)×N 本と
  縦 N×(N+1) 本。`edges` は 1 辺 1 文字('0' / '1')、`boxes` は 1 箱 1 文字
  ('.' / 'p' / 'c')。先攻は常に自分。
- **一手(§2)**: 未使用の辺をタップして引く。4 辺そろった箱はその手番の側のもの。
  **箱ができたら続けてもう 1 手**(できなければ手番交代)。1 本で 2 箱できることもある。
- **終了(§3)**: 全部の辺が引かれたら終局。箱の多い方が勝ち(4×4 は引き分けあり)。
- **CPU(§4)**: 1 段階。(1) 箱を完成できる辺があれば引く(2 箱できる辺を優先)
  (2) なければ 3 辺目にならない「安全な」辺 (3) それも無ければ、各候補について相手の
  貪欲な回収(完成できる辺を取り続ける)を模擬し、渡す箱が最少の辺。同点は seed +
  moveCount で決定的に。探索木は持たない(5×5 で 60 辺、模擬は O(E²))。
  CPU の連続手は 450ms ごとに 1 辺ずつ見える。
- **Undo(§5)**: 無料・無制限。自分の直前の決定点まで(CPU の連続手ごと戻る)。
- **助け(§6)**: Undo だけ。Hint は作らない(完全情報)。
- **統計(§7)**: 盤サイズ別 played / wins / losses / draws + totalPlaySeconds。
- **保存(§8)**: `db.saveGame` v1 = size / seed / edges / boxes / toMove / moveCount /
  elapsedSeconds / savedAt。fail-closed: 4 辺そろった箱に持ち主が無い・そろっていない箱に
  持ち主がある・箱数と辺数が矛盾・終局済み。`db.prefs` は最後に選んだ盤サイズ。
- **画面(§9)**: CSS grid(点のトラックと辺のトラックを交互に)。辺はボタンで、当たり判定は
  トラック幅いっぱい。引いた辺は持ち主の色(自分 = アクセント、CPU = ゲーム内容の第 2 色)、
  箱には持ち主の印(自分 = ●、CPU = ✕ の SVG)を置いて色だけに頼らない。
  ドラッグでの線引きは作らない(タップで十分正確、pointer 契約の負担だけ増える)。
  キーボード: Tab / Enter、Ctrl+Z。
- Quick Rules: ① 点と点の間をタップして線を引く ② 4 辺そろえた箱は自分のもの、
  もう 1 手 ③ 線が全部引けたら箱の多い方が勝ち。
- テスト: 辺は 1 回だけ / 箱の完成 / 1 本で 2 箱 / 完成後のもう 1 手 / それ以外は交代 /
  最終スコアと勝敗 / CPU が常に合法(3 サイズ)/ Undo / 保存と復元 / golden。

## フェーズ

1. **Phase 1 — 接続点**: `scripts/new-game.mjs` で 5 本をスキャフォールド(済。
   併せてスクリプトが `loadStorageSchemas` を出すよう直した — Backup & Restore の必須
   フィールド)、registry に `channel: 'web-beta'`、`gameChannel.test.ts` /
   `landing.test.ts` のベータ一覧、アクセント 5 色を styles.css / `titleAccents` /
   title-accent.md に登録、css-split.md / storage-keys.md の一覧を更新。
2. **Phase 2 — 5 本の本実装(並行)**: 各ゲームはルール文書 → `game/`(テスト込み)→
   `storage/` → `state/` → `ui/` → i18n(en / ja)の順。ゲームフォルダと自分のルール
   文書以外には触れない。
3. **Phase 3 — 翻訳**: 残り 12 言語(機械翻訳・未承認。高リスクキーは作らない)。
4. **Phase 4 — 検証と文書**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
pnpm --filter simple-games build:web && pnpm --filter simple-games size:check`、
   `bash .github/scripts/check-principles.sh`、`pnpm size:update`、ブラウザ試遊
   (ライト / ダーク、タッチ / マウス / キーボード)、WEB_VERSION.md「実装状況」・
   PROJECT_CONTEXT.md・README.md「Web 先行公開」・I18N_POLICY.md のキー数。

### Phase 1 の実施結果(2026-09-27)

BRAND.md「アクセントを選ぶ手順」を出荷済み 33 色 + `--warn` に対して実行した(CIE76、
スクリプトは選定時の作業ディレクトリに置き、リポジトリには入れていない)。既存の最接近
ペアはライト 10.88(Sudoku × Schulte Table)/ ダーク 7.91(Nonogram × Sky Fighter)で
変わらず、床は 1.15 倍の 12.5 / 9.1。中央値帯(ライト S44 / L37、ダーク S44 / L65)に
寄せ、白インク 4.5:1・ダーク紙 4.5:1・紙 3:1 を満たす候補から、5 本の相互距離 ΔE 30
以上を条件に最大クリークで選んだ。

**33 色の時点で、5 本を別々の色相族に置きながら相互 30 を保つことはできない**
(赤・金の帯へ入るか、彩度の外れ値 S67% を超えるかのどちらか。厳密な最大クリーク探索で
確認)。5-クリークはどれも「緑 1 + 青 2 + マゼンタ 2」の形で、BRAND.md が 20 本超で
書いているとおり、族の中では深さと彩度で離した。Dominoes(くすんだ側)と Hit & Blow
(鮮やかな側)は色相 3° の対で、盤面の棚の隣人(Reversi / Gomoku)から遠い側を
Dominoes に当てている — Hit & Blow の 8 色記号との衝突は数値化できないので、
実測できる棚の距離を優先した判断。

| ゲーム         | 色         | ライト    | ダーク    | 最接近(ライト / ダーク)              | 白文字 / 紙  |
| -------------- | ---------- | --------- | --------- | ------------------------------------ | ------------ |
| Yacht          | アズール   | `#3879ae` | `#aebfcd` | Number Match 13.9 / Minesweeper 11.5 | 4.65 / 4.09  |
| Mancala        | 苔色       | `#55592f` | `#a6ac77` | Crown Grid 15.2 / Solitaire 13.1     | 7.35 / 6.46  |
| Dominoes       | モーブ     | `#533653` | `#d55cd5` | Block Puzzle 21.3 / Gin Rummy 12.4   | 10.39 / 9.13 |
| Hit & Blow     | フューシャ | `#7c2177` | `#dd9eda` | Gin Rummy 16.0 / Reversi 11.9        | 8.97 / 7.88  |
| Dots and Boxes | 群青       | `#3855ca` | `#6f84da` | Hearts 15.6 / Mahjong Solitaire 10.6 | 6.32 / 5.56  |

5 色の相互距離はライト 34.9〜95.7・ダーク 34.4〜100.3。棚の隣人との最小は Mancala ×
Checkers 17.4 / 16.1、Dominoes × Ludo(ダーク)14.0 で、いずれも慣例の 15 / 11 を超える。
Yacht の紙の上 4.09 は 4.5 に届かない(Bunny Hop 等 4 色と同じ扱い。BRAND.md「コントラスト」)。
soft / onDark は既存の回帰(softLight = S×0.97 / L90%、softDark = S×0.71 / L18%、
onDark = L8%)で出し、Crown Grid の出荷値を誤差 0 で再現することを確かめてから当てた。
