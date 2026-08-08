# Kakuro / Futoshiki / Takuzu — ロジックパズル 3 本の実装計画 (2026-08-08)

README が後続候補として掲げてきた 3 本(いずれも未着手)を実装し、ロジック節を
3 本(Sudoku / Minesweeper / Nonogram)から 6 本へ広げる。3 本とも「数字と記号だけの
盤面 + 一意解 + 論理」で成立し、出題は端末内のシード決定的生成で完結する。ルールは
パブリックドメイン、絵素材もコンテンツサーバーも要らない
([CONTRIBUTING.md](../../CONTRIBUTING.md) の収録条件)。盤面は DOM + CSS で描き、
Canvas も RAF ループも使わない(Sudoku / Nonogram と同じ、低消費電力の最軽量帯)。
盤面に置く文字は ASCII の数字と不等号のみで、翻訳不能文字を盤面に埋め込まない
([I18N_POLICY.md](../I18N_POLICY.md))という原則に最初から適合する。

**この文書は着手前の実装計画である。**実装は未着手。仕様の正本は実装時に
`docs/KAKURO_RULES.md` / `docs/FUTOSHIKI_RULES.md` / `docs/TAKUZU_RULES.md` として
起こし、以後はそちらが勝つ(各ルール文書はそのゲームの実装 PR に同乗する)。

## 決定事項(ユーザー指示)

| 項目     | 決定                                                                                        |
| -------- | ------------------------------------------------------------------------------------------- |
| 収録     | Kakuro / Futoshiki / Takuzu の **3 本すべて**                                               |
| 実装担当 | **Opus(サブエージェント)。**本文書と各ルール文書を仕様の出発点にする(脳トレ 3 本と同じ体制) |

## 提案(実装はこの既定で進める。変える場合は本文書を更新してから)

| 項目        | Kakuro                            | Futoshiki                      | Takuzu                      |
| ----------- | --------------------------------- | ------------------------------ | --------------------------- |
| id          | `kakuro`                          | `futoshiki`                    | `takuzu`                    |
| 型          | **Sudoku 型**(パッド + メモ)      | **Sudoku 型**(パッド + メモ)   | **Nonogram 型**(タップ循環) |
| 進行        | 100 レベル + デイリー             | 100 レベル + デイリー          | 100 レベル + デイリー       |
| 助け        | Undo / Hint                       | Undo / Hint                    | Hint(Undo なし)             |
| 保存接頭辞  | `kk.`(6 キー)                     | `ft.`(6 キー)                  | `tk.`(5 キー・prefs なし)   |
| i18n 接頭辞 | `kakuro*` + `kakuroName`          | `futoshiki*` + `futoshikiName` | `takuzu*` + `takuzuName`    |
| グリフ      | `∑`(U+2211)                       | `≶`(U+2276)                    | `01`(2 文字。代替 `◧`)      |
| 途中保存    | 2 スロット(レベル / デイリー独立) | 同左                           | 同左                        |

- **カテゴリは 3 本とも `logic`。**レジストリ配列上は末尾に
  Kakuro → Futoshiki → Takuzu の順で追加する(節内の並びは配列順なので、ホームの
  ロジック節では Nonogram の後ろにこの順で並ぶ。検索需要の大きい順)。既存の並びは
  動かさない。
- **接頭辞の空きは確認済み**: 既存 22 個(`sd` `so` `ss` `fc` `ms` `ng` `nm` `ws`
  `sp` `mm` `bb` `sf` `tm` `bp` `ck` `rv` `c4` `gm` `bh` `qm` `st` `nr`)と衝突しない。
  i18n キーの互いに素は `i18n.test.ts` が機械検証する。
- **グリフ**: `∑` と `≶` は Mathematical Operators ブロックで、既存の `≡`
  (Brick Breaker)と `≋`(Water Sort)が同ブロックの描画前例。`01` は 2 文字グリフ
  (Number Match の `10` が前例)で「0 と 1 のパズル」をそのまま名乗るが、
  **`10` との見間違いが唯一の懸念** — Phase 1 のホームモックで並べて判定し、紛れるなら
  `◧` を同じ手順で測る。低スペック床(Chromium 88 / システムフォント)での描画確認は
  3 つとも Phase 1 で行う(Gomoku `⁙` の前例)。
- **アクセント色はこの計画では先取りしない。**Checkers / Gomoku の前例に従い、
  Phase 1 で [BRAND.md](../BRAND.md)「アクセントを選ぶ手順」を最初から実行する。
  22 タイトル時点で空き色相は存在しない(BRAND.md の実測: 3° 刻みの全帯に 30° 以内の
  既存色がある)ので、3 色は**明度と彩度の帯**で分けることになる — 一度に 3 色を
  通すのは手順始まって以来の本数で、本計画の主検証項目である。

