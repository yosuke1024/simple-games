# FreeCell と Spider Solitaire — カード2本の本実装計画 (2026-08-07)

カードの柱を 1 本(Solitaire = クロンダイク)から 3 本へ広げる。FreeCell と Spider は
クロンダイクと並ぶ「名前で探される」定番で、生成も進行も端末内で完結し、コンテンツ
サーバーを必要としない([CONTRIBUTING.md](../../CONTRIBUTING.md) の収録条件)。
盤面の絵素材は不要(カードは DOM + インライン SVG スートで描く。Solitaire と同じ)。

**この文書は着手前の実装計画である。**実装は未着手。仕様の正本は実装時に
`docs/FREECELL_RULES.md` / `docs/SPIDER_SOLITAIRE_RULES.md` として起こし、以後は
そちらが勝つ。リバーシ / コネクト 4(別計画・未着手)とは独立で、どちらが先に
main へ入っても成立する — 収録本数の文言はマージ時点の実数に合わせる(Phase 4)。

## 決定事項(ユーザー承認済み)

| 項目            | 決定                                                                    |
| --------------- | ----------------------------------------------------------------------- |
| 収録            | FreeCell と Spider Solitaire の**両方**                                 |
| 正式タイトル    | `FreeCell`(id: `freecell`) / `Spider Solitaire`(id: `spider-solitaire`) |
| FreeCell の助け | **Undo のみ・Hint なし**(完全情報 — Sliding Puzzle / 2048 と同じ理屈)   |
| Spider の助け   | Undo + Hint(裏カードがある = 隠れた情報がある。Klondike と同じ理屈)     |

## 提案(実装はこの既定で進める。変える場合は本文書を更新してから)

| 項目            | 提案                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 並び順          | Solitaire の直後にカードを束ねる: **3 番 Spider Solitaire、4 番 FreeCell**(検索される可能性順)                                                               |
| 保存接頭辞      | FreeCell `fc.`(4 キー) / Spider `ss.`(5 キー)。`sp.` は Sliding Puzzle が使用済み                                                                            |
| i18n 接頭辞     | `fc*` + `freecellName` / `spider*` + `spiderName`(キー重複は i18n テストが機械検証)                                                                          |
| グリフ          | Spider Solitaire `♣` / FreeCell `♥`(Solitaire の `♠` と合わせ、カード3本がスートを着る。**Phase 1 で入れ替え**)                                              |
| アクセント色    | **Phase 1 で実測のうえ当初案から変更**: Spider Solitaire = 深い緑 `#31802f` / `#7fcc7d`、FreeCell = くすんだ菫 `#853795` / `#c288d0`(下記「Phase 1 の結果」) |
| スーパームーブ  | FreeCell の複数枚移動は **1 手**と数える(Klondike の `moveTableauRun` と同じ)                                                                                |
| Spider デイリー | その時点のスート設定を**継承**する(Klondike のデイリーが Draw 設定を継承するのと同型)                                                                        |

## 前提(調査済み)

**Solitaire(4,913 行 / 42 ファイル)が型と作法の正本。**両ゲームとも同じ骨格
(`game/ state/ storage/ ui/ i18n/`)で作る。踏襲する設計は:

- **カードは整数**(`suit * 13 + (rank - 1)`)。表裏はカードのフラグではなく置き場所
  (`pile.down` / `pile.up`)で表す。`isValidBoard()` が全 52 枚の存在一意性まで検証し、
  storage のバリデータがそれを再利用する。
- **Undo は盤面スナップショット**(`{ board, moveCount }`、上限 2000、復元でめくりも戻る)。
  履歴は保存しない。
- **`rng.ts`(xmur3 + mulberry32 + Fisher–Yates)はゲームごとにコピーが正**。共有しない
  (13 ゲームすべてがコピーを持つ。抽出の判断は保留中のまま)。
- デイリーは per-game 実装(`game/daily.ts` + `state/progressLogic.ts` +
  `ui/screens/DailyScreen.tsx`)+ 共有クローム。**過去 30 日は無条件に開く**
  (Solitaire 型。進行でゲートする Sudoku 型にしない)。達成記録は `stats.dailyMoves`
  (疎マップ)から導出し、カレンダー専用レコードは持たない。
- 盤面幅は `width: min(100%, 420px)`(**vw を使わない**)。列は `repeat(N, 1fr)`、
  カードは `aspect-ratio: 5/7`、重なりは列幅基準の負のマージン(%)。
