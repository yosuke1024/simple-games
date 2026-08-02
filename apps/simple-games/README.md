# Simple Games: Offline Puzzles

**Honest by design. Simple games, built in the open.**
「無料ゲームを、誠実に。シンプルなゲームを、オープンに。」

複数のゲームを収録した 1 つのアプリです(ランチャー表示名: `Simple Games`)。
収録ゲームはワークスペースパッケージではなく `src/games/<gameId>/` のフォルダで分割し、
シェル(コレクションホーム、設定 / About、バナー広告、広告削除 IAP 基盤、
ストレージ基盤、i18n)だけを共有します。

- Fully playable offline(初回起動から機内モードで動作。オフライン時は広告リクエストなし)
- No account required / No subscriptions / No paywalls
- 助けは常に無料・無制限(広告視聴・課金不要)。ただし全ゲームで同じ機能を並べず、
  そのゲームの中身を空にしない形の助けを用意します(下表)
- 広告はオンライン時の小さなバナー 1 つだけ(買い切りで永久に削除可能)
- Progress stays on your device(クラウド同期なし。Analytics なし)

## 収録ゲーム

並び順はコレクションホームの表示順(`src/app/registry.ts`)です。

| ゲーム | フォルダ | 進行 | 無料・無制限の助け | ルール文書 |
| --- | --- | --- | --- | --- |
| Sudoku(ナンプレ) | `src/games/sudoku/` | 999 レベル + デイリー | Undo / Hint | [docs/SUDOKU_RULES.md](../../docs/SUDOKU_RULES.md) |
| Minesweeper | `src/games/minesweeper/` | 難易度 3 種 + デイリー | Hint(Undo なし) | [docs/MINESWEEPER_RULES.md](../../docs/MINESWEEPER_RULES.md) |
| Nonogram | `src/games/nonogram/` | 999 レベル + デイリー | Hint(Undo なし) | [docs/NONOGRAM_RULES.md](../../docs/NONOGRAM_RULES.md) |
| Number Match | `src/games/number-match/` | 999 レベル + デイリー | Undo / Hint | [docs/NUMBER_MATCH_RULES.md](../../docs/NUMBER_MATCH_RULES.md) |
| Sliding Puzzle | `src/games/sliding-puzzle/` | 999 レベル + デイリー | Undo(Hint なし) | [docs/SLIDING_PUZZLE_RULES.md](../../docs/SLIDING_PUZZLE_RULES.md) |

- **Sudoku** — 9×9 の標準ルール。999 レベル(level から難易度ティアと seed を決定的に導出)、
  デイリー(毎日 Medium 固定・過去日も挑戦可)、メモ、教えるための Hint。ミス上限も
  ゲームオーバーもスコアもなく、プレイ中に時計を出しません。盤面は端末上で seed から生成し
  (問題データの同梱もダウンロードもなし)、常に一意解かつ推測なしで解けます。
- **Minesweeper** — Easy 9×9 / Medium 12×12 / Hard 14×18。**初手は必ず安全で(必ず領域が
  開く)、出題は必ず論理だけで解けます**。地雷は初手の後に配置し、2 規則のソルバーが
  解ききった配置だけを採用します(作り直しの上限に達したときの退避も規定してありますが、
  テストで測った範囲では一度も発生していません)。生成は端末上で同期実行し、
  Hard で 200ms の予算に対して実測は桁違いに速く収まっています。
  運で負けないぶん地雷を開くのは常にプレイヤーの判断なので、Undo は作りません
  (同じ盤面への即時・無料の再挑戦を出します)。Hint は無制限。
- **Nonogram** — 5×5 / 10×10 の 999 レベルとデイリー。**出題は必ず行・列単位の論理だけで
  解けます**(ラインソルバーが解ききった盤面だけを採用し、解は常に一意)。ミス判定も
  ライフもありません。塗りも × もタップで自由に付け外しできるため **Undo は作らず**、
  Hint(確定するマスと根拠の行・列を示す)は無制限です。
- **Number Match** — 999 レベル(式による決定的生成、緩やかな難易度上昇)とスコア
  (時間要素なし)、デイリーチャレンジ。Undo / Hint。
- **Sliding Puzzle** — 3×3 / 4×4 / 5×5 の 999 レベルとデイリー。Undo は無制限ですが、
  **Hint は作りません**(盤面は完全に見えており、隠れている情報がないため)。

