# Backgammon — No. 67 の実装計画(2026-11-02)

67 本目の新作 1 本を、**Web 版の先行公開(ベータ)チャンネル**として実装する
([WEB_VERSION.md](../WEB_VERSION.md)「先行公開(ベータ)」。前例は 62〜66 本目 —
[2026-10-23-five-games-62-66.md](2026-10-23-five-games-62-66.md))。アプリには**正式収録しない**
(registry は遊べるようになるまで `channel: 'in-development'`、その後 `'web-beta'`。正式収録は
[RELEASE_CHECKLIST.md §0](../RELEASE_CHECKLIST.md) の基準を満たしてから人間が判断する)。

**この文書は着手時点の実装計画である。**仕様の正本は [BACKGAMMON_RULES.md](../BACKGAMMON_RULES.md)
で、コードより先に書き、以後はそちらが勝つ。

## 選定の経緯(2026-11-02)

[Issue #264](https://github.com/yosuke1024/simple-games/issues/264)(2026-10-23)が置いた「67 本目以降の
候補 20 本を 4 軸(認知 30 / 既存に無い遊び 30 / 自発的に繰り返せる 20 / 実装・保守コスト 20)と
必須ゲートで比べ、上位 5 本と次点を明記する」を、2026-11-02 に別セッションの Workflow(47 体)で実行した:
既存 66 本の語彙マップ → 補完候補 12 本(定番 / 新しい動詞 / 14 ロケールの地域定番)→ 32 本を
仕様カード + 4 軸 + ゲートで採点 → 権利 / 製品適合 / 実現性の 3 レンズで反証 → 統合と批評。
採点・反証の数値は**リポジトリの外の作業で出た算術と試作の値**であり、この計画では「算術では」
「試作では」と書く。

反証後の加重(上位): Cannon Duel 7.3 / **Backgammon 7.1** / Sea Battle 6.8 / Ice Slide 6.8 /
Chinese Checkers・Mini Golf・Go 9×9・Corner the Cat 6.6。推薦は点数順でなく方針 A(定番中心)と
棚の偏りで並べ、**67 本目は Backgammon** とした —

- 方針 A の中で、まだ棚に無い最も認知の高い対局(認知 8)。2026-08-08
  ([2026-08-08-mahjong-bubble-ludo.md](2026-08-08-mahjong-bubble-ludo.md)「頭キーワードに負ける」)と
  2026-10-20([2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md](2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md)
  「board の枠は Nested Tic-Tac-Toe に使った」)の 2 回の見送りはどちらも枠の都合で、原則で落とした
  記録は無い。
- 権利・製品適合・実現性の 3 レンズのどれも drop にしていない。残る未確定はポイント幅
  (算術で 21〜25px)の操作だけ。
- Nearby の 2 席型(公開盤面・host が出目を生成)にそのまま乗る(この版では作らない)。

**製品オーナーの判断(2026-11-02)**: 「Backgammon で進める」。組(68〜71: Cannon Duel / Hidden Fleet /
Ice Trail / Cribbage、次点 Corner the Cat / Chinese Checkers / Hop Across)と、Issue の暫定 5 本への
答え(Platformer 見送り・Virtual Pet は brand fail・Wordless Dungeon は別フェーズの試作案件)は
**判断待ちのまま Issue #264 に記録する**(この計画の範囲外)。

## 決定事項

| 項目         | 値                                                                                     |
| ------------ | -------------------------------------------------------------------------------------- |
| id / 題      | `backgammon` / `Backgammon`(全言語同じ。一般名 — RULES §14)                            |
| 接頭辞       | 保存 `bk.`(2026-11-02 に `gameKeys.test.ts` の `PREFIXES` と `src/games/*/storage/keys.ts` に無いことを確認。`bg.` は Bridges)、i18n `backgammon*` |
| 棚 / No.     | `board` / 67。棚は board 12 → 13                                                       |
| channel      | scaffold で `'in-development'` → 遊べる変更で `'web-beta'`                             |
| グリフ       | `▽`(U+25BD、ポイントの三角。`⚅` `⚄` は Ludo / Yacht のサイコロなので避ける)。実機の描画は未確認 |
| アクセント   | 既存 66 色との CIE76 ΔE で機械的に絞る(BRAND「アクセントを選ぶ手順」)。値は RULES §11 ではなく BRAND.md に表で記録 |
| 規則         | 標準の 1 局。キューブ・マッチ・Jacoby / Crawford なし。ギャモンは事実表示のみ(RULES §3・§13) |
| 先後         | オープニングロール(同点は振り直し)。設定で選ばない                                      |
| サイコロ     | `seed:dice:rollIndex` のシード決定・一様(Ludo §3 の形)                                   |
| CPU          | easy 乱択 / normal 1 プライ / hard 上位 6 列 × 21 出目の 2 プライ期待値、ノード上限 20,000(暫定) |
| 待った       | 手番内だけ(最後の歩を置くまで)。確定後は無し                                            |
| 保存         | 入力だけ(seed / difficulty / rollCount / turns)を再生。CPU の手も記録(RULES §9)         |
| 助け         | 合法手の表示・ピップ数。Hint なし                                                        |
| Club / Nearby | 登録しない / この版では作らない                                                         |

## 共通要件

[2026-10-20 の計画](2026-10-20-overtake-make-the-target-nested-tic-tac-toe-scopa-tangram.md)「共通要件(5 本とも)」を
そのまま引き継ぐ(オフラインで完結・全機能無料・時計もストリークも無し / `game/` は Pure TypeScript で
シード付き PRNG / 探索は仕事量の上限で正直に返す / 保存は fail-closed / registry に `channel` と
`loadStorageSchemas`、`storage/keys.ts` は import ゼロの葉 / ホームと Quick Rules に `WebBetaNotice` /
結果カードは `ShareAction` / Back の唯一の持ち主は GameContext / `useOnUnmount(syncActiveGame)` を 1 回 /
Quick Rules は最大 3 ステップ / 1 ゲーム 1 アクセント / 360×640 でスクロールなし / タッチ・マウス・
キーボード / 色だけに頼らない / Reduced Motion / 音は `services/sound.ts` だけ / 新しいアセットは
足さない / アンマウントで全解放 / 14 言語、`en` が原文 / 既存 66 本の挙動・保存スキーマ・golden を
変えない)。

追加で今回決めたこと:

- **CPU 対局の ↻ は `confirmNewGameTitle` の `ConfirmDialog`**(Reversi / Checkers と同じ。
  `restartDialogWiring.test.ts` の対象外)。
- **数値の出所を分ける。**選定時の算術・試作の値はこの文書に、ルール文書には実装のテストで再現した値
  だけを書く(暫定値はそう書く)。
- **題の確認は scaffold の後・実装の前に記録済み**(RULES §14、2026-11-02)。DB(USPTO / J-PlatPat /
  WIPO)と両ストアの検索は正式収録の前に足す。

## フェーズ

1. **文書(この計画と RULES)→ scaffold**: `node scripts/new-game.mjs backgammon BK --title "Backgammon" --category board --glyph "▽" --channel in-development`。
   生成物に手を入れずに `pnpm exec vitest run src/test src/app src/i18n src/games/backgammon` が緑で
   あることを確かめる(skill `add-game`)。アクセントを `packages/brand` に足し、BRAND.md に表で記録。
2. **`game/`(Pure TypeScript)**: `types.ts`(盤・ポイント・視点)/ `rng.ts`(複製)/ `dice.ts` /
   `engine.ts`(合法手列・1 歩の適用・終局・ギャモン判定)/ `evaluate.ts` / `cpu.ts`(3 難易度・
   ノード上限・`BackgammonView`)/ `session.ts`(手番の状態機械・待った・自動パス・`MAX_ROLLS`)/
   `persistence.ts`(入力だけのレコード・再生・fail-closed)。テスト: 合法手の golden(バー再入・
   両方の目の義務・大きい目の義務・ベアオフの超過目・ゾロ目・塞がり)、出目の一様性と golden、CPU の
   決定性と bench のノード数、自己対局の終局と `MAX_ROLLS` の分布、再生と v1 ペイロードのリテラル。
3. **`ui/` と `state/` と `storage/`**: 盤(DOM、26 個のボタン)・サイコロ・情報行・待った・結果
   カード(`details` は上げた数と結果の種類)・Quick Rules・設定(難易度)・保存の配線・統計。
   `*.leak.test.tsx`、GameScreen の操作テスト(選択 → 行き先 → 確定 → CPU の拍)、チュートリアルの流れ。
   CSS の高さ定数を実測して RULES §11 に書く。
4. **i18n**: `en` を書き、`ja` と 12 言語を AI が書く(未読と明記)。`*ResultTitle` の仮文を結果の
   文言に置き換える。
5. **検証と公開**: `pnpm verify:changed` → 全テスト・lint・typecheck・ビルド・`size:update`。registry を
   `'web-beta'` に変え、landing の `WEB_BETA_GAME_IDS` に足す同期 PR(別リポジトリ)→ Publish
   ワークフロー(人の作業)。push・PR・公開はすべて人間の明示的な承認の後。

## ゲームの作業がオーナーの判断に残した点

RULES §16 の表のとおり。とくに「待った」を手番内に限る線(Ludo / Yacht の前例の外)、行き先が 1 つでも
1 タップで動かさないこと(Zero Friction との兼ね合い)、ポイント幅の操作が実機で通らなかったときの
縦配置への切り替え。

## 実施記録(2026-11-02)

同日に Phase 1〜4 を 1 つの worktree(`worktree-backgammon-67`、origin/main `78b46308` 起点)で実装した。
数値は実装のテストが固定した値だけをルール文書に書き、ここには検証の経過を書く。

- **文書 → scaffold**: ルール文書と本計画を先に書き、`new-game.mjs backgammon bk --category board --glyph ▽ --channel in-development`
  で接続点を生成。生成物のままの横断ゲートは、`gameChannel.test.ts` の in-development 一覧と
  `docs/architecture/css-split.md` の一覧に新作を足すだけで通った(どちらも新作の登録であって golden の
  書き換えではない)。アクセントは `packages/brand` と `ui/styles.css` の `.accent-backgammon`、BRAND.md の表に記録。
  ホームのタイル絵は `GameArtwork.tsx` に SVG のミニ盤を 1 件追加。
- **`game/`**: types / rng(Ludo の複製)/ dice / engine(`bestUsage` のメモ化探索で「使える目は全部・大きい目優先」を
  担保)/ evaluate / cpu / session / persistence / selfPlay。テスト 5 本 52 件 — 合法手の golden(バー再入・両方の目の義務・
  大きい目・ベアオフの超過目・ゾロ目・塞がり)、出目の一様性と golden、CPU の決定性と上限、自己対局、再生と v1 レコードの
  リテラル。自己対局の実測: normal 対 easy 24 局で 24 勝、最長 86 投擲(RULES §3・§5)。
- **`ui/` / `state/` / `storage/`**: 盤(26 ボタン)・サイコロ・情報行・待った・結果カード・Quick Rules(図つき)・
  統計画面・保存の配線(入力だけのレコード)。`BackgammonRoot.test.tsx` 6 件(初回・投擲と歩・保存の再生・再開・
  差し替えの確認・ショートカット起動)と `*.leak.test.tsx` 1 件。
- **i18n**: `en` を書き、13 言語を AI が書いた(未読 — RULES §12・§16)。
- **横断ゲート**: `src/test` / `src/app` / `src/i18n` は負荷の低い単独実行で緑(構造の門 895 件、i18n・lifecycle・
  Reset 103 件、`gameKeys` の golden に新作の 4 キーを登録)。**`src/app/App.*.test.tsx` は並列実行で 5 秒の
  タイムアウトを起こす**(この変更の前、生成物のままの時点でも同じ。機械の load average は 13〜24 で、
  ほかの worktree の作業が同時に走っていた)。`App.route` / `App.webAppStoreCard`(35 件)、`App.club`(17 件)、
  `App.nearby`(10 件)、`App.load` / `App.shortcut` / `App.test` は、ファイル単位の単独実行ではすべて緑。
- **ESLint**: 対象ファイルは緑。**typecheck**: `noUncheckedIndexedAccess` の配列の `+=` と `let` の null 絞り込みで
  23 件出て直し、再実行で 0 件。
- **ビルドと容量**: native / Web のビルドが通り、`size:update` で `size-baseline.json` を更新。ゲームチャンク
  `backgammon` は gzip 25.3 KB(native)/ 25.2 KB(Web)、エントリは +1.1 KB(+1.2%、registry の 1 要素・タイル絵・
  アクセント)、総量は raw +55.4 KB(+3.1%)。10% の門の内側。
- **フルセット(skill `verify`「新しいゲーム」の条件)**: root の `pnpm lint` と `pnpm typecheck` は緑。`pnpm test`(全件)は
  947 ファイル中 18 ファイルが落ちた — 本物は 2 件(`CollectionHomeScreen.test.tsx` が固定する実装中タイトルの一覧に
  新作を足す / `cpu.test.ts` の自己対局 2 件に 60 秒の hang 用上限を明示)で、残りは load average 13〜24 の下での
  5 秒タイムアウトと生成予算テスト(壁時計の断定)。直してから 18 ファイルをワーカー 2 本で再実行し、
  **18 ファイル 398 件すべて緑**。その後 root の `pnpm build`(brand と app)、app の `build:web`、`size:check`
  (基準値と ±0)も緑。
- **やっていないこと**: Web 版・実機での表示(registry は `'in-development'` のまま、どの扉からも開けない)、静的モックと
  Phase 0、Nearby、Club、landing の同期、リモートへの反映と PR。`'web-beta'` への切替は製品オーナーの判断。