- 移動アニメは pointerdown 時に `offsetLeft/offsetTop` でレイアウトを捕まえ、
  `useLayoutEffect` で差分を `el.animate()` する FLIP。reduced-motion で全停止。
  新規配札は再生しない(`moveTick` ゲート)。
- **タップ移動のみ**(ドラッグは §13 の意図的な差分)。選択 → 合法先ハイライト → 確定。
  保持カードへの 2 度目のタップは Foundation 送り。**無効操作を叱らない**
  (`sounds.invalid` / `haptics.invalid` を呼ばない。選択が移るだけ)。
- カード面は両テーマとも紙のまま(赤黒の区別はゲーム内容)。ゲーム CSS が色を書く
  唯一の例外として各 CSS のヘッダに理由を書く(Solitaire 前例)。行き先ハイライトは
  フェルトともカードの赤とも離れた色。
- プレイ時間は ref + 可視時のみ加算 + **bookedRef 方式の逐次計上**(`ca015a2` の
  背景化テストパターンを Root テストに複製する)。時計はプレイ中に表示しない。
- スコアは作らない。指標は手数と時間だけ(§4 / §13)。
- 勝利時のみ `recordGameCompleted()`(REVIEW_PROMPT_POLICY)。

**ゲーム追加の接続点は調査済み**(2026-08-06 の 2 本追加コミットが実物)。ゲーム
フォルダを作ればチャンク・lifecycle 掃除・i18n ゲート・境界ゲート・サイズ計測は
自動編入。手で触るのは: `app/registry.ts`(union + keys import + 1 要素)/
`app/gameKeys.test.ts`(RELEASED_KEYS + PREFIXES の行追加)/ `ui/styles.css`
(アクセント 2 ブロック × 2 ゲーム)/ `packages/brand` の `titleAccents` /
`size-baseline.json`(`pnpm size:update`)/ `ui/landing.ts` は**触らず**
`landing.test.ts` の「リンクなし」配列に 2 id を足す(ガイド公開後に
`PUBLISHED_GAME_IDS` へ入れるのは別リリース)/ 文書類(Phase 4)。

## ゲーム仕様の要点(ルール文書の骨子)

ルール文書は 2 本とも既存の 13 章テンプレートで書く(盤面 / 勝利条件 / 操作 /
手数・時間 / 配札 / デイリー / (ゲーム別章) / Undo と Hint / 統計 / 中断と再開 /
Quick Rules / 演出とアクセシビリティ / 意図的な差分)。以下は各章に入る決定。

### FreeCell

- **盤面**: 8 カスケード(左 4 列 7 枚・右 4 列 6 枚)+ フリーセル 4 + Foundation 4。
  **52 枚すべて表向き**。`Pile` の down/up 分割は不要 — 盤面型は
  `{ cells: (Card | null)[4], foundations: Card[][4], cascades: Card[][8] }`。
  上段はセル 4 + Foundation 4 = 8 スロットで下の 8 列とグリッドが揃う。
- **移動**: 単カード → 空セル / Foundation(同スート昇順)/ カスケード(色違い降順、
  空列は何でも可)。**スーパームーブ** = 色違い降順の並びを
  `(1 + 空セル数) × 2^(空列数)` 枚まで一括移動(**移動先が空列のときその列は
  乗数に数えない**)。エンジンは容量チェック付きの原子的移動として実装し、
  §13 に「単カード移動の糖衣である」ことを記録する。1 スーパームーブ = 1 手。
- **オートフィニッシュ**(§7): `canAutoFinish(board)` = 「Foundation 送りだけの貪欲
  シミュレーションが 52 枚に到達する」こと(有限・安価・正確)。ボタンの見た目と
  手数の数え方(送った枚数ぶん加算)は Klondike と同じ。常時の安全自動送りは
  作らない(§13 — タップ 2 度目の Foundation 送りで足りる)。
- **手詰まり検知**: FreeCell は合法手が有限なので `hasAnyMove(board)` が安価。勝利前に
  合法手ゼロになったら静かな通知を出し、**同じ配札への再挑戦と新しい配札をどちらも
  無料・無制限**で提示する(Klondike は draw が常にあるため存在しない章。§2 に書く)。
