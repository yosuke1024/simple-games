# Crown Grid / Number Path / Shape Regions — Web 先行公開 3 本の実装計画 (2026-09-26)

issue #194 の 3 本を、**Web 版の先行公開(ベータ)チャンネル**として実装する
([WEB_VERSION.md](../WEB_VERSION.md)「先行公開(ベータ)」— 2026-08-03 に方針だけ決まり、
このリリースで初めて実体を持つ)。アプリ(Android / iOS)には**正式収録しない**。
コードは同じバンドルに入るが、シェルの実行時ガードが native では 3 本を隠す。

**この文書は着手時点の実装計画である。**仕様の正本は各ルール文書
(`docs/CROWN_GRID_RULES.md` / `docs/NUMBER_PATH_RULES.md` /
`docs/SHAPE_REGIONS_RULES.md`)で、実装と同じ PR で起こし、以後はそちらが勝つ。
LinkedIn の名称・アセット・画面デザインは複製しない。古典的なメカニクス
(Star Battle 系 / Hamiltonian path 系 / 多角形分割系)を Simple Games の名前と表現で作る。

## 決定事項

| 項目        | Crown Grid                                           | Number Path                      | Shape Regions              |
| ----------- | ---------------------------------------------------- | -------------------------------- | -------------------------- |
| id          | `crown-grid`                                         | `number-path`                    | `shape-regions`            |
| 保存接頭辞  | `cg.`                                                | `np.`                            | `sr.`                      |
| i18n 接頭辞 | `crownGrid*`                                         | `numberPath*`                    | `shapeRegions*`            |
| カテゴリ    | `logic`                                              | `logic`                          | `logic`                    |
| グリフ      | `♛`(U+265B)                                          | `↝`(U+219D)                      | `▙`(U+2599)                |
| 進行        | 難易度 3 種 + デイリー(Minesweeper 型)               | 同左                             | 同左                       |
| 助け        | Hint(Undo なし — タップ循環)                         | Undo(1 手 = 1 ストローク)+ Hint  | Undo + Hint                |
| 保存キー    | saveGame / saveDaily / stats / flags / prefs(5 キー) | 同左                             | 同左                       |
| チャンネル  | `web-beta`                                           | `web-beta`                       | `web-beta`                 |
| アクセント  | ブラス `#7e673e` / `#cdb87e`                         | ペトロール `#29606a` / `#7ecdc3` | 深紫 `#57317d` / `#a37bcc` |
| README 併記 | 王冠配置パズル                                       | 数字の一筆書き                   | 図形分割                   |