レベルを持つのは Sudoku / Nonogram / Number Match / Sliding Puzzle の 4 本です。
Minesweeper には段階的な進行が存在せず、999 段階を作れば水増しになるため作りません。

ストア掲載文の英語正文は [store/listing.md](store/listing.md) に置きます。収録ゲームは
名前だけを並べ、ルールの詳細は掲載文に書きません(ゲーム別 Landing Page の役割)。
言語別の掲載文はこのリポジトリでは管理しません(理由は
[docs/I18N_POLICY.md](../../docs/I18N_POLICY.md) の「ストアローカライズ」)。

各ゲームは共有設定画面へ設定セクションを 1 つだけ差し込めます
(ゲームレジストリの任意フィールド `SettingsSection`)。ゲーム固有の設定はゲームが所有し
(Sudoku は「ミスの即時表示」を `sd.prefs` に保存)、シェルは場所だけ貸します。
契約は [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)。

コレクション化と収録ゲームの計画は
[docs/plans/2026-07-30-collection-and-sudoku.md](../../docs/plans/2026-07-30-collection-and-sudoku.md)。

## ゲームごとの分割の約束

- **ストレージ**: 共有レコードは `sg.` 接頭辞(`sg.settings` / `sg.iap`)。
  ゲームは自分の接頭辞だけを使います — `sd.` Sudoku / `ms.` Minesweeper /
  `ng.` Nonogram / `nm.` Number Match / `sp.` Sliding Puzzle。
  一方の破損が他方に波及せず、「ローカルデータ削除」は全部を消します。
- **CSS**: ゲームのスタイルはそのゲームが持ち、`src/games/<id>/ui/<id>.css` を
  同じフォルダの Root が import します。`src/ui/styles.css` に置くのは共有クロム
  (トークン、コレクションホーム、設定 / About、ダイアログ等)だけです。
  ※ Number Match と Sudoku の盤面スタイルは規約より前に書かれたため、まだ
  `src/ui/styles.css` に残っています。
- **アクセント色**: 1 タイトル 1 色を `packages/brand` の `titleAccents` に置き、
  シェルがマウント時にルート要素へ `data-game="<id>"` を付けて CSS 変数を
  差し替えます。シリーズの下地は変わりません([docs/BRAND.md](../../docs/BRAND.md))。

## 言語

現在 14 言語・227 キー(en / ja / hi / th / id / vi / ko / zh-hans / zh-hant /
es / pt-br / fr / de / tr)。カタログは全言語同梱(`src/i18n/`)。ロケールタグは小文字で持ち、
中国語は書記体系で解決します(zh-TW / zh-HK / zh-Hant → zh-hant、zh / zh-CN / zh-SG →
zh-hans)。pt / pt-PT は pt-br へ解決します。Arabic は RTL 検証の条件を満たすまで見送りです。
**en と ja 以外は来歴 `machine`(その言語のネイティブは読んでいない)。**
約束を背負う高リスクキーは、リリース前に逆翻訳を作者が読む門を通します
(`i18n:gate`。未通過があると `i18n:gate:check` が落ちます)。
方針・対応言語計画は
[docs/I18N_POLICY.md](../../docs/I18N_POLICY.md)、locale の追加・修正手順は
[CONTRIBUTING.md](../../CONTRIBUTING.md) の Translations 節を参照。

アプリ内のゲーム説明は Quick Rules(チュートリアル、最大 3 ステップ)のみで、
詳細ルールはゲーム別 Landing Page(別リポジトリ、公開済み)へ分離します。
チュートリアルの「Learn More / 詳しく見る」ボタンがそこを開き、オフライン時は
静かに何もしません(ゲームは止まりません)。