- **助け(§8)**: **Undo 無制限・Hint なし**。理由は Sliding Puzzle と同じ「盤面に隠れた
  情報がなく、次の一手を教えることはパズルの肩代わり」— この対比(Klondike / Spider
  には Hint がある)を両方のルール文書に明記する。`hintCount` も持たない。
- **配札と可解性(§5)**: シード `fc-free-<token>` / `fc-daily-<YYYY-MM-DD>`。可解性
  スクリーニングは行わない。ただし Klondike と違い「ランダム配札のほぼすべて
  (99.999% 超)が原理的に可解」であることを§5 に**正直に**書く — 保証はしない、
  ソルバーも走らせない、稀な不可解配札に当たりうる、と。
- **storage**: `fc.saveGame` / `fc.saveDaily` / `fc.stats` / `fc.flags` の **4 キー**
  (設定トグルがないので prefs を作らない)。`PersistedGame` v1 = mode / seed /
  dailyDate / cells / foundations / cascades / moveCount / elapsedSeconds / savedAt
  (hintCount なし)。スロットは free / daily の 2 つ(Solitaire 同型)。
- **統計(§9)**: played / won / totalPlaySeconds / bestMoves / bestSeconds /
  dailyMoves / dailySeconds — Solitaire の `Stats` から drawThree 関連を除いた同型。
- **Quick Rules(§11)**: ① 色違いで降順に重ねる(黒 8・赤 7・黒 6 の図 — 図自体が
  ルールに従う) ② フリーセルは 4 枚だけの一時置き場(セルへ動く図) ③ スートごとに
  A→K を積めば勝ち(A♥2♥3♥ の図)。図はカード描画と同じ部品(`CardsFigure` 相当)。
- **i18n**: 30 キー前後(セル・列・Foundation のアクセシビリティラベル、手詰まり通知、
  オートフィニッシュ、勝利、統計、チュートリアル 3×2)。高リスクキーなし。

### Spider Solitaire

- **カードの同一性(設計上の要)**: 2 デッキ 104 枚には同スート同ランクが 2 枚ずつ
  存在する。整数カードをそのまま流用すると値が重複し、`isValidBoard` の一意性検証と
  アニメーションの `Map<Card, [x,y]>` が壊れる。**カード = 一意な 0..103** とし、
  `rank = card % 13 + 1`、`copy = floor(card / 13)`(0..7)、スートは難易度から導出:
  1 スート → 常に ♠、2 スート → `copy % 2`(♠♥)、4 スート → `copy % 4`。
  シャッフルは 104 要素 1 回で、**同じシードなら難易度が違っても並びは同じ**
  (スートの読み替えだけが変わる)。
- **盤面**: 10 列(左 4 列 6 枚・右 6 列 5 枚 = 54 枚、各列の最上段だけ表)+
  山札 50 枚(10 枚 × 5 回)+ 完成ラン置き場 8。`Pile { down, up }` は Klondike 同型。
  上段は山札(残り回数の表示付き)+ 完成ラン 8 スロット。
- **移動**: 表向きの**同スート降順ラン**は何枚でも一括移動。置き先は「ランク +1 の
  カード(スート不問)」または空列。K→A の同スートランが完成したら自動的に取り除き、
  露出した裏カードをめくる(`normalized(pile)` パターン)。取り除きは 0 手(完成させた
  移動が 1 手)。8 ラン完成で勝利。
- **配札(山札)**: タップで全 10 列に 1 枚ずつ表で配る。**空列があるあいだは配れない**
  (古典ルール)。塞がっているときのタップは静かなトーストで理由を言い、無効音は
  鳴らさない。配札も 1 手で、Undo はスナップショットなので配札もラン完成もそのまま戻る。
- **難易度(§ゲーム別章)**: 1 スート(Easy)/ 2 スート(Medium)/ 4 スート(Hard)。
  ホーム画面のトグルで選び、`ss.prefs` v1 `{ suitCount: 1 | 2 | 4 }`(既定 1)に保存、
  **次の配札から適用**(Klondike の Draw トグルと同文)。デイリーは現在の設定を継承。
- **助け(§8)**: Undo 無制限 + **Hint(定石の合法手・ソルバーではない)**。優先度:
  ① 裏カードをめくれる同スートのラン移動 ② 裏カードをめくれるスート不問の移動
  ③ 同スートのランを伸ばす移動(長い方を優先) ④ 空列を作る移動 ⑤ 配札。
  Foundation から戻す提案はしない・めくりを生まない横滑りの循環は提案しない
  (Klondike の設計文と同じ書き方で §8 に記録)。
