# Simple Games — リリースチェックリスト

Google Play への公開前に、この順で確認する。
**チェックが通らない項目を「たぶん大丈夫」で飛ばさない。**
実施していない検証を成功扱いにしないこと([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))。

## 0. 先行公開からの正式収録(該当リリースのみ)

Web 版で先行公開(ベータ)していたゲームをこのリリースで正式収録する場合
([WEB_VERSION.md](WEB_VERSION.md)「先行公開」):

- [ ] 直近 2 週間、スキーマ変更(セーブを消す変更)・既知のクラッシュ・進行不能がない
      (壊す変更を入れたら 2 週間を数え直す)
- [ ] 計測の滞在時間が十分(シェル層イベントで確認。既収録ゲームを参照点に
      人間が判断する。読み方と限界は
      [GROWTH_MEASUREMENT.md](GROWTH_MEASUREMENT.md))
- [ ] 正式収録 = スキーマ凍結。**`game/compatibility.test.ts`(盤面/配札/ウェーブの
      golden テスト)だけでは足りない** — これは生成の決定性を守るもので、保存データが
      生き残ることは検証しない(Minesweeper / Nonogram にはこのテスト自体が無い)。
      このゲームの保存スキーマに対して、`progressMigration.test.ts` /
      `storage.test.ts` と同じ形の**永続化ラウンドトリップテスト**
      (実際に保存済みペイロードを読み込み、想定どおり扱われることを検証する)を
      このリリースで作成し、以後の変更はこのテストに対する移行のみとする
- [ ] Web 版の BETA バッジとセーブ注意文(en/ja)を外す

## 1. コードの検証(機械が判定できるもの)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- [ ] 4 つすべて緑
- [ ] `git status` がクリーン(生成物の取りこぼしがない)
- [ ] golden テスト(`compatibility.test.ts`)が通っている
      = 既存プレイヤーの盤面と自己ベストの土台が変わっていない
- [ ] 生成コストのテストが通っている(Sudoku / Minesweeper / Nonogram)
      = 生成の仕事量(探索した配置数・試行回数)が上限内。これは決定的な指標
      なので、落ちたら再実行せずに原因を読むこと。**壁時計は判定していない**
      ([SUDOKU_RULES.md](SUDOKU_RULES.md) §7)
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

- [ ] 原則ガードが緑(通信 API なし / バナー以外の広告なし / トラッキング依存なし /
      Android 権限は INTERNET・BILLING のみ / 本番広告 ID がソースにない)

ガードが見ていない分は、コードを grep して**存在しないこと**を確認する:

- [ ] `interstitial` / `rewarded` / `appOpen` の広告実装が存在しない
- [ ] analytics / トラッキング / Remote Config の実装が native ビルドに存在しない
      (Web 版のページ解析は `--mode web` 限定 — [WEB_VERSION.md](WEB_VERSION.md)「計測」)
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
      Sudoku の level 53 / 72(開発機で既に 100ms 予算を超過。
      [SUDOKU_RULES.md](SUDOKU_RULES.md) §7)、Minesweeper Hard の初手、
      Nonogram の level 100。押してから盤面が出るまでに間があってはいけない

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
5.5 と同じ危険(頻度・オフライン・端末ごとのストア)を、別の画面で繰り返している。

- [ ] 初回訪問と 1 ゲーム目には出ない
- [ ] ゲームから 2 回戻ったあとのコレクションホームに出る。**閉じても、閉じずに
      次のゲームへ行っても、再読み込みしても、二度目は出ない**
- [ ] 実機で開くのが**そのブラウザの端末のストア**であること。Android は
      Google Play、iPhone / iPad は App Store、Desktop は両方
      (`services/webAppPrompt.ts` の `storeTargets`)
- [ ] **両方のリンクが実在する掲載ページに着く**こと。5.5 と同じ事故
      (入手できないページに着いて壊れたボタンに見える)を、Web では
      iOS 未掲載の期間に起こしうる
- [ ] 機内モードで出ないこと。出ないだけでゲームは止まらないこと
- [ ] インストール済みアプリでは**一度も出ない**(Android / iOS 実機で確認)
- [ ] 「ローカルデータを削除」のあと、状態が消えていること(消えたら 2 回遊び直せば
      また出る、が正しい挙動)
- [ ] 14 言語 × 狭い画面(360px 以下)でカードが崩れず、横スクロールが出ず、
      「最近遊んだ」より下・全ゲーム一覧より上に収まっていること

## 5.7 結果画面の共有([ARCHITECTURE.md](ARCHITECTURE.md)「レイヤー規則」, issue #86)

自動テストは文面・リンク・全 30 ゲームへの設置までしか見られない。**共有シートが
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

- [ ] 全 30 ゲームのホームのヘッダー右に星があり、押すと塗りつぶしと
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
- [ ] 未対応 Launcher(または iOS・Web)ではその行ごと出ないこと
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

## 6. ストア掲載

- [ ] `apps/simple-games/store/listing.md` の文言を各言語へ反映
- [ ] スクリーンショットを撮影(盤面中心・文字は最小限)
- [ ] プライバシーポリシーをホスティングし、URL を Play Console に登録
- [ ] データセーフティ欄を公開ページ <https://pixapps.ai/simple-games/privacy> と
      一致させる(そこが正本。[PRIVACY_POLICY.md](PRIVACY_POLICY.md) はポインタ)
- [ ] 設定画面の「プライバシーポリシー」「利用規約」が実機で開くことを確認
      (アプリは文面を同梱せずリンクするだけになった)
- [ ] 「Coming Soon」表記や未実装ゲームの名前が掲載文に含まれていない

## 7. 公開

- [ ] タグ `v<major>.<minor>.<patch>` を打って push する
      (`android-release.yml` が署名済み AAB + 確認用 APK を出す)
- [ ] ワークフローが緑(署名 secret が無ければ失敗する)
- [ ] AAB を Play Console の**内部テスト**トラックにアップロード(手動)
- [ ] 内部テストトラック経由でインストールして動作確認
      (課金とレビュー導線はこの経路でしか確認できない)
- [ ] 段階的公開で開始する

作り直すときは `build.gradle` ではなく**新しいタグ**を打つ。`versionCode` はタグから
導出され、Play は同じ `versionCode` を二度受け付けない。

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
