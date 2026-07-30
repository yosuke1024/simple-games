# 計画: ゲーム集アプリ化 + 第2弾 Sudoku(ナンプレ)

作成日: 2026-07-30。このドキュメントは実装引き継ぎ用の計画書。実装者(人間または AI)は
着手前に必ず [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md) / [ARCHITECTURE.md](../ARCHITECTURE.md) /
[NUMBER_MATCH_RULES.md](../NUMBER_MATCH_RULES.md) を読むこと。

## 0. 決定事項(このセッションでの合意)

- **Number Match を単体アプリとして出すのをやめ、複数ゲームを収録した 1 つの
  「ゲーム集アプリ」として出す。** Sudoku はその第2収録タイトル。
- コンセプトは全タイトル共通で不変:
  **Simple. Offline. Lightweight. Unobtrusive. Respectful.**
  (シンプル。オフライン。軽量。邪魔しない。急かさない。)
- Sudoku の正式ルールは新設する `docs/SUDOKU_RULES.md` を唯一のソースとする
  (NUMBER_MATCH_RULES.md と同じ位置づけ。実装・Hint・テストはすべてこの文書に従う)。

### 確定した設計判断(2026-07-30 ユーザー決定)

| 項目 | 決定 |
| --- | --- |
| appId | `com.pixapps.simplegames` |
| アプリ名 | `Simple Games: Offline Puzzles` |
| CI タグ規約 | `simple-games-v*` |
| デイリーの難易度 | **毎日 Medium 固定**(曜日カーブは採らない) |
| ミス即時表示のデフォルト | **オン**(設定でオフ可) |
| Sudoku のレベル数 | 1〜999(Number Match に揃える) |

これは README / ARCHITECTURE.md の「各ゲームは独立したアプリとして公開」という記述を
**覆す方針転換**である。Number Match は未リリースなので移行コスト・データ移行は発生しない。
関連文書の更新はマイルストーン M1 に含む。

## 1. 全体アーキテクチャ(コレクション化)

### 1.1 方針

- 単一の Vite + Capacitor アプリ `apps/simple-games` に再編する。
  ゲームごとの workspace パッケージ分割は**しない**
  (「巨大な共通ゲームフレームワークを作らない」原則を維持。フォルダ分割で足りる)。
- `git mv` で `apps/number-match` → `apps/simple-games` に移動し、履歴を保つ。
- 各ゲームは `src/games/<gameId>/` 配下に自己完結で置く。シェル(コレクションホーム、
  設定、広告、ストレージ基盤、i18n 基盤)だけを共有する。

### 1.2 ディレクトリ構成(移行後)

```text
apps/simple-games/src/
├── app/                    # シェル: ルート App、ルーティング、ゲームレジストリ
├── games/
│   ├── number-match/
│   │   ├── game/           # 既存 src/game/ をそのまま移動(Pure TS、変更しない)
│   │   ├── state/          # 既存 AppContext(NumberMatchProvider に改名)+ progress/stats ロジック
│   │   ├── storage/        # NM 固有スキーマ(saveGame/saveDaily/stats/progress/flags)
│   │   ├── i18n/           # NM 固有文言(5 言語)
│   │   └── ui/             # NM の screens / BoardView など
│   └── sudoku/             # 第2弾(構成は number-match と同型)
├── state/                  # 共有: SettingsContext(言語/テーマ/音/振動/Reduced Motion)
├── storage/                # 共有: kv.ts / repo.ts / SchemaDef 基盤 / 共有スキーマ
├── services/               # 共有: ads / analytics / remoteConfig / network / sound / haptics
├── i18n/                   # 共有: 言語解決 + シェル文言。ゲーム別カタログをマージ
└── ui/                     # 共有: CollectionHomeScreen / SettingsScreen / 共通コンポーネント
```

レイヤー規則は現行どおり: `games/*/game/` は他レイヤーを import しない。
`games/A/` から `games/B/` への import は禁止。シェルはゲームの内部実装を知らない。

### 1.3 ゲームレジストリ(薄い契約。フレームワーク化しない)

```ts
// src/app/registry.ts — 契約はこの型だけに留める
interface GameModule {
  id: 'number-match' | 'sudoku';
  titleKey: MessageKey;          // コレクションホームに出す名前
  Icon: ComponentType;           // ホームカード用アイコン(SVG)
  Root: ComponentType;           // ゲームのルート(内部に自前の画面遷移を持つ)
}
```