- **配札と可解性(§5)**: シード `ss-free-<token>` / `ss-daily-<YYYY-MM-DD>`。可解性
  スクリーニングなし(4 スートは不可解配札が現実に出る — §5 に正直に書き、
  「勝てない配札もある」を統計の勝率表示の前提にする)。
- **storage**: `ss.saveGame` / `ss.saveDaily` / `ss.stats` / `ss.flags` / `ss.prefs` の
  **5 キー**(Solitaire 同型 + suitCount)。`PersistedGame` v1 に suitCount を含める
  (mode / seed / suitCount / dailyDate / tableau / stock / completedRuns /
  moveCount / hintCount / elapsedSeconds / savedAt)。
- **統計(§9)**: スート数ごとに played / won / bestMoves / bestSeconds を分けて持つ
  (`perSuit: { '1' | '2' | '4': … }`)+ totalPlaySeconds + dailyMoves / dailySeconds。
  実装時に Minesweeper の難易度別統計の実物と形を揃えること。
- **スコアなし**: 古典の 500 点方式は作らない(Klondike §4/§13 と同じ判断)。
- **Quick Rules(§11)**: ① ランク順に重ねる — スートは違ってよい(9♥ に 8♠ の図)
  ② 同スートの並びはまとめて動く。K→A で列から消える(同スートランの図)
  ③ 山札タップで全列に 1 枚ずつ。空列があると配れない(山札と 10 列の図)。
- **i18n**: 32 キー前後(スート数ラベル、山札・完成ラン・列のラベル、空列トースト、
  勝利、難易度別統計、チュートリアル 3×2)。高リスクキーなし。
- **レイアウトの注意**: 10 列は本シリーズ最多(Klondike 7 列)。320px 幅でカード幅
  約 28px — 角のランク + 小スート表示が `clamp()` でどこまで読めるか **Phase 3 の
  最初に 320 / 360 / 420px で実測**し、読めなければ数字を優先しスートを角から
  落とす(中央の大スートは残る)などの調整を §12 に記録する。

### カード描画の共有方針

`suits.tsx`(48 行)・`cardText.ts`(29 行)・カード面 CSS(トークンブロック含む
~150 行)は **Solitaire からゲームごとにコピーする**(`rng.ts` と同じ「コピーが正」の
前例)。盤面コンポーネントはレイアウトが三者三様(7 列表裏 / 8 列全表 + セル / 10 列
2 デッキ)なので最初から別物として書く。`games/A → B` import は禁止であり、既存
Solitaire を触ることは「ゲーム追加が既存ゲームの挙動を変えてはならない」に反するため、
**このリリースでは抽出しない**。3 重化した時点で共通化候補として測れるようになるので、
リリース後に独立のリファクタ PR として判断する(フォローアップに記載)。

## フェーズ分割

### Phase 1 — ブランド整備(小)

1. `packages/brand` の `titleAccents` に `freecell` / `spiderSolitaire` を追加
   (light/onLight/softLight/dark/onDark/softDark + 色相選定理由のコメント)。
2. `apps/simple-games/src/ui/styles.css` にアクセント 2 ブロック × 2 ゲーム
   (ring は `rgba()` 直書き。light `.38/.12`、dark `.42/.14` — `color-mix` 不可)。
3. `docs/ARCHITECTURE.md` / `docs/BRAND.md` のアクセント表に 2 行追加。
   **BRAND.md の表は 10 行のまま古い**(Brick Breaker / Sky Fighter / Bunny Hop 欠落、
   「収録済みの 12 タイトル」も古い)— この機会に現状へ直す。
4. コントラスト検証(両テーマ・4.5:1 / 3:1)を通してから確定する。

#### Phase 1 の結果(実施済み・当初案から 2 点変更)

**アクセントは当初案のスチールシアン / ワインを採らなかった。**候補を機械的に絞って
(白文字 4.5:1・紙に 3:1・シリーズの彩度明度レンジ)既存 13 色との CIELAB ΔE を測ったところ、
**シアン〜青の帯(色相 135°〜225°)はどの値を採っても既存色に近づきすぎる**ことが分かった
— この帯で到達できる最大距離は ΔE 13.9〜16.3 で、Water Sort・Minesweeper・Number Match の
3 色が塞いでいる。ワイン案も別の理由で落とした: 裏向きカードの裏面は
`--accent-ring-soft` で描くため、暖色にすると裏面とハートが同じ一瞥に答えてしまう。
Spider は裏向きカードが全タイトル中で最も多い。

