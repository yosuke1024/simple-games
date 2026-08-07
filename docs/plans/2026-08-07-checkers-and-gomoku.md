# Checkers と Gomoku — ボードゲーム2本の本実装計画 (2026-08-07)

CPU 対局の柱を 2 本(Reversi / Connect Four)から 4 本へ広げる。Checkers と Gomoku は
どちらも「名前で探される」定番のクラシックで、ルールはパブリックドメイン、対局は
端末内で完結し、コンテンツサーバーも絵素材も必要としない
([CONTRIBUTING.md](../../CONTRIBUTING.md) の収録条件)。盤面は DOM + CSS で描く
(Reversi / Connect Four と同じ)。

検討の経緯: テトリス型の落ちゲーは見送った。技術は既存のゲームループ資産で足りるが、
The Tetris Company はテトロミノ + 井戸という「見た目と手触り」の総体を著作権として
守っており(Tetris Holding v. Xio Interactive, 2012 — 名前を変えたクローンが敗訴)、
実名・ソース公開のこのプロダクトと権利グレーは最悪の相性であるため。
「Othello」を使わず Reversi と呼ぶ判断と同じ物差しである。

**この文書は着手前の実装計画である。**実装は未着手。仕様の正本は実装時に
`docs/CHECKERS_RULES.md` / `docs/GOMOKU_RULES.md` として起こし、以後はそちらが勝つ。
脳トレ 3 本(Quick Math / Schulte Table / Number Recall — 別ブランチ・進行中)とは
独立で、どちらが先に main へ入っても成立する — 収録本数の文言はマージ時点の実数に
合わせ(Phase 4)、アクセント色はマージ直前に再測定する(Phase 1)。

## 決定事項(ユーザー承認済み)

| 項目     | 決定                                                                    |
| -------- | ----------------------------------------------------------------------- |
| 収録     | Checkers と Gomoku の**両方**                                           |
| タイトル | `Checkers`(id: `checkers`) / `Gomoku`(id: `gomoku`)                     |
| 型       | Reversi / Connect Four と同じ **CPU 対局型**(難易度 3 種・デイリーなし) |

## 提案(実装はこの既定で進める。変える場合は本文書を更新してから)

| 項目          | 提案                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Checkers 規則 | **英式(アメリカン・チェッカー)8×8**: 強制捕獲・連続捕獲・キング昇格(飛びキングなし)。国際式 10×10 は採らない(下記)                                                                                                             |
| Gomoku 規則   | **freestyle 15×15**: 5 つ**以上**並べば勝ち(長連も勝ち)、連珠の禁手なし(下記)                                                                                                                                                  |
| 助けの形      | 両方とも **Undo のみ・Hint なし**(盤面が完全に見えている — Reversi §7 / Connect Four §6 と同じ理屈)。Checkers は**合法手の表示**を持つ(下記)                                                                                   |
| 先後の選択    | Checkers は Connect Four 型(先攻 / 後攻を選ぶ・既定は先攻)、Gomoku は Reversi 型(黒(先攻) / 白(後攻)を選ぶ・既定は黒)                                                                                                          |
| 保存接頭辞    | Checkers `ck.`(4 キー) / Gomoku `gm.`(4 キー)。`c4` `qm` `st` `nr` は使用済み                                                                                                                                                  |
| i18n 接頭辞   | `checkers*` + `checkersName` / `gomoku*` + `gomokuName`(重複は i18n テストが機械検証)                                                                                                                                          |
| グリフ        | Checkers `◉` / Gomoku `⁙`(FIVE DOT PUNCTUATION)。`⁙` は Connect Four の `⁘`(FOUR DOT)と「N 目並べ」の家族を作る — カード 3 本のスート前例                                                                                      |
| 並び順        | ボード対局の束を **Checkers → Reversi → Connect Four → Gomoku** に(Checkers は 4 本中で最も名前検索が強いので束の先頭)。位置は現行の Reversi / Connect Four の場所。脳トレ 3 本のマージで絶対位置はずれてよい — 正本は束の順序 |
| アクセント色  | **この計画では色を先取りしない。**Phase 1 で BRAND.md「アクセントを選ぶ手順」を最初から実行する(FreeCell の前例: 目で選んだ当初案は実測で覆った)                                                                               |

## 前提(調査済み)

