# Simple Games — リリースチェックリスト

Google Play への公開前に、この順で確認する。
**チェックが通らない項目を「たぶん大丈夫」で飛ばさない。**
実施していない検証を成功扱いにしないこと([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))。

## 0. 先行公開からの正式収録(該当リリースのみ)

Web 版で先行公開(ベータ)していたゲームをこのリリースで正式収録する場合
([WEB_VERSION.md](WEB_VERSION.md)「先行公開」):

> **2026-10-02 の実施記録(v1.3.2 を Play の内部テストと TestFlight に出して確かめ、問題が
> なければ v1.4.0 として公開する — 製品オーナーの段取り)。** Crown Grid / Number Path /
> Shape Regions / Yacht / Mancala / Dominoes / Hit & Blow / Dots and Boxes /
> Binary Balance / Sudoku 6×6 / Box Regions の 11 本を一度に正式収録する。各項目の
> 「この版」の行が、その項目をどうしたかの記録。チェックを入れるのは実際に終えた
> ものだけで、未了は未了と書く。

- [ ] 直近 2 週間、スキーマ変更(セーブを消す変更)・既知のクラッシュ・進行不能がない
      (壊す変更を入れたら 2 週間を数え直す)
      **この版: 未達 — 2026-10-02 に製品オーナーが明示的に免除した。** 公開は
      2026-09-26(3 本)/ 09-27(5 本)/ 09-29(3 本)で、経過は 6 / 5 / 2 日。
      基準を満たしたのではなく、オーナーの判断で収録する(経緯は
      [WEB_VERSION.md](WEB_VERSION.md)「先行公開」)
- [ ] 計測の滞在時間が十分(シェル層イベントで確認。既収録ゲームを参照点に
      人間が判断する。読み方と限界は
      [GROWTH_MEASUREMENT.md](GROWTH_MEASUREMENT.md))
      **この版: 確認した記録は無い。** 収録の根拠は上のオーナーの判断であり、
      滞在時間の確認ではない
- [x] 正式収録 = スキーマ凍結。**`game/compatibility.test.ts`(盤面/配札/ウェーブの
      golden テスト)だけでは足りない** — これは生成の決定性を守るもので、保存データが
      生き残ることは検証しない(Minesweeper / Nonogram にはこのテスト自体が無い)。
      このゲームの保存スキーマに対して、`games/<id>/storage/releasedRecords.test.ts` の形の
      **永続化ラウンドトリップテスト**(公開済みのビルドで実際に保存された payload の
      **リテラル**を、実際の読み込み経路へ通し、想定どおり扱われることを検証する。
      見本は `games/2048/storage/releasedRecords.test.ts`)を
      このリリースで作成し、以後の変更はこのテストに対する移行のみとする。
      現行コードでレコードを組み立てる形のテスト(`storage.test.ts` /
      `gamePersistence.test.ts` / `slots.test.ts` が作るペイロード)は、スキーマを
      変えるとテストも一緒に変わるので、これの代わりにならない
      **この版: 11 本ぶん(`games/<id>/storage/releasedRecords.test.ts`)を作成した。
      ペイロードは Web 版で実際に遊んで採取したもの。
      `ls apps/simple-games/src/games/*/storage/releasedRecords.test.ts` で 15 本
      (既存 4 本 + この 11 本)あることと、15 ファイルが通ること(303 テスト)を
      2026-10-02 に確認した**
- [x] registry のエントリから `channel: 'web-beta'` を外す(Web 版の BETA バッジと
      セーブ注意文(en/ja)はそれで消え、アプリのホーム・検索・住所にも現れる —
      `app/gameChannel.ts`)。README の「Web 先行公開」節から正式収録の表へ移し、
      ストア掲載文(`apps/simple-games/store/listing.md`)はゲームの収録と同時に足す。
      landing のガイド(`ui/landing.ts` の `PUBLISHED_GAME_IDS`)だけはガイドが出てから足す
      **この版: 11 本とも `channel` を外した(registry は 41 エントリ)。README は
      正式収録の表へ移した。ストア掲載文(store/listing.md)も 41 本ぶんに更新した —
      Console / App Store Connect への反映は v1.4.0 の公開と同時で、人間の作業。
      ガイドはまだ無いので `PUBLISHED_GAME_IDS` は 30 のまま — この 11 本は
      「詳しく見る」を出さない**
- [ ] landing(`pixapps-landing`)の `tests/ui.test.js` で、そのゲームの id をベータ
      許容リストから `LANDING_GAME_IDS` へ移し、`public/simple-games/index.html` に
      カードを足す(先行公開中はチャンクだけが配信され、カードは無い —
      [WEB_VERSION.md](WEB_VERSION.md)「先行公開」)
      **この版: landing の PR で対応する(このリポジトリの外)。マージされるまで
      チェックを入れない**
- [ ] そのゲームが練習セットの 5 本([PUZZLE_PRACTICE_SET.md](PUZZLE_PRACTICE_SET.md))なら、
      landing の `public/simple-games/practice/index.html` のカードから BETA 表示と
      セーブ注意文を外す(専用入口は各ゲームの実際のチャンネルを表示する —
      [WEB_VERSION.md](WEB_VERSION.md)「専用ベータ入口」)。カード自体は残る
      **この版: 5 本(Crown Grid / Number Path / Binary Balance / Sudoku 6×6 /
      Box Regions)とも対象。landing の PR で対応する**
- [ ] この版の 11 本は**アプリでまだ一度も実機・エミュレータで動かしていない**
      (jsdom と Web ビルドでしか動いていない)。§2 の「全ゲームを 1 本ずつ開ける」と
      生成・探索の待ち、§4 の低スペック端末での 1 局を、この 11 本を含めて通すまで
      「アプリで確認済み」と書かない

## 1. コードの検証(機械が判定できるもの)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- [ ] 4 つすべて緑
- [ ] `git status` がクリーン(生成物の取りこぼしがない)
- [ ] golden テスト(`compatibility.test.ts`)が通っている
      = 既存プレイヤーの盤面と自己ベストの土台が変わっていない