### 名前(タイトルは全言語で同一の固有名詞)

| タイトル    | README 併記      | 判断                                                                                                                                                                       |
| ----------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Kakuro`    | クロスサム       | 国際的な一般名(新聞各紙が使用)。日本にはニコリの商標「カックロ」があるため、**併記に「カックロ」を使わない** — Sudoku が併記を「数独」でなく「ナンプレ」にしたのと同じ構図 |
| `Futoshiki` | 不等式           | 一般名詞(不等式)そのもの。新聞パズルの定番名                                                                                                                               |
| `Takuzu`    | バイナリーパズル | 一般名。**Binairo / 0h h1 は名乗らない**(他社の商品名。Othello を使わず Reversi と呼んだ物差し)                                                                            |

3 語とも他社商標でないことは実装時に最終確認する(脳トレ 3 本と同文)。

## 前提(調査済み)

**Sudoku / Nonogram が骨格と作法の正本。**3 本とも同じ骨格
(`game/ state/ storage/ ui/ i18n/`、`levels.ts` / `daily.ts` / `session.ts` /
`generator.ts` / `solver.ts` / 6 スクリーン構成)で作る。踏襲する設計は:

- **一意解 + 推測なしを生成時に構成として保証する**(Sudoku §6–7 / Nonogram §4 の
  中心判断)。ティア(難易度)は「許容する技法の集合」で定義し、「その技法が必要」は
  約束しない(Sudoku §6 の教訓)。グレーダー・Hint・生成検査は同一の技法実装を共有する。
- **性能の門は壁時計でなく仕事量**(探索の配置数・試行回数)で立てる。壁時計は計測して
  出力するだけで判定に使わない — 理由ごと Sudoku §7 に詳しい(並列テストで壁時計は
  最大 41 倍ぶれる)。不成立時は派生シード `<seed>#2` … で作り直す(Nonogram §5、
  上限つき)。
- **シード決定的**: `levelSeed` は `<id>-level-<n>`、デイリーは `<id>-daily-<YYYY-MM-DD>`
  (端末ローカル日付のみ)。同シード同盤面を golden テストで固定。レベルは 100
  (999 は水増し — Sudoku / Nonogram の圧縮判断を最初から採る)。帯の配分は
  「枚数を配る」方式(Sudoku `tiersForBand`)か帯内線形補間(Nonogram)で、
  表の数字を平均でなく実数の約束にする。
- **デイリーは難易度・サイズ固定**(曜日変動は「当たり日 / 外れ日」の圧 — Sudoku §10)。
  **過去 30 日は無条件に開く(Nonogram / ドリルの実装を正とする)** — Sudoku だけは
  「前日を解くと次が開く」連鎖解錠式だが、新しい 3 本には採らない(貯まった過去日を
  宿題にしない)。ストリークは数えない。
- **中断は 2 スロット独立**で、どちらのモードかを決めるのは**キー**
  (`gameSlotSchema(key, expectedMode)` — 食い違うレコードは破損として `null`)。
  この規則は `src/test/savedGameSlots.test.ts` が二重スロットのゲームを走査して
  自動強制する。検証は fail-closed: プレイから生まれえない盤面は破棄してホームへ戻る。
- **プレイ時計は ref 加算のみ**(1 秒 interval は可視 + プレイ中のみ、再レンダリング
  ゼロ)。統計への計上は bookedRef 方式の逐次計上で、保存は全レイヤー
  fire-and-forget。hide / pause / back は `syncActiveGame()` に合流して盤面と
  未計上秒を一緒に保存する。`recordGameCompleted()` は**クリア時に無条件**で呼ぶ
  (Sudoku / Nonogram と同じ。1 問数分のパズルなので、数十秒で終わるドリルに入れた
  L11 ゲートは要らない)。
- **rng(xmur3 + mulberry32 + Fisher–Yates)はゲームごとにコピーが正**(25 個目に
  なる。未決事項は collection-and-sudoku 計画 §6 に積んだまま)。
- **時計を出さない・ミス上限なし・ゲームオーバーなし・スコアという数を作らない。**
  統計はクリア数 / サイズ別ベスト / 合計プレイ時間 / デイリー達成日
  (Nonogram の `sizeKey` 方式)。

**ゲーム追加の接続点は調査済み**(実測値・固有名は 2026-08-08 時点):