較正の基準も途中で直した。当初は「Minesweeper × Number Match の ΔE 17.2 が最接近ペア」
と見積もっていたが、全 78 ペアを実測すると**実際の最接近は Nonogram × Sky Fighter の
ΔE 10.9(ダーク 7.9)**だった。これを下回らないことを基準にした。

確定値と実測(すべて基準を満たす):

| ゲーム           | ライト    | ダーク    | 最も近い既存色       | ΔE(ライト / ダーク) |
| ---------------- | --------- | --------- | -------------------- | ------------------- |
| Spider Solitaire | `#31802f` | `#7fcc7d` | Solitaire のフェルト | 21.9 / 20.3         |
| FreeCell         | `#853795` | `#c288d0` | Nonogram のプラム    | 22.6 / 14.5         |

どちらも既存の最接近ペア(10.9 / 7.9)より**離れて**いる。コントラストは
白文字 7.05:1(FreeCell)/ 4.93:1(Spider)、紙に対して 6.20:1 / 4.33:1、
ダークも全項目クリア。手順は BRAND.md「アクセントを選ぶ手順」に残した。

**グリフも入れ替えた。**2 列グリッドでは Solitaire(2 番)の真下が 4 番になるため、
4 番に `♣` を置くと 4 スート中もっとも似たシルエットの組が縦に並ぶ。3 番を `♣`、
4 番を `♥` にして、`♠` の真下には最も形の違う `♥` が来るようにした。
緑の `♣`(クローバー)と菫の `♥` という色との相性も、この並びの方が素直である。

### Phase 2 — FreeCell 本実装(大)

- `game/`: types(cells/foundations/cascades 型と `isValidBoard`)、rng(コピー)、
  deal(左 4 列 7 枚 + `boardToString` シリアライザ)、daily、engine(移動述語 +
  遷移関数 + スーパームーブ容量 + `hasAnyMove` + `canAutoFinish` シミュレーション)、
  session(`do*` ラッパ + スナップショット Undo + restart/restore)、index。
- テスト: engine(配札形状・決定性、色違い降順、空列、セル、スーパームーブ容量
  **±境界と空列先の乗数除外**、オートフィニッシュ、手詰まり検知が偽陽性を出さない
  こと)、session(シード固定・Undo・restart・restore)、
  **compatibility(v1 golden を最初から敷く** — daily 1 本 + free 1 本の
  `boardToString` 完全一致。ヘッダに「直すのは実装であってテストではない」の契約文)。
- `state/`: GameContext(screen 遷移 / free・daily 2 スロット / bookedRef 計上 /
  visibilitychange + Capacitor pause / ハードウェア back)、statsLogic、progressLogic。
- `storage/`: keys(**ゼロ import**)、schemas(`isValidBoard` 再利用・daily マップ上限
  2000・クロスフィールド検証)、gamePersistence(勝利済みレコードは復元しない)。
- `ui/`: FreeCellRoot(+ Root テスト: 背景化 8 秒問題の複製・初回 Quick Rules・
  2 タップ移動・裏カードなしでも `data-card` の枚数検証・時計とストリークの不在)、
  freecell.css(カード面トークンのコピーとヘッダの理由文)、components(Table +
  ResultOverlay + suits + cardText)、screens(Home / Game / Daily / Stats / Tutorial)。
- `docs/FREECELL_RULES.md`(13 章)、i18n 14 ロケール + index
  (`registerGameMessages('freecell', …)` + `declare module` ブロック)。
- 接続: registry(union + `FC_STORAGE_KEYS` import + **4 番目**に 1 要素)、
  gameKeys.test(fc 行)、landing.test の「リンクなし」配列、`pnpm size:update`。

### Phase 3 — Spider Solitaire 本実装(大)

- 最初に **10 列レイアウトの実測**(320 / 360 / 420px、ライト / ダーク)。ここが
  通らない設計は残り全部が無駄になるため、静的モックで先に判定する。
- `game/`: types(**0..103 の一意カード + suitCount からのスート導出**)、rng(コピー)、
  deal(54 + 50、シャッフルは難易度非依存)、daily、engine(同スートラン判定・
  ランク +1 置き・空列・配札ブロック・ラン完成の自動除去とめくり)、session、hint
  (5 段優先)、index。
