# Number Match Offline

**A Simple Game by PixApps** — a quiet number puzzle made for long flights.

- Fully playable offline (初回起動から機内モードで動作)
- No account required / No in-app purchases
- Unlimited Undo and Hints (広告視聴・課金不要)
- Progress stays on your device

ゲームルールの正式定義は [docs/NUMBER_MATCH_RULES.md](../../docs/NUMBER_MATCH_RULES.md)。

## 開発

```bash
pnpm install          # リポジトリルートで
pnpm --filter number-match dev        # ブラウザで開発
pnpm --filter number-match test       # 単体テスト
pnpm --filter number-match lint
pnpm --filter number-match typecheck
pnpm --filter number-match build      # dist/ へ production build
```

## Android

```bash
pnpm --filter number-match build
pnpm --filter number-match exec cap sync android
cd apps/number-match/android && ./gradlew assembleDebug
```

要件: JDK 21、Android SDK(`local.properties` または `ANDROID_HOME`)。

- appId: `com.pixapps.simplegames.numbermatch`
- versionName / versionCode: `android/app/build.gradle` で管理(このアプリ単位で更新)
- 署名用 keystore はコミットしない。リリースは
  `.github/workflows/number-match-android.yml`(手動実行 / `number-match-v*` タグ)を使用。

## 広告

開発ビルドは Google 公式テスト広告 ID のみを使用する。本番 ID は
`VITE_ADMOB_APP_ID` / `VITE_ADMOB_BANNER_ID` / `VITE_ADMOB_INTERSTITIAL_ID`
を production build 時に環境変数で注入する(未設定なら広告は無効、ゲームは通常動作)。
方針は [docs/ADS_POLICY.md](../../docs/ADS_POLICY.md)。