- 自動編入(フォルダを作れば掛かる門): チャンク `game-<id>` 化 /
  `importBoundaries` / `lifecycle` 掃引(RAF なしなので leak テスト不要)/
  `gameI18nWiring`(Root 先頭の `import '../i18n'` を静的強制)/
  `savedGameSlots` / i18n の全カタログ横断検証。
- 手で触る場所: `app/registry.ts`(`GameId` union + keys import + `GAMES` 1 要素
  × 3)/ `app/gameKeys.test.ts`(`RELEASED_KEYS` に配列、`PREFIXES` に接頭辞 —
  レジストリとの完全一致が門なので追加漏れは即赤)/ `ui/styles.css`(ライト帯・
  ダーク帯それぞれの**末尾**にブロック追加。ring は rgba 直書きで light `.38/.12`、
  dark `.42/.14` — `.14` のライト外れ値 2 件には倣わない)/ `packages/brand` の
  `titleAccents`(**ランタイムでは未参照 — CSS と手で二重管理**であることに注意)/
  `size-baseline.json`(`pnpm size:update`)/ `landing.test.ts` の
  「ガイド未公開」**インライン配列**に 3 id(it 名は
  `offers no link for a shipped game …`。名前つき定数ではない) —
  この配列はレジストリ網羅の門ではないので追加を忘れても赤にならない。忘れないこと。
- **`ui/styles.test.ts` が ARCHITECTURE.md の per-game CSS 列挙とファイルシステムを
  両方向で固定している**ため、`<id>.css` を足す PR は ARCHITECTURE.md §CSS の分割の
  列挙更新を同乗させないと CI が落ちる(文言スイープを Phase 5 に残せない唯一の文書)。
- サイズ感: Sudoku 22.1KB / Nonogram 17.6KB gzip。3 本とも 15〜22KB 見込みで
  ゲーム別予算 500KB は問題にならない。効くのはエントリ成長ゲート(×1.1)で、
  同期 import は `storage/keys.ts` の葉だけに保つ。
- i18n はシェル 79 キー + ゲーム別カタログ(Sudoku 34 / Nonogram 26 キーが相場)。
  3 本で 28〜40 キー × 14 言語ずつを見込む。**高リスクキーは発生させない**
  (ゲーム文言に無料・オフライン・課金の約束を書かない)。

## ゲーム仕様の要点(ルール文書の骨子)

ルール文書は 3 本とも Sudoku / Nonogram の章立て(盤面 / 勝利条件 / 操作 /
ミスと支援(または Undo と Hint)/ 難易度と生成 / レベルとデイリー / 統計 /
中断と再開 / Quick Rules / 演出とアクセシビリティ / 意図的な差分)で書く。
以下は各章に入る決定。

### Kakuro(3 本で最大。最後に作る)

- **盤面(§1)**: W×H グリッド。マスは「白マス(1〜9 を入れる)」か「手がかりマス」。
  手がかりマスは右向き(その右に続く横 run の合計)と下向き(その下に続く縦 run の
  合計)を斜め分割で持てる。run は長さ 2〜9、すべての白マスはちょうど 1 つの横 run と
  1 つの縦 run に属し、白マス全体は連結。サイズは 3 種(小 ≈6×6 / 中 ≈8×8 /
  大 ≈10×10 — 手がかりマス込みの全体寸。**確定は Phase 4 冒頭の静的モック実測後**)。
- **ルール(§2)**: run 内の数字は重複しない。run の合計が手がかりと一致する。
  全白マスが埋まって全 run が一致したら勝ち。出題は常に一意解(§5)。
- **操作(§3)**: Sudoku §3 と同型 — 白マスを選ぶ → 数字パッド 1〜9 で入れる / 消す、
  メモモードでパッドはメモの追加・削除。選択マスの属する横 run・縦 run と手がかりを
  ハイライト。数字を入れるとそのマスのメモが消え、**同じ run のメモから同じ数字を
  自動で消す**。**パッドの残数表示は作らない** — Sudoku の「9 − 盤上の個数」に当たる
  不変量が Kakuro には存在しない(§意図的な差分)。
- **ミスと支援(§4)**: 違反表示は常時 — run 内の重複、埋まりかけの run の合計超過、
  埋まった run の合計不一致(ルール違反の指摘であり答え合わせではない)。
  **ミスの即時表示**(一意解と異なる数字の警告色)は設定トグル・既定オン
  (`kk.prefs.highlightMistakes`。Sudoku の `loadSettingsSection` の口の 2 例目。
  マウント時読みで足りる — 設定画面はホームからのみ到達する)。ミス上限なし。