Landing Page が書かれている言語は `src/ui/landing.ts` の `PAGE_LOCALES`
(現在 en / ja / es)。アプリの 14 ロケールのうちそれ以外は英語ページへ送ります。
**ページが公開される前にここへ言語を足すと 404 を配ることになる**ので、
順序は「ページを公開してから `PAGE_LOCALES` を足す」です。

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
cd apps/simple-games && pnpm exec cap sync android
cd apps/simple-games/android && ./gradlew assembleDebug     # デバッグビルド
cd apps/simple-games/android && ./gradlew assembleRelease   # リリースビルド(未署名)
```

要件: JDK 21、Android SDK(`local.properties` または `ANDROID_HOME`)。
`pnpm --filter <pkg> exec cap` は pnpm 10 でワークスペースのバイナリを解決できない
(`Command "cap" not found`)ため、`cap` はアプリディレクトリから実行する。

**低スペック端末はリリース要件**です(動かないなら配信しない)。サポート下限は
minSdk 24(Android 7.0)+ **WebView Chromium 88 相当(2021 年初)**。JS は es2018 へ
トランスパイルするため(`vite.config.ts`)、これより古い WebView でも白画面にはならず、
下限を決めているのはトランスパイルされない CSS(`aspect-ratio` / flex `gap`)です。
`structuredClone`(Chromium 98)や `color-mix` など新しめのプラットフォーム API は
使わない。リリース前に実機またはエミュレータでの確認を必須とする
([docs/RELEASE_CHECKLIST.md](../../docs/RELEASE_CHECKLIST.md))。

- appId: `com.pixapps.simplegames`
- appName: `Simple Games: Offline Puzzles`
- 収録ゲームの追加・更新は 1 つのアプリリリースとして出す(アプリ単位で更新)

### リリースはタグで作る

`versionName` / `versionCode` は **git タグが決める**。`build.gradle` の値は
`./gradlew assembleDebug` を動かすためだけの手元用フォールバック(`0.0.0` / `1`)で、
配信されるものではない。

```bash
git tag v1.0.0 && git push origin v1.0.0
```

`v<major>.<minor>.<patch>` を push すると
[`.github/workflows/android-release.yml`](../../.github/workflows/android-release.yml)
が走り、次を出力する。

| 生成物 | 用途 |
|---|---|
| `app-release.aab` | Play Console にアップロードするもの |
| `app-release.apk` | 実機・エミュレータでの動作確認用(§4)。sideload では課金が動かないのは正常 |

- `versionCode` は `major * 10000 + minor * 100 + patch`(`1.2.3` → `10203`)。
  **minor / patch は 100 未満**に保つこと。同じ版を再アップロードすることはできない
  ので、作り直すときは新しいタグを打つ。
- 署名 secret が無いままタグを打つとワークフローは**失敗する**。未署名の生成物を
  「できた」として渡さないため。
- タグに製品名を付けないのは、この monorepo のリリース対象が 1 つだけだから。
  5 ゲームは 1 つのアプリとして出すので、ゲームを足してもこのアプリのリリースに
  なるだけで、2 つ目のタグ空間は生まれない。`v1` のような雑なタグでも起動はするが、
  版の形が正規形でないためその場で失敗する(誤ったビルドは出ない)。
- ストアへのアップロードは手動(`docs/RELEASE_CHECKLIST.md` §7)。

### 署名鍵と GitHub Secrets(初回だけの人手作業)

keystore はコミットしない(`.gitignore` が `*.jks` / `*.keystore` を弾く)。
Play App Signing を使うので、ここで作るのは**アップロード鍵**。

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

`upload.jks` はリポジトリ外(パスワードマネージャや暗号化バックアップ)に保管する。
**失うと同じアプリを更新できなくなる。** 続けてリポジトリの Secrets に登録する:

| Secret | 中身 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i upload.jks \| pbcopy` の出力 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore のパスワード |
| `ANDROID_KEY_ALIAS` | 上の例なら `upload` |
| `ANDROID_KEY_PASSWORD` | 鍵のパスワード |
| `ADMOB_ANDROID_APP_ID` / `ADMOB_ANDROID_BANNER_ID` | 本番 AdMob ID(未設定なら広告なしでビルドされる。AdMob ID は OS ごとに別なので名前にプラットフォームを含む) |

ワークフローは鍵を実行中の一時ディレクトリに展開し、ジョブの最後に削除する。

## 広告(バナーのみ)

広告は Anchored Adaptive Banner 1 つだけ(オンライン時のみ・画面下部の確保済みスロット)。
インタースティシャル等の他フォーマットは使いません。方針は
[docs/ADS_POLICY.md](../../docs/ADS_POLICY.md)。

開発ビルドは Google 公式テスト広告 ID のみを使用する。本番 ID の注入は 2 箇所:

- **バナー広告ユニット ID**(Web 側): `VITE_ADMOB_ANDROID_BANNER_ID` を
  `vite build` 時に環境変数で注入(未設定なら広告は無効、ゲームは通常動作)。
  `VITE_ADMOB_USE_TEST_ADS` でテスト広告を明示的に指定できる。
- **AdMob アプリケーション ID**(ネイティブ側): `ADMOB_ANDROID_APP_ID` 環境変数を
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