- シェルのルーティングは `{ view: 'collection' } | { view: 'settings' } | { view: 'game', gameId }`
  程度の判別 union で十分。URL ルーターは導入しない。
- 各ゲームの `Root` は現行 NM の `App.tsx` 相当(tutorial/home/levels/daily/game/stats を内包)。
  「コレクションホームに戻る」導線を各ゲームのホーム画面に追加する。
- 統計(stats)はゲーム別に持つ。シェル横断の統計画面は作らない。

### 1.4 ストレージのキー設計

未リリースのためデータ移行は不要。キーだけ整理する:

- 共有: `sg.settings` / `sg.adState` / `sg.rcCache`(現 `nm.settings` 等から改名)
- Number Match 固有: `nm.saveGame` / `nm.saveDaily` / `nm.stats` / `nm.progress` / `nm.flags`(現状維持)
- Sudoku 固有: `sd.saveGame` / `sd.saveDaily` / `sd.stats` / `sd.progress` / `sd.flags`

`kv.ts` / `repo.ts` / `SchemaDef` の仕組みは変更なし。schemaVersion 運用も現行踏襲。

### 1.5 i18n

- 言語解決(`resolveLocale`)・`translate` は共有のまま。
- カタログは「シェル文言」+「ゲーム別文言」に分割し、キーに `nm.` / `sd.` 接頭辞を
  付けてビルド時に 1 つの `Messages` にマージする(型はキーの union で保たれる)。
- 対応言語は現行の 5 言語(en/ja/hi/th/id)を Sudoku でも全て揃える。

### 1.6 広告(Unobtrusive の維持)

- AdMob App ID はコレクションで 1 つ。バナー + インタースティシャルのみ(現行方針)。
- `interstitialPolicy` / `adState` は**アプリ全体で共有**にする。頻度上限はゲーム横断で
  効かせる(ゲームを移動しても広告頻度が増えない)。ポリシーの純関数・テストは現行維持。

### 1.7 アプリ ID・名前・配布

- appId: `com.pixapps.simplegames`(決定済み)
- appName: `Simple Games: Offline Puzzles`(決定済み)
- appId が変わるため Capacitor の `android/` プロジェクトは再生成する
  (アイコン・スプラッシュは `@capacitor/assets` で再生成。ブランド資産は流用)。
- CI: `number-match-android.yml` → `android-release.yml` に改名、タグを `simple-games-v*`
  に変更(決定済み)。手動実行 / タグ起動のみという原則は維持。
- `store/listing.md` はコレクションとして書き直す(収録タイトル一覧を含む)。

### 1.8 文書の更新(方針転換の反映)

- README.md: アプリ表を「収録ゲーム」表に変更。「独立したアプリとして公開」の段落を削除。
- ARCHITECTURE.md: §1.2 の構成へ書き換え。「アプリ別リリース」記述を「単一アプリ、
  収録ゲームはフォルダ分割」に変更。
- PRODUCT_PRINCIPLES.md: 「あるゲームのリリースが別ゲームのリリースを強制しない」を
  「収録ゲームの追加・更新はアプリのリリースとして一体で行う。ただしゲーム追加が
  既存ゲームの挙動を変えてはならない」に置き換え。他の原則は全て不変。

## 2. Sudoku 仕様の骨子(SUDOKU_RULES.md に正式化する内容)

M2 で `docs/SUDOKU_RULES.md` を書く際の設計方針。番号章立ては NUMBER_MATCH_RULES.md に倣う。

### 2.1 基本ルール

- 9×9、3×3 ボックス。完成盤から一意解を保証してマスを抜いた盤面を提示する。
- 入力: マス選択 → 数字パッド(1〜9 / 消す)。メモ(鉛筆書き)モードあり。
- 数字を置いたとき、同じ行・列・ボックスのメモから該当数字を自動で消す。
- 数字パッドには各数字の残数(9 − 盤上の個数)を表示し、置き切った数字は無効化する。

### 2.2 ミスと支援(Respectful の具体化)

- **タイマーはプレイ中に表示しない**(NM と同じ決定。経過時間は内部でのみ記録し、
  クリア画面と統計でだけ見せる)。
- **ミス上限なし・ゲームオーバーなし**(3 ミス失格のような仕様は採らない)。
  正解と異なる数字を置いたらミスとして数えるだけ。
- ミスの即時表示(正解と違うマスを赤くする)は設定でオン/オフ。**デフォルトはオン**(決定済み)。
  行・列・ボックス内の重複(ルール違反)の強調は常時オン。