- **Hint(§5)**: グレーダーの次の一手を 1 つ、根拠の run を強調して平易文で示す
  (「この列は合計 16 の 2 マスなので 7 と 9 しか入らない」)。技法名は UI に出さない。
  数字は入れない。無制限・無料。
- **難易度と生成(§6–7)**: 技法は ①固定分割(和と長さから組が一意: 16(2)={7,9} など)
  ②交差(横 run 候補 ∩ 縦 run 候補)③run 内の naked / hidden single
  ④(上位帯)naked pair / 部分和。生成は「seed からレイアウト生成(run 長・連結の
  制約下)→ 完成充填(バックトラック)→ 手がかり算出 → 技法ソルバーで全確定 +
  一意検査 → 不成立なら派生シード」。**ティアの許容技法だけで解けることを保証し、
  必要性は約束しない。**門は仕事量。
- **レベル(§8)**: 帯の提案 — L1–20 小 / L21–65 中 / L66–100 大。帯内でティアを
  枚数配分。デイリーは**中サイズ・medium 固定**。
- **中断と再開(§9)**: `kk.saveGame` v1 = mode / seed / level・dailyDate / layout
  (マス種の文字列)/ solution / entries / notes / mistakeCount / hintCount /
  elapsedSeconds / savedAt。**手がかりは保存しない** — layout + solution から
  再計算する(Nonogram が clues を保存しない判断と同じ。ドリフトできない)。
  fail-closed: 手がかりマスへの入力・run 制約を破る layout・solution が §2 を
  破る保存は破棄。
- **Quick Rules(§11)**: ① 数字は 1〜9。タテヨコひと続きの合計を、手がかりの数に
  合わせる ② 同じひと続きの中で同じ数字は使えない ③ 2 マスで 16 なら 7 と 9 —
  組み合わせで絞る。詰まったら Hint。
- **意図的な差分(§13)**: パッドの残数表示なし(上記)/ 0 を含む変種・重複許容変種は
  作らない / サイズは 3 種のみ / 問題パックの同梱・配信はしない(最後の手段としてのみ
  — Sudoku §7 と同順)。
- i18n 40 キー前後。

### Futoshiki(Sudoku の骨格を最小差分で写す)

- **盤面(§1)**: N×N(4〜7)。各行・各列に 1〜N がちょうど 1 つずつ(ラテン方陣)。
  隣接マスの間に不等号(`<` `>` — とがった側が小さい)が一部にあり、初期数字は少数。
  出題は常に一意解。
- **操作(§3)**: Sudoku §3 と同型 — マス選択 → パッドは **1〜N**(サイズ追従)、
  メモ、同行・同列のメモ自動消去。パッドの残数表示は「N − 盤上の個数」で成立するので
  **作る**(各数字は解に N 回現れる)。
- **ミスと支援(§4)**: 違反表示は常時 — 行・列の重複と、両側が埋まった不等号の向き
  違反。ミスの即時表示はトグル・既定オン(`ft.prefs.highlightMistakes`、
  SettingsSection の口の 3 例目)。
- **Hint(§5)**: Kakuro と同じ形。平易文の例:「この不等号の並びで、ここは 1 しか
  入らない」。
- **難易度と生成(§6–7)**: 技法は ①不等号伝播(`a<b` なら a≠N、鎖で範囲が締まる)
  ②naked / hidden single ③(上位帯)pair / 長い鎖。生成は「seed からラテン方陣 →
  不等号エッジ選定(ティアで本数帯)→ 初期数字を技法で解ける限り掘る → 検査 →
  派生シード」。
- **レベル(§8)**: 帯の提案 — L1–15 4×4 / L16–45 5×5 / L46–80 6×6 / L81–100 7×7。
  デイリーは **6×6・medium 固定**。**7×7 は Phase 3 冒頭の静的モック実測
  (320px、不等号ギャップ込み)を門にする** — 不成立なら 6×6 上限に本文書を
  更新してから進む。
- **中断と再開(§9)**: `ft.saveGame` v1 = mode / seed / level・dailyDate / size /
  givens / solution / constraints(不等号エッジの列挙)/ entries / notes /
  mistakeCount / hintCount / elapsedSeconds / savedAt。fail-closed: solution が
  ラテン方陣でない・constraints が solution と矛盾する・givens と entries が
  重なる保存は破棄(不等号と解の矛盾は強い不変量)。
- **Quick Rules(§11)**: ① どの行・列にも 1〜N を 1 つずつ ② 不等号に従う —
  とがった側が小さい ③ 迷ったらメモ、詰まったら Hint。
