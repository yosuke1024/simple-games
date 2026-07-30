# Simple Games — リリースチェックリスト

Google Play への公開前に、この順で確認する。
**チェックが通らない項目を「たぶん大丈夫」で飛ばさない。**
実施していない検証を成功扱いにしないこと([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))。

## 1. コードの検証(機械が判定できるもの)

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- [ ] 4 つすべて緑
- [ ] `git status` がクリーン(生成物の取りこぼしがない)
- [ ] golden テスト(`compatibility.test.ts`)が通っている
      = 既存プレイヤーの盤面と自己ベストの土台が変わっていない
- [ ] 生成の性能予算テストが通っている(Sudoku / Minesweeper)

## 2. ブランド原則の実地確認(人が見るもの)

コードを grep して**存在しないこと**を確認する:

- [ ] `interstitial` / `rewarded` / `appOpen` の広告実装が存在しない
- [ ] analytics / トラッキング / Remote Config の実装が存在しない
- [ ] ストリーク(連続日数)の計算・表示が存在しない
- [ ] Hint / Undo / 再挑戦が広告視聴や購入の後ろに置かれていない
- [ ] ゲーム機能の課金ロックが存在しない(唯一の商品は広告削除)

実機で確認する:

- [ ] 機内モードで初回起動 → チュートリアル → 全ゲームが最後まで遊べる
- [ ] 機内モードで広告リクエストが発生しない(ログで確認)
- [ ] 外部リンク(About のソースコード等)がオフラインでもアプリを止めない
- [ ] プレイ中に時計が表示されない(各ゲームのルール文書の規定どおり)
- [ ] 初回起動で言語選択・ログイン・通知許可・課金ダイアログが出ない

## 3. 多言語

- [ ] 全 locale が全キーを持つ(テストで担保)
- [ ] 主要 5 画面を各言語でレンダリングして崩れがない
      (特にドイツ語の長さ、CJK の折り返し、Devanagari / Thai の行高)
- [ ] 課金・削除・復元・プライバシーの文言が**ネイティブレビュー済み**
      ([I18N_POLICY.md](I18N_POLICY.md) の状態表が `reviewed` 以上)
- [ ] 端末言語を切り替えてもゲーム進行が失われない

## 4. Android

- [ ] `pnpm --filter simple-games build && pnpm --filter simple-games exec cap sync android`
- [ ] `./gradlew assembleRelease`(JDK 21)が通る
- [ ] `versionCode` / `versionName` を上げた(`android/app/build.gradle`)
- [ ] 署名鍵で署名した AAB を作成(鍵はリポジトリに入れない)
- [ ] 低スペック端末またはエミュレータで、起動 → 各ゲーム 1 局 → 中断 → 再開
      (**リリース要件**。WebView をサポート下限の Chromium 88 相当に近い状態でも
      確認する — 例: API 24〜26 のエミュレータイメージを WebView 未更新のまま使う。
      動かないなら配信しない)
- [ ] ホームボタン / 戻るボタンでゲームが失われない
- [ ] ダークモードで全画面を確認
- [ ] フォント倍率を最大にして主要画面が崩れない

## 5. 広告と課金(本番接続)

- [ ] AdMob に本番バナーユニットを作成し、GitHub Secrets に設定
      (`ADMOB_APP_ID` / `ADMOB_BANNER_ID`。interstitial 用は存在しない)
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
- [ ] データセーフティ欄を [PRIVACY_POLICY.md](PRIVACY_POLICY.md) と一致させる
- [ ] 「Coming Soon」表記や未実装ゲームの名前が掲載文に含まれていない

## 7. 公開

- [ ] タグ `simple-games-v<version>` を打つ(`android-release.yml` が動く)
- [ ] 内部テストトラックで動作確認
- [ ] 段階的公開で開始する

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
7. 翻訳のネイティブレビュー
8. ゲーム別 Landing Page(pixapps.ai)の作成
