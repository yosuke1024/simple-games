# 先行公開 3 本の盤面を、軽いまま豊かにする(2026-09-27)

対象: Crown Grid / Number Path / Shape Regions(Web 先行公開中 — [WEB_VERSION.md](../WEB_VERSION.md)「先行公開」)。
issue #194 の続き。**遊びの規則・入力・保存形式は一切変えない。**変えるのは描画だけ。

## 何を直すか(共通の弱点)

3 面とも「平らなマス + 線」で、**要素どうしがつながって見えない**。領域は色付きマスの
集まりに、道は線分の集まりに見える。そこを DOM + CSS だけで直す。動く要素は
「置いた・つながった・解けた」の状態変化に限り、常時動く装飾は入れない
([PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「盤を最優先、不要な演出を出さない」)。

## 守ること(全ゲーム共通)

- **床は Chromium 88 / es2018**([RELEASE_CHECKLIST.md](../RELEASE_CHECKLIST.md))。
  `:has()` は使えない — 隣接や角の判定は render 側で行い、クラスで渡す。`inset` 短縮、
  `clamp()`、`calc()`、`border-radius` の個別指定、擬似要素、`@keyframes` は使ってよい。
- **動きは transform / opacity を基本**にする。一回きりで 90〜240ms。`filter`
  (`brightness` / `blur`)、`backdrop-filter`、`box-shadow` を連続で動かすアニメーション、
  常時ループ、粒子、画像・テクスチャ・フォントの追加はしない。
- **Reduced Motion** は `src/ui/styles.css` の全体ルール(`prefers-reduced-motion` と
  `data-reduced-motion`)がすべての animation / transition を 0.01ms にする。ゲーム側で
  分岐する JS は要らない。ただし**アニメーションの終状態が「何も残らない」形**にする
  (光が消える・輪が消える)。終状態に意味を持たせない。
- **色だけに意味を持たせない**契約はそのまま。領域の境界線、違反の枠、Hint の輪は残す。
  Crown Grid の 9 色 / `--cg-warn-ink` と Shape Regions の 8 色は**値を変えない**
  (`crown-grid/ui/contrast.test.ts` が CSS から読み直す)。
- **読み上げは変えない。**追加する SVG・擬似要素はすべて `aria-hidden`。
  ボタンの `aria-label` は今のまま。
- **押下フィードバックは `filter` をやめ、地色の切り替えで出す**(低スペック端末で
  再描画が軽い)。
- 1 ゲームあたり CSS の増分は source で 1.5 KB 以内、JS は数十行以内。新しい依存はゼロ。
  `pnpm --filter simple-games size:check` の Gate を超えない(超えたら baseline を更新
  してその理由をコミットに書く)。
- 各ゲームの `docs/<GAME>_RULES.md` の該当節(表示・演出)を**同じ変更で**更新する。
  ルール文書が正典なので、描画の約束もそこに書く。
- 既存テストは全部通す。**変えた描画にはテストを足す**(角のクラス、SVG の存在、
  差し替えの条件、solved のクラス — 下記)。

## 共通の仕組み: 「解けた」の一拍

- 各盤面ルートに `solved` prop を足し、`session.status === 'solved'` のとき
  `cg-board-solved` / `np-board-solved` / `sr-board-solved` を付ける
  (GameScreen から渡す。盤面は既に `inert`)。
- 盤面の `::after` に 1 枚だけ重ねる: `position: absolute; inset: 0; pointer-events: none;
  background: var(--accent-soft); border-radius: inherit;` を `opacity` 0 → 1(30%)→ 0 の
  900ms で 1 回。盤面ルートは `position: relative; overflow: hidden` にする。
  `ui/useResultReveal.ts` の 900ms の間に流れ、結果カードが出る頃には消えている。
- Sudoku の `sudoku-complete`(マスごとの box-shadow)ではなく**盤 1 枚の opacity**で
  やる — 要素 1 つ、合成のみ。

## Crown Grid

### タイル(領域を「角丸のかたまり」に)

- 今: マス背景 = 地色、領域境界はマスの上と左に 2px の inset box-shadow(`cg-wall-t/l`)、
  マス内に 1px の罫線(右と下)。
- 変更後: **マスの背景を `--cg-wall`(インク)にし、地色は `::before` のタイル**で描く。
  - 境界の側(上下左右それぞれ、隣が別領域か盤の外)は `--cg-gap: 1px` だけタイルを
    内側に寄せる。両側から 1px ずつで、領域間は今と同じ 2px のインク線になる。
    同じ領域の側は 0(タイルどうしが継ぎ目なく並ぶ)。
  - **凸の角**(隣り合う 2 辺がともに境界)は `border-radius: var(--cg-round)`
    (5px)で丸める。凹の角は丸めない(向こう側のタイルが丸まる)。
  - 罫線(同じ領域の中でマスを数えるための 1px `--line`)は**残す**。タイルの
    `box-shadow: inset -1px -1px 0 0 var(--line)` で、右と下の、同じ領域の側にだけ。
    Queens 系は行と列を数える遊びなので、領域の中の格子は消さない。
- render は 4 辺の境界フラグと 4 隅の凸フラグを計算し、クラスで渡す:
  `cg-b-t cg-b-r cg-b-b cg-b-l`(境界の辺)、`cg-c-tl cg-c-tr cg-c-br cg-c-bl`(凸の角)。
  `cg-wall-t` / `cg-wall-l` は廃止(テストも直す)。盤の外周は境界として扱う
  (`.cg-board` の `border` と `overflow: hidden` は残す)。
- 王冠・×・違反の枠・Hint の `::after` オーバーレイはタイルの上に描く(`.cg-glyph` は
  `position: relative` のまま。`::after` はそのまま `inset: 0`)。
- 押下: `.cg-cell:active::before` に半透明の重ね(`linear-gradient` 1 色、ライト
  `rgba(0,0,0,.06)` / ダーク `rgba(255,255,255,.08)`)。`filter` は削除。

### 王冠を SVG に

- `ui/components/CrownGlyph.tsx`: `viewBox="0 0 24 24"`、`fill="currentColor"`、
  `aria-hidden`、`focusable="false"`。台座 + 3 つの山の素直な王冠(装飾なし)。
  ShapeIcon と同じ方針: どの端末・フォントでも同じ形。
- `.cg-glyph-crown` は `width/height: calc(var(--cg-cell) * 0.6)`(clamp 15〜28px 相当)。
  色は今までどおり `currentColor`(`--ink`、違反時は `--cg-warn-ink`)。
- `×` は文字のまま(U+00D7 はどの環境でも同じ)。
- 置く動き: 王冠は `transform: scale(.6) → 1` 90ms ease-out、× は opacity 0 → 1 90ms。
  glyph の `span` に `key={mark}` を付けて、王冠 ↔ × の切り替えでも必ず再マウントする。
- 文書: §1 の「王冠は `♛`(U+265B)」を「王冠は言語非依存のインライン SVG
  (`CrownGlyph`)、`×` は U+00D7」に直す。§13 に SVG の理由(フォント差)を書く。

### 置いた瞬間の「利き筋」

- 王冠が**新しく置かれた**(前回の marks で王冠でなかったマスが王冠になった)とき、
  同じ行・列・領域と 8 近傍のマス(王冠のマス自身は除く)に `cg-cell-reach` を
  700ms だけ付ける。`::before` タイルに `@keyframes cg-reach`
  (`background-color: var(--accent-soft)` → 地色。終状態は元の地色)。
- 検出は `CrownGridBoard` の中で: `useRef` に前回の `marks` を持ち、render で差分を取り、
  ちょうど 1 マスが「王冠になった」なら `useState` で `reach` を立て、`setTimeout` 700ms
  で消す(unmount で clear。[GAME_LIFECYCLE.md](../GAME_LIFECYCLE.md) の「残さない」)。
  `houseIndices` で行・列・領域が引ける。
- **自動 `×` は置かない**(§4、§14)。これは一瞬の表示であって印ではない。Hint の
  オーバーレイ(`::after`)とは重ならない(こちらは `::before`)。
- 解けたとき: `.cg-board-solved .cg-glyph-crown` に `cg-settle`(translateY(-2px) → 0、
  240ms、`animation-delay: calc(var(--cg-i) * 40ms)`)。`--cg-i` は王冠の通し番号
  (行順、0 始まり)を glyph の inline style で渡す。9 個まで。

### テスト(`CrownGridBoard.test.tsx` に追加)

- 境界と角のクラス: 小さな固定盤(既存テストの盤でよい)で、別領域に接する辺と凸の角に
  正しいクラスが付き、同じ領域の内側には付かないこと。盤の外周が境界として数えられること。
- 王冠のマスに `svg` があり `aria-hidden="true"` であること。×は文字のまま。
- 王冠を置いた render で、行・列・領域・8 近傍に `cg-cell-reach` が付き、王冠自身には
  付かず、fake timers で 700ms 後に消えること。× を置いても付かないこと。
- `solved` で `cg-board-solved` が付くこと。

### 文書(`CROWN_GRID_RULES.md`)

- §1(王冠の表現)、§13(タイルと角丸、境界は色だけに頼らない旨は不変、SVG、利き筋の
  一瞬表示、置く動き、解けた一拍、Reduced Motion)。§14 に「利き筋の表示は印ではない」を
  1 行。

## Number Path

### 関節と「引かれる線」

- 経路上のマス(`np-cell-on`)の `::before` に、中心に線幅 `--np-line` と同径の円
  (`background: var(--accent)`)。線分 `span` はその後に描かれるので、円は L 字の外角を
  埋め、曲がり角が滑らかな肘になる。始点(1)の端も丸くなる。`np-cell-astray` では
  `--warn`。
- 末尾のマス(`np-cell-end`)の線分だけ `@keyframes np-grow`: 入ってきた辺から中心へ
  `transform: scaleY / scaleX` 0 → 1、90ms ease-out。`transform-origin` は辺の側
  (`np-seg-up` → `top`、`np-seg-down` → `bottom`、`np-seg-left` → `left`、
  `np-seg-right` → `right`)。末尾のマスの線分は「1 つ前へ向かう」1 本だけなので、
  これで線がマスに入ってくる。1 つ前のマス側の半分は即時に出る(それでよい)。
- `.np-end`(末尾の丸)は `np-pop`: scale .6 → 1、90ms。末尾が動くたびに再マウント
  されるので毎回動く。
- 戻したとき(切り詰め)は何も動かさない(消えるものに演出は要らない)。

### 数字と壁

- **次に向かう数字**にクラス `np-cell-next`: 通過済みの数字の最大値 + 1 のマス
  (K を超えたら無し)。`.np-cell-next .np-digit` は `border-width: 3px`(輪を太く)。
  静的。到達した数字は今どおり塗り(`np-cell-visited`)。
- 壁: `.np-wall` に `border-radius: 2px`(両端を丸める)。太さ・位置は変えない。

### 解けた一拍

- `np-board-solved` の `::after`(共通の仕組み)。`.np-board` に `position: relative;
  overflow: hidden`。

### テスト(`NumberPathBoard.test.tsx` に追加)

- 経路上のマスに関節(`::before` は DOM に出ないので、クラス `np-cell-on` の存在で
  代替してよい)、末尾に `np-cell-end`、次の数字に `np-cell-next` が付き、通過済みの
  数字には付かないこと。K に達したら `np-cell-next` が無いこと。
- `solved` で `np-board-solved`。

### 文書(`NUMBER_PATH_RULES.md` §11)

- 関節の円と曲がり角、線が入ってくる動き、末尾の丸、次の数字の太い輪、壁の丸い端、
  解けた一拍、Reduced Motion で全部が即時になること。

## Shape Regions

### タイル(領域を「角丸のかたまり」に)

- 今: 全マス `border: 1px solid var(--line)`、割り当て済みは背景 = 地色、領域が変わる
  辺(上・左と外周の右・下)に 3px のインクの border。
- 変更後:
  - **すべてのマス**に `::before` のタイル。割り当て済みは地色、未割り当ては透明。
  - 割り当て済みマスの背景を `var(--ink)` にし、border は 1px のまま色を
    `var(--ink)` にする。タイルは**同じ領域の側では `-1px` まで**広げて罫線を覆う
    (継ぎ目なし)。境界の側(隣が別領域・未割り当て・盤の外)はタイルを padding box の
    縁で止める。見えるインクは各マス 1px、**領域どうし・領域と未割り当ての間はどちらも
    2px** になる(未割り当てマスも境界の辺だけ `border-<side>-color: var(--ink)`)。
    `--sr-edge` は 2px に読み替える(文書 §5 も)。
  - **凸の角**(隣り合う 2 辺がともに境界)は `border-radius: var(--sr-round)`(6px)。
    タイルの角が丸まった分はマス背景のインクが見えるので、輪郭は角で自然に太る(フィレット)。
  - 領域の中の罫線は消える(領域は 1 つの形として読む。数は手がかりの `n/m` で分かる)。
- render: 境界フラグを 4 辺すべてについて計算(隣の region と自分の region が違えば境界。
  自分が割り当て済みで盤の外に接する辺も境界。未割り当てで盤の外は境界でない)。
  クラス `sr-edge-t/r/b/l`(意味を「その辺は境界」に統一)と `sr-corner-tl/tr/br/bl`
  (割り当て済みかつ凸)。
- 違反(`sr-cell-warn`): タイルの背景を `--warn-soft`、タイルに
  `box-shadow: inset 0 0 0 2px var(--warn)`(角丸に沿う)、文字色 `--warn`。
- Hint: `sr-cell-hint` / `sr-cell-wrong` の輪もタイル(`::before`)の inset box-shadow に
  移す(未割り当てマスにもタイルはあるので同じ規則で描ける)。`sr-cell-reason::after` は
  そのまま。
- `.sr-clue` に `position: relative`(タイルの上に描く)。
- 押下: `.sr-cell:active::before` に半透明の重ね。`filter` は削除。

### 完成した領域の手がかりは「置いた形」になる

- 条件: その手がかりに**記号がある**(`clue.shape !== null`)、領域が完成サイズ
  (`clue.size` があればそれと一致、無ければ 2〜6 でカテゴリが記号と一致)、かつ
  違反でない — つまり `regionSatisfiesClue(cells, clue, width)` が真。
- そのとき `ShapeIcon` に**カテゴリではなく実際のマス集合**を渡して描く:
  `ShapeIcon` に `cells?: readonly (readonly [number, number])[]` を足し、渡されたら
  それを使う。領域のマスは `offsetsOf` → `normalize` で左上を原点にし、
  `UNIT = 16 / max(幅, 高さ)` で 16×16 に収め、短い方の軸は中央に寄せる。
  `INSET` はマス数に応じて縮めてよい(6 マスの一直線でも読めるように)。
- 記号のみ・数字のみの手がかりは変えない(数字のみは今どおり `n/m` → `m`)。
- 差し替えの瞬間: `key` で再マウントし、`sr-icon-in`(opacity 0 → 1、120ms)。
- 記号の `aria-hidden` はそのまま。読み上げは変えない。

### 解けた一拍

- `sr-board-solved` の `::after`(共通の仕組み)。`.sr-board` に `position: relative;
  overflow: hidden`。

### テスト(`ShapeRegionsBoard.test.tsx` に追加)

- 境界と角のクラス: 2 マスの領域とその周りで、境界の辺と凸の角に正しいクラス、
  内側の共有辺には付かないこと。未割り当てで領域に接するマスの辺にも `sr-edge-*`。
- 完成した領域(記号あり)の手がかりの SVG が、実際の形の rect 数(= マス数)になること。
  未完成のときはカテゴリの図(rect 数は図の数)であること。数字のみの手がかりでは
  SVG が出ないこと。
- `solved` で `sr-board-solved`。

### 文書(`SHAPE_REGIONS_RULES.md`)

- §5(境界 2px、タイルと角丸、完成した領域の記号は置いた形の縮図になる)、§13
  (動き、Reduced Motion)。§2 の「記号の意味」表は変えない。

## 進め方

ゲームごとに 1 コミット(+ 文書)。レビュー(描画ロジック / CSS と性能 / 文書との整合 /
a11y とコントラスト)→ 反証 → 修正のあと、`pnpm lint && pnpm typecheck && pnpm test &&
pnpm build && pnpm --filter simple-games build:web`、`size:check`、Playwright の
スクリーンショット(ライト / ダーク × 3 面)で目視。PR 1 本、マージ後に landing の
「Publish Simple Games (web)」を回す。
