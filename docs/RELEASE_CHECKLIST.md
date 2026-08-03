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
      人間が判断する)
- [ ] 正式収録 = スキーマ凍結: このゲームの golden テスト(`compatibility.test.ts`)を
      このリリースで作成し、以後は移行のみ
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

## 5.5 レビュー導線([REVIEW_PROMPT_POLICY.md](REVIEW_PROMPT_POLICY.md))

- [ ] 合計 5 勝するまで質問が出ない/5 勝後、ゲームから戻った時だけ出る
- [ ] 「楽しい」→ In-App Review カードが表示される(内部テストトラックで確認。
      Play のクォータにより出ないことがある — その場合ストア掲載ページが開く)
- [ ] 「いまいち」→ メールドラフトが開き、宛先が brand の `SUPPORT_EMAIL`
- [ ] Play Console のサポートメールアドレスを `SUPPORT_EMAIL` と一致させる
- [ ] 回答後は二度と出ない/「あとで」は 20 勝後に一度だけ再表示

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
