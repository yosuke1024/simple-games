# Simple Games: Offline Puzzles

**Honest by design. Simple games, built in the open.**
「無料ゲームを、誠実に。シンプルなゲームを、オープンに。」

複数のゲームを収録した 1 つのアプリです(ランチャー表示名: `Simple Games`)。
収録ゲームはワークスペースパッケージではなく `src/games/<gameId>/` のフォルダで分割し、
シェル(コレクションホーム、設定 / About、バナー広告、広告削除 IAP 基盤、
ストレージ基盤、i18n)だけを共有します。

- Fully playable offline(初回起動から機内モードで動作。オフライン時は広告リクエストなし)
- No account required / No subscriptions / No paywalls
- Unlimited Undo and Hints(広告視聴・課金不要。全ゲーム機能が無料)
- 広告はオンライン時の小さなバナー 1 つだけ(買い切りで永久に削除可能)
- Progress stays on your device(クラウド同期なし。Analytics なし)

## 収録ゲーム

| ゲーム | パス | 状態 | ルール文書 |
| --- | --- | --- | --- |
| Number Match | `src/games/number-match/` | 第1弾 / 収録済み | [docs/NUMBER_MATCH_RULES.md](../../docs/NUMBER_MATCH_RULES.md) |
| Sudoku(ナンプレ) | `src/games/sudoku/` | 第2弾 / 実装予定 | `docs/SUDOKU_RULES.md`(新設予定) |

Number Match は 999 レベル(式による決定的生成、緩やかな難易度上昇)とスコア(時間要素なし)、
デイリーチャレンジを持ちます。ストア掲載文はゲーム単位で [store/listing.md](store/listing.md) に置きます。

コレクション化と第2弾の計画は
[docs/plans/2026-07-30-collection-and-sudoku.md](../../docs/plans/2026-07-30-collection-and-sudoku.md)。

## 言語

現在 5 言語(en / ja / hi / th / id)。カタログは全言語同梱(`src/i18n/`)で、
リリース前に 15 言語へ拡張予定。方針・対応言語計画は
[docs/I18N_POLICY.md](../../docs/I18N_POLICY.md)、locale の追加・修正手順は
[CONTRIBUTING.md](../../CONTRIBUTING.md) の Translations 節を参照。

アプリ内のゲーム説明は Quick Rules(チュートリアル、最大 3 ステップ)のみで、
詳細ルールはゲーム別 Landing Page へ分離します。チュートリアルの
「Learn More / 詳しく見る」ボタンがそこを開き、オフライン時は静かに何もしません
(ゲームは止まりません)。

## 開発

```bash
pnpm install          # リポジトリルートで
pnpm --filter simple-games dev        # ブラウザで開発
pnpm --filter simple-games test       # 単体テスト
pnpm --filter simple-games lint
pnpm --filter simple-games typecheck
pnpm --filter simple-games build      # dist/ へ production build
```

## Android

```bash
pnpm --filter simple-games build
pnpm --filter simple-games exec cap sync android
cd apps/simple-games/android && ./gradlew assembleDebug     # デバッグビルド
cd apps/simple-games/android && ./gradlew assembleRelease   # リリースビルド(未署名)
```

要件: JDK 21、Android SDK(`local.properties` または `ANDROID_HOME`)。

- appId: `com.pixapps.simplegames`
- appName: `Simple Games: Offline Puzzles`
- versionName / versionCode: `android/app/build.gradle` で管理(アプリ単位で更新。
  収録ゲームの追加・更新は 1 つのアプリリリースとして出す)
- 署名用 keystore はコミットしない。リリースは
  `.github/workflows/android-release.yml`(手動実行 / `simple-games-v*` タグ)を使用。
  ワークフローは未署名のリリース APK をアーティファクトとして出し、
  ストアへのアップロードは手動で行う。

## 広告(バナーのみ)

広告は Anchored Adaptive Banner 1 つだけ(オンライン時のみ・画面下部の確保済みスロット)。
インタースティシャル等の他フォーマットは使いません。方針は
[docs/ADS_POLICY.md](../../docs/ADS_POLICY.md)。

開発ビルドは Google 公式テスト広告 ID のみを使用する。本番 ID の注入は 2 箇所:

- **バナー広告ユニット ID**(Web 側): `VITE_ADMOB_BANNER_ID` を `vite build` 時に
  環境変数で注入(未設定なら広告は無効、ゲームは通常動作)。
  `VITE_ADMOB_USE_TEST_ADS` でテスト広告を明示的に指定できる。
- **AdMob アプリケーション ID**(ネイティブ側): `ADMOB_APP_ID` 環境変数を
  Gradle ビルド時に注入(`android/app/build.gradle` の manifestPlaceholder。
  未設定なら Google のテスト用 app ID にフォールバック)。

本番 ID はコミットしない。環境変数はこの 2 つ(+ テスト切替)だけで、
インタースティシャル用の ID は存在しない。

## 広告削除の買い切り(IAP)

- 商品: 「Remove Ads & Support Simple Games / 広告を削除して Simple Games を支援」。
  基準価格 USD 3.99、一度だけ、サブスクではない。購入でバナーを永久に削除
  (将来追加されるゲームにも適用)。購入復元あり。ゲーム機能は無料ユーザーと同一。
- コードにあるのは基盤(`src/monetization/` のアダプタ契約と `sg.iap` キャッシュ)まで。
  **開発ビルドではストアに接続されておらず、購入 UI は表示されない。**
  本番接続には Play Console でのアプリ内商品作成など人間の作業が必要
  (計画書 §5 参照)。

## 設定 / About の導線

- View Source Code(GitHub)
- Report a Bug
- Suggest a Game
- View Licenses
- Remove Ads & Support Simple Games(購入復元を含む)

About 画面はオフラインでも正常に表示され、外部リンクが開けなくても
アプリは止まりません。