- **意図的な差分(§13)**: サイズは 4〜7 のみ(9×9 は指のサイズで作らない — Nonogram
  §1 と同じ理由)/ 不等号のない変種は作らない(それは Sudoku)。
- i18n 36 キー前後。

### Takuzu(3 本で最小。最初に作り、イディオムを確立する)

- **盤面(§1)**: N×N・N は偶数(6 / 8 / 10)。各マスは 0 か 1。初期数字は固定。
  規則: ① 同じ数字は縦横に 3 連続しない ② 各行・各列で 0 と 1 は同数
  ③ 同一内容の行同士・列同士は禁止。出題は常に一意解。
- **操作(§3)**: **タップで 空 → 0 → 1 → 空 の循環**(初期数字は変更不可)。
  長押しもモードも要らない(Nonogram の ×モードに当たるものが構造的に不要)。
- **Undo と Hint(§4)**: **Undo は作らない** — すべての手がタップで自由に一巡できる
  ゲームに Undo を重ねても同じ操作が 2 つ並ぶだけ(Nonogram §7 と同じ理由。
  メモも自動消去もないので Sudoku 側の理由が発生しない)。**Hint は作る** —
  技法で新しく確定する 1 マスを根拠の行・列(またはペア)ごと示す。規則に矛盾した
  行・列があるときは先にそこを示す(Nonogram の矛盾優先と同文)。
  ミス-vs-解の表示は作らない(違反表示で足りる — §意図的な差分)。
- **違反表示(§4)**: 常時 — 3 連続、行・列でどちらかの数字が N/2 を超過、
  埋まった行・列の重複。
- **難易度と生成(§5–6)**: 技法は ① ペアの両隣と穴埋め(`1 1` の両端は 0、`1 _ 1` の
  間は 0)② 行・列カウント(片方が N/2 に達したら残りは他方)③(上位帯)完成間近の
  行・列比較(重複禁止からの確定)。生成は「seed から完成盤(3 規則を満たす)→
  技法ソルバーで全確定が保てる限り掘る → 派生シード」。帯内で初期数字率が線形に
  下がる(Nonogram の充填率と同じ形)。
- **レベル(§7)**: 帯の提案 — L1–20 6×6 / L21–60 8×8 / L61–100 10×10。
  デイリーは **8×8・medium 固定**。
- **中断と再開(§9)**: `tk.saveGame` v1 = mode / seed / level・dailyDate / size /
  givens / solution / marks / hintCount / elapsedSeconds / savedAt(mistakeCount は
  持たない — ミス概念がない)。fail-closed: solution が 3 規則を破る・givens 外の
  文字・marks が givens を上書きする保存は破棄。**prefs キーなし(5 キー)。**
- **Quick Rules(§11)**: ① タップで 0 → 1 → 空。同じ数字は 3 つ続けない
  ② どの行・列も 0 と 1 は同じ数 ③ 同じ並びの行(列)は 2 つ作れない。
- **演出と a11y(§12)**: 0 と 1 は**数字の形で区別**し、2 つの控えめな地色は補助
  (色だけに意味を持たせない — Nonogram §12)。セルはボタンで
  「行・列: 空 / 0 / 1 / 初期数字」を読み上げる。
- **意図的な差分(§13)**: ●○ や色タイル表記にしない(ASCII 0/1 — 全言語で同じに
  読め、読み上げも一意)/ 奇数サイズ・12×12 以上は作らない / ミス表示なし(上記)。
- i18n 28 キー前後。

## フェーズ分割

各実装フェーズは Opus が担当する。各フェーズの完了条件に**ブラウザ試遊
(ライト / ダーク両テーマ)**を含める(「動作テストが全部緑でも遊べるとは限らない」
— 2048 / Block Puzzle の教訓)。ルール文書はそのフェーズの冒頭で起こし、実装 PR に
同乗させる。

### Phase 1 — ブランド整備(小)

1. アクセント 3 色を BRAND.md「アクセントを選ぶ手順」で機械選定する:
   機械絞り込み(白文字 4.5:1・紙に 3:1。彩度・明度の範囲は**現行パレットの実測**
   — ライト彩度 21〜67% / 明度 27〜51%、ダーク彩度 24〜59% / 明度 57〜74% — を使う。
   固定値 20–50 / 28–48 は BRAND.md 自身が棄却済み)→ 既存**全 22 色**との CIELAB ΔE
   (床: ライト 10.9 / ダーク 7.9)→ ホーム 2 列グリッドの隣接 → 盤面での出方
   (3 本ともアクセントはクロームと選択・ハイライトに乗る — 駒のような大面積は
   ない)。空き色相はないので**明度・彩度の帯で分ける**(Checkers のウォルナットが
   前例)。3 色を同時に通すので、**候補同士の ΔE も床の対象にする**こと。
