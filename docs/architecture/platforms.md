# Web / Android / iOS

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

- Vite で静的 Web アプリとしてビルドし、Capacitor で Android / iOS アプリ化する。
  SSR / API Routes は不要のため Next.js は使用しない。
- `apps/simple-games/android/` / `apps/simple-games/ios/` は Capacitor が生成した
  ネイティブプロジェクトをコミットする(ビルド成果物・local.properties・
  `ios/App/App/public/`(web 資産のコピー)は除外)。
- **プラットフォーム差分は 3 箇所に限定する**: 広告 ID・ストアの可用性判定・
  ホーム画面ショートカット。いずれも実行時に `Capacitor.getPlatform()` で選ぶ
  (`services/ads/banner.ts` / `monetization/nativeStore.ts` の `PlatformRules` /
  `services/homeShortcut/` + `app/shortcutLaunch.ts` が
  `Capacitor.getPlatform() === 'android'` を見る、issue #110)。
  ゲーム・保存・i18n のコードに `if (ios)` を書かない。
- iOS 側の AdMob アプリ ID は Xcode ビルド設定 `ADMOB_IOS_APP_ID` →
  `Info.plist` の `GADApplicationIdentifier`(Android の manifestPlaceholder と
  同型。未設定はテスト用 app ID)。ATT は使わない(ADS_POLICY.md)。
- ハードウェア戻るボタン: ゲーム内ホーム→コレクションへ、コレクション→アプリ最小化。
  `AndroidManifest.xml` の `android:enableOnBackInvokedCallback="false"` は削除しない
  ——targetSdk 36(Android 16)から予測型戻る(predictive back)が既定で有効になり、
  `@capacitor/app` の `backButton` イベントが一切発火しなくなる実機バグを回避している
  (キーイベントもジェスチャーも同様に無反応になる。@capacitor/app 8.4.2 で確認、
  Capacitor 側にも既知の相互作用: ionic-team/capacitor-plugins#2418)。全ゲームの
  ナビゲーションがこのイベントに依存しているため、外すとハードウェア戻るが
  アプリ全体で無反応になる。予測型戻るのプレビューアニメーションと引き換えの選択。
