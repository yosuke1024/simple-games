# 計画 v2: Simple Games ゲーム集化・収益方針転換・Sudoku 以降のラインナップ

作成 2026-07-30 / 同日 v2 に全面改訂(ユーザーの「方針変更・設計更新指示」を反映)。
このドキュメントは実装引き継ぎ用の計画書。着手前に必ず
[PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md) / [ARCHITECTURE.md](../ARCHITECTURE.md) /
[BRAND.md](../BRAND.md) / [ADS_POLICY.md](../ADS_POLICY.md) を読むこと。

## 0. 決定事項(確定)

### プロダクト形態

- 各ゲームを独立アプリで出す方針を**廃止**。複数のクラシックゲームを収録した単一の
  「Simple Games」アプリに、継続的にゲームを追加していく。
- appId: `com.pixapps.simplegames` / appName: `Simple Games: Offline Puzzles` /
  ランチャー表示名: `Simple Games`
- CI リリースタグ: `simple-games-v*`(ワークフローは `android-release.yml`)
- リポジトリは Public(https://github.com/yosuke1024/simple-games)。Apache-2.0。
  名称・ロゴ・ブランド素材はライセンス対象外を維持。

### ブランド(Honest by design)

中心思想: **Honest by design. Simple games, built in the open.**
「私たちの説明を信じる必要はありません。ソースコードを公開しています。」
OSS は技術者向け訴求ではなく、ブランドプロミスを誰でも検証できる仕組みとして扱う。
ストア第1訴求は「1つのアプリでクラシックゲーム集・完全オフライン」であり、OSS は最後段。

必須原則(PRODUCT_PRINCIPLES.md に明文化):
No paywalls / No subscriptions / Banner ads only / Optional one-time ad removal /
All games playable offline / No account required / No streaks or artificial urgency /
Local-first game data / Low battery consumption / Public source code

### 広告(バナー専用)

- 使用する広告は **Anchored Adaptive Banner のみ**。
- Interstitial / Rewarded / Rewarded Interstitial / App Open / Native /
  盤面に重なる広告 / 進行を止める広告 / 視聴による機能解放は**すべて廃止・禁止**。
- オフライン時は広告を表示せず、広告リクエストも行わない。
  広告・同意処理のあらゆる失敗でゲームを止めない(従来どおり)。
- 広告への言及は謝罪調・強制調にしない。初回起動時に課金ダイアログを出さない。

### 広告削除の買い切り課金

- 商品: 「Remove Ads & Support Simple Games / 広告を削除して Simple Games を支援」
- 基準価格 USD 3.99。各国価格はストアの自動調整。サブスクではない。一度だけ。
- 購入でアプリ内バナーを永久に削除。**将来追加されるゲームにも適用**。購入復元あり。
- ゲーム機能は無料ユーザーと完全に同一。課金専用ゲーム・機能は作らない。
- 「Lifetime Access」という表現は使わない(無期限なのは広告削除権)。

### ゲームラインナップ

収録済み: Number Match。
初期ラインナップ候補(実装順の提案): **Sudoku → 2048 → Sliding Puzzle → Minesweeper**。
後続候補: Nonogram(ビルド時生成・検証パイプライン設計後)/ Solitaire(共通 UI と
保存基盤の安定後)/ Kakuro / Futoshiki / Takuzu。
すべてローカル生成で完結し、コンテンツサーバーを必要としないものを優先する。

### Sudoku の確定済み設計判断(v1 から継続)

| 項目 | 決定 |
| --- | --- |
| デイリーの難易度 | 毎日 Medium 固定 |
| ミス即時表示のデフォルト | オン(設定でオフ可) |
| レベル数 | 1〜999(Number Match に揃える) |
| プレイ中のタイマー表示 | しない(内部記録のみ。クリア画面と統計でだけ表示) |
| ミス上限・ゲームオーバー | なし |

## 1. 対案・解釈(指示に対する実装者の判断 — 異議があれば言うこと)

1. **ストリークの扱い**: 指示は「ストリークを強制しない」+ 必須原則「No streaks or
   artificial urgency」。Number Match には連続日数カウンタ(表示+ロジック)が既にある。
   → **ストリーク表示・カウンタは削除**し、デイリーの「達成日カレンダー」だけ残す
   (記録は誠実、連続日数は煽り、という線引き)。統計スキーマからも streak 系を落とす
   (未リリースなので互換負債なし)。
2. **Analytics / Remote Config**: どちらも現状 Firebase 未配線のスタブ。指示 §14 の
   「初期リリースでは Analytics を使用しない選択肢」を採用し、**両方とも削除**する。
   バナー専用になった今、Remote Config の主用途(インタースティシャル頻度制御)も
   消滅している。「公開コードに追跡コードが存在しない」ことが最も強い透明性の証明。
   将来必要になれば adapter 差し込み点ごと復活させる(この計画書が復活手順の目印)。
3. **共通パッケージ**: 指示 §11 の概念図にある packages/shared-ui・game-contracts・
   storage への分割は**今はやらない**(指示自身の「現在の実装に合わせて最小限」に従う)。
   ゲームはフォルダ分離、共有はアプリ内シェルに留める。重複が3ゲーム分たまってから抽出。
4. **i18n**: 5言語の単一カタログ(型で全キー強制)を維持。既存キーの一括改名はせず、
   新ゲームのキーだけ `sudoku*` などの接頭辞を付ける。カタログが肥大したら分割。
5. **タグライン修正**: 「No purchases / 課金なし」は広告削除 IAP の存在と矛盾するため
   「No paywalls / 機能課金なし」系の表現に改める(アプリ内・ストア・文書すべて)。

## 2. アーキテクチャ(v2)

```text
apps/simple-games/src/
├── app/                    # シェル: ルート App、ルーティング、ゲームレジストリ
├── games/
│   ├── number-match/       # game/ state/ storage/ ui/ で自己完結
│   └── sudoku/             # 第2弾(M3〜)。以後のゲームも同型
├── monetization/           # 広告削除 IAP: アダプタ契約 + ローカルキャッシュ
├── services/               # ads(バナーのみ) / network / sound / haptics
├── state/                  # SettingsContext(共有設定)
├── storage/                # kv / repo / validate / 共有スキーマ
├── i18n/                   # 言語解決 + 5言語カタログ
└── ui/                     # コレクションホーム / 設定 / About / 共通コンポーネント
```

- レイヤー規則(不変): `games/*/game/` は Pure TS で他レイヤーを import しない。
  `games/A/` → `games/B/` の import 禁止。シェルはゲーム内部に踏み込まない。
- ゲームレジストリは `{ id, titleKey, Icon, accent, Root }` 程度の薄い契約のみ。
  Plugin System 化しない。
- ハードウェア戻るボタン: ゲーム内ホーム→コレクションへ、コレクション→アプリ最小化。
- 電池: ポーリングなし・常時通信なし・画面外ゲームはアンマウント・保存はイベント駆動
  (可視性変化 / pause / 状態遷移時)+ プレイ時計は ref 加算のみ(再レンダリングなし)。

### ストレージキー

| キー | 内容 |
| --- | --- |
| `sg.settings` | 共有設定(言語/テーマ/音/振動/Reduced Motion) |
| `sg.iap` | 広告削除購入状態のローカルキャッシュ |
| `nm.*` | Number Match(saveGame / saveDaily / stats / progress / flags) |
| `sd.*` | Sudoku(同型。M3 で定義) |

ゲームごとに保存領域を分離し、一方の破損が他方へ波及しない(validate は従来方式)。
`adState` / `rcCache` は廃止。「ローカルデータ削除」は sg.* + 全ゲームのキーを消す。

### 広告実装(バナーのみ)

- `services/ads/banner.ts`: AdMob 初期化(起動後 fire-and-forget)、Anchored Adaptive
  Banner の表示/非表示、UMP 同意(失敗してもゲーム継続)。オフライン時・購入済み時は
  リクエストしない。dev はテスト ID、本番は `VITE_ADMOB_BANNER_ID`(未設定なら無効)。
- `BannerSlot` は従来どおり高さ確保方式(盤面のレイアウトシフトなし)。購入済みなら
  スロットごと消す。

### 広告削除 IAP の基盤(今回はコードの土台まで)

- `monetization/adRemoval.ts`: `AdRemovalStore` 契約
  (`isAvailable` / `getPrice` / `purchase` / `restore`)+ 実装差し替え点。
  既定実装は「ストア未接続」(購入 UI は非表示、購入済みキャッシュだけ尊重)。
- `sg.iap` スキーマ: `{ schemaVersion, adRemovalPurchased, purchasedAt }`。
  購入・復元成功時に更新。オフラインでも購入済み状態は端末キャッシュで有効。
- 設定/About 画面: 静かな説明文(指示 §6 の文言)+ Remove Ads 行 + 購入復元。
  何度も購入を促さない。初回起動ダイアログなし。
- 本番接続に必要な人間作業は §5 に列挙。プラグイン選定(Capacitor 向け Google Play
  Billing)は接続時に行い、ID 類はハードコードしない。

### アプリ内 OSS 導線(設定/About)

View Source Code / Report a Bug / Suggest a Game / View Licenses /
Remove Ads & Support Simple Games。リンク先は GitHub(オフライン時は開けなくても
画面自体は正常表示、失敗でアプリを止めない)。

## 3. Sudoku 設計(v1 から維持。変更点: 広告関連の記述を削除)

正式ルールは `docs/SUDOKU_RULES.md`(M2 で新設)を唯一のソースとする。

- 9×9。完成盤から一意解保証で掘る。メモ(鉛筆書き)、同数字・行列ボックスの
  ハイライト、数字パッドに残数表示。
- ミス: 正解と異なる数字がミス。上限なし。即時表示は設定制(既定オン)。
  ルール違反(行・列・ボックス内重複)の強調は常時。
- Hint: グレーダーの次の一手を技法名つきで指す「教える Hint」。無制限・無料。
- 難易度ティア: Easy = Naked/Hidden Single。Medium = + Locked Candidates,
  Naked/Hidden Pair。Hard = + Triple, X-Wing。全難易度で推測不要を保証。
- モード: レベル 1〜999(決定的 seed、カーブは SUDOKU_RULES.md の表で確定)+
  デイリー(毎日 Medium、過去日遡り可)。中断はレベル/デイリー独立 2 スロット。
- スコアなし。クリア画面は 時間 / ミス数 / Hint 数。統計は難易度別クリア数・
  ベスト/平均時間・達成日カレンダー(ストリーク表示なし — §1-1)。
- 実装モジュール(`games/sudoku/game/`): types / rng / solver(解数カウント2で打切)/
  generator(180°対称に掘る・目標ティア・試行上限つき決定的リトライ)/ grader /
  engine / hint / levels / daily / session / serialize。
  性能予算: Easy·Medium 生成 50ms 未満、Hard 200ms 未満(テストで計測)。
  逃げ道: 対称性緩和 → 試行調整 → (最後)ビルド時パック。
- テスト: solver の解数検証 / generator プロパティテスト(一意解・ティア一致・
  決定性 golden)/ grader 技法別フィクスチャ / serialize round-trip + 互換 golden。

## 4. マイルストーン

| # | 内容 | 状態 |
| --- | --- | --- |
| M0 | main クリーン化 | ✅ 2026-07-30 |
| M1 | ゲーム集移行: シェル+レジストリ+NM 再配線、バナー専用化(interstitial/analytics/remoteConfig 削除)、IAP 基盤、OSS 導線、i18n、文書全面整合 | 本セッションで実施 |
| M2 | `docs/SUDOKU_RULES.md` 執筆(§3 の正式化) | |
| M3 | Sudoku コア(types/rng/solver/generator/grader)+ テスト | |
| M4 | Sudoku プレイ層(engine/hint/levels/daily/session/serialize)+ テスト | |
| M5 | Sudoku UI + i18n + シェル統合 + チュートリアル | |
| M6 | 2048(盤ロジックは小さい。undo・統計・デイリーは共通パターン踏襲) | |
| M7 | Sliding Puzzle(画像なし数字タイル・可解性保証シャッフル) | |
| M8 | Minesweeper(初手安全保証・旗/開閉 UI) | |
| M9 | リリース仕上げ: アイコン、store listing 最終化、IAP 本番接続、Android ビルド | |

各マイルストーンで lint / typecheck / test / build 緑を維持。ゲーム追加が既存ゲームの
挙動・保存データを変えないこと。

## 5. 人間(ストア側)作業 — コードでは代替不可

1. Google Play Console: 新アプリ `com.pixapps.simplegames` の作成(旧 numbermatch の
   掲載は作らない)。
2. AdMob: コレクション用アプリ登録 + **バナー広告ユニットのみ**作成。
   Secrets `ADMOB_APP_ID` / `ADMOB_BANNER_ID` を GitHub に設定(interstitial 系は不要)。
3. Play Console: アプリ内商品(管理された商品)`remove_ads` を USD 3.99 で作成。
   国別価格は自動調整に任せる。
4. 署名鍵の作成・保管(リポジトリに含めない)。
5. ストア掲載素材(スクリーンショット等)とプライバシーポリシーのホスティング URL。
6. (接続時)Capacitor 向け課金プラグインの選定・動作確認は人間のストア環境が必要。

## 6. 残る未決事項

1. Sudoku レベル 1〜999 の難易度カーブ表(M2 で確定)。
2. Sudoku Hint 説明文の粒度(技法名を出すか。5言語の負荷との兼ね合い。M2 で確定)。
3. 2048 以降の各ゲーム仕様書(各実装マイルストーン冒頭で `docs/<GAME>_RULES.md` を書く)。
4. iOS 展開の時期(現状 Android のみ。IAP 文言はストア中立にしておく)。