- テスト: engine(配札形状・**同シードで難易度を変えるとスートだけ変わる**こと・
  ラン完成の除去とめくり・空列で配れない・完成済みランは動かない)、session、hint
  (めくり最優先・循環を提案しない)、compatibility(v1 golden ×
  スート数 3 通り + daily)。
- `state/ storage/ ui/ docs/SPIDER_SOLITAIRE_RULES.md / i18n` は Phase 2 と同型。
  Home にスート数トグル(`aria-pressed`、次の配札から適用の注記)、Stats は難易度別、
  registry は **3 番目**、gameKeys.test に ss 行、size:update。

### Phase 4 — 文言スイープとリリース準備

1. **数と列挙の更新**(2 本がそろうリリースに同乗):
   - `README.md` — 収録本数、ゲーム表 2 行(進行 = フリー配札 + デイリー、助けの形)、
     「助けの内容が…」段落に FreeCell の Hint なし / Spider の Hint ありの理由 1 文ずつ、
     リポジトリ構成ツリー(**2048 / block-puzzle が既に欠けている** — 併せて直す)、
     後続候補行から今回の 2 本を消す。
   - `apps/simple-games/index.html` — description / og(**現状 "Twelve classic games"
     のまま Bunny Hop 欠落** — 実数に直して 2 本を足す)。
   - `apps/simple-games/store/listing.md` — 収録本数・INCLUDED GAMES・キーワード優先順
     (`freecell` / `spider solitaire` は検索語として強いので上位へ)。
     **Play Console への反映は手動・要承認**。
   - `docs/ARCHITECTURE.md`(registry id 列挙・ストレージキー表・i18n カタログ数と
     キー数計)/ `docs/I18N_POLICY.md`(キー数・「10 本の games/…」手順文)。
   - スイープ: `grep -rniE "thirteen|twelve|1[23] ?本|1[23] games" README.md docs apps/simple-games --include="*.md" --include="*.html" --include="*.ts" --include="*.tsx"`
     で取りこぼしを拾う(リバーシ / コネクト 4 が先に入っていれば実数はその分ずれる)。