**Reversi / Connect Four が型と作法の正本。**両ゲームとも同じ骨格
(`game/ state/ storage/ ui/ i18n/`)で作る。2 本には計画文書がない(PR #45)ので、
正本は実装と `docs/REVERSI_RULES.md` / `docs/CONNECT_FOUR_RULES.md` である。
踏襲する設計は:

- **盤面は行優先の整数配列**(0 = 空、1 = プレイヤー側、2 = CPU 側)。シリアライズは
  1 セル 1 文字の文字列(`game/serialize.ts`)、デコードは fail-closed —
  「プレイから生まれえない盤面」は破棄してホームへ戻る(勝手に新規対局を始めない)。
- **CPU 探索はプレイヤーの着手(タップ)起点でのみ**走る。ポーリングも先読みもしない
  ([GAME_LIFECYCLE.md](../GAME_LIFECYCLE.md)「CPU 探索」)。CPU の着手は
  `CPU_DELAY_MS`(450ms)置いて現れ、タイマーは `state/GameContext.tsx` の effect が
  セッション依存で張る(アンマウント・Undo・新規対局で cleanup)。
- **難易度 3 種**(easy / normal / hard)。hard は反復深化 α–β + **ノード上限**
  (Reversi 12,000 / Connect Four 30,000 — どちらも「450ms の間に収まる最大」を実測で
  決めた)。上限に達したら完了済みの深さの最善で打つ。depth 1 は必ず完了するので
  hard が normal より弱くなることはない。探索は盤面を作り直さず 1 つの `Int8Array` へ
  make / unmake(ルール自体は engine.ts の 1 セットだけで、速いコピーを持たない)。
- **同点タイブレークはシード決定的**: `createRng(`${seed}:cpu:${moveCount}`)`。
  同じシードで同じ手順なら CPU は同じ手を返す — Undo が振り直しでなく待ったになる
  ための土台で、ゴールデンテスト(`game/compatibility.test.ts`)が固定する。
  `rng.ts`(xmur3 + mulberry32 + Fisher–Yates)は**ゲームごとにコピーが正**。
- **Undo は自分の直前の決定点まで** — CPU の応手と自分の一手をまとめて戻す。無制限・
  無料。CPU の手番の途中には戻さない。
- **統計は難易度ごとに** played / wins / losses / draws、全体で totalPlaySeconds。
  スコアという数は作らない。放棄は負けに数えない。プレイ時間は bookedRef 方式の
  逐次計上(可視時のみ加算。Root テストに背景化パターンを複製する)。
- **途中保存 1 スロット**(ターン制なので保存 = 保存した瞬間の盤面)。Undo 履歴は
  保存しない。終局済みの保存は破棄。先後・色の選択は**次の対局に適用**され、対局中の
  ゲームには触らない(確認ダイアログ `*ConfirmSwitch*` の同型を持つ)。
- **時計を出さない**。盤面に文字を置かない(全言語で同じに読める)。最後に動いた駒に
  小さな印(CPU の手を見失わないため)。粒子も画面揺れもない。Reduced Motion で
  アニメーション全停止。効果音は既存の合成音のみ。ローカル対人戦・オンライン対戦は
  作らない(PRODUCT_PRINCIPLES「初期リリースで実装しないもの」)。

**ゲーム追加の接続点は調査済み**(2026-08-06 / 08-07 の追加コミットが実物)。ゲーム
フォルダを作ればチャンク・lifecycle 掃除・i18n ゲート・境界ゲート・サイズ計測は
自動編入。手で触るのは: `app/registry.ts`(union + keys import + 1 要素)/
`app/gameKeys.test.ts`(RELEASED_KEYS + PREFIXES の行追加)/ `ui/styles.css`
(アクセント 2 ブロック × 2 ゲーム)/ `packages/brand` の `titleAccents` /
`size-baseline.json`(`pnpm size:update`)/ `ui/landing.ts` は**触らず**
`landing.test.ts` の「ガイド未公開」配列に 2 id を足す(ガイド公開後に
`PUBLISHED_GAME_IDS` へ入れるのは別リリース)/ 文書類(Phase 4)。

**並行ブランチとの衝突面は確認済み**(2026-08-07 時点の
`claude/brain-training-learning-games-ya72vz`): 保存接頭辞 `qm.` `st.` `nr.`、
グリフ `÷` `⌖` `?`、アクセントはオリーブ `#776e18` / ティール `#18787b` /
グリーン `#1d6b33`(ライト)。`ck.` `gm.` `◉` `⁙` はどちらの世界でも空いている。

## ゲーム仕様の要点(ルール文書の骨子)

ルール文書は 2 本とも Reversi / Connect Four の章立てで書く(盤面と対局者 / 一手の
解決 / 終了条件 / CPU / Undo / 助けの形 / スコアと統計 / 中断と再開 / Quick Rules /
演出とアクセシビリティ / 意図的な差分)。以下は各章に入る決定。

### Checkers

- **盤面(§1)**: 8×8 の 64 セル、行優先配列。駒は 0 = 空、1 = プレイヤーの兵、
  2 = CPU の兵、3 = プレイヤーのキング、4 = CPU のキング。使うのは**暗色マスの 32 だけ**
  — 右下 `(7,7)` を明色とする慣習に合わせ、暗色 ⇔ `(row + col) % 2 === 1`。
  初期配置は各 12 兵(CPU が行 0–2、プレイヤーが行 5–7 の暗色マス)。プレイヤーは
  常に下側。**先攻・後攻はプレイヤーが選ぶ**(ホーム画面。既定は先攻。Connect Four
  §1 と同文 — 選択は次の対局に適用)。駒の色は役割で固定: プレイヤー = タイトルの
  アクセント色、CPU = 第 2 色(Connect Four のディスクと同じ立場)。
- **一手の解決(§2)**: 兵は斜め前 1 マス(プレイヤーは上へ、CPU は下へ)。捕獲は
  斜めに隣接する敵駒を跳び越え、直後の空きマスへ着地(兵は前方 2 方向、キングは
  4 方向)。**捕獲できる手があるとき、捕獲以外の手は非合法**(強制捕獲)。複数の
  捕獲からどれを選ぶかは自由 — 最大取り義務は課さない(それは国際式の規則。§11)。
  着地した駒がさらに跳べるときは**同じ駒で続けて捕獲する**(義務)。跳びの途中で
  最奥段に達したら昇格して**その手番は終わる**(英式)。キングは斜め 1 マス 4 方向 —
  飛びキングはない(国際式の規則。§11)。
  **1 手(moveCount)= シーケンス全体**(連続捕獲を含む)。連続捕獲の途中はセッションが
  `pendingJumpFrom`(セル番号)として持ち、UI は選択をその駒に固定して続く跳び先だけを
  合法にする。CPU のシーケンスはエンジンには一括適用し、UI が跳びごとに描く。
- **終了条件(§3)**: 駒がなくなった側の負け。**手番に合法手がない側の負け**(閉塞)。
  引き分けは「**捕獲も兵の移動もない手(= キングだけの静かな手)が 50 プライ連続**」
  したとき — カウンタ `quietPlies` 1 個で表し、捕獲か兵の移動でリセットする。
  三回同形は実装しない(§11 に理由: 同じ帰結をより単純な機構が与え、保存形式に
  局面履歴を持ち込まない。50 は実装時に体感で調整してよいが、変えたら文書も変える)。
- **CPU(§4)**: negamax α–β、Int8Array make / unmake(unmake は捕獲駒を**種類ごと**
  戻し、昇格も戻す)。連続捕獲の継続は**同一プライ**として読む(手番も深さも消費
  しない — Reversi がパスに深さを課さないのと同じ理屈)。深さ 0 で強制捕獲が残る
  局面は捕獲だけ読み進める(静止探索。ノード上限が正直な歯止め)。評価は駒価値
  (兵 100 / キング 160 目安)+ 前進 + 自陣最奥段の守り + 軽い機動力。easy = 合法手
  (捕獲義務込み)からシード乱択、normal = 浅い読み(2–3 プライ、easy との体感差で
  実装時に確定)、hard = 反復深化 + ノード上限(**450ms の間に収まる最大を実測で
  決め、実測値をルール文書 §4 に書く** — Reversi / Connect Four と同じ手順)。
- **Undo(§5)**: シーケンス丸ごと + CPU の応手をまとめて戻す。連続捕獲の途中で
  押してもシーケンス開始前まで戻る(途中の駒だけ戻す中途半端は作らない)。
- **助けの形(§6)**: Undo と**合法手の表示**(選択した駒の行き先に点)。強制捕獲は
  初見で最も躓くルールなので、捕獲義務があるときは**跳べる駒だけが選べる** —
  これはルールの可視化であって最善手の提案ではない(Reversi §7 の合法手表示と
  同じ側)。Hint は作らない。
- **中断と再開(§8)**: `ck.saveGame` v1 = board(64 文字 0–4)/ first
  (`'player' | 'cpu'`)/ difficulty / seed / moveCount / quietPlies /
  pendingJumpFrom(`number | null`)/ elapsedSeconds / savedAt。手番は保存しない —
  交互が崩れないので moveCount と first から導出し、`pendingJumpFrom` が非 null なら
  その側の手番の続きである。検証は fail-closed: 明色マスの駒・昇格段にいる兵・
  片側 12 駒超・どちらかが 0 駒・終局済み(手番側に合法手なし)・`pendingJumpFrom` の
  駒がそこから跳べない保存は破棄。
- **統計(§7)**: 難易度別 played / wins / losses / draws + totalPlaySeconds
  (`ck.stats`)。`ck.prefs` は難易度と先後(Reversi / Connect Four の prefs の実物に
  形を合わせる)。`ck.flags` は初回チュートリアル。
- **Quick Rules(§9)**: ① 斜め前へ 1 マス — 相手は跳び越して取る。取れるときは
  取る手しか打てない ② 着地からまた跳べるなら、同じ駒で続けて取る ③ いちばん奥で
  キングに(斜め後ろへも動ける)。相手の駒をなくすか、動けなくしたら勝ち。
- **演出と a11y(§10)**: 駒は DOM。移動・跳びは transform スライド(Connect Four の
  落下と同じ言語、上限 220ms)、捕獲された駒はフェード、昇格は内側リングが現れる
  120ms のポップ。**キングは形で示す**(内側リング — 色に頼らない)。セルはボタンで
  「行・列: 空 / 自分の兵 / 自分のキング / CPU の兵 / CPU のキング / 移動先」を
  読み上げる。連続捕獲は一時通知「続けて跳べます」(エラーではないので無音)。
  効果音: 着手 `select`、捕獲 `match`、勝ち `clear`、負け・引き分け `gameOver`。
- **意図的な差分(§11)**: 国際式(10×10・飛びキング・最大取り義務)を採らない —
  Checkers という名で探す人の期待は英式であり、v1 で盤面規則は 1 つに絞る
  (Connect Four「盤面サイズは 7×6 だけ」と同文)。赤黒の物理慣習(暗色が先手)は
  継がない — 駒色は役割の色で、先後は設定である。強制捕獲のオフ設定は作らない —
  捕獲義務は Checkers の戦術のほぼすべてで、外した遊びは別のゲームである。
- **i18n**: 40 キー前後。高リスクキーなし。

### Gomoku

- **盤面(§1)**: 15×15 の 225 交点、行優先配列(0 = 空、1 = 黒、2 = 白)。黒が先手。
  **黒か白かはプレイヤーが選ぶ**(ホーム画面。既定は黒。ボタンは「黒(先攻)/
  白(後攻)」— Reversi §1 と同文)。石は黒白で描き、アクセントはクロームに置く
  (Reversi と同じ)。盤は木目を模した無地 + 罫線で、文字は置かない。
- **一手の解決(§2)**: **二度タップ確定** — 1 度目のタップで候補マーカー(ゴースト石
  - 交点の強調)、同じ交点をもう一度タップで確定、別の交点をタップすれば候補が移る。
    320px 幅の床で交点は約 19px になり、一度タップ即確定は誤着手製造機になる(§11 に
    記録)。Sudoku の「選択 → 入力」、カードの「選択 → 行き先」と同じ二段の言語である。
    候補タップは無音、確定で `select`。空いていない交点は候補にできない。
- **終了条件(§3)**: 縦・横・斜めのいずれかに自分の石が **5 つ以上**並んだ側の勝ち
  (長連も勝ち — freestyle。§11)。225 交点が埋まって五がなければ引き分け。
  パスはない(空点がある限り必ず打てる)。勝った並びはリングで示し他を薄くする
  (Connect Four §3 / §10 と同文)。
- **CPU(§4)**: 候補は**既存の石からチェビシェフ距離 2 以内の空点**に限る(CPU が
  先手の初手だけ天元)。評価は両者の連パターンの数え上げ(五 = 終端、活四・死四・
  活三・死三・活二の重み表)。easy = 距離 1 以内の空点からシード乱択、normal =
  候補を 1 プライ評価で最善(自分の五完成と相手の即五の阻止は評価が自然に最上位に
  する — テストで固定)、hard = 静的評価上位 K(16 目安)に絞った反復深化 α–β
  (最大 6 プライ)+ ノード上限(**実測で 450ms — 同手順、実測値を §4 に書く**)。
  タイブレークは `createRng(`${seed}:cpu:${moveCount}`)`。
- **Undo(§5)**: CPU の応手と自分の一手をまとめて戻す(Reversi §6 と同文)。
- **助けの形(§6)**: Undo のみ。合法手の表示は不要(空点はすべて合法)— 候補
  マーカー(§2)が置き間違いの助けを担う。Hint は作らない。
- **中断と再開(§8)**: `gm.saveGame` v1 = board(225 文字 0–2)/ playerColor /
  difficulty / seed / moveCount / elapsedSeconds / savedAt。手番は保存しない —
  パスがないので石数から導出できる。検証は fail-closed: 駒種以外の文字・
  **moveCount ≠ 石数**(石は 1 手に 1 つ増え、減らない — Reversi §9 と同じ強い
  不変量)・黒白の枚数差が 0 か 1 でない・五連が既に存在する(終局済み)保存は破棄。
- **統計(§7)**: 難易度別 played / wins / losses / draws + totalPlaySeconds
  (`gm.stats`)。`gm.prefs` は難易度と色。`gm.flags` は初回チュートリアル。
- **Quick Rules(§9)**: ① タップで候補、もう一度タップで確定 — 黒が先手 ② 縦・横・
  斜めのどれかに 5 つ並べたら勝ち ③ CPU の 4 つ並びと、両端の空いた 3 つ並びは
  先にふさぐ。
- **演出と a11y(§10)**: 石は DOM(225 要素 — Nonogram 級の規模で前例内)。置いた石は
  120ms のポップ、最後の石に印。交点はボタンで「行・列: 空 / 黒石 / 白石 / 候補」を
  読み上げる。効果音: 確定 `select`、勝ち `clear`、負け・引き分け `gameOver`。
- **意図的な差分(§11)**: 連珠の禁手(三三・四四・長連禁)は実装しない — freestyle
  として出す。禁手は人間同士の均衡装置で、CPU 対局では難易度がその役を担う。
  先手必勝が理論上知られているが、完全読みの CPU は作らない方針(Reversi §12
  「最強 CPU を作らない」)の内側にある。盤面サイズは 15×15 だけ(13×13 等は
  作らない)。定石データベースは積まない。
- **i18n**: 35 キー前後。高リスクキーなし。

## フェーズ分割

### Phase 1 — ブランド整備(小)

1. アクセント 2 色を BRAND.md「**アクセントを選ぶ手順**」で機械選定する: 候補の
   機械絞り込み(白文字 4.5:1・紙に 3:1・彩度 20–50%・明度 28–48%)→ 既存**全**色
   との CIELAB ΔE(基準: 既存最接近ペア ライト 10.9 / ダーク 7.9 を下回らない)→
   コレクションホームの隣接 → 盤面での出方(Checkers はプレイヤー駒がアクセントを
   着る = 面積が大きい。Gomoku はクロームのみ)。**脳トレ 3 色(#776e18 / #18787b /
   #1d6b33 系)を測定対象に含め、マージ直前にもう一度測り直す**(FreeCell の菫が
   Reversi のマージで失格になった前例)。
2. `packages/brand` の `titleAccents` に `checkers` / `gomoku`(色相選定理由の
   コメント付き)、`ui/styles.css` にアクセント 2 ブロック × 2 ゲーム(ring は
   `rgba()` 直書き。light `.38/.12`、dark `.42/.14`)。
3. グリフ `◉` / `⁙` の一意性をマージ時点の registry(脳トレ分含む)と突き合わせ、
   低スペック床(Chromium 88 / システムフォント)での描画を実機確認。`⁙` が
   潰れるなら Gomoku は `※` 等の代替を測ってから決める。
4. `docs/BRAND.md` / `docs/ARCHITECTURE.md` のアクセント表に 2 行追加。
   コントラスト検証(両テーマ 4.5:1 / 3:1)を通してから確定する。

### Phase 2 — Checkers 本実装(大)

- `game/`: types(駒種 5 値・暗色マス述語・`isValidBoard`)、rng(コピー)、engine
  (合法手生成 = 捕獲義務込み・跳び適用・昇格・閉塞判定・`quietPlies` 更新)、
  serialize(64 文字)、session(`do*` ラッパ・シーケンス 1 手カウント・
  `pendingJumpFrom`・スナップショット Undo・状態遷移一度きり)、cpu(上記 §4)、
  index。
- テスト: engine(捕獲があるとき静手が非合法・連続捕獲の強制継続・跳び昇格で手番
  終了・キング 4 方向・兵は後退不可・閉塞 = 負け・quietPlies のリセット条件と 50 で
  引き分け・シリアライズ往復・fail-closed 各種)、cpu(easy/normal/hard の決定性・
  hard がノード上限で完了済み深さに落ちること)、session(シード固定・Undo が
  シーケンス丸ごと戻す・pendingJumpFrom の保存再開)、
  **compatibility(v1 golden を最初から敷く** — 固定シードの対局トレースと保存形式。
  ヘッダに「直すのは実装であってテストではない」の契約文)。
- `state/`: GameContext(CPU タイマー effect・bookedRef 計上・visibilitychange +
  Capacitor pause・ハードウェア back)、statsLogic。`storage/`: keys(ゼロ import)・
  schemas・gamePersistence + テスト。
- `ui/`: CheckersRoot(+ Root テスト: 背景化計上・初回 Quick Rules・時計とストリーク
  の不在)、checkers.css、components(CheckersBoard / CheckersResultOverlay)、
  screens(Home / Game / Stats / Tutorial)。
- `docs/CHECKERS_RULES.md`、i18n 14 ロケール + index(`registerGameMessages` +
  `declare module`)。
- 接続: registry(union + `CK_STORAGE_KEYS` + 束の位置に 1 要素)、gameKeys.test
  (ck 行)、landing.test の「ガイド未公開」配列、`pnpm size:update`。

### Phase 3 — Gomoku 本実装(大)

- 最初に **15×15 の静的モック実測**(320 / 360 / 420px × ライト / ダーク): 交点の
  タップ精度・候補マーカーの見え方・石の輪郭。二度タップ確定を前提にしても成立
  しないときは、この計画へ戻って再判断する(サイズ変更は本文書の更新を要する)。
- `game/`: types(`isValidBoard` = 枚数差 0/1・五連なし)、rng(コピー)、engine
  (着手・置いた石起点の 4 方向 ≥5 判定・満杯引き分け)、serialize(225 文字)、
  session、cpu(候補生成・パターン評価・3 難易度)、index。
- テスト: engine(横縦斜 4 方向・長連・盤端・満杯引き分け・moveCount = 石数・
  シリアライズ往復・五連入り保存の破棄)、cpu(normal が即五を打つ / 即五を塞ぐ・
  候補が距離 2 以内・決定性)、session(Undo・保存再開)、compatibility(v1 golden)。
- `state/ storage/ ui/ docs/GOMOKU_RULES.md / i18n` は Phase 2 と同型。UI は
  二度タップ確定(候補 → 確定・別交点で移動・`aria` は候補状態を読む)、
  registry は束の末尾(Connect Four の次)、gameKeys.test に gm 行、size:update。

### Phase 4 — 文言スイープとリリース準備

1. **数と列挙の更新**(2 本がそろうリリースに同乗。本数は**マージ時点の実数** —
   脳トレ 3 本が先に入っていれば 20 → 22、まだなら 17 → 19):
   - `README.md` — 収録本数、ゲーム表 2 行(進行 = CPU 対局・難易度 3 種(デイリー
     なし)、助け = Undo(Hint なし))、「助けの内容が…」段落に 2 本の 1 文
     (Reversi / Connect Four の文に並べる)、リポジトリ構成ツリー、後続候補行は
     そのまま(Kakuro / Futoshiki / Takuzu は残る)。
   - `apps/simple-games/index.html` の description / og、
     `apps/simple-games/store/listing.md`(収録本数・INCLUDED GAMES・キーワードに
     `checkers` `draughts` `gomoku` `five in a row` — 検索語として強い。
     **Play Console への反映は手動・要承認**)。
   - `docs/ARCHITECTURE.md`(registry id 列挙・ストレージキー表・i18n キー数)/
     `docs/I18N_POLICY.md`(キー数)/ `docs/WEB_VERSION.md`(本数が出ていれば)。
   - スイープ: `grep -rniE "seventeen|nineteen|twenty|1[79] ?本|2[02] ?本|1[79] games|2[02] games"`
     を README.md / docs / apps/simple-games に掛けて取りこぼしを拾う。
2. **品質ゲート**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
pnpm --filter simple-games build:web && pnpm --filter simple-games size:check` +
   `format:check`、`.github/scripts/check-principles.sh`、
   `check-dist-ads-separation.sh`。lifecycle 掃除・i18n ゲート・境界ゲートは自動編入。
3. **実機確認**(RELEASE_CHECKLIST §2 に加えて): 機内モードで 2 本を初回起動から
   通しプレイ / 320px 幅で Gomoku の二度タップと Checkers の斜めタップ精度 /
   中断 → プロセス kill → 復元(連続捕獲の途中を含む)/ hard の応答が低スペック実機で
   450ms の間に収まる / ライト・ダーク・Reduced Motion / TalkBack で盤面を一巡。
4. **Codex レビュー**: `games/*/game/`・`storage/`・`i18n/`・`packages/brand/` を
   触るため各 PR の push 前に必須。

## PR とリリース

- PR1: Phase 1 + 2(Checkers 一式 + brand)
- PR2: Phase 3(Gomoku 一式)
- PR3: Phase 4(文言スイープ。2 本マージ後)
- 3 つ揃ってから 1 タグでリリース(収録ゲームの追加はアプリのリリースと一体、
  かつ既存ゲームの挙動・保存データを変えない)。Web 版への先行公開はタグに先行して
  よい(WEB_VERSION.md「先行公開」)。タグ発行・versionCode・ストア公開は明示承認が
  必要。

## リスクと対処

| リスク                                        | 対処                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 捕獲義務 + 連続捕獲のエンジン誤実装           | 合法手生成を性質テストで固定(捕獲があるとき静手ゼロ・継続跳びの網羅)。compatibility golden を最初のコミットから敷く     |
| 連続捕獲の途中保存・Undo の取りこぼし         | `pendingJumpFrom` を保存形式 v1 に最初から含め、kill → 復元とシーケンス丸ごと Undo を session テストで固定              |
| Checkers の 50 プライ引き分けが体感と合わない | カウンタ 1 個なので値の調整は安全。変えるときはルール文書 §3 と本文書を同時に直す                                       |
| Gomoku 15×15 が 320px で押せない              | 二度タップ確定を最初から設計に含めた。Phase 3 冒頭の静的モック実測で判定し、不成立なら計画へ戻る(勝手に 13×13 にしない) |
| Gomoku CPU が弱すぎる / 強すぎる              | normal の「即五を打つ・即五を塞ぐ」をテストで固定。hard はノード上限を実測で決め、depth 1 保証で normal 以上            |
| CPU が低スペック実機で 450ms の間からはみ出す | ノード上限は開発機でなく床(2018 年級)基準で実測(Reversi / Connect Four の手順)。実測値をルール文書に書く                |
| アクセント帯の枯渇(マージ時 20 色)            | 目で選ばず BRAND.md の手順で機械選定。ΔE 基準(10.9 / 7.9)を下回る色は採らない。マージ直前に脳トレ 3 色込みで再測定      |
| 収録本数の文言が脳トレ 3 本と競合             | 本数はハードコードせず Phase 4 のスイープでマージ時点の実数に合わせる(先方ブランチも同じ方針)                           |
| `⁙` `◉` が低スペック床のフォントで潰れる      | Phase 1 で実機確認してから確定。潰れたら代替グリフを同じ手順で選ぶ                                                      |
| MT 12 言語の品質                              | ゲーム文言のみで高リスクキーなし。placeholder 整合は i18n テストが機械検証                                              |

## フォローアップ(このリポジトリ外・リリース後可)

- pixapps-landing に 2 本の Learn More ガイド(en / ja / es)を追加し、公開後に
  `landing.ts` の `PUBLISHED_GAME_IDS` へ 2 id を足す(landing.test.ts も更新)。
  それまでチュートリアルの Learn More ボタンは自動的に出ない(仕組み済み)。
- ストアのスクリーンショット更新。Data Safety は変更なし(通信・収集の変化なし)。
- CPU 対局が 4 本になる。GameContext の CPU タイマー effect・難易度別統計・
  ResultOverlay が 4 重化するので、共通化するかを独立のリファクタ PR として判断する
  (「重複が確認されてから抽出」の原則)。