2. `packages/brand` の `titleAccents` に 3 エントリ(色名・選定理由・実測 ΔE の
   JSDoc 付き。camelCase キー)、`ui/styles.css` のライト帯・ダーク帯それぞれの
   末尾にブロック × 3(ring は rgba 直書き。light `.38/.12`、dark `.42/.14`)。
   **`titleAccents` と styles.css は手で二重管理**(突き合わせるテストは存在しない)
   — 転記ミスに注意。
3. グリフ確定: `∑` `≶` の低スペック床(Chromium 88 / システムフォント)描画確認、
   `01` はホームモックで Number Match の `10` と並べて判定(紛れたら `◧` を同じ
   手順で)。マージ時点の registry 全 22 グリフと突き合わせる。
4. `docs/BRAND.md` / `docs/ARCHITECTURE.md` のアクセント表に 3 行追加。
   コントラスト検証(両テーマ、`--surface` と `--paper` の両方)を通してから確定。
   **マージ直前の再測定を各実装 PR で繰り返す**(FreeCell / Number Recall の前例 —
   選定は選んだ時点のパレットに対してしか正しくない)。

### Phase 2 — Takuzu 本実装(中)

- `game/`: types(`isValidBoard` = 3 規則 + givens 整合)、rng(コピー)、engine
  (着手・違反検出・勝利判定)、solver(技法 3 種の不動点反復 — 生成検査と Hint が
  共有)、generator(完成盤 → 掘り)、levels(帯 + 線形補間)、daily、serialize、
  session、index。
- テスト: engine(3 規則の縁と角・違反検出)、solver / guarantee(**全 100 レベル +
  デイリー帯を走査して「技法だけで全確定 = 一意」を固定**。門は試行回数と仕事量 —
  壁時計は計測のみ)、levels(帯とサイズ・givens 率の単調性)、serialize 往復、
  session(シード固定・保存再開)、slots(実レコードで expectedMode)、
  **compatibility(v1 golden を最初から敷く** — 固定シードの盤面と保存形式。
  ヘッダに「直すのは実装であってテストではない」の契約文)。
- `state/`: GameContext(elapsedRef / bookedRef・visibilitychange + pause + back の
  `syncActiveGame` 合流・クリア時 `recordGameCompleted`)、progressLogic
  (`DAILY_BACKLOG_LIMIT = 30`・無条件開放 = Nonogram の形を写す)、statsLogic
  (sizeKey 方式)。`storage/`: keys(ゼロ import の葉・5 キー)、schemas
  (`gameSlotSchema(key, expectedMode)`)、gamePersistence + テスト。
- `ui/`: TakuzuRoot(先頭 `import '../i18n'` + Root テスト: 背景化計上・初回
  Quick Rules・時計とストリークの不在)、takuzu.css(色は `var(--accent)` 系のみ。
  0/1 の地色 2 種だけはこのゲームの中身の色としてここに書く)、components
  (TakuzuBoard / TakuzuResultOverlay)、screens(Home / Game / Daily / LevelSelect /
  Stats / Tutorial)。共有部品は Sudoku / Nonogram と同じ口
  (BannerSlot / ConfirmDialog / useTransientTimeout / ResultAdSlot / WebChromeSlot /
  formatDuration / icons)。
- `docs/TAKUZU_RULES.md`、i18n 14 ロケール + index(`registerGameMessages` +
  `declare module`)。
- 接続: registry(union + `TK_STORAGE_KEYS` + logic 末尾に 1 要素)、gameKeys.test
  (RELEASED_KEYS + PREFIXES に tk 行)、**ARCHITECTURE.md の CSS 列挙に takuzu.css**
  (styles.test が両方向固定するため同 PR 必須)、landing.test の「ガイド未公開」
  インライン配列に `takuzu`、`pnpm size:update`。

### Phase 3 — Futoshiki 本実装(中)

- 冒頭に **7×7 の静的モック実測**(320 / 360 / 420px × ライト / ダーク): セルと
  不等号ギャップのタップ精度・不等号の視認性。不成立なら 6×6 上限に本文書を更新
  してから進む。