2. **品質ゲート**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
pnpm --filter simple-games build:web && pnpm --filter simple-games size:check` +
   `format:check`、`.github/scripts/check-principles.sh`、
   `check-dist-ads-separation.sh`。lifecycle 掃除・i18n ゲート・境界ゲートは自動編入。
3. **実機確認**(RELEASE_CHECKLIST §2 に加えて): 機内モードで 2 本を初回起動から
   通しプレイ / 320px 幅で Spider の 10 列とタップ精度 / 中断 → プロセス kill → 復元 /
   デイリーの日付またぎ / ライト・ダーク両テーマのカード面。
4. **Codex レビュー**: `games/*/game/`・`storage/`・`i18n/`・`packages/brand/` を触る
   ため各 PR の push 前に必須。

## PR とリリース

- PR1: Phase 1 + 2(FreeCell 一式 + brand)
- PR2: Phase 3(Spider Solitaire 一式)
- PR3: Phase 4(文言スイープ。2 本マージ後)
- 3 つ揃ってから 1 タグでリリース。Web 版への先行公開はアプリのタグに先行してよい
  (WEB_VERSION.md「先行公開」。コードでチャンネルを表現しない — 2026-08-06 決定)。
  タグ発行・versionCode・ストア公開は明示承認が必要。

## リスクと対処

| リスク                                       | 対処                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Spider 10 列が 320px で読めない              | Phase 3 冒頭に静的モックで実測。角はランク優先・スート縮小 / 省略の順で調整し §12 に記録           |
| 2 デッキの重複カードが検証とアニメを壊す     | カード = 一意 0..103 + スート導出を最初から採用(本文書で設計済み)。golden がスート導出の回帰も固定 |
| スーパームーブの容量式の誤実装               | `(1+セル)×2^空列` と**移動先空列の除外**を境界値テストで固定                                       |
| FreeCell 手詰まり検知の偽陽性                | `hasAnyMove` は全種の合法手を列挙する純関数として単体テスト(勝てる局面を stuck と言わないこと)     |
| golden 未整備のまま乱数や配札に触れる回帰    | compatibility.test.ts を各ゲーム最初のコミットから敷く(Solitaire と同じ契約文)                     |
| アクセント 2 色が既存 13 色や警告色と近い    | Phase 1 で距離とコントラストを検証してから確定。BRAND.md の基準値を PR に記載                      |
| MT 12 言語の品質                             | ゲーム文言のみで高リスクキーなし。placeholder 整合は i18n テストが機械検証                         |
| 2 本同時でレビュー量が大きい                 | PR を 3 分割し、リリースは 1 回に束ねる(前例どおり)                                                |
| 収録本数の文言がリバーシ / コネクト 4 と競合 | 本数はハードコードせず Phase 4 のスイープでマージ時点の実数に合わせる                              |

## 実施結果(2026-08-07 — Phase 1〜4 完了)

4 フェーズすべてを実装済み。収録は 13 本から **15 本**へ。テストは 1052 から
**1155** へ(FreeCell 47・Spider 50・既存の landing テスト更新)。lint / 型検査 /
ビルド / Web ビルド / サイズ Gate / 原則ガード / Web 分離チェックはすべて緑。
チャンクは gzip で FreeCell 19.8KB、Spider 22.6KB(予算 500KB)。

計画から変えたのは 3 点で、いずれも実測の結果である。

**1. アクセント 2 色(Phase 1)。**当初案のスチールシアンとワインを採らなかった。
詳細は上の「Phase 1 の結果」。

**2. Spider の角インデックスを横並びにした(Phase 3)。**計画は「320px で読めるか
実測し、読めなければ調整」としていた。実測の結果、**縦積み(他のカードゲームと同じ
形)では読めない**ことが分かった — 10 列では重なったカードが覗かせるのは約 11px で、
縦積みのインデックスは約 22px を要求するため、K・Q・J のランクが半分に切れる。
ランクの横にスートを置く形に変え、盤面幅の上限も 420px ではなく 460px にした。
静的モックを 320 / 360 / 420px × ライト / ダークで描いて判断している
([SPIDER_SOLITAIRE_RULES.md](../SPIDER_SOLITAIRE_RULES.md) §12)。

**3. FreeCell に「組札から戻す移動」を作らなかった。**計画には書いていなかったが、
古典のルール集に従い、取り消しは Undo が担う形にした
([FREECELL_RULES.md](../FREECELL_RULES.md) §13)。Solitaire は戻せるので、
これはカード 3 本の間の意図的な差である。

実装中にテストが書き留めた性質が 2 つある。**FreeCell では、複数枚移動ができる盤面には
必ず 1 枚移動もできる** — 容量が 2 以上になる条件(空きセルか空き列)は、それ自体が
1 枚のカードの行き先だからである。したがって「1 枚も動かせないが並びなら動かせる」
盤面は存在しない。そして **Spider では、同じシードなら難易度を変えてもカードの位置が
変わらない**ことをゴールデンテストが固定した(スート数のフィールドだけが変わる)。

Phase 4 のスイープでは、今回の 2 本と無関係に古かった記述も直した: `index.html` の
"Twelve classic games"(Bunny Hop が抜けたまま)、README のリポジトリ構成ツリー
(2048 / block-puzzle が抜けたまま)、`landing.test.ts` の「ガイド未公開」配列
(bunny-hop が抜けたまま、コメントは「これら 3 本」と言いながら 2 本)、
`ARCHITECTURE.md` の registry id 列挙・CSS 規約の「10 タイトル」・i18n のキー数
(78 + 257 → 79 + 388)、`I18N_POLICY.md` の同じキー数と「10 本の games/…」手順文、
`BRAND.md` のアクセント表(3 タイトル欠落)。

## フォローアップ(このリポジトリ外・リリース後可)

- pixapps-landing に 2 本の Learn More ガイド(en / ja / es)を追加し、公開後に
  `landing.ts` の `PUBLISHED_GAME_IDS` へ 2 id を足す(landing.test.ts も更新)。
  それまでチュートリアルの Learn More ボタンは自動的に出ない(仕組み済み)。
- ストアのスクリーンショット更新。Data Safety は変更なし(通信・収集の変化なし)。
- カード描画(suits / cardText / カード面 CSS)が 3 重化するので、共通化するかを
  独立のリファクタ PR として判断する(「重複が確認されてから抽出」の原則。
  Solitaire の golden と Root テストが挙動不変の証明になる)。
- Snake 作り直しの判断は本計画と無関係に保留のまま(2026-08-06 計画に記録済み)。