- Undo 無制限。Hint 無制限・広告不要(ブランド原則)。

### 2.3 Hint(教える Hint)

- Hint は「次に論理的に確定できるマス」を技法名つきで指す
  (例:「この行で 5 が入るのはここだけ」)。答えを埋めるだけの Hint にしない。
- 実装はグレーダー(§3.4)の解法パスを流用する。使用回数は統計に記録。

### 2.4 難易度(技法ティア定義)

推測(仮置き・試行錯誤)なしで解けることを全難易度で保証する。

| 難易度 | 必要技法(最高到達) |
| --- | --- |
| Easy | Naked Single / Hidden Single |
| Medium | + Locked Candidates(pointing/claiming)/ Naked Pair / Hidden Pair |
| Hard | + Naked・Hidden Triple / X-Wing |

グレード = 論理解法パスで必要になった最高ティア。Expert 以上の技法(chains 等)は
初期リリースでは扱わない(将来の拡張とする)。

### 2.5 モード

- **レベルモード**: NM と同じく 1〜999 の進行。level → (難易度ティア, seed) を決定的に
  導出。序盤はヒント多めの Easy、緩やかに Medium/Hard を混ぜていく
  (正確なカーブは SUDOKU_RULES.md で表として確定させる)。
- **デイリー**: 日付 seed で決定的に生成。NM 同様、過去日を遡って挑戦可能。
  ストリークは NM の `effectiveDailyStreak` と同じ寛容な定義を使う。
  **難易度は毎日 Medium 固定**(決定済み)。曜日で難易度が変わると「今日は当たり日/外れ日」
  という圧を生むため採らない。
- 中断は NM の §14 と同じく **レベル用・デイリー用の 2 スロット独立保持**。

### 2.6 スコア

- スコアは**作らない**。クリア画面は「クリア / 経過時間 / ミス数 / Hint 数」のみ。
  統計は難易度別クリア数・ベスト/平均時間・デイリーカレンダー。
  (NM の score-to-beat に相当する競争要素は Sudoku では時間だが、プレイ中に見せない
  ことで「急かさない」を守る。)

### 2.7 チュートリアル

3 ステップ以内(原則): ①行・列・ボックスに 1〜9 ②マスを選んで数字を置く
③メモと Hint の使い方。初回起動時のみ。ゲームごとに独立。

## 3. Sudoku 実装設計(`src/games/sudoku/game/` — Pure TS)

NM の `game/` と同じ流儀(イミュータブル、依存なし、全モジュール単体テスト)。

| モジュール | 内容 |
| --- | --- |
| `types.ts` | `Digit`, 81 マスの `Grid`, `Candidates`(ビットマスク), `Puzzle`, `SudokuSession` 等 |
| `rng.ts` | NM の `rng.ts` と同じ seeded RNG(コピーする。共通化は第3弾で重複確認後) |
| `solver.ts` | 候補ビットマスク + 単純伝播 + バックトラック。**解数カウント(2 で打ち切り)** |
| `generator.ts` | 完成盤生成(ランダム化バックトラック)→ 180° 対称に掘る → 一意性維持 → グレーダーで目標ティア確認。目標に届かなければ seed を派生させ再試行(試行上限あり、決定的) |
| `grader.ts` | §2.4 の技法を人間の解法順(安い技法優先)で適用し、解法パスと最高ティアを返す |
| `engine.ts` | `place / erase / toggleNote / undo` の状態遷移、ミス判定、メモ自動消去、クリア判定 |
| `hint.ts` | grader の次手を Hint(対象マス + 技法 + 説明キー)に変換 |
| `levels.ts` | level → 難易度ティア + seed 導出(カーブは SUDOKU_RULES.md の表に従う) |
| `daily.ts` | 日付文字列 → seed / 難易度。NM の daily.ts と同じ日付規約 |
| `session.ts` | レベル/デイリーのセッション生成・進行・再開 |
| `serialize.ts` | schemaVersion 付き保存形式。NM 同様 round-trip + 互換性フィクスチャをテスト |

### 3.1 決定性と性能

- level / 日付 → seed → **全ユーザーで同一盤面**。golden テスト(既知 seed → 既知盤面)で
  将来のリファクタリングによる盤面変化を検出する(NM の compatibility.test.ts と同じ発想)。
- 生成は端末上で同期実行。性能予算: Easy/Medium 50ms 未満、Hard 200ms 未満(テストで測る)。
  超える場合の逃げ道は「対称性の緩和 → 試行上限の調整 → (最後の手段)ビルド時生成した
  パズルパック同梱」の順。パック方式は初期リリースでは採らない。

