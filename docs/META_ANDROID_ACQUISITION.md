# Simple Games — Android の獲得計測(Meta)runbook

2026-09-27 決定(issue #204、オーナー合意)。**Android 版だけ**に Meta の App Events SDK
(`facebook-core`)を入れ、Meta 広告 → Google Play → インストールの流れを、Meta の
インストール最適化が使える形で計測できるようにする。**分析基盤ではない。** 送るのは
「このアプリがインストールされた」という 1 件の報告を、**利用者が許可した場合に、
インストールごとに 1 回だけ**。

方針(何を約束し、どこまでを例外とするか)は
[PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md)「Android の獲得計測(Meta)」が持ち、
この文書は**運用** —— ビルドの設定、送る内容の一覧、Meta / Google Play 側の手作業、
検証、1,000 installs の判定、停止と撤去 —— を持つ。方針とぶつかったら方針が勝つ。

## 目次

1. [範囲](#1-範囲)
2. [仕組み(いつ何が起きるか)](#2-仕組みいつ何が起きるか)
3. [ビルドと設定](#3-ビルドと設定)
4. [送るもの・送らないもの(SDK 18.3.0 の実測と読解)](#4-送るもの送らないものsdk-1830-の実測と読解)
5. [広告 ID を使わない判断](#5-広告-id-を使わない判断)
6. [同意](#6-同意)
7. [オフライン・性能・保存](#7-オフライン性能保存)
8. [本番有効化の前提(オーナー作業)](#8-本番有効化の前提オーナー作業)
9. [検証の記録](#9-検証の記録)
10. [1,000 installs の判定と運用](#10-1000-installs-の判定と運用)
11. [停止と撤去](#11-停止と撤去)
12. [未完了事項](#12-未完了事項)

## 1. 範囲

| 対象 | 扱い |
| --- | --- |
| Android release ビルド(`SG_META_ANDROID_ENABLED=true`) | Meta SDK が入る。同意後にインストールを 1 回報告 |
| Android release ビルド(フラグなし・既定) | **SDK はビルドに存在しない**(依存にも dex にも無い — CI が APK で検査) |
| Android debug ビルド | フラグに関わらず SDK は入らない(本番の Meta アプリへ送らない) |
| iOS | 対象外。SDK・同意 UI・通信を足さない(SKAdNetwork のまま — ADS_POLICY.md「ATT」) |
| Web | 対象外。既存の Meta → Web 広告と GA4(WEB_VERSION.md「計測」)は別件で、変更しない |
| Meta Audience Network(アプリ内広告) | **導入しない。** これは獲得計測であって広告枠ではない |
| AdMob バナー・広告削除の買い切り・ゲーム機能 | 一切変えない。計測のスイッチとバナーのスイッチは別 |

予算・対象国・許容 CPI・費用上限・確認頻度は**配信開始前にオーナーが決める**。
この文書は金額や期限を決めない。既存の Web 向けキャンペーンの操作もこの文書の外。

## 2. 仕組み(いつ何が起きるか)

```
ビルド   SG_META_ANDROID_ENABLED=true の release だけが src/metaOn(本物)を含む
           それ以外は src/metaOff(常に「使えない」と答えるスタブ)
起動     JS: services/acquisition/metaInstall.ts が native に状態を聞く(ローカル読み出しのみ)
           同意あり・未報告・オンライン → reportInstall() を 1 回だけ
           オフライン → 次にオンラインへ戻ったとき 1 回だけ(タイマー・リトライなし)
native   metaOn/MetaInstallPlugin.java が条件を**もう一度**確かめてから、初めて SDK に触る
           → SDK 初期化 → Meta 由来の Install Referrer を渡す → インストール報告(1 リクエスト)
次の起動 報告が Meta に受理されていれば記録し、SDK のローカルデータを削除。以後 SDK は起動しない
```

- **同意する前は SDK のコードが 1 行も実行されない。** SDK は通常、起動時に
  ContentProvider(`FacebookInitProvider`)で自動初期化されるが、manifest overlay で
  この provider ごと外している。`AutoInitEnabled=false` だけでは足りない —— SDK 18.3.0 の
  `GraphResponse.fromHttpConnection` は「完全初期化前」を**応答を読む時点で**しか
  見ておらず、POST の本文はその前に送信される(`GraphRequest.serializeToUrlConnection`)。
  だから「フラグで止める」ではなく「呼ばない」で止める。
- **報告はインストールにつき 1 回。** Meta が受理したら(SDK が `{appId}ping` を記録
  したら)、次の起動でそれを読み、SDK を二度と初期化しない。送信が失敗したら次の起動で
  もう一度試す(1 起動 1 回、**合計 3 起動まで**)。3 回で受理されなければ、その端末では
  以後試さない。Meta 側の設定が自動ログを有効にしていると分かった場合も同じく止める。
  止めた後も設定のスイッチは残り(答えは利用者のもの)、SDK のデータは起動時に消す。
- **撤回は必ず効く。** 撤回を記録できなかった(ストレージが一杯など)ときは記録ファイル
  自体を消す。次の起動は「未回答」として始まり、何も送らない。
- **ゲームからは何も届かない。** JS の窓口は「状態を読む / 答えを記録する / 報告を
  始める」の 3 つだけで、イベント名や値を渡す口は無い(`check-principles.sh` §8 d)。
  ゲームはこのモジュールを import できない(`importBoundaries.test.ts` 規則 6)。

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
- 実行時に何かが欠けていても(リソースが読めない等)、プラグインは「使えない」と
  答え、ゲームは通常どおり動く。
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
**「イベントを 1 つしか呼んでいない」は「外へ出る情報が 1 つ」ではない** —— SDK が付け足す
ものを全部並べる。実機のネットワーク観測の結果は §9 に分けて書く。

### イベント

| イベント | 送る? | 条件と頻度 |
| --- | --- | --- |
| `MOBILE_APP_INSTALL`(`POST graph.facebook.com/{app-id}/activities`) | **送る** | 同意あり・オンライン・未受理のときに 1 回。受理されたら二度と送らない |
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
| `advertiser_id_collection_enabled` | **false** | 広告 ID を使わない(§5) |
| `advertiser_id` / `advertiser_tracking_enabled` | **付かない** | 収集を無効にしているため SDK が値を出さない(`AttributionIdentifiers.androidAdvertiserId`) |
| `attribution` | Facebook アプリが持つ広告計測用 ID | **Facebook アプリが入っている端末で**(署名を確かめた本物の Facebook アプリの ContentProvider から読む)。Android 11 以降のパッケージの可視性の制限でも防げるとは限らない —— merge 済み manifest には AdMob の `<queries>`(https の VIEW / BROWSABLE)があり、Facebook アプリはそれに該当しうる。SDK 側で止める設定は無いので、同意文と公開ポリシーで開示する(実機で読まれるかは未確認) |
| `install_referrer` | Google Play の Install Referrer 文字列 | **Meta 広告から来たときだけ**(文字列に `fb` / `facebook` を含むとき — SDK と同じ条件をアダプタでも使う)。クリックとインストールを結ぶ唯一の経路 |
| `installer_package` | 例: `com.android.vending` | ストア経由かどうか |
| `extinfo` | 形式版・パッケージ名・versionCode・versionName・OS バージョン・機種・ロケール・タイムゾーン略称・通信事業者名・画面の幅/高さ/密度・CPU コア数・ストレージ総量/空き(GB)・タイムゾーン名 | SDK が常に付ける。個別に外す設定は無い |
| `application_package_name` | `com.pixapps.simplegames` | |
| `campaign_ids` / `click_id` | Meta のアプリリンクで起動されたときの値 | このアプリは Meta のアプリリンクを使わないので、通常は付かない |
| `ud`(ハッシュ化した利用者データ) | **付かない** | `setUserData` を呼ばない(CI §8 b)。Automatic Advanced Matching は §8 で無効にする |
| リクエスト自体 | `access_token={App ID}\|{Client Token}`、`sdk=android`、User-Agent `FBAndroidSDK.18.3.0`、送信元 **IP アドレス** | IP アドレスは通信の性質上 Meta に届く。広告 ID を使わないことは「IP も届かない」を意味しない |

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
> したがって上の表の「送らない」と同意文の「購入を含まない」は、**Meta のアプリダッシュ
> ボードで自動ログがオフであること(§8 の 7)に依存する**。そこで §8 の 7 は有効化の
> 必須条件とし、§8 の 11 で Test Events に `fb_mobile_activate_app` が**届かない**ことを
> 確かめる。アダプタは次の起動で SDK が保存したアプリ設定を読み、自動ログが有効と
> 返っていたら以後その端末で SDK を起動しない(報告に失敗して再試行する端末のための
> 後ろ盾であり、最初の起動は守れない)。

### 端末に残るもの

| もの | 場所 | 扱い |
| --- | --- | --- |
| 同意の記録と報告済みの記録 | アプリの `no_backup` 領域のファイル(アダプタ専用) | Android の自動バックアップにも、アプリのバックアップファイルにも入らない |
| SDK の SharedPreferences(`com.facebook.*` — anon_id・受理記録・設定キャッシュ等) | `shared_prefs/` | 報告受理後・同意撤回後の**次の起動で、SDK を読み込む前に全部削除** |
| `AppEventsLogger.persistedevents` / `facebook_ml/` / キャッシュの `instrument/` | `files/` / `cache/` | 同上(このアプリはイベントを溜めないので、通常は作られない) |

Android の自動バックアップが SDK の SharedPreferences を別の端末へ運んでも、その端末では
アダプタの記録(`no_backup`)が無いため「未回答」から始まり、起動時に SDK のデータは
消される。同意が別の端末へコピーされることはない。

## 5. 広告 ID を使わない判断

**使わない**(`AdvertiserIDCollectionEnabled=false`。有効にする呼び出しは CI §8 b が拒否する)。

- Meta 広告のクリックからのインストールは、Google Play の Install Referrer に Meta が
  埋めた情報で結べる。アダプタは Referrer を先に読み、Meta 由来のときだけ SDK に渡す
  (SDK 自身は非同期に取りに行くため、最初の報告に間に合わないことがある —
  `FacebookSdk.publishInstallAndWaitForResponse` は `getInstallReferrer()` を待たずに読む)。
- 失うもの: **ビュースルー**(広告を見ただけでクリックせずにインストール)の計上と、
  広告 ID による端末の突き合わせ。Meta の最適化の精度は下がりうる。SDK もその旨の
  警告をログに出す。
- 得るもの: 他社のアプリ・サイトをまたいで端末を識別する ID を 1 つも送らないこと。
  同意文に「広告 ID は含みません」と書けること。
- 広告 ID を使わないことは、**他の識別子(anon_id、古い Android での Facebook アプリの
  計測用 ID)や IP アドレスが送られないことを意味しない**。そう表現しない。
- 変えるなら: 同意文(`metaInstallCopy.ts`)・公開ポリシー・データセーフティ・この節・
  `check-principles.sh` §8 b を**同じ PR で**変える。

## 6. 同意

- **送信前に明示的な「許可」を得る。** 未回答・拒否・読み込み失敗は、すべて「送らない」。
- **聞くのは 1 インストールにつき最大 1 回**。ゲームからコレクションへ戻った瞬間
  (レビュー質問と同じ扉 — REVIEW_PROMPT_POLICY.md)で、起動直後・プレイ中には出さない。
  レビュー質問と同じ回には出さない(Meta の質問が先)。
- **インストールから 7 日以内だけ聞く。** 質問はこのインストールがどう起きたかについてで、
  既存の利用者のアップデートには意味が無い(アップデートした人には出ない)。
- **英語と日本語だけ。** 12 言語はネイティブが読んでいない機械翻訳で、誤訳された同意は
  同意として示せない(I18N_POLICY.md、`WebBetaNotice` と同じ判断)。その 12 言語では
  質問せず、何も送らない。文面は `src/ui/components/metaInstallCopy.ts` の 1 か所。
- **表示した時点で「許可しない」として記録してから開く。** 「許可しない」、外側のタップ、
  ハードウェア戻る、強制終了 —— どの閉じ方でも送信は起きず、質問は戻ってこない。
  「許可する」だけが変える。2 つのボタンは同じ見た目で、キーボードの既定は「許可しない」。
- **設定(About の節、Ad Privacy Options の隣)でいつでも変えられる。** オフにすると
  まだの報告は取りやめ、SDK のローカルデータを消す(SDK が動いた起動なら次の起動で)。
  報告済みのものを Meta から取り消すことはできない —— 設定の文言は、オンでもオフでも
  「一度知らせました」と事実を言う。撤回と送信の開始が重なった場合は、送信の開始前に
  届いた撤回だけが効く(native はこの 2 つを 1 つのロックの下で判定する)。
- 言語を切り替えても、許可した人の設定行は消えない(英語で表示する)。撤回の道を
  言語で隠さない。
- **AdMob の同意(UMP)を Meta の許可として使わない。** UMP の `canRequestAds` は
  Google の広告配信についての答えで、目的も相手も違う。既存の UMP の意味とフェイル
  セーフは変えていない。
- **ゲームの保存領域・バックアップファイルと分ける。** 同意は native の `no_backup` に
  置き、`localStorage` のキーにしない。したがって「ローカルデータを削除」でも消えない
  (UMP の同意と同じ扱い。消したいときは設定のスイッチで)。
- 同意しなくても、何も変わらない。ゲーム・広告・購入・報酬のどれとも結びつけない。

## 7. オフライン・性能・保存

- 起動・ゲーム開始・購入/復元は計測を待たない(起動後の fire-and-forget)。
- オフラインでは SDK を初期化しない。JS がオンラインを確かめ、native も接続の有無を
  もう一度確かめてから始める。オンライン復帰は OS のイベントを 1 回待つだけで、
  タイマーもリトライループも作らない。**過去の行動を溜めて後送しない**(溜めるものが無い)。
- 通信の失敗・タイムアウト・SDK の例外・Play サービスや Install Referrer が使えない
  端末でも、ゲーム・保存・課金の復元は影響を受けない(アダプタはすべてを握りつぶし、
  ログだけ残す)。
- 全ゲームの保存スキーマ・migration は変えていない。SDK のデータはバックアップ対象外。
- 性能の実測(release / R8、エミュレータ)は §9。**低価格の実機では未測定**であり、
  未測定を「影響なし」とは書かない。

## 8. 本番有効化の前提(オーナー作業)

**以下がすべて済むまで、リポジトリ変数 `SG_META_ANDROID_ENABLED` を `true` にしない。**
変数を入れた瞬間に次のタグのビルドが SDK 入りになり、許可した利用者から送信が始まるため
(**開示が先、送信が後** — WEB_VERSION.md「計測」と同じ順序)。

### Google Play

1. **対象年齢を確認する。** ターゲットオーディエンスに 13 歳未満が含まれる場合、
   Google Play のファミリー ポリシー(子ども向けアプリで使える SDK の制限)と Meta の
   規約の両方に抵触しうるため、**有効化しない**。対象年齢を計測の都合で変更しない。
   広告を成人に限定しても、アプリ利用者の年齢を確認したことにはならない。
2. **データ セーフティ**を更新する(SDK 経由の収集・共有を含む)。§4 の一覧から、
   少なくとも「デバイスまたはその他の ID」(anon_id / Facebook アプリの計測用 ID)を
   Meta と**共有**、目的は広告・マーケティング、利用者が選べる(任意)として申告する。
   「アプリのアクティビティ」への該当と、IP から Meta が推定しうるおおよその位置の扱いは
   法的に確認する。**未確認のまま申告を確定しない。**
3. 広告 ID の申告は、AdMob の既存の申告のまま(Meta は広告 ID を使わない — §5)。

### 公開文面(pixapps-landing)

4. プライバシーポリシー(`simple-games/privacy.html`、日英)に Android の節を足す。
   現行は「本アプリには Analytics・トラッキングコードが含まれていません」と書いており、
   **有効化したビルドではこれが偽になる**。§4 の送信内容・同意・撤回・1 回だけであること・
   Meta のポリシーへのリンク、iOS には含まれないことを書く。**有効化するリリースより前に公開する。**
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
11. **Test Events で受信を確認する**: 手動実行(`meta: on`)の APK を実機に入れ、
    許可 → Events Manager の Test Events に `MOBILE_APP_INSTALL` が 1 件届くこと、
    **`fb_mobile_activate_app` やその他のイベントが 1 件も届かないこと**(=7 が効いている)、
    許可しない / 未回答 / オフラインでは何も届かないことを見る。ログ上の「SDK 初期化成功」
    だけで完了にしない。
12. 広告マネージャで **Android アプリのインストール最適化**(アプリの宣伝 → アプリの
    インストール)が選べることを実アカウントで確認する。Web トラフィック目的のままにしない。
13. 以上が済んでから、リポジトリ変数 `SG_META_ANDROID_ENABLED=true` を設定し、
    次のタグで出荷する。配信の開始(予算の支出)は、その版が公開されたことを確認した後に
    オーナーが行う。既存の Web 向けキャンペーンの操作とは分ける。

## 9. 検証の記録

**機械で確かめたもの(自動・毎 PR)と、実機・通信で確かめたものを分けて書く。**

### 自動(CI)

| 検査 | 何を示すか |
| --- | --- |
| `src/services/acquisition/metaInstall.test.ts` | 同意前・拒否・読み込み失敗で報告しない / オフラインは復帰を 1 回待つ / 1 起動 1 回 / 受理後は二度と送らない / iOS・Web・Meta なしビルドでは何もしない / 質問は新規インストール・en/ja・1 回 |
| `src/app/App.metaInstall.test.tsx` | 質問はゲームから戻ったときだけ・レビュー質問と同じ回に出ない・Back で閉じる(=許可しない)・12 言語では出ない |
| `src/ui/components/MetaInstallSetting.test.tsx` | 設定行の有無と文言、スイッチの動作 |
| `src/test/importBoundaries.test.ts` 規則 6 | ゲーム・保存・課金から Meta 計測に届かない |
| `check-principles.sh` §3b / §4b / §8 | 追跡系依存は release 限定の facebook-core 1 行だけ・overlay は権限を足さない・禁止 API を呼ばない・SDK の自動動作を止めている |
| `check-android-artifact.sh`(`android-artifact.yml` / `android-release.yml`) | APK と merge 済み manifest の権限・provider・SDK の有無 |

### 実機・通信(2026-09-27 時点)

| 項目 | 状態 |
| --- | --- |
| Meta なし(既定)の release ビルド: SDK 不在(dex の `com/facebook` 0 件)・権限は従来どおり | **済**(ローカルビルド、APK 5,056,482 bytes = 従来比 +2,076 bytes) |
| Meta 入り release ビルド(ダミー ID): 権限・provider の差分 | **済** — 権限は `BIND_GET_INSTALL_REFERRER_SERVICE` の 1 つだけ増加、`ACCESS_ADSERVICES_CUSTOM_AUDIENCE` は外れ、`FacebookInitProvider` と 2 つの receiver は不在、増えた manifest 要素は false の meta-data 4 つだけ |
| Meta 入り release ビルド: APK サイズ | **済** — 5,248,830 bytes(Meta なし比 +192,348 bytes、R8 後の APK。**ストアの配布サイズではない**) |
| エミュレータ(Pixel_7 / API 37、機内モード、Meta 入り release): 起動・質問・設定 | **済**(2026-09-28)— R8 後も起動、ゲームから戻った瞬間に質問が 1 回出る、機内モードで「Allow」を押しても SDK が初期化されない(SDK のログ 0 件・接続 0 件)、設定の行が「次にオンラインになったとき」を表示、オフにすると「Nothing is sent」になり再起動後も保持、再起動後に質問は出ない |
| 通信の観測(オンラインで: 同意前に 0 件・許可後に `graph.facebook.com` へ報告 1 件・撤回後 0 件) | **未** — エミュレータのネットワークを有効にする操作が自動モードの安全分類器に止められた。オーナーの判断待ち(§12) |
| 起動時間・メモリ(Meta 入り vs なし、release/R8) | **未** |
| 低価格の Android 実機 | **未** |
| Events Manager の Test Events で受信 | **未**(オーナーの Meta アプリが要る) |
| 広告マネージャのインストール最適化の選択 | **未**(同上) |

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
  許可しなかった人のインストールも観測しない(=Meta の数字は構造的に少ない)。
  アトリビューションの時間窓・遅延・同意拒否・広告 ID 不使用による欠測がある。

### 運用中

- 1,000 到達までは基本的に継続する。ただし次の停止条件は別に持つ: 同意・申告の不備、
  重大な性能悪化、保存データへの影響、承認済みの費用上限への到達。
- 記録する: 費用、Meta の獲得成果と CPI、Play の獲得数と初回起動、利用可能な集計の
  継続指標、クラッシュ / ANR。**CTR だけで成功を判定しない。**
- Web のクリック単価と Android の CPI は目的が違うので、そのまま優劣比較しない。
- 広告 → Google Play → 新規インストール → 起動 → 許可 → 成果、の流れを実配信後に
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
   分岐・manifest overlay・`services/acquisition/`・同意 UI・CI の例外(§3b / §8)・
   この文書を削除し、PRODUCT_PRINCIPLES.md の例外節を「終了」として残す。
   既存のゲーム・AdMob・購入は維持する。
4. **旧版の扱い**: 旧版を使い続ける端末でも、報告を受理された端末は SDK を二度と起動しない
   (§2)。まだ報告していない端末(許可したがオンラインにならなかった等)だけが、後から
   1 回送りうる。したがって公開ポリシーは、撤去後もしばらく「旧版の Android アプリ」に
   ついての記述を残す。Meta 側でアプリを無効にすれば受信そのものが止まる。
5. データ セーフティとポリシーを更新する(旧版の残存を考慮)。

停止のために API サーバーや Remote Config は作らない(PRODUCT_PRINCIPLES.md「維持費の原則」)。
報告はインストールごとに 1 回で、継続的な送信は構造上起きない —— 遠隔停止スイッチを
作らなくてよい理由はそこにある。

## 12. 未完了事項

- **オンラインでの通信観測が未実施。** 依存の追加と native アダプタはオーナーの承認
  (2026-09-28)を得て実装したが、Meta 入りビルドをオンラインで動かす操作は自動モードの
  安全分類器に止められた。Test Events での確認(§8 の 11)で代えるか、別途観測する。
- §8 の Google Play / 公開文面 / Meta 側の作業(すべてオーナー)。
- §9 の「未」の項目(Meta 入りビルドの実測・通信観測・実機・Test Events)。
- §10 の開始値の記録。
