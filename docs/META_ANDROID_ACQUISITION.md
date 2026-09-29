# Simple Games — Android の獲得計測(Meta)runbook

2026-09-27 決定(issue #204、オーナー合意)、2026-09-29 に送り方を変更(オーナー判断)。
**Android 版だけ**に Meta の App Events SDK
(`facebook-core`)を入れ、Meta 広告 → Google Play → インストールの流れを、Meta の
インストール最適化が使える形で計測できるようにする。**分析基盤ではない。** 送るのは
「このアプリがインストールされた」という 1 件の報告を、**新しいインストールごとに 1 回だけ**。
**利用者には聞かない**(質問も設定のスイッチも無い)。その代わり、同意が要る地域
(EEA・英国・スイスと関連地域)の端末と、地域が分からない端末では送らない(§6)。

2026-09-27〜29 の最初の形(許可した人だけが送る・広告 ID を使わない)は 2026-09-29 に
やめた(§5・§6)。タグ v1.3.0 はその最初の形でビルドしてあり、本番に出さない。
新しい形は v1.3.1 で出す(§8・§12)。

方針(何を約束し、どこまでを例外とするか)は
[PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「Android の獲得計測(Meta)」が持ち、
この文書は**運用** —— ビルドの設定、送る内容の一覧、Meta / Google Play 側の手作業、
検証、1,000 installs の判定、停止と撤去 —— を持つ。方針とぶつかったら方針が勝つ。

## 目次

1. [範囲](#1-範囲)
2. [仕組み(いつ何が起きるか)](#2-仕組みいつ何が起きるか)
3. [ビルドと設定](#3-ビルドと設定)
4. [送るもの・送らないもの(SDK 18.3.0 の実測と読解)](#4-送るもの送らないものsdk-1830-の実測と読解)
5. [広告 ID を使う判断](#5-広告-id-を使う判断)
6. [同意を求めない判断と地域の除外](#6-同意を求めない判断と地域の除外)
7. [オフライン・性能・保存](#7-オフライン性能保存)
8. [本番有効化の前提(オーナー作業)](#8-本番有効化の前提オーナー作業)
9. [検証の記録](#9-検証の記録)
10. [1,000 installs の判定と運用](#10-1000-installs-の判定と運用)
11. [停止と撤去](#11-停止と撤去)
12. [未完了事項](#12-未完了事項)

## 1. 範囲

| 対象 | 扱い |
| --- | --- |
| Android release ビルド(`SG_META_ANDROID_ENABLED=true`) | Meta SDK が入る。条件(§2)を満たす新しいインストールを、起動時に自動で 1 回報告 |
| Android release ビルド(フラグなし・既定) | **SDK はビルドに存在しない**(依存にも dex にも無い — CI が APK で検査) |
| Android debug ビルド | フラグに関わらず SDK は入らない(本番の Meta アプリへ送らない) |
| iOS | 対象外。SDK・通信を足さない(SKAdNetwork のまま — ADS_POLICY.md「ATT」) |
| Web | 対象外。既存の Meta → Web 広告と GA4(WEB_VERSION.md「計測」)は別件で、変更しない |
| Meta Audience Network(アプリ内広告) | **導入しない。** これは獲得計測であって広告枠ではない |
| AdMob バナー・広告削除の買い切り・ゲーム機能 | 一切変えない。計測のスイッチとバナーのスイッチは別 |

予算・対象国・許容 CPI・費用上限・確認頻度は**配信開始前にオーナーが決める**。
この文書は金額や期限を決めない。既存の Web 向けキャンペーンの操作もこの文書の外。

## 2. 仕組み(いつ何が起きるか)

```
ビルド   SG_META_ANDROID_ENABLED=true の release だけが src/metaOn(本物)を含む
           それ以外は src/metaOff(何もしない空のプラグイン)
起動     native: metaOn/MetaInstallPlugin.java の load() が自分で判断する(JS は関わらない)
           端末内の読み出しだけで下の条件 1〜3 を確かめる
           通信あり → SDK 初期化 → Meta 由来の Install Referrer を渡す → インストール報告(1 リクエスト)
           通信なし → Android の既定ネットワークの復帰を OS のコールバックで 1 回待ち、条件を確かめ直す
次の起動 報告が Meta に受理されていれば記録し、SDK のローカルデータを削除。以後 SDK は起動しない
```

送るのは、次の**すべて**がそろったときだけ。1〜3 のどれかが欠ければ、その起動では SDK に
触れない。4 だけが欠けるときは、同じ起動の中で通信の復帰を待つ。

1. **新しいインストール。** `PackageInfo.firstInstallTime` から 7 日以内
   (`NEW_INSTALL_WINDOW_MS`)。アップデートは最初のインストールの時刻を引き継ぐので、
   既存の利用者が Meta 入りの版へ更新しても(例: v1.2.2 → v1.3.1)インストールとしては
   報告しない —— Meta の数字に偽のインストールを混ぜない。一度試した後の再試行は、
   この 7 日に縛らない。
2. **同意が要る地域ではない**(§6)。SIM の国・モバイルネットワークの国・端末の地域設定の
   どれか 1 つでも一覧に入れば送らない。どれも分からない端末も送らない。
3. **まだ受理されていない・この起動でまだ試していない・試行が 3 回未満・止めていない**
   (下の「報告はインストールにつき 1 回」)。
4. **通信がある。** 無ければ待つ(§7)。

App ID / Client Token が形どおりでないビルドでは、何もしない(§3)。

- **質問も設定のスイッチも無い**(2026-09-29 のオーナー判断 — §6)。アプリの中に送信を
  止める手段は無い。利用者が使えるのは、Android の広告 ID の設定(§5)、Meta 側の設定、
  アンインストール。
- **条件がそろうまでは SDK のコードが 1 行も実行されない。** SDK は通常、起動時に
  ContentProvider(`FacebookInitProvider`)で自動初期化されるが、manifest overlay で
  この provider ごと外している。`AutoInitEnabled=false` だけでは足りない —— SDK 18.3.0 の
  `GraphResponse.fromHttpConnection` は「完全初期化前」を**応答を読む時点で**しか
  見ておらず、POST の本文はその前に送信される(`GraphRequest.serializeToUrlConnection`)。
  だから「フラグで止める」ではなく「呼ばない」で止める。既存の利用者の端末や、
  同意が要る地域の端末では、SDK は一度も動かない。
- **報告はインストールにつき 1 回。** Meta が受理したら(SDK が `{appId}ping` を記録
  したら)、次の起動でそれを読み、SDK を二度と初期化しない。送信が失敗したら次の起動で
  もう一度試す(**アプリのプロセスが起動するごとに 1 回、合計 3 回まで**。数える単位は
  画面ではなくプロセスで、同じプロセスのまま Activity が作り直されても 2 回目は試さない —
  少ない側に倒した)。3 回で受理されなければ、その端末では
  以後試さない。Meta 側の設定が自動ログを有効にしていると分かった場合も同じく止める。
  止めた後も、SDK のデータは起動時に消す。
- **記録が読めなければ止める。** アダプタの記録ファイル(`no_backup/meta-install.properties`)
  が読めないときは試行切れとして扱い、その端末では以後試さない。試行は送る前に数え、
  数えた記録を書けなければその起動は送らない。
- **JS からもゲームからも届かない。** プラグインは `@PluginMethod` を 1 つも持たず
  (起動時に自分で判断して動く)、JS のソースは `MetaInstall` を参照しない
  (`check-principles.sh` §8 d)。イベント名や値を渡す口は無い。

## 3. ビルドと設定

### 変数

| 名前 | 置き場所 | 意味 |
| --- | --- | --- |
| `SG_META_ANDROID_ENABLED` | GitHub の**リポジトリ変数**(Variables) | `true` のときだけ Meta 入りでビルドする。タグのリリースはこれに従う |
| `META_ANDROID_APP_ID` | GitHub **Secrets** | Meta アプリの App ID(数字のみ) |
| `META_ANDROID_CLIENT_TOKEN` | GitHub **Secrets** | Meta アプリの Client Token(32 桁の 16 進) |

- App ID と Client Token は**クライアントに埋め込まれる設定値**であり、APK を開けば
  読める。秘匿できるサーバー側の鍵とは違う。それでもソースには書かず注入する
  (AdMob の ID と同じ扱い)。**App Secret・管理用アクセストークン・署名鍵は、
  APK・JS・ログ・Issue・PR のどこにも入れない**(このアプリは使わない)。
- 有効化を頼んだのに App ID / Client Token が欠けている・形が違う場合、ビルドは
  **失敗する**(`android-release.yml` の「Decide Meta install measurement mode」と
  `app/build.gradle` の検証)。黙って無効のまま出荷しない。
- 実行時に何かが欠けていても(リソースが読めない等)、プラグインは何もせず、
  ゲームは通常どおり動く。
- **獲得計測のスイッチと AdMob のスイッチは別。** 計測を止めてもバナーは変わらず、
  バナーを止めても計測は変わらない。

### ワークフロー

- タグの `android-release.yml` は変数 `SG_META_ANDROID_ENABLED` に従う。
- 手動実行(workflow_dispatch)の `meta` 入力: `auto`(変数に従う)/ `on`(この
  ビルドだけ有効 — Test Events での実機確認用)/ `off`。
- どのビルドも最後に `.github/scripts/check-android-artifact.sh` が **APK と merge 済み
  manifest** を検査する: 権限が許可リスト内、`FacebookInitProvider` が無い、off なら
  dex に `com/facebook` が 1 つも無い、on なら SDK があり自動動作が false で宣言済み。
- PR では `android-artifact.yml` が off / on(ダミー ID、実行はしない)の両方を
  ビルドして同じ検査をする。

### ローカル

```bash
cd apps/simple-games && pnpm build && pnpm exec cap sync android
cd android
SG_META_ANDROID_ENABLED=true META_ANDROID_APP_ID=<数字> META_ANDROID_CLIENT_TOKEN=<32桁hex> \
  ./gradlew assembleRelease
cd ../../.. && bash .github/scripts/check-android-artifact.sh on
```

実値は追跡外の `apps/simple-games/.env`(`VITE_` を付けない)に置き、シェルで
export してから使う。debug ビルド(`assembleDebug`)には何を設定しても SDK は入らない。

## 4. 送るもの・送らないもの(SDK 18.3.0 の実測と読解)

採用版は **`com.facebook.android:facebook-core:18.3.0`**(2026-06-25 公開、Maven Central)。
依存: `facebook-bolts:18.3.0` / `installreferrer:2.2` / `androidx.legacy:legacy-support-core-utils` /
`androidx.core:core-ktx` / `kotlin-stdlib`。版は `app/build.gradle` の `sgMetaSdkVersion` に
固定し、`+` や `latest` を使わない(`check-principles.sh` §3b)。**版を上げるときは、
この節をソースから読み直してから上げる。**

以下は 2026-09-27 に公開ソース(`facebook-core-18.3.0-sources.jar`)を読んで書いた。
広告 ID の行は 2026-09-29 に、SDK の runtime jar の逆アセンブル
(`Utility.setAppEventAttributionParameters`)で読み直した。
**「イベントを 1 つしか呼んでいない」は「外へ出る情報が 1 つ」ではない** —— SDK が付け足す
ものを全部並べる。実機のネットワーク観測の結果は §9 に分けて書く。

### イベント

| イベント | 送る? | 条件と頻度 |
| --- | --- | --- |
| `MOBILE_APP_INSTALL`(`POST graph.facebook.com/{app-id}/activities`) | **送る** | 新しいインストール・同意が要る地域の外・オンライン・未受理のときに、プロセスの起動ごとに 1 回、最大 3 回まで試す(§2)。受理されたら二度と送らない |
| `fb_mobile_activate_app` / `fb_mobile_deactivate_app`(セッション) | 送らない(**§8 の 7 が前提**) | アダプタは `AppEventsLogger.activateApp` を呼ばず、自動ログを false にしている。ただし下の注意のとおり、Meta 側の設定が自動ログを有効にしていると、SDK 自身が設定取得の直後に `activateApp` を呼ぶ |
| `fb_sdk_initialize` / `fb_sdk_settings_changed` などの SDK 内部イベント | 送らない | どれも自動ログが true のときだけ記録される(`AppEventsLoggerImpl.initializeLib` ほか) |
| 購入(自動・手動)| 送らない(**§8 の 7 が前提**) | 自動購入ログは自動ログ true が前提(同上)。手動の `logPurchase` は呼ばない(CI §8 b) |
| ゲーム・盤面・スコア・Hint/Undo・保存・設定 | 送らない | 送る口が無い(§2) |

独自の `install` イベントは作らない。インストールは Meta 自身の `MOBILE_APP_INSTALL` で、
その計上(アトリビューション)は Meta が行う。

### `MOBILE_APP_INSTALL` に SDK が付けるもの

| 項目 | 中身 | 必要性 / 無効化 |
| --- | --- | --- |
| `anon_id` | SDK が端末内で作るランダムな ID(`com.facebook.sdk.appEventPreferences`) | 同じインストールの報告を重複させないため。報告後に端末から削除する |
| `application_tracking_enabled` | **false**(`setLimitEventAndDataUsage(true)`) | SDK の説明では「分析とコンバージョン以外(この人への広告ターゲティング等)に使わない」指定。リターゲティング用に使わせないため |
| `advertiser_id_collection_enabled` | **true** | 報告の直前にコードで有効にする(manifest は false のまま — §5) |
| `advertiser_id` | **Android の広告 ID** | SDK が Google Play 開発者サービスから読む(`AttributionIdentifiers`)。読むのに要る AD_ID 権限は AdMob がすでに持ち込んでおり(`check-android-artifact.sh` の許可リスト)、この計測のために権限は増えない。Play 開発者サービスから読めない端末では付かない。利用者が Android の設定で広告 ID を削除した端末では、開発者サービスが返す値(ゼロの ID)をそのまま送る(読解。実機では未確認 — §9) |
| `advertiser_tracking_enabled` | 端末が広告のトラッキングを制限していなければ true(`!isTrackingLimited`) | `advertiser_id` が付くときに一緒に付く。広告 ID を削除・オプトアウトした端末では false |
| `attribution` | Facebook アプリが持つ広告計測用 ID | **Facebook アプリが入っている端末で**(署名を確かめた本物の Facebook アプリの ContentProvider `com.facebook.katana.provider.AttributionIdProvider` から読む)。報告を広告と結ぶ手がかりの 1 つ。Android 11 以降は他のアプリの provider が見えないため、overlay の `<queries>` でこの provider **1 つだけ**を宣言している(`check-principles.sh` §4b、`check-android-artifact.sh`)。宣言が無いと、読めるかどうかが「Facebook アプリが AdMob の `<queries>`(https の VIEW)に該当するか」に左右されていた(2026-09-29 に修正)。公開ポリシーで開示する(§8 の 4)。Facebook アプリのある端末で実際に読まれることは未確認(§9) |
| `install_referrer` | Google Play の Install Referrer 文字列 | **Meta 広告から来たときだけ**(文字列に `fb` / `facebook` を含むとき — SDK と同じ条件をアダプタでも使う)。Meta 広告のクリックとインストールを結ぶ経路 |
| `installer_package` | 例: `com.android.vending` | ストア経由かどうか |
| `extinfo` | 形式版・パッケージ名・versionCode・versionName・OS バージョン・機種・ロケール・タイムゾーン略称・通信事業者名・画面の幅/高さ/密度・CPU コア数・ストレージ総量/空き(GB)・タイムゾーン名 | SDK が常に付ける。個別に外す設定は無い |
| `application_package_name` | `com.pixapps.simplegames` | |
| `campaign_ids` / `click_id` | Meta のアプリリンクで起動されたときの値 | このアプリは Meta のアプリリンクを使わないので、通常は付かない |
| `ud`(ハッシュ化した利用者データ) | **付かない** | `setUserData` を呼ばない(CI §8 b)。Automatic Advanced Matching は §8 で無効にする |
| リクエスト自体 | `access_token={App ID}\|{Client Token}`、`sdk=android`、User-Agent `FBAndroidSDK.18.3.0`、送信元 **IP アドレス** | IP アドレスは通信の性質上 Meta に届く |

### イベント以外の通信(報告を試みた起動の中だけ)

| 通信 | 契機 | 備考 |
| --- | --- | --- |
| `GET graph.facebook.com/app?fields=…`(アプリ設定。App ID は `access_token` で渡る) | SDK 初期化(`loadAppSettingsAsync`) | 設定の取得。応答は `com.facebook.internal.preferences.APP_SETTINGS` に保存される。**この応答が端末側の自動ログ設定を上書きしうる**(下の注意) |
| `GET graph.facebook.com/{app-id}/mobile_sdk_gk`(gatekeeper) | `FeatureManager.checkFeature` | 機能フラグの取得 |
| モデル・クラッシュ報告などの取得/送信 | Meta 側の gatekeeper が有効にしたとき | 既定は無効。クラッシュ報告は自動ログ true が前提 |

報告が受理された後の起動では SDK を初期化しないので、これらの通信も起きない。

> **注意 — Meta 側の設定が端末の設定を上書きする。端末からは防げない。** SDK 18.3.0 の
> `UserSettingsManager.checkAutoLogAppEventsEnabled()` は、アプリ設定の応答に
> `auto_log_app_events_enabled` があれば、manifest の `AutoLogAppEventsEnabled=false`
> より**そちらを優先する**。そして `FetchedAppSettingsManager.loadAppSettingsAsync` は
> 設定を取得した直後に `AutomaticAnalyticsLogger.logActivateAppEvent()` を呼び、自動ログが
> 有効なら `AppEventsLogger.activateApp` を実行する —— **報告を送るその起動の中で**、
> セッションのイベント、(gatekeeper 次第で)自動購入ログ、クラッシュ報告が動きうる。
> したがって上の表の「送らない」と公開ポリシーの「購入・セッションを送らない」は、
> **Meta のアプリダッシュボードで自動ログがオフであること(§8 の 7)に依存する**。
> そこで §8 の 7 は有効化の
> 必須条件とし、§8 の 11 で Test Events に `fb_mobile_activate_app` が**届かない**ことを
> 確かめる。アダプタは次の起動で SDK が保存したアプリ設定を読み、自動ログが有効と
> 返っていたら以後その端末で SDK を起動しない(報告に失敗して再試行する端末のための
> 後ろ盾であり、最初の起動は守れない)。

### 端末に残るもの

| もの | 場所 | 扱い |
| --- | --- | --- |
| 報告済み・停止・同意が要る地域の判定・試行回数の記録(`meta-install.properties`、地域の判定を書けなかったときの目印 `meta-install.consent-region`) | アプリの `no_backup` 領域のファイル(アダプタ専用) | Android の自動バックアップにも、アプリのバックアップファイルにも入らない |
| SDK の SharedPreferences(`com.facebook.*` — anon_id・受理記録・設定キャッシュ等) | `shared_prefs/` | 報告受理後・試行切れや停止の後の**次の起動で、SDK を読み込む前に全部削除**。一度も試していない端末にあった場合も削除する |
| `AppEventsLogger.persistedevents` / `facebook_ml/` / キャッシュの `instrument/` | `files/` / `cache/` | 同上(このアプリはイベントを溜めないので、通常は作られない) |

Android の自動バックアップが SDK の SharedPreferences を別の端末へ運んでも、その端末では
アダプタの記録(`no_backup`)が無いため試行 0 回から始まり、起動時に SDK のデータは
消される(別の端末の受理記録を信じない)。復元した端末は、その端末での
`firstInstallTime` が 7 日以内なら、新しいインストールとして自分の報告を 1 回送りうる。

## 5. 広告 ID を使う判断

**使う**(2026-09-29、オーナー判断)。2026-09-27 の最初の判断は「使わない」だった。

- 仕組み: manifest overlay は `AdvertiserIDCollectionEnabled=false` を宣言したまま
  (SDK が起動する前に誰も広告 ID を読まないように — `check-principles.sh` §8 c)。
  報告の直前に、アダプタが `FacebookSdk.setAdvertiserIDCollectionEnabled(true)` を
  呼ぶ(`startSdkAndReportLocked`)。この呼び出しは `check-principles.sh` §8 b の
  禁止一覧から外した。SDK を起動するのは報告を試みる起動だけなので、広告 ID を読むのも
  その起動だけ。受理された後は読まない。
- Install Referrer も引き続き使う。アダプタは Referrer を先に読み、Meta 由来のときだけ
  SDK に渡す(SDK 自身は非同期に取りに行くため、最初の報告に間に合わないことがある —
  `FacebookSdk.publishInstallAndWaitForResponse` は `getInstallReferrer()` を待たずに読む)。
- 得るもの: 広告 ID による端末の突き合わせ。Install Referrer と Facebook アプリの ID
  だけのときより、Meta が報告を広告と結べる範囲が広がりうる(例: 広告を見ただけで
  クリックせずにインストールした**ビュースルー**)。最適化の精度がどれだけ変わるかは
  測っていない。
- 失うもの: 他社のアプリ・サイトをまたいで端末を識別できる ID を Meta に送ること。
  「広告 ID は含みません」とはもう書けない。データ セーフティと公開ポリシーを変える
  (§8 の 2〜4)。
- 利用者の手段: Android の設定(「Google」→「広告」、または「プライバシー」→「広告」。
  機種と版で場所が違う)で広告 ID をリセット・削除できる。削除した端末では SDK はその状態を送る(§4)。
  アプリの中のスイッチは無い(§6)。
- 広告 ID の他にも、識別子(anon_id、Facebook アプリがある端末ではその計測用 ID)と
  IP アドレスが送られる。広告 ID だけが送られる、と表現しない。
- 変えるなら: 公開ポリシー・データ セーフティ・この節・`check-principles.sh` §8 b / c を
  **同じ PR で**変える。

## 6. 同意を求めない判断と地域の除外

### 判断(2026-09-29、オーナー)

- 2026-09-27〜29 の実装は、ゲームから戻ったときに 1 回だけ質問し、許可した人だけが
  送る形だった。これでは Meta に届くインストールがごく一部にとどまり、Meta の
  インストール最適化が学習できない —— というのがオーナーの判断で、そのため質問を
  やめ、条件(§2)を満たす新しいインストールでは自動で送る。許可制での許可率は
  測っていない(許可制の版は公開していない)。
- 消したもの(コミット 483df49): 質問のダイアログ、設定の「Ad measurement (Meta)」の行、
  JS 側の Meta 計測(`services/acquisition/`、UI、App / main / Settings の組み込み、
  `network.onNextOnline`、`importBoundaries.test.ts` 規則 6)。**アプリの中に送信を
  止める手段は無い。** 利用者の手段は Android の広告 ID の設定(§5)、Meta 側の設定、
  アンインストール。
- **AdMob の同意(UMP)とは結びつけない。** UMP の答えで Meta の送信を決めず、Meta の
  送信で UMP の意味やフェイルセーフを変えない。目的も相手も違う。
- 送ったかどうかで、ゲーム・広告・購入は何も変わらない。

### 地域の除外

同意なしに送れない地域では送らない。一覧はアダプタの `REGIONS_THAT_NEED_CONSENT`:

| 区分 | 国・地域コード |
| --- | --- |
| EU 27 か国 | AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE |
| EEA の残り | IS LI NO |
| 英国・スイス | GB CH |
| EU の最外周地域とオーランド(独自のコードを持つもの) | GF GP MQ RE YT MF AX |
| ジブラルタルと王室属領 | GI GG JE IM |

| 手がかり | 読み方 | 権限 |
| --- | --- | --- |
| SIM の国 | `TelephonyManager.getSimCountryIso()` | 不要 |
| モバイルネットワークの国 | `TelephonyManager.getNetworkCountryIso()` | 不要 |
| 端末の地域設定 | `Locale.getDefault().getCountry()` | 不要 |

- **どれか 1 つでも一覧に入れば送らない。3 つとも分からない端末も送らない。**
- 位置情報は使わない(位置の権限を足さない)ので、判定は推定である。SIM が無く
  (Wi-Fi だけの端末など)地域設定が一覧の外なら、EEA の中にあっても送りうる。
  逆に、EEA の SIM を挿したまま日本にいる端末は送らない。
- 判定は起動ごと(と通信の復帰を待ったあと)に行い、**一度でも該当したら記録する**
  (`meta-install.properties` の `consentRegion`。容量不足などで書けないときは、空の目印
  ファイル `meta-install.consent-region` を作るか、記録ファイルをその名前に変える ——
  どちらも失敗すればその起動は送らない)。以後その端末では、SIM の差し替えや
  地域設定の変更で手がかりが一覧の外になっても送らない。まだ受理されていない報告に
  限る —— 受理済みの端末は、そもそも二度と送らない。

### 法的な位置づけ(確認は未了)

- EEA・英国・スイスを除くのは、そこでは、このような送信(端末の識別子を読み、
  第三者へ渡す)に事前の同意を求める規則(ePrivacy 指令・GDPR と、英国・スイスの
  相当する規則)があるため。同意を求めない以上、そこでは送らない。Meta の
  Business Tools 規約も、必要な同意を得ることを広告主(このアプリの運営者)の責任としている。
- それ以外の地域(例: 日本の個人情報保護法の「個人関連情報」、米国の州のプライバシー法)
  では、公開プライバシーポリシーでの開示に拠る。これはオーナーの判断である。
- **法務の確認はまだしていない**(§12)。この節は判断の根拠であって、確認の結果ではない。

## 7. オフライン・性能・保存

- 起動・ゲーム開始・購入/復元は計測を待たない。`load()` がするのは端末内の読み出し
  (記録ファイル・`PackageInfo`・国コード)だけで、Install Referrer の読み出し
  (最大 3 秒)は別スレッド、SDK の初期化と報告はその後にメインスレッドへ post する。
- オフラインでは SDK を初期化しない。native が接続の有無を確かめ、ネットワーク以外の
  条件がそろっていて通信だけが無いときは、Android の既定ネットワークの復帰を
  **OS のコールバックで 1 回だけ**待ち、戻ったときに条件を確かめ直して始める
  (条件が崩れたとき・Activity が終わるときは待ちを解除する)。タイマーもリトライループも
  作らない。**過去の行動を溜めて後送しない**(溜めるものが無い)。
- 通信の失敗・タイムアウト・SDK の例外・Play サービスや Install Referrer が使えない
  端末でも、ゲーム・保存・課金の復元は影響を受けない(アダプタはすべてを握りつぶし、
  ログだけ残す)。
- 全ゲームの保存スキーマ・migration は変えていない。SDK のデータはバックアップ対象外。
  アダプタの記録は native の `no_backup` に置き、`localStorage` のキーにしない。
  したがって「ローカルデータを削除」でも消えない。
- 性能の実測(release / R8、エミュレータ)は §9 にあるが、**質問ありの旧い流れで測った
  もの**で、新しい流れでは測り直していない。新しい流れでは、条件を満たす端末は最初の
  起動で SDK を初期化する(旧い流れでは許可した後だった)。**低価格の実機では未測定**
  であり、未測定を「影響なし」とは書かない。

## 8. 本番有効化の前提(オーナー作業)

**以下がすべて済むまで、Meta 入りのリリース(v1.3.1)を出さない。** リポジトリ変数
`SG_META_ANDROID_ENABLED` が `true` のあいだは次のタグのビルドが SDK 入りになり、
その版を入れた新しいインストールから、質問なしで送信が始まるため
(**開示が先、送信が後** — WEB_VERSION.md「計測」と同じ順序)。
**v1.3.0 は本番に出さない**(許可制・広告 ID なしの旧い流れでビルドしたタグ)。

### Google Play

1. **対象年齢を確認する。** ターゲットオーディエンスに 13 歳未満が含まれる場合、
   Google Play のファミリー ポリシー(子ども向けアプリで使える SDK の制限)と Meta の
   規約の両方に抵触しうるため、**有効化しない**。対象年齢を計測の都合で変更しない。
   広告を成人に限定しても、アプリ利用者の年齢を確認したことにはならない。
2. **データ セーフティ**を更新する(SDK 経由の収集・共有を含む)。§4 の一覧から、
   少なくとも「デバイスまたはその他の ID」(**広告 ID**・anon_id・Facebook アプリの
   計測用 ID)を Meta と**共有**、目的は広告・マーケティングとして申告する。
   収集は**任意ではない**(利用者が選べない — アプリの中に選択肢が無く、条件を満たせば
   自動で送る)。「アプリのアクティビティ」への該当と、IP から Meta が推定しうる
   おおよその位置の扱いは法的に確認する。**未確認のまま申告を確定しない。**
3. Play Console の「広告 ID」の申告(アプリのコンテンツ)を、AdMob の用途に加えて
   Meta によるインストールの計測を含むよう見直す(§5)。

### 公開文面(pixapps-landing)

4. プライバシーポリシー(`simple-games/privacy.html`、日英)の Android の節を書き換える。
   いま main にある節は許可制の旧い流れ(許可した場合だけ・広告 ID なし)を書いており、
   **新しい流れの版ではこれが偽になる**。§4 の送信内容(広告 ID を含む)・質問なしに
   自動で送ること・新しいインストールにつき 1 回だけであること・EEA・英国・スイスと
   関連地域では送らないこと・アプリの中で止める手段は無く、Android の広告 ID の設定と
   Meta 側の設定・アンインストールで制御できること・Meta のポリシーへのリンク、
   iOS には含まれないことを書く。**v1.3.1 が利用者に届く前に公開する。**
5. LP・ストア掲載文・README の「トラッキングなし」系の包括表現を見直す
   (BRAND.md「表現ルール」)。ゲームデータを送らないことと、SDK 由来の獲得情報を
   送ることを区別して書く。

### Meta(アプリダッシュボード / Events Manager / 広告マネージャ)

6. Meta のアプリを作成(または既存を使用)し、Android プラットフォームにパッケージ名
   `com.pixapps.simplegames` と Google Play の掲載先を登録する。広告アカウントとの
   関連付けと権限を確認する。
7. **自動ログを無効にする(必須・端末からは代替できない)**: アプリダッシュボードの
   「アプリイベントの自動ログ」(Automatically log app events / in-app events)を**オフ**。
   §4 の注意のとおり、ここがオンだと報告を送るその起動の中で SDK が `activateApp` を呼び、
   セッションや購入のイベントが送られうる。
8. **Automatic Advanced Matching をオフ**、**Codeless(イベント設定ツール)を使わない**。
9. key hash は Facebook ログイン用であり、このアプリ(ログインなし)では通常不要。
   求められた場合は **Play App Signing の配布鍵**と upload 鍵・debug 鍵を混同しない。
10. App ID と Client Token を取得し、GitHub の Secrets に設定する(値を Issue・PR・
    チャットに貼らない)。
11. **Test Events で受信を確認する**: 手動実行(`meta: on`)の APK を、**この Meta アプリで
    役割を持つアカウントが Facebook アプリにログインしている端末**(地域は §6 の一覧の外)に
    新しく入れる(Facebook アプリの無い端末の報告は Test Events に出なかった — §9)。
    Meta アプリは公開(Live)にしておく。最初の起動だけで(操作なしに)Test Events に
    `MOBILE_APP_INSTALL` が 1 件届くこと、**`fb_mobile_activate_app` やその他のイベントが
    1 件も届かないこと**(=7 が効いている)を見る。受理後の再起動・同意が要る地域の端末・
    前の版からの更新・オフラインでは何も送られないことは、通信の観測で見る(§9)。
    ログ上の「SDK 初期化成功」だけで完了にしない。
12. 広告マネージャで **Android アプリのインストール最適化**(アプリの宣伝 → アプリの
    インストール)が選べることを実アカウントで確認する。Web トラフィック目的のままにしない。
13. 以上が済んでから、リポジトリ変数 `SG_META_ANDROID_ENABLED=true` を設定(または確認)し、
    次のタグ(v1.3.1)で出荷する。配信の開始(予算の支出)は、その版が公開されたことを
    確認した後にオーナーが行う。既存の Web 向けキャンペーンの操作とは分ける。

## 9. 検証の記録

**機械で確かめたもの(自動・毎 PR)と、実機・通信で確かめたものを分けて書く。**
**旧い流れ(許可制)の記録と新しい流れの記録を混ぜない。**

### 自動(CI)

| 検査 | 何を示すか |
| --- | --- |
| `check-principles.sh` §3b / §4b / §8 | 追跡系依存は release 限定の facebook-core 1 行だけ・overlay は権限を足さない・overlay の `<queries>` は Facebook アプリの AttributionIdProvider 1 行だけ・禁止 API を呼ばない(広告 ID の収集の有効化は禁止一覧から外した)・manifest で SDK の自動動作と広告 ID の収集を false で宣言し、`FacebookInitProvider` を外している・プラグインに `@PluginMethod` が無く、JS が `MetaInstall` を参照しない |
| `check-android-artifact.sh`(`android-artifact.yml` / `android-release.yml`) | APK と merge 済み manifest の権限・provider・SDK の有無、`<queries>` の provider / package(Meta 入りは AttributionIdProvider がちょうど 1 つ、なしは 0) |

送る条件(新しいインストール・地域・試行の数・受理後の停止)を確かめる自動テストは無い。
判断は native(`MetaInstallPlugin.java`)にあり、その単体テストは書いていない。
質問と設定のスイッチを確かめていた JS のテスト(`metaInstall.test.ts`・
`App.metaInstall.test.tsx`・`MetaInstallSetting.test.tsx`・`importBoundaries.test.ts`
規則 6)は、対象のコードとともに 483df49 で消した。

### 実機・通信 — 新しい流れ(2026-09-29 の実装)

| 項目 | 状態 |
| --- | --- |
| Meta 入り release ビルド(新しい流れ): 権限・provider・`<queries>` | **済**(ローカル、ダミー ID)— `check-android-artifact.sh on` が通過。権限の増減なし、`<queries>` の provider は AttributionIdProvider だけ、`FacebookInitProvider` なし。Web のバンドルに `MetaInstall` への参照なし |
| エミュレータ、地域 US / JP の新規インストール: 最初の起動で、操作なしに Meta への接続が起きる | **済** (2026-09-29、Pixel_7 エミュレータ API 37、ローカルの release ビルド・ダミー ID、全 TCP を記録用プロキシ経由にし **Meta への接続は拒否して数えるだけ**。地域はアプリ単位の言語設定 `cmd locale set-app-locales` で変え、SIM とネットワークは US のまま) — US: 1 回目の起動で Meta への接続 14 件(すべて拒否)、タップは一度もしていない。JP(ja-JP): 1 回目で 16 件 |
| 同上、報告の中身: `advertiser_id` / `advertiser_tracking_enabled` が付き、`advertiser_id_collection_enabled=true`・`application_tracking_enabled=false` | **未** |
| 同上、受理後の再起動: Meta への接続 0 件、SDK のデータが消える | **未** |
| 地域を一覧の中にした新規インストール: Meta への接続 0 件 | **済**(同上)— fr-FR で起動 2 回とも 0 件。そのあと ja-JP に切り替えても 2 回とも 0 件(判定の記録 `consentRegion` が効いている) |
| 地域設定は一覧の外で、SIM / ネットワークの国が一覧の中: 0 件 | **未**(エミュレータで再現できるかも未確認) |
| 前の版からの更新(`firstInstallTime` が 7 日より前): 0 件 | **未** |
| 機内モードの初回起動 → オンライン復帰で 1 回分の試行、2 度目の復帰は 0 件 | **一部**(同上)— 機内モードのまま起動 4 回で Meta への接続 0 件(エミュレータが機内モードのまま残っていたときの記録。SDK が起動しなかったことはログで確かめていない)。復帰で試行が始まるところは未確認 |
| 受理されないときの再試行が 3 回で止まる | **済**(同上、Meta を拒否しているので受理されない)— US で起動 1〜3 回目に各 14 件、4 回目以降は 0 件 |
| 広告 ID を削除した端末で送られる値 | **未** |
| Facebook アプリのある端末で `attribution` が付く | **未** |
| 起動時間・メモリ(新しい流れ) | **未**(下の旧い流れの測定は流用しない) |
| Events Manager の概要で計上 / Test Events で受信 | **未** |
| 低価格の Android 実機 | **未** |
| 広告マネージャのインストール最適化の選択 | **未** |

### 実機・通信 — 許可制の旧い流れ(2026-09-27〜29)

以下は 2026-09-29 にやめた実装(質問と設定のスイッチあり、広告 ID なし)で確かめた
もの。記録として残すが、新しい流れの確認の代わりにはしない。

| 項目 | 状態 |
| --- | --- |
| Meta なし(既定)の release ビルド: SDK 不在(dex の `com/facebook` 0 件)・権限は従来どおり | **済**(ローカルビルド、APK 5,056,482 bytes = 従来比 +2,076 bytes) |
| Meta 入り release ビルド(ダミー ID): 権限・provider の差分 | **済** — 権限は `BIND_GET_INSTALL_REFERRER_SERVICE` の 1 つだけ増加、`ACCESS_ADSERVICES_CUSTOM_AUDIENCE` は外れ、`FacebookInitProvider` と 2 つの receiver は不在、増えた manifest 要素は false の meta-data 4 つだけ |
| Meta 入り release ビルド: APK サイズ | **済** — 5,248,830 bytes(Meta なし比 +192,348 bytes、R8 後の APK。**ストアの配布サイズではない**) |
| エミュレータ(Pixel_7 / API 37、機内モード、Meta 入り release): 起動・質問・設定 | **済**(2026-09-28)— R8 後も起動、ゲームから戻った瞬間に質問が 1 回出る、機内モードで「Allow」を押しても SDK が初期化されない(SDK のログ 0 件・接続 0 件)、設定の行が「次にオンラインになったとき」を表示、オフにすると「Nothing is sent」になり再起動後も保持、再起動後に質問は出ない |
| 通信の観測(オンライン、2026-09-28、オーナー承認のうえ) | **済** — エミュレータ(Pixel_7 / API 37、Meta 入り release、ダミー ID)の全 TCP をローカルのプロキシ経由にし、**Meta の全経路(AS32934 の公表 572 プレフィクス)とホスト名への接続は拒否して記録だけ**した(Meta には何も届いていない)。結果: 同意前・起動直後 0 件 / 「Allow」直後に Meta 宛の接続試行が始まる(SDK のログ上はアプリ設定 `GET /v16.0/app` 1 件と gatekeeper `GET /v16.0/app/mobile_sdk_gk` 4 件。インストール報告の POST は、SDK が本文を書いた後にしかログを出さないため、接続拒否の下ではログに出ない)/ 受理されないまま 2・3 回目の起動で再試行し、**4 回目以降の起動は 0 件** / 「Don't allow」後とその再起動後は 0 件、質問も再表示されない / 機内モードで許可 → 0 件、同じ起動でオンライン復帰 → 1 回分の試行、2 度目の復帰は 0 件 / オフにした後 0 件 |
| 報告の中身(同上、一時的な診断ビルドで SDK が組み立てる JSON を出力) | **済** — `event=MOBILE_APP_INSTALL`、`anon_id`、`application_tracking_enabled=false`、`advertiser_id_collection_enabled=false`、`extinfo`(形式版 / パッケージ名 / versionCode / versionName / OS 版 / 機種 / ロケール / タイムゾーン略称 / 通信事業者 / 画面幅・高さ・密度 / CPU コア数 / ストレージ総量・空き / タイムゾーン名)、`application_package_name`。**`advertiser_id` は無い**(当時は収集を無効にしていた)。`attribution` はエミュレータに Facebook アプリが無いので無い。`install_referrer` / `installer_package` は adb でのインストールなので無い(Play 経由なら付く)。診断用のログ出力はコミットしていない |
| 起動時間・メモリ(Meta 入り vs なし、release/R8) | **済(エミュレータ、同意前)** — 2026-09-29、Pixel_7 エミュレータ(API 37、ホストは Apple Silicon の Mac)に、ローカルの release ビルド(Meta なし / Meta 入り・ダミー ID、debug 鍵で署名)を入れ替えて測った。初回起動は測らず、`am force-stop` → `am start -W` の `TotalTime` と、10 秒後の `dumpsys meminfo` の TOTAL PSS(アプリのメインプロセスだけで、WebView のレンダラは含まない)を 7 回ずつ、3 組取った。起動時間の中央値(なし / 入り)は 2,956 / 1,843 ms、2,087 / 2,060 ms、1,558 / 2,145 ms で、組ごとに向きが逆になった。1 組の中でも 1.3〜3.7 秒ばらつき、差はこのばらつきより小さい。PSS の中央値は 141.3 / 134.7 MB、143.4 / 135.7 MB、141.1 / 141.8 MB で、増えていない。**同意前(=報告の 1 回を除くすべての起動)に測れる差は無かった。** SDK を初期化するのは報告する 1 回の起動だけで、その起動は測っていない。APK は 5,110,185 / 5,303,153 bytes(+192,968、debug 鍵で署名)。実機・低価格機では測っていない |
| 本物の Meta アプリへの送信(2026-09-28、オーナー承認のうえ) | **済(受理まで)** — `android-release.yml` の手動実行(`meta: on` / `ads: test`)の APK をエミュレータ(Pixel_7 / API 37、Facebook アプリなし)に新規インストールし、今度は Meta への接続も通して記録した。同意前は 0 件、「Allow」直後に Meta への接続が 3 件、再起動後は設定が「報告済み」(SDK が受理を記録したときだけ)になり、Meta への接続は 0 件。Meta 側で自動ログが有効なときの「停止」にはならなかった。3 回(20:33 / 20:39 は Meta アプリ未公開、20:45 は公開後)とも同じ。この APK は `<queries>` の修正前 |
| Events Manager の概要で計上 | **済** — 翌朝(2026-09-29)、データセットの概要に「アプリのインストール」1 件(連携: Facebook SDK、20 時台、状態はアクティブ)が出た。**3 回送って計上は 1 回**で、Meta アプリを公開(Live)した後の 20:45 の分と見られる(未公開中の 2 回は計上されていない — 推定)。広告 ID も Facebook アプリの ID も無い報告でも計上される。標準イベントの一覧に出たのはインストールだけで、「アプリの起動」(`fb_mobile_activate_app`)は無い。送信直後(5〜15 分)の概要には出ていなかった。**受理(`{appId}ping`)は応答にエラーが無かったことしか示さない**(`FacebookSdk.publishInstallAndWaitForResponse`)ので、計上は概要で見る |
| Events Manager の Test Events で受信 | **未** — 3 回とも送信直後の Test Events には出なかった。Test Events は、端末の Facebook アプリにログインしたアカウントで「自分のイベント」を見分けるらしい(facebook-android-sdk#1094 の利用者報告。Meta の文書では未確認)。新しい流れのビルドで、Facebook アプリにログインした端末で確かめる(上の表) |

## 10. 1,000 installs の判定と運用

### 指標を混同しない

- 目標は **Android 版の累計インストール 1,000+**。Meta 経由だけで 1,000 件ではなく、
  MAU 1,000 でもない。
- **配信開始前にオーナーが記録する**: Play Console で採用する指標(例: 統計情報の
  「ユーザー獲得数」=初めてインストールしたユーザー)、集計単位(ユーザー / デバイス。
  再インストールを混ぜない)、対象期間(累計の起点)、**開始時点の値**。

  | 記録 | 値 |
  | --- | --- |
  | 採用指標(Play Console の画面名) | (未記録) |
  | 集計単位 | (未記録) |
  | 開始日 / 開始時点の値 | (未記録) |
  | 運用責任者 | オーナー |

- ストアの「1,000+」表示も見るが、Console の指標との対応と表示の更新時期は要確認で、
  単純一致を保証しない。
- **Meta の広告アトリビューション(Meta が数えたインストール)と、Play Console の
  インストール / 初回起動は別の指標**として並べる。SDK は、起動されなかったインストールも、
  同意が要る地域(§6)や地域が分からない端末のインストールも観測しない
  (=Meta の数字は構造的に少ない)。アトリビューションの時間窓・遅延・地域の除外による
  欠測がある。

### 運用中

- 1,000 到達までは基本的に継続する。ただし次の停止条件は別に持つ: 開示・申告の不備、
  重大な性能悪化、保存データへの影響、承認済みの費用上限への到達。
- 記録する: 費用、Meta の獲得成果と CPI、Play の獲得数と初回起動、利用可能な集計の
  継続指標、クラッシュ / ANR。**CTR だけで成功を判定しない。**
- Web のクリック単価と Android の CPI は目的が違うので、そのまま優劣比較しない。
- 広告 → Google Play → 新規インストール → 起動 → 報告 → 成果、の流れを実配信後に
  一度通して確認し、ここに結果を書き足す。

## 11. 停止と撤去

**広告の停止では SDK は止まらない。SDK を外したリリースでも、更新していない旧版からは
消えない。** この区別を前提に次の順で行う。

1. 1,000 到達をオーナーが確認し、Android 獲得広告の停止を判断する(延長するなら理由と
   次の見直し条件をここに書き、なし崩しに恒久化しない)。
2. 停止後は、ストアの集計で自然流入と利用継続を見る。**SDK を分析用途へ転用しない。**
3. **撤去リリース**: リポジトリ変数 `SG_META_ANDROID_ENABLED` を外す(または `false`)
   だけで、次のタグのビルドから SDK は消える(`check-android-artifact.sh off` が APK で
   示す)。続けてコードを片付ける PR で `src/metaOn` / `src/metaOff` の実装・Gradle の
   分岐・manifest overlay・`MainActivity` の登録・CI の例外(§3b / §4b / §8)・
   この文書を削除し、PRODUCT_PRINCIPLES.md の例外節を「終了」として残す。
   JS 側と同意の UI は 483df49 で消えており、片付けるものは無い。
   既存のゲーム・AdMob・購入は維持する。
4. **旧版の扱い**: 旧版を使い続ける端末でも、報告を受理された端末は SDK を二度と起動しない
   (§2)。まだ受理されていない端末(新しいインストールのうちにオンラインにならなかった等)
   だけが、後から送りうる(最初の試行はインストールから 7 日以内、試行は合計 3 回まで)。
   したがって公開ポリシーは、撤去後もしばらく「旧版の Android アプリ」に
   ついての記述を残す。Meta 側でアプリを無効にすれば受信そのものが止まる。
5. データ セーフティとポリシーを更新する(旧版の残存を考慮)。

停止のために API サーバーや Remote Config は作らない(PRODUCT_PRINCIPLES.md「維持費の原則」)。
報告はインストールごとに 1 回で、継続的な送信は構造上起きない —— 遠隔停止スイッチを
作らなくてよい理由はそこにある。

## 12. 未完了事項

- **v1.3.0 を本番に出さない。** 許可制・広告 ID なしの旧い流れでビルドしたタグで、
  新しい流れは v1.3.1 で出す。
- **新しい流れの実機検証**(§9 の新しい流れの表。すべて未)。まずエミュレータで:
  地域 US / JP の新規インストールで、操作なしに最初の起動で Meta へ接続する / 地域を
  EU(例: DE)にした新規インストールで接続 0 件 / 受理後の再起動で接続 0 件。
- **法務の確認**(§6「法的な位置づけ」): EEA・英国・スイスと関連地域を除外し、それ以外の
  地域では公開ポリシーでの開示に拠る判断と、データ セーフティの申告内容(§8 の 2・3)。
- **公開ポリシーとデータ セーフティを新しい流れに合わせ、v1.3.1 が利用者に届く前に
  公開する**(§8 の 2〜4)。
- **Test Events での確認と、Facebook アプリの ID が実際に読まれることは未確認。**
  本物の Meta アプリへの送信と概要での計上は、旧い流れで確かめた(§9)。Facebook アプリに
  ログインした端末での Test Events(§8 の 11)で、新しい流れのビルドを確かめる。
- §8 の Google Play / 公開文面 / Meta 側の作業(すべてオーナー)。
- §10 の開始値の記録。