- **Tango 系は作らない**(Takuzu と中核ルールが重複 — issue #194)。
- **100 レベルは作らない。** issue の要求は EASY / MEDIUM / HARD が実際の解法難度に
  対応することであり、Minesweeper / Memory Match の「難易度 3 種 + デイリー」がそのまま
  合う。デイリーは **Medium 固定**(曜日で当たり外れを作らない — Sudoku §10)。
  過去 30 日は無条件に開く(Nonogram / Minesweeper と同じ)。ストリークは数えない。
- **接頭辞の空きは確認済み**(既存 30: `sd so ss fc ms ng nm ws sp mm bb sf tm bp ck rv
c4 gm bh qm st nr kk ft tk ht gr mj bu ld`)。`scripts/new-game.mjs` が衝突を拒否する。
- **アクセント 3 色は BRAND.md「アクセントを選ぶ手順」で機械選定済み**(下の Phase 1)。
- **ストア掲載文・landing のガイド・`PUBLISHED_GAME_IDS` には入れない**
  (正式収録まで — `apps/simple-games/store/listing.md` / `ui/landing.ts` の既存規則)。

## 共通要件(3 本とも)

- 骨格は Minesweeper を写す: `game/ state/ storage/ ui/ i18n/`、
  `session.ts` / `generator.ts` / `solver.ts` / `daily.ts` / `serialize.ts` /
  `types.ts` / `rng.ts`(コピー)/ `index.ts`、5 スクリーン
  (home / tutorial / daily / game / stats)、`GameContext` は elapsedRef / bookedRef、
  visibilitychange + pause + backButton の `syncActiveGame` 合流、クリア時
  `recordGameCompleted()`。**中断は 2 スロット独立**(difficulty / daily)で、どちらの
  モードかは**キー**が決める(`gameSlotSchema(key, expectedMode)`、
  `src/test/savedGameSlots.test.ts` が強制。`storage/slots.test.ts` を必ず置く)。
- `prefs` は「最後に選んだ難易度」だけ(ゲームの遊び方を変える設定は作らない)。
- **一意解を生成時に構成として保証する。**ソルバーは 2 つ持つ: 解の個数を数える
  完全探索(生成の門)と、人間の技法を積んだ技法ソルバー(難易度の門 + Hint)。
  技法ソルバーは健全(sound)にし、技法だけで全確定できた出題はそれだけで一意である。
- **難易度は技法の集合で定義し、上位ティアは下位ティアの技法だけでは解けない盤面を
  選ぶ**(issue: サイズだけで難易度を変えない)。試行上限に達したら「そのティアの技法で
  解ける最善の候補」を `fallback` 付きで出荷する(Takuzu §6 と同じ形)。
  `guarantee.test.ts` が 2 年分のデイリー + 難易度ごとの固定シード群を走査し、
  fallback 率 0・一意・仕事量予算を固定する。
- **性能の門は仕事量**(探索ノード数・試行回数)で、壁時計は出力するだけ。生成は UI
  スレッドで同期に走らせる(Worker は使わない — GAME_LIFECYCLE.md)ので、**開発機で
  Hard 1 面が 100ms 以内**に収まる設計にすること。収まらなければ Hard の盤面サイズを
  1 段下げる(本文書を更新してから)。
- シード: 難易度は `<id>-<difficulty>-<token>`(token は Takuzu の `newSeedToken`)、
  デイリーは `<id>-daily-<YYYY-MM-DD>`(端末ローカル日付)。同シード同盤面を
  `compatibility.test.ts`(golden)で固定する — ベータ中はスキーマ変更が許されるが、
  黙って変えないための門として最初から敷く。
- 盤面に翻訳の要る文字を置かない(数字は ASCII、記号はアイコン)。色だけで状態を
  識別させない(色 + 太線 / 記号 / 読み上げ)。セルはボタンで位置と状態を読み上げる。
- **時計を出さない・ミス上限なし・ゲームオーバーなし。**統計は難易度別
  played / solved / totalPlaySeconds / bestSeconds + `dailyTimes`(Minesweeper と同形)。
- Quick Rules は 3 ステップ・図中心・1 文ずつ。Learn More は出ない(ガイド未公開)。
- 高リスクキーは発生させない(ゲーム文言に無料・オフライン・課金の約束を書かない)。
- 通る門(すべて `pnpm test` の中): gameKeys / importBoundaries / gameI18nWiring /
  homeActionsWiring / shareWiring / refLeading / savedGameSlots / lifecycle /
  modalIsolationWiring / gameBackButtonWiring / tutorialBackWiring /
  shortcutResumeWiring / pointerContractWiring(ドラッグを持つ 2 本)/ i18n 全カタログ。

## 1. Crown Grid(Star Battle 1 星型)

- **盤面(§1)**: N×N を N 個の連結な色領域に分割。Easy 6×6 / Medium 8×8 / Hard 9×9。
  10×10 以上は作らない(1 マスが指のサイズを下回る — Nonogram §1)。
- **ルール(§2)**: 各行・各列・各領域に王冠ちょうど 1 つ。王冠同士は 8 近傍で接しない。
  出題は常に一意解。**勝利**: 王冠が N 個置かれ、規則を 1 つも破っていないとき
  (解との照合ではなく規則で判定。一意解なので一致する)。
- **操作(§3)**: タップで 空 → × → 王冠 → 空 の循環。**ドラッグは × を置くだけ**
  (空マスにのみ書く。王冠や既存の × には触れない。ストロークの開始マスは指が 2 マス目に
  達した時点で × になる — Nonogram の stroke と同じ「動いたらストローク」の判定)。
  長押し・モード切替・自動 × は作らない(§意図的な差分: 自動 × は「どこが埋まるか」を
  読む作業そのものを肩代わりする)。キーボード: H = Hint。
- **違反表示(§4)**: 常時 — 同じ行 / 列 / 領域の 2 つ以上の王冠、接している王冠を warn で。
- **Hint(§5)**: 無料・無制限。順に (1) 違反があればそこを示す (2) 解に無い王冠が
  あればその 1 つを「この王冠は成立しない」として示す(一意解の出題なので誤りは定義
  できる。§意図的な差分に書く) (3) 技法ソルバーの次の一手 — `place`(このマスは王冠)
  または `eliminate`(このマスに王冠は置けない)を、根拠の行 / 列 / 領域ごと示す。
  マスを書き換えることはしない。プレイヤーの × は信用せず、王冠だけを前提に計算する。
- **技法(§6)**(候補 = まだ王冠を置きうるマス):
  - T1 single: 行 / 列 / 領域の候補がちょうど 1 マス → 王冠。王冠は行・列・領域・
    8 近傍の候補を消す。
  - T2 confinement: 領域の候補がすべて 1 行(1 列)に収まる → その行(列)の領域外の
    候補を消す。双対: 行(列)の候補がすべて 1 領域に収まる → その領域の行外の候補を消す。
  - T3 attack: あるマスに王冠を置くと(その行・列・領域・8 近傍で)どこかの行 / 列 /
    領域の候補が 0 になる → そのマスの候補を消す。
  - T4 set(K=2): 2 領域の候補が合わせて 2 行(2 列)に収まる → その 2 行の他領域の
    候補を消す。双対も。
  - T5 hypothesis(深さ 1): 候補マスに王冠を仮置きし T1〜T3 を不動点まで走らせて
    矛盾(候補 0 の家)→ 消す。
  - ティア: Easy = {T1, T2} / Medium = {T1〜T4} かつ Easy 集合では解けない /
    Hard = {T1〜T5} かつ Medium 集合では解けない。
- **生成(§7)**: (1) seed から王冠配置(順列 + 斜め非接触、バックトラック)
  (2) 各王冠を種にした多点ランダム成長で領域を切る(連結を保証、サイズにばらつき)
  (3) 完全探索で解を 2 つまで数え、一意でなければ派生シード `<seed>#n`
  (4) 技法ソルバーで等級判定、ティアに合えば出荷。上限 `ATTEMPT_LIMIT` で最善を fallback。
  仕事量 = 完全探索のノード数 + 技法ソルバーの走査数。
- **保存(§10)**: `cg.saveGame` v1 = mode / seed / difficulty / dailyDate / size /
  regions(1 マス 1 文字、'a'〜'i')/ solution(王冠の列 index を行順に)/ marks
  (1 マス 1 文字: '.' 空 / 'x' × / 'q' 王冠)/ hintCount / elapsedSeconds / savedAt。
  fail-closed: regions が N 個の連結領域でない・solution が規則を破る・marks に未知文字。
- **描画(§11)**: 領域は薄い地色 + **領域境界の太線**で区別(色はゲーム内容 — `crown-grid.css`
  に 9 色を持つ。ライト / ダークで各 9 色、地色の上のインクは 4.5:1 を満たす)。
  王冠と × はインク色の記号(♛ / ×)。読み上げ:「行 r・列 c・領域 k・空 / × / 王冠」。
- Quick Rules: ① 各行・各列・各色に王冠 1 つ ② 王冠どうしは斜めにも隣り合わない
  ③ タップで × → 王冠、なぞって × をまとめて置く。詰まったら Hint。
- i18n 30 キー前後。

## 2. Number Path(番号つき一筆書き)

- **盤面(§1)**: W×H。Easy 5×5 / Medium 6×6 / Hard 7×7。数字マス 1〜K
  (Easy 6〜8 / Medium 5〜7 / Hard 4〜6。1 は始点、K は終点)。一部の辺に壁。
- **ルール(§2)**: 1 から始めて上下左右に 1 本の道を引き、数字を 1 → 2 → … → K の順に
  通り、**全マスをちょうど 1 回ずつ**通って K で終わる。壁の辺は越えられない。
  出題は常に一意解。**勝利**: 道が全マスを覆い、末尾が K で、数字を順に通っている。
- **操作(§3)**: 道の末尾(最初は 1)を押して隣へなぞると伸びる。1 つ前のマスへ戻ると
  1 マス戻る(backtrack)。道の途中のマスをタップすると、そこまで道を切り詰める。
  末尾に隣接するマスをタップすると 1 マス伸びる(片手・キーボード用)。数字マスは
  順番どおりでなければ入れない(なぞっても伸びない)。K に着いたら伸びない。
  キーボード: 矢印で末尾から伸ばす / Backspace で 1 マス戻る / Ctrl+Z Undo / H Hint。
  マウス: 左ドラッグ。壁と非隣接は単に伸びないだけで、エラーを出さない。
- **Undo(§4)**: 1 手 = 1 ストローク(1 回のドラッグで伸びた全マス)/ 1 タップ伸長 /
  1 切り詰め。履歴は保存しない(再開時は空)。Retry(同じ盤面)は共通の tryAgain。
- **Hint(§4)**: (1) 現在の道が一意解の接頭辞でなければ、最初に外れたマスを示す
  (「ここまで戻る」) (2) 接頭辞なら次の 1 マスを示す(ソルバーが証明した唯一の続き —
  Water Sort §8 と同じ「証明付き」の助け)。マスを書き換えない。
- **生成(§6)**: (1) seed から Hamiltonian path — 蛇行の初期路に backbite 変換を
  十分回数かける(全マスを覆う道が常に得られる) (2) 数字: 始点 = 1・終点 = K、途中の
  番号を道上の位置から選ぶ (3) 壁: 道が使っていない隣接辺から選ぶ
  (4) 一意性: 探索ソルバー(未訪問マスの連結性・次の数字への到達可能性・行き止まりの
  枝刈り)で解を 2 つまで数える (5) 削減: 番号と壁を多めに置いてから、一意を保つ限り
  ティアの目標本数まで減らす(少ないほど難しい)。ティアの判定は「削減後の番号数 +
  壁数」と、ソルバーの分岐回数(推測なしで一本道に決まる度合い)の 2 軸で書く。
  仕事量 = ソルバーのノード数。
- **保存(§9)**: `np.saveGame` v1 = mode / seed / difficulty / dailyDate / width /
  height / numbers(マス index → 番号の疎な列)/ walls(辺の列挙: 'h'/'v' + index)/
  solution(マス index の列)/ path(マス index の列)/ hintCount / elapsedSeconds /
  savedAt。fail-closed: solution が Hamiltonian でない・壁を跨ぐ・数字順を破る、
  path が接頭辞規則(隣接・重複なし・壁・数字順)を破る。
- **描画(§10)**: 道は各マスの入口 / 出口方向から描く太線(DOM + CSS、Canvas なし)。
  数字はインクの ASCII 数字で、通過済みは強調。壁は太い辺。`touch-action: none`。
  pointercancel は道をそこで止める(描いたぶんは残る)。読み上げ:「行 r・列 c・
  番号 n / 道の n 番目 / 未通過」。
- Quick Rules: ① 1 から順に数字をたどる ② 全部のマスを 1 回ずつ通る ③ 壁は越えない。
  戻るときはなぞり返すか、途中をタップ。
- i18n 30 キー前後。

## 3. Shape Regions(図形分割)

- **盤面(§1)**: W×H。Easy 5×5 / Medium 6×6 / Hard 7×7。手がかりマスがいくつかあり、
  **手がかり 1 つにつき領域 1 つ**。領域は連結(上下左右)なポリオミノでサイズ 2〜6。
- **手がかり(§2)**: 数字(その領域のマス数)/ 形の記号(その領域の形カテゴリ)/ 両方。
  形カテゴリは 5 つで、全マスの読みでは:
  - **Line**(一直線): 全マスが 1 行または 1 列にある。
  - **Block**(長方形): 外接長方形が埋まっていて縦横とも 2 以上。
  - **Corner**(L 字): 角マス 1 つから水平の腕と垂直の腕が出ている(腕は各 1 マス以上)。
  - **Tee**(T 字): 長さ 3 以上の一直線に、端以外の 1 マスへ直交する 1 マスが付く。
  - **Step**(段違い): 隣り合う 2 行(2 列)に各 1 本の連続した線分があり、重なりが
    ちょうど 1 列(1 行)。
    この 5 カテゴリに入らない形(十字・W・U 等)は**出題しない** — 生成は 5 カテゴリの
    形だけで盤面を敷き詰めるので、どの領域も必ず 1 つのカテゴリを持つ。記号は小さな
    インライン SVG(言語非依存)、読み上げ名は i18n。
- **ルール(§3)**: 全マスがちょうど 1 つの領域に属し、各領域は自分の手がかりを 1 つだけ
  含み、数字 / 形の制約を満たす。出題は常に一意解。勝利は規則で判定。
- **操作(§4)**: 手がかりマス(またはその領域のマス)から隣へなぞると、通ったマスが
  その領域に加わる(領域は手がかりから連結に育つ — 隣接していないマスは加わらない)。
  他の領域に属するマスは上書きしない。領域のマスをタップすると外れる(外したことで
  手がかりから切り離されたマスも一緒に外れる)。手がかりマスは外せない。
  Undo(1 手 = 1 ストローク / 1 タップ)。キーボード: Ctrl+Z / H。
- **表示(§5)**: 各領域は薄い地色 + 領域境界の太線 + 手がかりマスに `現在/目標` の
  マス数(数字手がかりのとき)。サイズ超過・形カテゴリ不成立(完成時)は warn。
- **Hint(§6)**: (1) 解と違う割り当てを含む領域があればその領域を示す (2) 技法ソルバー
  の次の一手: 「このマスは領域 R にしか入れない」(候補配置の共通部分)または
  「領域 R の置き方は 1 つしかない」。根拠として候補配置の和集合を淡く示す。
- **技法(§7)**(各領域の候補配置 = 手がかりを含み・他の手がかりを含まず・確定済みの
  割り当てと矛盾しない・サイズと形を満たすポリオミノ):
  - T1 forced cell: あるマスを覆える候補配置がただ 1 つの領域のものだけ → そのマスは
    その領域(空のマスがどの領域にも覆えないなら矛盾)。
  - T2 sole placement: 領域の候補配置が 1 つ → 確定。
  - T3 common cells: 領域の全候補配置に共通するマス → 確定。
  - T4 hypothesis(深さ 1): 候補配置を 1 つ仮定して T1〜T3 を回し、矛盾なら除外。
  - ティア: Easy = {T1, T2, T3} / Medium = {T1〜T3} かつ Easy…(Medium は「数字だけ・
    形だけ」に削った手がかりの割合で差を付け、T4 なしで解ける) / Hard = {T1〜T4} かつ
    Medium 集合では解けない。
- **生成(§8)**: (1) seed から 5 カテゴリの形(サイズ 2〜6)だけで盤面を敷き詰める
  (最初の空マスに候補形をランダム順で試すバックトラック) (2) 各領域に手がかりマスを
  1 つ選び、数字 + 形の両方を与える (3) 完全探索(exact cover)で一意を確認
  (4) 削減: 一意を保つ限り、手がかりから形または数字を落とす(ティアごとの目標割合)
  (5) 技法ソルバーで等級判定。仕事量 = 候補配置の列挙数 + 探索ノード数。
- **保存(§10)**: `sr.saveGame` v1 = mode / seed / difficulty / dailyDate / width /
  height / clues(index / size|null / shape|null の列)/ solution(1 マス 1 文字:
  領域番号)/ assignment(1 マス 1 文字: 領域番号 or '.')/ hintCount / elapsedSeconds /
  savedAt。fail-closed: solution が手がかりを満たさない・assignment が非連結 / 他の
  手がかりを含む / 手がかりマスが自分以外の領域。
- Quick Rules: ① 数字はその形のマス数、記号はその形 ② 手がかりからなぞって形を
  育てる ③ 全マスがどれかの形に属したら完成。タップで外す。
- i18n 40 キー前後。

## Web 先行公開チャンネル(シェル側)

- `GameDefinition.channel?: 'web-beta'`。省略 = 全プラットフォームに正式収録。
- `app/gameChannel.ts`: `isGameAvailable(game)` = `channel !== 'web-beta' ||
!Capacitor.isNativePlatform()`。`availableGames()` はその filter。
- 使う場所: コレクションホーム(節・お気に入り棚・最近)/ `gameSearch` / `webRoute`
  の id 判定(= ショートカット URL の判定も同じ 1 か所)/ `favoriteGames` /
  `recentGames` の既知 id / 設定のお気に入りピッカー / `lazyRoots`。
  **`storageKeys`(Reset Local Data)とバックアップは全ゲームのまま**
  (Web で作った保存が native に復元されても壊れないようスキーマは常に登録)。
- 表示: タイトルカードに言語非依存の `BETA` バッジ。ゲームのホームには
  `WebBetaNotice`(シェル所有)— バッジ + セーブが消えうる説明文。説明文は
  **en / ja のみ**(高リスク文言 — 他言語はバッジだけ)、目的の形で書く。
- ドキュメント: WEB_VERSION.md「先行公開」の実装状況、PROJECT_CONTEXT.md の
  収録スナップショット、README.md に「Web 先行公開」節、I18N_POLICY.md のキー数。

## フェーズ

1. **Phase 1 — 接続点(本計画と同じコミット)**: `scripts/new-game.mjs` で 3 本を
   スキャフォールド、アクセント 3 色を styles.css / `titleAccents` / BRAND.md /
   title-accent.md に登録、css-split.md / storage-keys.md の一覧を更新。
2. **Phase 2 — 3 本の本実装(並行)**: 各ゲームはルール文書 → `game/`(テスト込み)→
   `storage/` → `state/` → `ui/` → i18n 14 言語の順。ゲームフォルダと自分のルール
   文書以外(registry / gameKeys.test / styles.css / README 等)には触れない。
3. **Phase 3 — Web 先行公開チャンネル**(Phase 2 と並行、シェル側)。
4. **Phase 4 — 検証**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build &&
pnpm --filter simple-games build:web && pnpm --filter simple-games size:check`、
   `bash .github/scripts/check-principles.sh`、ブラウザ試遊(ライト / ダーク、
   タッチ / マウス / キーボード)。

### Phase 1 の実施結果(2026-09-26)

BRAND.md「アクセントを選ぶ手順」を出荷済み 30 色 + `--warn` に対して実行した。
CIE76 で既存の最接近ペアはライト 10.9 / ダーク 7.9 のまま(床の 1.15 倍 = 12.5 / 9.1 を
要求)。色相はどの帯にも 30° 以内に既存色があるので、中央値帯(ライト S44 / L37、
ダーク S43 / L65)に寄せたうえで床を満たす値を選んだ。3 本は同じ節で隣り合うため
相互距離も測っている。

| ゲーム        | 色         | ライト    | ダーク    | 最接近(ライト / ダーク)                      | 白文字 / 紙 |
| ------------- | ---------- | --------- | --------- | -------------------------------------------- | ----------- |
| Crown Grid    | ブラス     | `#7e673e` | `#cdb87e` | Brick Breaker 13.0 / Brick Breaker 9.5       | 5.39 / 4.74 |
| Number Path   | ペトロール | `#29606a` | `#7ecdc3` | Water Sort 12.9 / Sudoku・Schulte Table 10.0 | 7.06 / 6.20 |
| Shape Regions | 深紫       | `#57317d` | `#a37bcc` | Reversi 13.0 / Reversi 10.1                  | 9.81 / 8.62 |

3 色の相互距離はライト 42.5〜71.7・ダーク 43.5〜77.5。ダークはいずれも暗い紙・暗い
インクに対して 5.36 以上。soft / onDark は既存の回帰(softLight = S×0.97 / L90%、
softDark = S×0.71 / L18%、onDark = L8%)で出した。