### 3.2 テスト戦略

- solver: 既知パズル(一意解 / 複数解 / 解なし)での解数カウント検証。
- generator: プロパティテスト — 任意 seed で「一意解」「目標ティア一致」「対称性」「決定性」。
- grader: 技法ごとに最小盤面フィクスチャを用意し、その技法が検出されることを個別に検証。
- engine/serialize: NM と同水準(遷移の不変条件、round-trip、旧バージョン読み込み)。
- UI: BoardView のインタラクションテスト(NM の BoardView.test.tsx に倣う)。

## 4. Sudoku UI(`src/games/sudoku/ui/`)

- `SudokuBoardView`: CSS Grid の 9×9。3×3 境界線は「図形として一体に見える」現行の
  盤面アウトラインの流儀に合わせる。選択マスの行・列・ボックス淡色ハイライト、
  同数字ハイライト、重複の警告表示。セルは button 要素 + aria-label(a11y)。
- `DigitPad`: 1〜9(残数表示つき)/ 消去 / メモ切替 / Undo / Hint。
- 画面: `SudokuHomeScreen` / `LevelSelectScreen` / `DailyScreen` / `GameScreen` /
  `TutorialScreen`。NM の同名画面の構造・スタイルを踏襲(コードは共有しない。
  見た目の共通言語は styles.css のデザイントークンで揃える)。
- `ResultOverlay` / `ConfirmDialog` / `Toggle` / `BannerSlot` 等は共有 `src/ui/` へ移して再利用。
- Reduced Motion 対応は全アニメーションで現行方針を踏襲。

## 5. マイルストーン(各段階で lint / typecheck / test / build 緑を維持)

| # | 内容 | 完了条件 |
| --- | --- | --- |
| M0 | 未コミットの作業ツリーを整理・コミット | main がクリーン ✅ 2026-07-30 完了 |
| M1 | コレクション移行: `apps/simple-games` へ改名、§1 の構造へ再配置、シェル(コレクションホーム + 共有設定)新設、appId/CI/文書/listing 更新 | NM の全テストが新配置で緑。Web + Android 起動確認。**ゲームロジックのコード変更ゼロ** |
| M2 | `docs/SUDOKU_RULES.md` 執筆(§2 を正式化、§6 の未決を解消) | ルール文書レビュー完了 |
| M3 | Sudoku コア: types / rng / solver / generator / grader + テスト | 全難易度で生成が性能予算内・一意解・ティア一致 |
| M4 | Sudoku プレイ層: engine / hint / levels / daily / session / serialize + テスト | golden・round-trip 含め緑 |
| M5 | Sudoku UI + i18n(5 言語)+ シェル統合 + チュートリアル | 実機相当(エミュレータ)で一通りプレイ可能 |
| M6 | 仕上げ: 統計、広告接点(ゲーム横断頻度)、アイコン/スプラッシュ、store listing、Android リリースビルド | リリース候補ビルド完成 |

規模感: M1 と M3 が重い(それぞれ NM の 1 モジュール群に相当)。M3 の中では grader が
最大の工数。M4 以降は NM の型が丸ごと参考になるため比較的軽い。

## 6. 残る未決事項

§0 の表で 5 件すべて決定済み。M2(SUDOKU_RULES.md 執筆)で確定させるのは以下のみ:

1. **レベル進行の難易度カーブ**: level 1〜999 のどこで Easy → Medium → Hard を混ぜるか
   (§2.5)。表として SUDOKU_RULES.md に固定する。
2. **Hint の説明文の粒度**: 技法名を出すか、平易な言い換えだけにするか(5 言語分の負荷と
   分かりやすさのバランス)。

## 7. リスクと対策

- **grader の品質が体感難易度を決める**(最大リスク)。技法単位のフィクスチャテストを
  先に書き、既知の公開パズル(難易度既知)を数十問コーパスとして照合する。
- **Hard 生成の速度**: §3.1 の逃げ道を順に適用。性能テストを M3 の完了条件に含める。
- **hi/th/id の翻訳品質**: 用語(メモ、ボックス等)は既存 NM カタログの語彙に揃え、
  数字パッドなど文字に依存しない UI を優先する。
- **appId 変更に伴う android/ 再生成**: 手作業が入るため M1 に Android 起動確認まで含めた。
  署名鍵・AdMob 本番 ID は従来どおり環境変数注入(リポジトリに含めない)。