- `game/`: types、rng、engine、solver(不等号伝播 + singles + pair)、generator
  (ラテン方陣 → エッジ選定 → 掘り)、levels / daily / serialize / session / index。
  テストは Phase 2 と同型 + 「constraints と solution の矛盾を破棄」の fail-closed。
- `ui/`: パッドは 1〜N(残数表示あり)+ メモモード — Sudoku の DigitPad の形を写す
  (import はしない — ゲーム間 import 禁止)。不等号はセル間ギャップに描く。
- `ft.prefs` + FutoshikiSettingsSection(ミス即時表示トグル。マウント時読み)。
- `docs/FUTOSHIKI_RULES.md`、i18n、接続(ft 行・CSS 列挙・landing 配列・size)。

### Phase 4 — Kakuro 本実装(大)

- 冒頭に **大サイズ(≈10×10)の静的モック実測**: 手がかりマスの斜め分割 2 数字が
  320px で読めるか。不成立なら大サイズ帯を 9×9 に落として本文書を更新してから進む。
- `game/`: types(マス種・run 抽出)、rng、engine、solver(固定分割テーブル + 交差 +
  singles + pair / 部分和)、generator(**レイアウト生成 → 充填 → 手がかり → 検査**。
  3 本で最大の技術リスク — 仕事量の門と派生シード上限を最初から敷き、低スペック床の
  実測で帯のサイズを最終確定する)、levels / daily / serialize / session / index。
- `ui/`: 手がかりマス(斜め分割・読み上げ「右へ合計 16 / 下へ合計 7」)、白マス選択で
  両 run ハイライト、パッド 1〜9 + メモ(残数なし)。
- `kk.prefs` + KakuroSettingsSection。`docs/KAKURO_RULES.md`、i18n、接続(kk 行・
  CSS 列挙・landing 配列・size)。

### Phase 5 — 文言スイープとリリース準備

1. **数と列挙の更新**(3 本がそろうリリースに同乗。本数は**マージ時点の実数** —
   現在 22 → 25):
   - `README.md` — 収録本数、ゲーム表 3 行(進行 = 100 レベル + デイリー、助け =
     上表)、「助けの内容が…」段落に 3 本の文(Kakuro / Futoshiki は Sudoku と同じ側
     — メモの自動消去で操作が非自明に不可逆だから Undo、一意解への論理の次の一手が
     あるから Hint。Takuzu は Nonogram と同じ側 — タップで一巡できるから Undo を
     作らない)、リポジトリ構成ツリー、**後続候補行の更新 — 3 本を消化したので行を
     書き換える(次候補を勝手に発明せず、残がなければ行ごと削除)**。
   - `apps/simple-games/index.html` の description / og、
     `apps/simple-games/store/listing.md`(収録本数・INCLUDED GAMES・キーワードに
     `kakuro` `cross sums` `futoshiki` `takuzu` `binary puzzle`。
     **Play Console への反映は手動・要承認**)。
   - `docs/ARCHITECTURE.md`(registry id 列挙・ストレージキー表 3 行・rng コピー数・
     i18n キー数。アクセント表と CSS 列挙は各 PR で更新済みのはず — 突き合わせ確認)
     / `docs/I18N_POLICY.md`(キー数)/ `docs/WEB_VERSION.md`(本数が出ていれば)。
   - スイープ: `grep -rniE "twenty-two|twenty-five|2[25] ?本|2[25] games"` を
     README.md / docs / apps/simple-games に掛けて取りこぼしを拾う。