- [ ] 生成コスト・探索コストのテストが通っている(生成: Sudoku / Minesweeper /
      Nonogram / Kakuro / Futoshiki / Takuzu / Water Sort / Crown Grid / Number Path /
      Shape Regions / Binary Balance / Sudoku 6×6 / Box Regions(後ろの 6 本は
      `game/guarantee.test.ts`)、CPU 探索: Checkers / Gomoku / Connect Four /
      Mancala / Dots and Boxes / Yacht(後ろの 3 本は `game/cpu.test.ts` の仕事量の
      予算。Dominoes の `cpu.test.ts` は CPU が見える情報と選び方を固めるもので、
      探索の仕事量は数えない))
      = 生成・探索の仕事量(探索した配置数・ノード数・試行回数。Sudoku は配置数と
      技法走査数の 2 つ)が上限内。これは決定的な指標なので、落ちたら再実行せずに
      原因を読むこと。**壁時計は判定していない**
      ([SUDOKU_RULES.md](SUDOKU_RULES.md) §7、[ARCHITECTURE.md](ARCHITECTURE.md)
      「CI / リリース」)。これはスイート全体の約束でもある: `pnpm test` の赤は
      まず退行を疑う。単独再実行で通ることは「無関係」の証拠にならない
      (issue #158)
- [ ] サイズ Gate が緑(`pnpm build && pnpm --filter simple-games build:web`
      のあと `pnpm --filter simple-games size:check`)。`size-baseline.json` を
      更新した場合は、増加の理由が PR に書かれている(黙って上げない —
      [ARCHITECTURE.md](ARCHITECTURE.md)「ゲーム単位の lazy チャンク」)
- [ ] ライフサイクル掃引(`src/test/lifecycle.test.tsx`)が緑
      = ゲーム終了後にタイマー・RAF・リスナーが残らない
      ([GAME_LIFECYCLE.md](GAME_LIFECYCLE.md))

## 2. ブランド原則の実地確認(人が見るもの)

grep で確定判定できる分は CI(`Brand principles` ジョブ)が毎 PR で見ている。
手元では次で同じ判定を回せる:

```bash
bash .github/scripts/check-principles.sh
```

- [ ] 原則ガードが緑(Core に通信 API なし — 例外は `src/club/` のみ / バナー以外の広告なし / トラッキング依存なし —
      例外は Android release 限定の `facebook-core` 1 行のみ / Android 権限は INTERNET・BILLING のみ /
      本番広告 ID がソースにない / Meta 計測の形)

ガードが見ていない分は、コードを grep して**存在しないこと**を確認する:

- [ ] `interstitial` / `rewarded` / `appOpen` の広告実装が存在しない
- [ ] analytics / トラッキング / Remote Config の実装が native ビルドに存在しない
      (Web 版のページ解析は `--mode web` 限定 — [WEB_VERSION.md](WEB_VERSION.md)「計測」。
      Android の Meta インストール計測は、このリリースで有効化した場合だけ §5.15 を見る)
- [ ] ストリーク(連続日数)の計算・表示が存在しない
- [ ] Hint / Undo / 再挑戦が広告視聴や購入の後ろに置かれていない
- [ ] ゲーム機能の課金ロックが存在しない(唯一の商品は広告削除)

実機で確認する:

- [ ] 機内モードで初回起動 → チュートリアル → 全ゲームが最後まで遊べる
      (ゲームはゲーム単位のチャンクから開く — 初回起動直後・機内モードのまま
      **全ゲームを 1 本ずつ開けること**。チャンクは全て同梱で、ネットワークからは
      何も取得しない)
- [ ] ゲームのロード中にハードウェア戻るを押すとコレクションへ戻る
      (アプリが背面化しない)
- [ ] 機内モードで広告リクエストが発生しない(ログで確認)
- [ ] 外部リンク(About のソースコード等)がオフラインでもアプリを止めない
- [ ] プレイ中に時計が表示されない(各ゲームのルール文書の規定どおり)
- [ ] 初回起動で言語選択・ログイン・通知許可・課金ダイアログが出ない
- [ ] **生成の待ちが体感されない** —— 性能予算は端末の予算で、開発機の
      テストでは測れない(そちらは仕事量を見ている)。最も重い盤面で確認する:
      Sudoku の level 53 / 57 / 72(53 が仕事量で、57 が壁時計で最も重く、
      72 は従来から名指ししているレベル。開発環境では全レベルが 100ms 予算に
      収まっているが、端末の予算を満たしたと言えるのはここで確かめたときだけ。
      [SUDOKU_RULES.md](SUDOKU_RULES.md) §7)、Minesweeper Hard の初手、
      Nonogram の level 100、そして 2026-10-02 に収録した 6 本の生成(Crown Grid /
      Number Path / Shape Regions / Binary Balance / Sudoku 6×6 / Box Regions)の
      最も大きい盤・最も難しい難度とデイリー(各ルール文書は「低スペック実機での
      測定はまだ」と書いている)。押してから盤面が出るまでに間があってはいけない
- [ ] **CPU の手番の待ちが体感されない** — Mancala(強い方)/ Dots and Boxes(最大盤)/
      Yacht / Dominoes の CPU 対戦で、CPU の手が返るまでの「間」が意図した長さに
      収まっていること(探索の仕事量は §1 のテストが見る。端末での待ちはここでしか
      分からない)
- [ ] **7×7 盤の 320px 幅でのなぞり・ドラッグの精度** — Number Path(なぞり)/
      Shape Regions / Box Regions(ドラッグ)の Hard を実機で確かめる。通らなければ
      Hard を 6×6 に落とすが、スキーマは凍結済みなので保存の移行を伴う
      ([NUMBER_PATH_RULES.md](NUMBER_PATH_RULES.md) /
      [SHAPE_REGIONS_RULES.md](SHAPE_REGIONS_RULES.md) §13 /
      [BOX_REGIONS_RULES.md](BOX_REGIONS_RULES.md))

## 3. 多言語

- [ ] 全 locale が全キーを持つ(テストで担保)
- [ ] 主要 5 画面を各言語でレンダリングして崩れがない
      (特にドイツ語の長さ、CJK の折り返し、Devanagari / Thai の行高)
- [ ] **高リスクキーの門を通している**([I18N_POLICY.md](I18N_POLICY.md)「リリース前の門」)

  ```bash
  pnpm --filter simple-games i18n:gate status        # 残りを見る
  pnpm --filter simple-games i18n:gate pending <lang> # 逆翻訳する文字列(英語は出ない)
  pnpm --filter simple-games i18n:gate:check          # 未承認があれば落ちる
  ```

  逆翻訳は**訳を書いた実行者以外**にやらせる。承認は
  `src/i18n/gateRecord.json` に、読んだ英語と訳文のハッシュ付きで記録される。
  どちらかを後から編集すると失効し、通常の `pnpm test` が落ちる。
  **「ネイティブレビュー済み」は要求しない** — 一人開発では供給できず、
  供給できない条件をチェックリストに置くと形骸化するため
  (自然さは `machine` 来歴の開示と読者からの報告で担保する)。

- [ ] 端末言語を切り替えてもゲーム進行が失われない
- [x] Backup & Restore の 4 キー(`backupRestoreConfirmTitle` /
      `backupRestoreConfirmBody` / `backupPrivacyNote` / `backupPurchaseNote`)と
      Club House の 13 キー(`clubRemoveEraseBody` / `clubDisconnectBody` /
      `clubDisconnectHostingNote` / `clubDisconnectLastOwner` / `clubPublicDisclosure` /
      `clubDailyDisclosure` / `clubAutoSendDisclosure` / `clubAutoSendAccept` /
      `clubDeleteRankingTitle` / `clubDeleteRankingBody` / `clubDeleteResultTitle` /
      `clubDeleteResultBody` / `clubDeleteConfirm`)が門を通っていること。
      12 言語 × 17 キー = 204 件。2026-10-02 に足した高リスクキー:
      `clubAutoSendDisclosure`(参加の画面の「参加している間は、遊び終えた結果が自動で送られます」。
      結果ごとのボタンに代わる同意の文言で、誤訳は同意していない送信になる。
      [architecture/club.md](architecture/club.md) §7-4)、`clubAutoSendAccept`(自動送信より前に参加した
      接続の持ち主が Club の画面で同じ開示を受け入れるボタン。§4-1)、`clubDeleteRankingTitle` /
      `clubDeleteRankingBody` / `clubDeleteResultTitle` / `clubDeleteResultBody` /
      `clubDeleteConfirm`(自分の記録を **1 件ずつ**消す確認。ランキングの行は「次の局でまた入る」、
      デイリーの結果は「その挑戦へはもう結果を送れない」。どちらも取り消せないこと。§9。全部を消す
      キーは無い)。
      **2026-10-02 にすべて通した**(`clubAutoSendDisclosure` の 12 件、続いて `clubAutoSendAccept` と
      削除の 5 キーの 72 件。盲検の逆翻訳 + 作者の読み)。`i18n:gate status` は Gate complete、
      `I18N_GATE_STRICT=1` の `i18n:gate:check` は緑。リリースまでに既存の高リスクキーの英語の
      原文か訳文を直したら、そのキーの承認は失効するので通し直す。
      切断の文を全員向けの本文と、自分で建てた Club の Owner にだけ出す費用の 1 文に
      分けたので 9 → 10 キー(issue #160 / #161)。**以前の 120 件は 2026-10-02 に
      通した**(自動送信の前。結果は下に残す): 手順 1 の
      独立逆翻訳は原文を見せない別の実行者(1 言語 1 体)、手順 2 は作者が逆翻訳の表を
      読んだ(es / tr の `clubRemoveEraseBody` は主語が省略されているが、題名に相手の名前が
      出るので、そのまま承認)。`i18n:gate status` は Gate complete、`i18n:gate:check` は緑

## 4. Android

- [ ] `pnpm --filter simple-games build` → `cd apps/simple-games && pnpm exec cap sync android`
- [ ] `./gradlew bundleRelease assembleRelease`(JDK 21)が通る
- [ ] アップロード鍵を作成し、GitHub Secrets に登録済み
      (`ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` /
      `ANDROID_KEY_PASSWORD`。手順は [apps/simple-games/README.md](../apps/simple-games/README.md))
- [ ] keystore をリポジトリ外に保管した(**失うとアプリを更新できなくなる**)
- [ ] 署名済み AAB はタグから作る(`versionCode` / `versionName` はタグが決めるので
      `build.gradle` を手で上げる必要はない)
- [ ] 低スペック端末またはエミュレータで、起動 → 各ゲーム 1 局 → 中断 → 再開
      (**リリース要件**。WebView をサポート下限の Chromium 88 相当に近い状態でも
      確認する — 例: API 24〜26 のエミュレータイメージを WebView 未更新のまま使う。
      動かないなら配信しない)
- [ ] ホームボタン / 戻るボタンでゲームが失われない
- [ ] ダークモードで全画面を確認
- [ ] フォント倍率を最大にして主要画面が崩れない

## 4.5 R8 スモークテスト(リリースビルドの実機確認)

リリースビルドは R8 でコード縮小される(`android/app/build.gradle` の
`minifyEnabled true`。keep ルールは `android/app/proguard-rules.pro`)。
**R8 の問題は JS テストでは絶対に出ない** — 縮小はネイティブ側だけで起き、
壊れるのはプラグイン呼び出しの実行時。だから release ビルド
(`assembleRelease` した APK、debug ビルドは不可)を実機に入れて、
ネイティブプラグインを使う導線を 1 つずつ通す:

- [ ] バナー広告が表示される(オンラインで確認 — @capacitor-community/admob)
- [ ] 広告削除の購入と「購入を復元」が動く(@capgo/native-purchases。
      Play 配布ビルドが必要 — §5 の経路で確認)
- [ ] ストアレビュー導線が動く(@capacitor-community/in-app-review)
- [ ] ハプティクス(振動)が動く(@capacitor/haptics)
- [ ] 機内モードでオフライン検出が働く(@capacitor/network)
- [ ] 設定がアプリ再起動後も残る(@capacitor/preferences)
- [ ] スプラッシュ画面が正常に表示・消灯する(@capacitor/splash-screen)
- [ ] フォアグラウンド/バックグラウンド遷移が正常
      (バックグラウンド滞在時間の計上を含む — @capacitor/app)

## 5. 広告と課金(本番接続)

- [ ] AdMob に本番バナーユニットを作成し、GitHub Secrets に設定
      (`ADMOB_ANDROID_APP_ID` / `ADMOB_ANDROID_BANNER_ID`。
      interstitial 用は存在しない)
- [ ] テスト広告ではなく本番 ID でビルドされていることを確認
      (`VITE_ADMOB_USE_TEST_ADS` が未設定)
- [ ] Play Console にアプリ内商品 `remove_ads` を作成(USD 3.99、国別自動価格)
- [ ] Play Console の「ライセンス テスト」にテスト用 Google アカウントを登録し、
      **内部テストトラック経由でインストールした**ビルドで購入フローを確認
      (課金は Play 配布ビルドでしか動かない。サイドロード APK では
      `isBillingSupported` が false になり購入 UI が出ない — それは正常)
- [ ] 購入 → バナーが消える → アプリ再起動後も消えたまま
- [ ] 購入キャンセル → 何も変わらない・エラー表示が出ない
- [ ] 別端末で「購入を復元」が機能する
- [ ] 購入前の画面で購入を繰り返し促していない

## 4.7 iOS(issue #72。App Store 提出まで)

ビルド:

- [ ] **iOS の版をこのリリースのタグに合わせた**こと
      (`pnpm --filter simple-games ios:version set <major>.<minor>.<patch>` →
      `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` の 2 つが変わる)。
      Android と違い iOS の版はタグから導出できない —— Archive は Mac の上で
      人間が回し、`ios/ExportOptions.plist` は
      `manageAppVersionAndBuildNumber` を false にしているので、Xcode
      プロジェクトに書かれた値がそのまま出荷される。**手で持つ値は腐る**:
      実際 v1.0.1 から v1.1.2 までの 4 つのタグの間、ここは 1.0 / 1 のまま
      だった。整合は CI が毎 PR で、タグとの一致は `android-release.yml` が
      タグ push で見る(`pnpm --filter simple-games ios:version check`)
- [ ] `pnpm --filter simple-games build` → `cd apps/simple-games && pnpm exec cap sync ios`
- [ ] `xcodebuild -project ios/App/App.xcodeproj -scheme App` が通る(署名は
      Automatic + 開発チーム。配布用の署名・Archive は App Store Connect 側の
      作業と合わせて行う)
- [ ] **`TARGETED_DEVICE_FAMILY = 1`(iPhone 専用)のままであること。**
      `"1,2"` にした版を出すには、その前に (a) iPad 実機での回転・Split View・
      Stage Manager の確認と、(b) 13 インチ iPad のスクリーンショット
      (シミュレータ `iPad Pro 13-inch` の `xcrun simctl io … screenshot` が
      2064×2752 = 要求サイズそのまま。**テスト広告が写らないビルドで撮る**)が要る。
      Universal は 2026-08-30 に一度コードへ入ったが、この 2 つが揃うまで
      バイナリとしては出さない([ARCHITECTURE.md](ARCHITECTURE.md)
      「ワイド画面のレイアウト」)
- [ ] iOS 実機でゲーム起動・全ゲームプレイが可能/初回起動からオフラインで
      ゲーム可能/機内モードで広告・consent の通信リトライが発生しない

広告(AdMob iOS):

- [ ] AdMob コンソールに iOS アプリを登録し、iOS 用バナーユニットを作成
      (`ADMOB_IOS_APP_ID` / `ADMOB_IOS_BANNER_ID`。Android の ID は使い回さない)
- [ ] リリースビルドで `ADMOB_IOS_APP_ID`(Xcode ビルド設定)と
      `VITE_ADMOB_IOS_BANNER_ID`(web ビルド)を注入し、テスト ID の
      フォールバックが残っていないことを確認
- [ ] オンライン時のみ anchored adaptive banner 1 枠が表示される/
      広告ロード失敗・consent 失敗がゲームを中断しない
- [ ] UMP: EEA 相当のテスト地域設定で同意フォームが出る・拒否してもゲームが
      動く・Privacy Options required のとき設定に「Ad Privacy Options」行が出る
- [ ] ATT を使っていないことの再確認: `NSUserTrackingUsageDescription` が
      Info.plist に**無い**こと(入れるなら ADS_POLICY.md の節に従い申告ごと変える)

課金(StoreKit):

- [ ] App Store Connect に非消費型 `remove_ads` を作成(USD 3.99 基準)
- [ ] Sandbox テスターで購入 → バナーが消える → 再起動後も消えたまま
- [ ] 購入キャンセル・「承認と購入のリクエスト」(Ask to Buy)保留で
      エラー表示が出ない・entitlement が付与されない
- [ ] 再インストール後に「購入を復元」が機能する(Sandbox)
- [ ] Play 側の既存挙動が壊れていない(§4.5 のスモークを iOS 追加後にも 1 周)

App Store Privacy:

- [ ] App Store Connect のプライバシー申告(おおよその場所・デバイス ID・
      製品の操作・広告データ・クラッシュ・パフォーマンス)と、実際の iOS
      ビルドの SDK / 通信が一致している(トラッキング=「しない」。ATT 不使用と
      SKAdNetwork の関係は [ADS_POLICY.md](ADS_POLICY.md)「ATT を使わない」)

## 5.5 レビュー導線([REVIEW_PROMPT_POLICY.md](REVIEW_PROMPT_POLICY.md))

- [ ] 合計 5 勝するまで質問が出ない/5 勝後、ゲームから戻った時だけ出る
- [ ] 「楽しい」→ In-App Review カードが表示される(内部テストトラックで確認。
      Play のクォータ・iOS の年あたり上限により出ないことがある — その場合は
      ストア掲載ページが開く)
- [ ] カードが出なかったとき、開くのが**その端末のストア**であること。
      iOS は App Store、Android は Google Play(`services/review.ts` の
      `storeListingUrl`。iPhone を Play へ送ると入手できないページに着く)
- [ ] 「いまいち」→ メールドラフトが開き、宛先が brand の `SUPPORT_EMAIL`
- [ ] Play Console と App Store Connect のサポートメールアドレスを
      `SUPPORT_EMAIL` と一致させる
- [ ] 回答後は二度と出ない/「あとで」は 20 勝後に一度だけ再表示

## 5.6 Web 版のアプリ案内カード([WEB_VERSION.md](WEB_VERSION.md)「アプリへの送客」)

Web 版だけの導線なので、アプリのリリースではなく **Web の公開(同期)前**に見る。
5.5 と同じ危険(オフライン・端末ごとのストア)を、別の画面で繰り返している。
**頻度の危険は 2026-09-11 の常設化(issue #192)で無くなった** — 代わりに増えたのは
「毎回出るものが大きすぎないか」で、下の高さの項目がそれを見る。

- [ ] 初回訪問のコレクションホームに、0 局の状態で出る
- [ ] 何局遊んでもコレクションホームに戻れば出ている。再読み込み後も、
      `?game=<id>` で直接着地して戻ってきた場合も同じ
- [ ] Close / dismiss の操作が**無い**こと
- [ ] 位置が**ヒーローの直後・「お気に入り」「最近遊んだ」より上**であること
- [ ] 実機で開くのが**そのブラウザの端末のストア**であること。Android は
      Google Play、iPhone / iPad は App Store、Desktop は両方
      (`services/webStoreLinks.ts` の `storeTargets`)
- [ ] **両方のリンクが実在する掲載ページに着く**こと。5.5 と同じ事故
      (入手できないページに着いて壊れたボタンに見える)を、Web では
      iOS 未掲載の期間に起こしうる
- [ ] 機内モードで出ないこと。出ないだけでゲームは止まらないこと
- [ ] インストール済みアプリでは**一度も出ない**(Android / iOS 実機で確認)
- [ ] 14 言語 × 狭い画面(320 / 360px)でカードが崩れず、横スクロールが出ず、
      **1 画面目からゲームのグリッドが見えている**こと(カードが第一画面を
      占領していないこと)
- [ ] ストアリンクを押すまで追加のネットワークリクエストが出ないこと
      (DevTools の Network で確認)

## 5.7 結果画面の共有([ARCHITECTURE.md](ARCHITECTURE.md)「レイヤー規則」, issue #86)

自動テストは文面・リンク・全ゲーム(registry の全エントリ)への設置までしか見られない。**共有シートが
実際に開くかは実機でしか分からない。**

2026-09-04 に決着した: **Android の WebView に `navigator.share` は無い**(WebView 148
でも `undefined`)。それまで Android は共有シートが一度も開かず、静かに
クリップボードへ落ちていた —— ユーザーが実機で気づくまで誰も知らなかった。
いまはネイティブ 2 プラットフォームとも `@capacitor/share` +
`@capacitor/filesystem` を通す(権限は増えない。どちらも Android マニフェストが空)。
ブラウザは従来どおり Web Share API。

- [ ] Android 実機で「共有」を押すと OS の共有シートが開き、**画像が添付されている**
      こと(シートの見出しが「画像を共有」相当になる)
- [ ] iOS 実機で同じこと(シートに「1個の画像、1個のリンク」相当が出る)
- [ ] どちらかでシートが開かない場合は**リンクがコピーされ、「リンクをコピー
      しました」が出る**こと(プラグインが失敗してもブラウザ側の梯子へ落ちる)
- [ ] ブラウザ(Android Chrome / iOS Safari / Desktop)で、共有シートまたは
      コピーのどちらかが必ず起きる
- [ ] 共有シートを**取り消して**もゲームが止まらず、エラーも「コピーしました」も
      出ないこと
- [ ] 機内モードで押しても、シートが開く / コピーできること。エラー画面が出ないこと
- [ ] 送られた文の 2 行目が結果画面に表示されている数字と一致すること(ラベル・値
      とも)、自己ベストや通算成績が入っていないこと、勝った結果だけが
      「クリアしました」を名乗ること
- [ ] **リンクが実際に相手先へ残ること**(とくに X)。共有の目的はリンクなので、
      画像だけ届いてリンクが消える状態は不合格。Android は URL を独立行として
      text に入れており、消える受け口が見つかったらここに書き足す
- [ ] iOS Safari / Android Chrome のブラウザ版で共有シートに**画像カード**が付く
      こと(1080×1080、ゲームのアクセント色、タイトル・結果・
      `pixapps.ai/simple-games`)
- [ ] Android / iOS の**アプリ**で画像付きの共有シートが開くこと(2026-09-04 に
      エミュレータ / シミュレータで確認済み。実機でも 1 度は見ること)
- [ ] 画像に広告が写っていないこと(描画カードなので写らないはず、確認のみ)
- [ ] 14 言語で画像の文字が枠からはみ出さないこと(長いタイトル: Mahjong
      Solitaire / Spider Solitaire、長いラベル: ドイツ語)
- [ ] 受け取ったリンクを別端末で開くと、そのゲームが直接開くこと
- [ ] 共有しても、しなくても、ゲーム・進行・広告表示・解放されるものが変わらないこと
- [ ] 14 言語 × 狭い画面(360px 以下)で、共有ボタンが「もう一度 / 次へ / ホーム」を
      押し出さず、結果カードからはみ出さないこと

## 5.8 お気に入りの固定([ARCHITECTURE.md](ARCHITECTURE.md)「コレクションホーム」, issue #109)

自動テストが見られるのは合成イベントまでで、**長押しが実機でどう終わるかは
エンジンごとに違う**。Android Chrome は自前の長押しメニューを出したあと click を
出さないことがあり、iOS の WKWebView は選択キャレットを出しうる。シートが
開いた瞬間に指を離す動作は、実機でしか確かめられない。

- [ ] 全ゲーム(registry の全エントリ)のホームのヘッダー右に星があり、押すと塗りつぶしと
      読み上げ文言(追加 ⇄ 削除)が入れ替わること。コレクションへ戻ると
      その節に載っていること
- [ ] 星がヘッダーの形を変えていないこと(戻るボタンと左右で釣り合う)
- [ ] Android / iOS 実機で、タイルの長押しでシートが開き、**指を離しても
      シートが閉じず、そのゲームも開かない**こと
- [ ] シートを閉じたあと、同じタイルの**普通のタップでゲームが開く**こと
      (押し込みの click を飲むガードが 1 回で解けていること)
- [ ] 長押しの途中でスクロールするとシートが**開かない**こと
- [ ] 長押し中に選択ハイライト・コピー吹き出し(iOS のキャレット)が出ないこと
- [ ] ブラウザ版で右クリック、およびキーボードのメニューキー(Shift+F10)で
      同じシートが開くこと
- [ ] 3 つの経路(ゲームホームの星 / タイルの長押し / 設定の一覧)が同じ状態を
      指していること。片方で固定してもう片方で解除して一周する
- [ ] TalkBack / VoiceOver で設定の星が**押した状態として読み上げられる**こと
- [ ] 固定したゲームが「最近遊んだ」から消えること、固定を外すと戻ること
- [ ] 「ローカルデータを削除」のあと、お気に入りの節ごと消えていること
- [ ] 14 言語 × 狭い画面(360px 以下)で、シートのボタン文言と設定の一覧が
      崩れないこと(長い言語: ドイツ語 `Zu Favoriten hinzufügen`)

## 5.9 ホーム画面ショートカット(issue #110)

JS 側は自動テストが見ている(`src/app/App.shortcut.test.tsx` /
`src/app/shortcutLaunch.test.ts` /
`src/services/homeShortcut/homeShortcut.test.ts`)。ここに残るのは
**Launcher・OS の確認ダイアログ・ホーム画面そのものが絡み、実機でしか
確かめられないもの**だけ。

- [ ] 対応 Launcher でタイルのシートに「ホーム画面に追加」が出ること
- [ ] 対応 Launcher で各ゲームホームのヘッダー右、星の隣に「ホーム画面に追加」の
      ボタンが出て、そのゲームの名前で OS の確認ダイアログが開くこと
- [ ] 未対応 Launcher(または iOS・Web)ではシートの行もヘッダーのボタンも
      出ず、ヘッダーは星だけの従来の形であること
- [ ] 押すと OS の確認ダイアログが出て、そこで拒否してもアプリ側は何も言わず
      静かに終わること
- [ ] ホーム画面に追加されたアイコンが、そのゲームのグリフとアクセント色で
      描かれ、ラベルがゲームタイトルであること
- [ ] cold start(アプリを完全終了した状態からショートカットを起動)で
      コレクションを経由せず、対象ゲームのホームが最初に出ること
- [ ] warm start(別のゲームを開いた状態でショートカットを起動)で対象ゲームへ
      切り替わること。**同じゲームを開いている最中**にそのショートカットを
      踏んだ場合は何も変わらないこと
- [ ] 通常のアプリアイコンからの起動は、これまでどおりコレクションが開くこと
- [ ] ショートカット起動後のハードウェア戻るが、ゲーム → コレクション →
      アプリ最小化の順のままであること
- [ ] 同じゲームをもう一度「ホーム画面に追加」すると、OS の確認ダイアログが
      **もう一度**出ること。id が同じなので OS 側のレコードは 1 つのまま更新される
      が、Pixel Launcher はそこで「追加」を選ぶと **2 つ目のアイコンを置く**
      (2026-09-05 エミュレータで実測)。それは Launcher の判断であり、アプリが
      迂回しない。アプリ側で確かめるのは「ダイアログが出る」ことまで
- [ ] お気に入りに登録しただけではショートカットが作られないこと
- [ ] 長い言語でラベルが崩れないこと(ドイツ語
      `Zum Startbildschirm hinzufügen`)

## 5.10 ゲーム名の検索([ARCHITECTURE.md](ARCHITECTURE.md)「コレクションホーム」, issue #122)

絞り込みそのものは自動テストが見ている(`src/app/gameSearch.test.ts` /
`src/ui/screens/CollectionHomeScreen.test.tsx`)。ここに残るのは
**実機のソフトキーボードと IME が絡むもの**——アプリで初めての入力欄なので、
「テキストフィールドが実機でどう振る舞うか」は一度も確かめていない。

- [ ] Android / iOS 実機で検索アクションを押すとキーボードが自動で上がり、
      そのまま打てること
- [ ] iOS でフィールドにフォーカスしても**ページが拡大されない**こと
      (16px 未満だと Safari が勝手にズームし、戻す手段が無い)
- [ ] 日本語・中国語・韓国語の IME で変換中(未確定)の文字が入力欄に見えること。
      ラテン文字のタイトルしか当たらないのは仕様
- [ ] 入力欄の文字を長押しで選択・コピーできること(`user-select: none` が
      body に効いている)
- [ ] キーボードが出ている状態で結果をスクロールでき、タップでそのゲームが
      開くこと
- [ ] Android のハードウェア戻るが**検索を閉じるだけ**で、アプリが最小化
      されないこと。ホームでもう一度押すと従来どおり最小化されること
- [ ] 検索を閉じて開き直すと入力欄が空であること(検索履歴を持たない)
- [ ] 14 言語 × 狭い画面(360px 以下)で、プレースホルダーが戻る矢印を
      押し出さず途中で切れないこと(長い言語: フランス語
      `Rechercher un jeu`)
- [ ] ダークテーマで入力欄の枠・文字・プレースホルダーが読めること

## 5.11 iOS のホーム画面 Quick Actions([ARCHITECTURE.md](ARCHITECTURE.md)「コレクションホーム」, issue #114)

JS 側は自動テストが見ている(`src/services/homeShortcut/quickActions.test.ts` /
`src/app/favoriteGames.test.ts` / `src/app/shortcutLaunch.test.ts` /
`src/app/App.shortcut.test.tsx`)。ネイティブ側(`AppDelegate.swift` /
`QuickActionsPlugin.swift` / `MainViewController.swift`)はこのリポジトリの CI では
ビルドされないので、**Xcode でのビルドと実機確認がここに残る**。

- [ ] §4.7 の `xcodebuild … build` が通ること。`Main.storyboard` の初期 VC が
      `MainViewController` になっていること(`cap sync ios` は戻さない)
- [ ] お気に入り 0 件でアプリアイコンを長押しすると、ゲームの項目が 1 つも
      無いこと(OS 自身の「アプリを削除」「アプリを共有」だけ)
- [ ] お気に入りを 1 本留めると、**再起動せずに**アイコン長押しにその 1 本が
      出ること。外すと消えること
- [ ] 5 本以上留めても項目は 4 本で、棚の**先頭 4 本(留めた順)**であること。
      先頭の 1 本を外すと 5 本目が繰り上がること
- [ ] 項目をタップして cold start(完全終了状態から)しても、コレクションを
      経由せず対象ゲームのホームが最初に出ること。中断中の局がちょうど 1 つの
      ゲームでは盤面へ直接入ること(#113)
- [ ] 別のゲームを開いた状態でのタップ(warm start)で対象ゲームへ切り替わり、
      レビューの質問が出ないこと。**同じゲームを開いている最中**のタップでは
      何も変わらないこと
- [ ] 通常のアプリアイコンからの起動は従来どおりコレクションが開くこと
- [ ] 「ローカルデータを削除」のあと項目が全部消えていること
- [ ] 3 経路(ゲームホームの星 / タイルの長押し / 設定の一覧)のどれで留めても
      同じように反映されること
- [ ] 長いタイトル(`Mahjong Solitaire` / `Spider Solitaire`)がメニューで
      切れないこと。項目のアイコンは全部同じ再生記号であること(仕様)
- [ ] Android / Web は変わっていないこと(Android の §5.9 が通り、お気に入り
      登録でショートカットが作られないこと)

## 5.12 ドラッグでの移動(issue #116 / #119 / #144)

Solitaire / Spider / FreeCell は**タップ操作を残したまま**ドラッグを足した
(`SolitaireTable.tsx` / `SpiderTable.tsx` / `FreeCellTable.tsx`)。自動テストは
合成した pointer イベントまでしか見られず、**指とスクロールの取り合いは実機に
しか無い**。カードには `touch-action: none` が掛かっているので、カードの上から
始めた縦スワイプはページを流さない —— 盤が画面に収まらない端末で最初に出る。

- [ ] Android / iOS 実機で、札をつまんで運び、置ける場所で離すと動くこと。
      置けない場所で離すと**元の位置へ戻る**こと(そこに落ちたままにならない)
- [ ] **タップ→タップの 2 手が従来どおり動く**こと。8px 未満の押し込みは
      ドラッグにならずタップとして扱われること(指はまっすぐ止まらない)
- [ ] 盤が縦に収まらない端末で、**カードの上から始めた縦スワイプで盤が
      スクロールしない**こと。逆に、余白から始めたスワイプでは従来どおり
      スクロールすること
- [ ] ドラッグの最中に盤がスクロールしたら、その運びが**取り消されて札が元へ
      戻る**こと(測った座標と実際の位置がずれるため。宙に浮いた札が残らない)
- [ ] 指が画面の外(ステータスバー・ホームバー・画面端)へ出て戻ってきても
      札を取りこぼさないこと
- [ ] ドラッグ中に通知シェード・着信・アプリ切り替えが割り込んでも、戻ったとき
      札が宙に浮いていないこと(`pointercancel` は解放ではなく取り消し)
- [ ] マウス(Chromebook / iPad + トラックパッド)で、ボタンを離した場所が
      表の外でも札が戻ること
- [ ] Bubble Pop: 狙っている最中に通知シェード・着信・パーム拒否が割り込んだとき
      **発射しない**こと。弾は装填したまま残り、天井も降りないこと(#144)
- [ ] Nonogram / Minesweeper のドラッグ(連続の塗り・× ・旗)が、盤の
      スクロールと取り合いにならないこと
- [ ] コレクションホームのタイルの長押し(§5.8)とドラッグが干渉しないこと ——
      スクロールしようとして長押しシートが開かないこと
- [ ] 運んでいる札が広告バナーの上を通っても、バナーが札を隠さないこと

## 5.14 バックアップと復元(issue #160、[architecture/backup.md](architecture/backup.md))

形式・検証・ロールバックは自動テストが持っている(`src/backup/`)。**実機にしか
無いのはファイルそのものの行き来**である —— OS の共有シート、ドキュメント
ピッカー、そして「別の端末で開けるか」。ここで失敗すると、失うのは機能ではなく
**その人の全ゲームぶんの進行**なので、1 台で完結させずに必ず 2 台で確かめる。

確認用に、**中断中の局・レベル進行・デイリー履歴・お気に入り・ゲーム固有設定が
実際に入った端末**を用意すること(まっさらな端末での往復は何も証明しない)。

- [ ] Android 実機: Export → 共有シートが開き、ドライブ / メール / ファイルへ
      保存できること。ファイル名が `simple-games-backup-YYYY-MM-DD.json` であること
- [ ] Android 実機: 別の端末(または削除後の同じ端末)で Restore →
      **中断中の局がそのまま再開でき**、レベル進行・統計・デイリー履歴・
      お気に入り・言語 / テーマ / 音 / 振動が戻ること
- [ ] iOS 実機: Export → 共有シート、Restore → ファイルアプリのピッカー。
      どちらも Android と同じファイルで動くこと
- [ ] **Android で書き出したファイルを iPhone で復元できること**、および
      **その逆**(この 2 つが目的そのもの。片方だけ確かめて済ませない)
- [ ] Web: Export がブラウザのダウンロードになり、Restore がファイル選択に
      なること。**アプリ ↔ Web の往復**もできること
- [ ] **機内モードで Export と Restore が最後まで完了すること**
      ([OFFLINE_POLICY.md](OFFLINE_POLICY.md))
- [ ] 共有シート / ピッカーを**閉じた**とき、画面が固まらず、何も壊れないこと
      (ボタンが押せる状態に戻る)
- [ ] 関係ないファイル(写真など)を選んだとき、**この端末のデータが変わらず**、
      「Simple Games のバックアップではありません」と出ること
- [ ] 確認ダイアログに**バックアップの日付**が出ること。Cancel を押したら
      何も変わっていないこと
- [ ] **広告削除を購入済みの端末で Export → 未購入の端末で Restore → 広告が
      消えないこと**([ADS_POLICY.md](ADS_POLICY.md))。書き出したファイルを
      テキストエディタで開き、`sg.iap` / `adRemovalPurchased` が
      **1 文字も入っていない**ことも目で見る
- [ ] **Club House に参加した端末で Export したファイルに、メンバートークンが
      入っていないこと。**書き出したファイルをテキストエディタで開き、
      `sg.club` / `sg.clubOutbox` のキーも、参加時に発行された値も
      **1 文字も入っていない**ことを目で見る(この 2 つは端末の鍵と、その接続に紐づく
      未送信の結果なので、書き出さず端末に残す — `src/backup/keys.ts`)。復元は
      この接続を足しも消しもしない。参加済みの端末で復元しても参加したまま残ること、
      未参加の端末で復元しても参加状態にならないことを確かめる
- [ ] 復元した端末で、購入済みだった側の「購入を復元」がこれまでどおり効くこと
- [ ] 14 言語 × 狭い画面(360px 以下)で、説明文とボタンが崩れないこと
      (長い言語: ドイツ語 `Sicherung wiederherstellen`)

## 5.13 物理キーボード(issue #93 / #115 / #143)

キーボードは「タップと同じ処理を呼ぶ入力アダプター」として入っている
(`src/ui/useGameKeys.ts`)。**キーで届くものは画面にも必ずある**という約束なので、
ここで見るのは新しい機能ではなく、**キーが余計なものを壊していないか**である。
自動テストは合成キーイベントまで。実機に残るのは IME とソフトキーボードとの
同居で、確認には Bluetooth キーボード(Android)か Magic Keyboard 等(iPad)が要る。

- [ ] 矢印 / 数字 / Undo(Ctrl+Z・Cmd+Z)/ Hint が、対応するボタンを押したときと
      同じ結果になること。**ボタンが無い操作がキーだけで起きないこと**
- [ ] Minesweeper の `F`、Nonogram の `X` で入力モードが入れ替わること(#115)
- [ ] Futoshiki / Kakuro / Quick Math が数字キーで入力でき、Backspace / Delete で
      消せること(#143)
- [ ] 日本語・中国語・韓国語の IME を**オンにした状態**で、変換のためのキーが
      盤面を動かさないこと
- [ ] 検索欄(§5.10)にフォーカスがある間、打った文字が盤面へ届かないこと
      (入力欄の中のキーはゲームへ渡さない)
- [ ] 結果オーバーレイ・確認ダイアログが出ている間、その裏の盤面がキーで
      動かないこと(盤面を inert にしたのと同じ約束 — issue #120)
- [ ] ゲームを離れたあとキーが効き続けないこと(リスナーが残らない ——
      [GAME_LIFECYCLE.md](GAME_LIFECYCLE.md))
- [ ] キーボードを使わない端末で、これまでと何も変わっていないこと

## 5.15 Android の獲得計測(Meta)([META_ANDROID_ACQUISITION.md](META_ANDROID_ACQUISITION.md), issue #204)

**このリリースで Meta を有効化するか**を最初に決める(リポジトリ変数
`SG_META_ANDROID_ENABLED`)。有効化しないリリースで見るのは 1 項目目だけ。
**2026-09-29、オーナー判断で仕様を変更した ―― 同意を尋ねる質問ダイアログと設定の
スイッチは廃止し、対象地域の新規インストールでは起動時に自動で送る。以下はその
前提で確認する(v1.3.0 は旧・同意ベースの仕様のままなので本番配信しない ――
新仕様は v1.3.1 以降)。**

- [ ] ワークフローのサマリーの「Meta インストール計測」が意図どおり(無効 / 有効)で、
      「Audit the Android artifact」が緑(無効なら dex に `com/facebook` が 0 件、
      有効なら SDK が入り自動動作が false、どちらも権限は許可リスト内)

有効化するリリースだけ:

- [ ] runbook §8 の前提がすべて済んでいる(対象年齢 / データ セーフティ / 公開
      プライバシーポリシーの Android の節 / Meta 側の自動ログ・AAM・Codeless の無効化 /
      Secrets)。**1 つでも欠けたら変数を入れない**
- [ ] 質問ダイアログも設定の「Ad measurement (Meta)」の行も存在しない
      (ソースで確認 —— `services/acquisition` 一式が無い、Settings 画面に
      該当行が無い。実機でも Settings を開いて確かめる)
- [ ] 対象地域(EEA・英国・スイス等の外 —— 例: US / JP)相当の SIM・ネットワーク・
      端末の地域設定で新規インストールし、初回のオンライン起動で**タップなしに**
      Meta へ報告が送られる。Events Manager の Test Events(届かないことがある —
      runbook §9)またはデータセットの概要(Overview)で `MOBILE_APP_INSTALL` が
      1 件、**`fb_mobile_activate_app` など他のイベントは 0 件**(Meta 側の自動ログが
      オフである証拠 — runbook §4 の注意)
- [ ] EEA・英国・スイス相当の地域設定(SIM・ネットワーク・端末のいずれか)にした
      新規インストールでは、初回起動から `graph.facebook.com` への通信が 0 件
      (通信を観測して確かめる。「イベントを呼んでいない」で代えない)
- [ ] 既存ユーザー相当(前の版からの更新)では `firstInstallTime` が更新前のまま
      残るため報告されない ―― 更新後の初回起動で `MOBILE_APP_INSTALL` が送られない
      こと。保存データと広告削除の権利は残っている
- [ ] 報告が 1 件受理された後、アプリを再起動しても通信が 0 件のままで、SDK が
      端末に残したデータが削除されること
- [ ] 機内モードの初回起動で全ゲームが動き、オンライン復帰で報告が 1 回だけ
      試みられる
- [ ] Meta 入り / なしの release ビルドで、配布サイズ・起動時間・メモリの差を実測し
      runbook §9 に書いた(低価格実機での結果は、測ったときだけ書く。**runbook §9 の
      起動時間・メモリは 2026-09-29 に同意ベースの旧仕様・同意前の起動で測ったもので、
      自動送信の新仕様では未実測。流用せず、このリリースで Meta 入り / なしを測り直して
      §9 の「新しい流れ」の表に書く**)
- [ ] 広告マネージャで Android アプリのインストール最適化が選べる
- [ ] データ セーフティ欄と公開プライバシーポリシーが、この自動送信の仕様と
      一致している ――「任意」ではなく自動収集であること、Device or other IDs に
      広告 ID(Meta と共有)が含まれること(詳細は下の §6)

## 5.16 Club House は未接続の端末では存在しない([architecture/club.md](architecture/club.md) §12-8, issue #161)

**2026-10-02 にエミュレータで実施**(Pixel_7、Android 17 相当のシステムイメージ、ブランチ
`claude/club-public-f` のデバッグビルド)。新規インストール → 起動 → ホームをスクロール → ゲームを
1 つ開いて操作 → 戻る → ヘッダのメニュー、の 70 秒間、WebView の DevTools プロトコル
(`Network.requestWillBeSent`)で記録した通信は **0 件**。対照として同じ接続から `fetch` を 1 本
打つと記録に出るので、監視は機能している。バナー広告はネイティブ SDK の通信で WebView には
出ないため、この 0 件は「Club House のコードが 1 件も通信していない」の実測である。実機
(端末)での再確認は出荷前のリリース作業で行う。

- [x] 未参加の端末で、Club House 宛ての通信が 0 件(2026-10-02、エミュレータ)
- [ ] 実機で同じ手順(リリース作業で)

元の文: Club House を出荷するリリースの前に、ここを実機で通す。
「接続していない端末は club/ を 1 バイトも読まず、1 件も通信しない」は、
`importBoundaries.test.ts` 規則 5・サイズゲート・`check-principles.sh` §1 / §1b が
**到達できない**ことを示しているだけで、実際に**起きない**ことは実機でしか見えない。

確認用の端末は、**Club に一度も参加しておらず、招待リンクも開いていない**もの
(アプリを入れ直す。または「ローカルデータ削除」を押した直後)。接続済みの端末での
確認は何も証明しない。

- [ ] **未接続の端末で機内モードにして**、ホーム → 設定 → Sudoku / Minesweeper /
      Water Sort の結果画面まで一通り遊ぶ。ホーム・設定・結果画面に
      **Club に関する変化がなく**(「一緒に遊ぶ」の入口が余計な場所に出ない、
      待ち表示も失敗表示も出ない)、遊び心地がこれまでと同じであること
- [ ] **その間のリクエストが 0 件**であること。見方:
      Android は Android Studio の Network Inspector(`com.pixapps.simplegames` を
      選び、操作の間ずっと録る)、iOS は Safari の Web Inspector の Network タブ
      (端末を Mac に繋いで開く)、Web は DevTools の Network タブ。
      広告の SDK のリクエストはここでは無関係なので、機内モードにして切り分ける
      (機内モードでは広告も出ないので、**残るのは Core 自身の通信だけ**)。
      0 件でなければ、そのリクエストの宛先を書き残してから止める
- [ ] 機内モードを**解除**して同じ操作を繰り返しても、未接続の端末は
      Club の宛先へ**何も送らない**こと(解除した瞬間に送られるものがない)
- [ ] ホームの表示から `club-*.js` が読まれていないこと(Web なら Network タブで
      `club-` を検索して 0 件。設定の Club House を**押す前**に見る)
- [ ] 設定 › Advanced › Club House を押して初めて `club-*.js` が読まれること、
      そして**ここで初めて**接続の画面が出ること

**未確認は未確認として書く。** 機内モードの確認を端末の一部でしかしなかったとき、
Network Inspector が使えなかったとき、通信の宛先を特定できなかったときは、
チェックを入れずに「何を確認できなかったか」をこの節の下に残す。「たぶん出ていない」は
確認ではない。

## 5.17 Club House の接続後の経路([architecture/club.md](architecture/club.md), issue #161)

§5.16 は「参加していない端末は何も送らない」を見た。ここは**参加した端末**で、
実際に通ることを実機で確かめる。エミュレータと jsdom では通らない部分
(ネイティブの WebView からの通信、オリジン、機内モード)が目的。**実機の Android と
実機の iPhone の両方**で行う。

前提: サーバ(<https://club.pixapps.ai>)が、出荷するビルドと同じ契約でデプロイ済みで
あること(通報・持ち主の対処・`GET /public` を含む)。サーバの CORS は、ネイティブの
オリジン `https://localhost`(Android)と `capacitor://localhost`(iOS)を許している
(サーバ側 `src/http/cors.ts` の `APP_ORIGINS`)。**これが効いているかは、実機から
実際に通信して初めて分かる**ので、下の最初の項目がその確認を兼ねる。

自動送信でサーバへの書き込みは「ボタンを押した数」から「参加している Club の数 × 遊び終えた局の数」に
変わった。**Public の費用の上限(1 日 10 万リクエスト、1 メンバー 1 分 60 リクエスト。
[PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「費用の上限」、[club.md](architecture/club.md) §15-3)が
この量で足りることを、v1.4.0 を出す前に Public のデプロイで再確認する**(未実施)。

**結果の送信は自動である**(2026-10-02。結果画面にボタンは無く、状態 1 行だけが出る。
[club.md](architecture/club.md) §2-2)ので、この節は「ボタンを押す」ではなく
**「参加 → 開示を読む → 遊び終える → 状態の行 → Rankings に載る」**を実機で通す。

- [ ] 設定 › Advanced › Club House(またはホームの Play together)から **Public Club
      House に参加**できること。表示名を入れて参加し、**参加前に「参加している間は、遊び終えた
      結果(時間・手数・スコアなど)が自動で送られる」旨(`clubAutoSendDisclosure`)と
      「表示名と結果が参加者と pixapps.ai に公開される」旨(`clubPublicDisclosure`)の
      説明が出ている**こと。Android・iPhone それぞれで。(招待リンクを貼って参加する画面と招待 URL を
      開いて参加する画面にも同じ説明があるが、v1.4.0 ではその入口を隠す — 下の「招待リンクの入口が
      無い」。次の版で入口を戻すときに、そこの説明をこの項目で確かめ直す)
- [ ] **1.3.2 から更新した端末は、受け入れるまで送らない**こと(自動送信より前に参加した接続。
      [architecture/club.md](architecture/club.md) §4-1)。1.3.2 でどれかの Club に参加した
      端末を、この版へ**上書き更新**する(Android は `adb install -r`、iPhone は TestFlight の更新)。
      Club を開くと、画面の一番上に開示(「参加している間は…自動で送られます」)と
      `Send my results automatically` のボタンの箱が出る。**ボタンを押す前に 1 局遊び終えても、結果画面の
      状態の行は空のままで、Rankings に載らない**(通信も出ない)。ボタンを押すと箱が消え、
      次に遊び終えた局から `Sent to <Club>` が出て Rankings に載る(押す前に遊んだ局は載らない)。
      押さずに Club を使い続けても、一覧・Reload・Disconnect は普通に動く。Android・iPhone それぞれで
- [ ] **参加する前に遊んだ局が送られない**こと: 参加の前に 1 局遊んでおき、参加したあとに
      Rankings を開いても、その局の成績が無い
- [ ] **ボタンを押さずに、遊び終えた結果が自動で送られ、Rankings に自分の成績が載る**こと。
      **ホームのゲームのデイリー / レベル / フリーを、Today や Club の画面を開かずに遊ぶ**
      (Today からでなく、ゲームの普通の入口から)。結果画面に **`Sent to <Club>` の状態 1 行**が
      出て、ボタンが無いこと。Club を開くと、全員同じ盤面のデイリーは `Today` に、それ以外は
      そのゲーム × モードの `Rankings` に自分の成績が載る。対象ゲームは複数(Sudoku /
      Minesweeper / Water Sort に加え、この版で収録した 11 本のうちデイリーのあるゲームを少なくとも
      1 つ)。**Minesweeper(または Number Recall)のデイリーは `Today` ではなくランキングの表に載る**
      こと。ランキングは各人の自己ベストの並びで、盤面は人ごとに違ってよい。熱心さの順位・
      ストリーク・カウントダウンが出ていないこと
- [ ] **Minesweeper で地雷を踏んだ局・Number Match の行き止まり・Dominoes で勝てなかった局は何も送られない**
      こと。点数を競うゲーム(2048、対 CPU の Reversi など)は、ゲームオーバーや負けの局も点数がランキングへ
      送られる(判断 30。これは正しい動き)。
      そのデイリーをあとで完了すると、その結果が `Today` / ランキングに載る(失敗が挑戦を確定させない)
- [ ] 送信の失敗が遊びを止めない: **機内モードのまま**局を最後まで遊べ、結果画面が普通に出ること。
      状態の行は `Will send when you open the Club`。**未送信の結果は端末に残り、機内モードを解除して
      Club を開き直す(または次の局を遊び終える)と送られる**こと。**アプリを起動しただけでは
      送られない**こと(起動時の再送は無い)。失敗表示で操作がふさがれない
- [ ] **2 つの Club に参加した端末**で、結果が**両方**へ送られ、状態の行が
      `Sent to 2 Clubs`(片方に届かなければ `Sent to 1 of 2 Clubs. …`)になること。
      同じデイリーの 2 度目の完了は何も言わず、先に送った結果が残ること
- [ ] **対象外のゲームは何も送らない**こと: Brick Breaker / Bubble Pop / Checkers /
      Connect Four / Gomoku / Ludo と、ティアに一致しない Water Sort のレベルの結果画面に、
      Club の状態の行が出ず、リクエストも出ない
- [ ] **Report**: Rankings の他人の名前を通報でき(1 人 1 回)、通報後に画面が
      壊れないこと。持ち主の側で、通報された名前を**変更**(`PATCH /members/:id`)・
      **結果ごと削除**(`DELETE /members/:id?purge=1`)でき、ランキングの行に反映される
      こと(Public の持ち主は PixApps。[club.md](architecture/club.md) §17-3)
- [ ] **Disconnect**: 接続を切ると、端末が Club の宛先へ以後 1 件も通信しないこと
      (§5.16 と同じ見方で確認。切断のあとに遊び終えた結果も送られない)。切断後もゲームの進行・
      統計は何も変わらないこと。**切断では記録が消えない**こと(Public の Rankings に自分の行が
      残っている — 別の端末か Web 版から見る)。切断した端末は、起動しても Club を開かなくても
      通信しないこと(切断した Club の資格 `departed` は何も起こさない。
      [club.md](architecture/club.md) §4-1)
- [ ] **同じ端末で入り直すと同じメンバーに戻る**こと(判断 43。[club.md](architecture/club.md) §7-4):
      Public に参加して 1 局遊び、`Disconnect this device` → もう一度 `Join the Public Club House`。
      表示名を**変えて**入り直すと、新しい行が増えずに**同じ行が新しい名前になり**、前の記録が残って
      いる(Rankings の件数が増えない)。切断前に Owner だった端末は Owner のまま。**同じ名前で入り
      直しても同じ行**であること。Android・iPhone それぞれで。**`Reset Local Data` のあとに入り直すと
      新しいメンバーになる**こと(古い行は残る)。これは仕様であり、不具合として扱わない
- [ ] **自分の名前を変えられる**こと(Club の Settings › `Change your name`): 変えた名前が Rankings と
      Today の自分の行・Members に反映される。参加と同じ表示名の規則(空・25 文字以上・制御文字など)が
      はたらき、拒まれても画面が壊れない。**通報された名前を自分で変えても、持ち主の `Reported` の
      数は消えない**こと(持ち主が変えたときだけ消える。[club.md](architecture/club.md) §17-3)
- [ ] **自分のランキングの行を 1 件消せる**こと(Rankings › 表の画面の自分の行の横の削除ボタン。
      [club.md](architecture/club.md) §9・§16-2): 確認(危険色のダイアログ。この表の自分の記録が消える・
      次に終えた局はまた入る・元に戻せない)→ 確認するとその行だけが消え、件数と 1 位が直る(ほかの表・
      ほかの人の行・Today は変わらない)。**メンバーのまま Club に居る**こと(Members に残る)。**消したあとに
      その表のゲームを 1 局遊び終えると、また送られて表へ入る**こと。50 位より下で末尾に足された自分の行
      にもボタンがあり、**ほかの人の行にボタンが無い**こと。**機内モードで遊んだ未送信(同じ表)があるとき
      に消すと、そのあと Club を開いても消したはずの行が復活しない**こと(同じ表の未送信は先に捨てられる)。
      Owner の端末でもできること
- [ ] **自分のデイリーの結果を消すと、その挑戦へは送れない**こと(Today › 挑戦の画面の自分の行の横の
      削除ボタン。[club.md](architecture/club.md) §9・§5-4): 確認(この挑戦から自分の結果が消える・
      この挑戦へはもう結果を送れない・元に戻せない)→ 確認すると自分の結果が消え、挑戦の人数が減る。
      **同じ日のデイリーをもう一度遊び終えても結果は載らない**こと(サーバが `409 already_submitted` で
      断り、アプリは何も言わずに「届いた」と同じに扱う。エラーも再試行も出ない)。**ランキングの行は
      デイリーの結果とは別で、消していなければそのまま残る**こと。全部の記録を一度に消すボタンが
      **どこにも無い**こと(Settings にも)。ダイアログの 3 つの文は、en と ja で内容が合っていること
- [ ] **招待リンクの入口が無い**こと(v1.4.0 は隠す。判断 44。[club.md](architecture/club.md) §7-3):
      設定 › Advanced › Club House(接続 0 件・1 件・2 件以上のそれぞれ)に `Join with an invite link` が
      無く、`Coming Soon` の予告も無いこと。持ち主の Club の画面に `Invite`(招待 URL・QR)が無いこと。
      **招待 URL(`https://<endpoint>/join#invite=…`)をブラウザで開いても参加画面が出ない**こと
      (fragment は住所欄から消える)。Public への参加は今までどおりできること
- [ ] §5.14 のバックアップに、メンバートークン(`sg.club` / `sg.clubOutbox`)が
      入らないこと

**未確認は未確認として書く。**実機が片方しか無い、サーバが未デプロイ、通報や持ち主の
対処をまだ通せていない、といったときは、チェックを入れずに「何を確認できなかったか」を
この節の下に残す。この節はまだ誰も実機で通していない。

## 6. ストア掲載

- [ ] `apps/simple-games/store/listing.md` の文言を各言語へ反映
- [ ] スクリーンショットを撮影(盤面中心・文字は最小限)
- [ ] プライバシーポリシーをホスティングし、URL を Play Console に登録
- [ ] データセーフティ欄を公開ページ <https://pixapps.ai/simple-games/privacy> と
      一致させる(そこが正本。[PRIVACY_POLICY.md](PRIVACY_POLICY.md) はポインタ)。
      Meta を有効化するリリースでは SDK 経由の収集・共有も含める(§5.15)。
      **2026-09-29 の自動送信への変更以降、この収集は「任意」ではなく自動 ―― 対象
      地域の新規インストールでは利用者の選択なしに発生するため、そう申告する。**
      Device or other IDs に広告 ID(Advertising ID、Meta と共有)を追加する。
      公開プライバシーポリシーも同じ内容へ更新し、**v1.3.1(新仕様)が利用者に
      届く前に公開**する
- [ ] **Club House(Public)の分も、データセーフティ欄と App Store のプライバシー
      ラベルに入れる。** 参加した人についてだけ発生する収集で、内容は表示名、結果の
      数値(時間・手数・スコア)、シード / 盤面の識別子、端末に結びつくメンバー
      トークン、そしてレート制限のために処理される IP アドレス。**参加している間は、遊び終えた
      結果が自動で送られる**(結果ごとの選択ではない。参加が選択で、参加の前に開示する。
      [club.md](architecture/club.md) §7-4)ので、「利用者が送信を選ぶ」ではなく、参加した人については
      自動の収集として申告する。Public では表示名と
      結果が参加者に見え、pixapps.ai の公開ページにも出る。参加しない端末では
      一切発生しない(§5.16)。公開ページのプライバシーポリシーの Club House 節と
      同じ内容にそろえ、**この版が利用者に届く前に公開**する。Meta を有効化する
      リリースでは、その分も別に足す(上と §5.15)
- [ ] **ユーザー生成コンテンツの審査の期待を確認する**(Apple Guideline 1.2 /
      Google Play の UGC ポリシー)。Public には他人の表示名が並ぶので、報告
      (Report)と持ち主による名前の変更・削除の仕組みが、審査が求める水準に
      足りているかを人が読んで判断する。このアプリにブロックの機能は無い。
      **足りているとは書かない — 審査の結果が出るまで未確認**
- [ ] 設定画面の「プライバシーポリシー」「利用規約」が実機で開くことを確認
      (アプリは文面を同梱せずリンクするだけになった)
- [ ] 「Coming Soon」表記や未実装ゲームの名前が掲載文に含まれていない
- [ ] GitHub リポジトリの description / homepage / topics が [BRAND.md](BRAND.md)
      「GitHub リポジトリの公開 metadata」の値と一致し、homepage がリダイレクトなしで
      開く(ゲーム数は書かない)

## 7. 公開

- [ ] **タグを打つ前に** iOS の版をそのタグに合わせて main へ入れておく
      (§4.7 の 1 項目目。`pnpm --filter simple-games ios:version set <version>`。
      合っていなければ `android-release.yml` が AAB を作る前に落ちる)
- [ ] タグ `v<major>.<minor>.<patch>` を打って push する
      (`android-release.yml` が署名済み AAB + 確認用 APK を出す)
- [ ] ワークフローが緑(署名 secret が無ければ失敗する)
- [ ] AAB を Play Console の**内部テスト**トラックにアップロード(手動)
- [ ] 内部テストトラック経由でインストールして動作確認
      (課金とレビュー導線はこの経路でしか確認できない)
- [ ] iOS は同じタグの内容から Archive し、TestFlight へ上げる(Mac 上の手作業。
      `ios/ExportOptions.plist` + App Store Connect API キー。§4.7)
- [ ] 段階的公開で開始する

作り直すときは `build.gradle` ではなく**新しいタグ**を打つ。`versionCode` はタグから
導出され、Play は同じ `versionCode` を二度受け付けない。iOS のビルド番号も同じ式で
導く(`ios:version set`)ので、作り直しは**新しいタグ + iOS の版の更新**が対になる。

## 8. 公開後

- [ ] クラッシュ報告を確認(Play Console)
- [ ] 翻訳の指摘を Issue で受け付ける([CONTRIBUTING.md](../CONTRIBUTING.md))
- [ ] 次のゲームを追加しても既存ゲームのデータが失われないことを、
      アップデート前後で確認する

## 人間にしかできない作業(コードでは代替不可)

1. Play Console のアプリ作成・掲載・公開
2. AdMob のアプリ登録とバナーユニット作成
3. アプリ内商品 `remove_ads` の登録
4. 署名鍵の作成・保管
5. スクリーンショット等のストア素材
6. プライバシーポリシーのホスティング
7. 高リスクキーの逆翻訳を**作者が読んで承認する**(§3 の門。
   `i18n:gate approve <locale> <key> --by <who>`)。逆翻訳を作らせるところまでは
   別セッションや Codex に出せるが、「約束が壊れていないか」の判定は作者が読む
   ほかない([I18N_POLICY.md](I18N_POLICY.md)「リリース前の門」)
8. ゲーム別 Landing Page(pixapps.ai)の作成
9. GitHub リポジトリの Description / Website / Topics の反映
   ([BRAND.md](BRAND.md)「GitHub リポジトリの公開 metadata」が正本。About 欄は
   手入力で、CI は検査しない)