2. **品質ゲート**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
pnpm --filter simple-games build:web && pnpm --filter simple-games size:check` +
   `format:check`、`.github/scripts/check-principles.sh`、
   `check-dist-ads-separation.sh`。
3. **実機確認**(RELEASE_CHECKLIST §2 に加えて): 機内モードで 3 本を初回起動から
   通しプレイ / 320px 幅で Kakuro の手がかり可読性・Futoshiki の不等号・Takuzu の
   10×10 タップ精度 / 中断 → プロセス kill → 復元(レベル・デイリー両スロット)/
   生成の床実測(低スペック実機で体感遅延なし)/ ライト・ダーク・Reduced Motion /
   TalkBack で 3 盤面を一巡。
4. **Codex レビュー**: `games/*/game/`・`storage/`・`i18n/`・`packages/brand/` を
   触るため各 PR の push 前に必須。

## PR とリリース

- PR1: Phase 1 + 2(ブランド 3 色 + Takuzu 一式 + TAKUZU_RULES.md)
- PR2: Phase 3(Futoshiki 一式 + FUTOSHIKI_RULES.md)
- PR3: Phase 4(Kakuro 一式 + KAKURO_RULES.md)
- PR4: Phase 5(文言スイープ。3 本マージ後)
- 4 つ揃ってから 1 タグでリリース(収録ゲームの追加はアプリのリリースと一体、かつ
  既存ゲームの挙動・保存データを変えない)。Web 版への先行公開はタグに先行してよい
  — ただし WEB_VERSION.md の「先行公開(ベータ)」運用(BETA バッジ・正式収録 =
  スキーマ凍結点)は**方針のみ・未実装**なので、使うならその実装が先。タグ発行・
  versionCode・ストア公開は明示承認が必要。

## リスクと対処

| リスク                                                       | 対処                                                                                                                                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kakuro の生成(レイアウト + 一意性 + 技法保証)が性能予算超過  | 3 本の最後に置き、確立済みの仕事量の門を最初から敷く。対処順: ①レイアウト制約(run 長分布)の調整 ②試行上限・派生シード ③(最後の手段)ビルド時パック同梱 — Sudoku §7 と同順 |
| Kakuro 手がかりマスが 320px で読めない                       | Phase 4 冒頭の静的モック門。不成立なら大サイズ帯を 9×9 へ(本文書を更新してから)                                                                                          |
| Futoshiki 7×7 が 320px で押せない                            | Phase 3 冒頭の静的モック門。不成立なら 6×6 上限へ(同上)                                                                                                                  |
| 「推測なし」保証の破れ(技法集合の実装ミス)                   | グレーダー・Hint・生成検査が同一の技法実装を共有。guarantee テストが全 100 レベル + デイリー帯を走査。fail-closed の保存検証                                             |
| アクセント帯の枯渇(22 色 + 一度に 3 色)                      | 目で選ばず BRAND.md の手順で機械選定。実測レンジ・ΔE 床(10.9 / 7.9)・候補同士の ΔE も対象。各実装 PR のマージ直前に再測定(FreeCell / Number Recall の前例)               |
| `01` が Number Match の `10` と紛れる / `∑` `≶` の描画床     | Phase 1 のホームモックと実機確認で判定。紛れ・潰れがあれば代替(`◧` など)を同じ手順で選ぶ                                                                                 |
| 追加を忘れても赤にならない接続点(landing 配列・titleAccents) | 本文書の接続点リストをフェーズのチェックリストにする。網羅テストの不在はフォローアップに記録                                                                             |
| 収録本数の文言競合                                           | 本数はハードコードせず Phase 5 のスイープでマージ時点の実数に合わせる                                                                                                    |
| MT 12 言語の品質                                             | ゲーム文言のみで高リスクキーなし。placeholder 整合は i18n テストが機械検証                                                                                               |

## 作らないもの

- **タイマー表示・ミス上限・ゲームオーバー・ストリーク・スコア・ランキング**
  (既存原則。時間は記録するだけ、締切にしない)。
- **Hint / Undo の有料化・広告接続**(常に無料・無制限)。
- **問題データの同梱・配信**(すべて端末上で生成。パック同梱は性能予算が破れた
  ときの最後の手段としてのみ — 採ったらルール文書に書く)。
- **変種ルール**: Kakuro の 0 入り・重複許容、Futoshiki の対角制約、Takuzu の
  奇数盤・3 値化などは作らない。v1 は各タイトル 1 規則セット(「盤面規則は 1 つに
  絞る」— Connect Four / Checkers の前例)。
- **ローカル対人・オンライン対戦・クラウド同期**(PRODUCT_PRINCIPLES)。

## フォローアップ(このリポジトリ外・リリース後可)

- pixapps-landing に 3 本の Learn More ガイド(en / ja / es)を追加し、公開後に
  `landing.ts` の `PUBLISHED_GAME_IDS` へ 3 id を足す(`landing.test.ts` の両配列も
  更新)。それまでチュートリアルの Learn More ボタンは自動的に出ない(仕組み済み)。
- ストアのスクリーンショット更新。Data Safety は変更なし(通信・収集の変化なし)。
- **registry ⇔ `titleAccents` ⇔ styles.css ⇔ グリフの網羅テストが存在しない**
  (今回の調査で確認 — 追加漏れがあっても現行テストは緑のまま)。25 本になった
  時点で、`gameKeys.test.ts` の「レジストリと完全一致」の形を写した網羅テストを
  独立 PR として検討する。
- `landing.test.ts` の既存の抜け(`reversi` / `connect-four` がどちらの配列にも
  いない)を直す小 PR 候補。
- rng コピーが 25 個になる。抽出の未決事項は collection-and-sudoku 計画 §6 のまま。
