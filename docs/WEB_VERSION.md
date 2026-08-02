# Simple Games — Web 版

`https://pixapps.ai/simple-games/play/` で配信するブラウザ版の方針。
Android アプリの約束(バナー広告 1 枠のみ・買い切りで広告削除・初回起動から
オフライン)は**アプリのもの**であり、Web 版はここに書く別の約束を持つ。

## 役割分担

| | Web 版 | Android アプリ |
|---|---|---|
| 位置づけ | すぐ遊べる無料版。PixApps への入口 | 静かに長く遊ぶための完成版 |
| 導入 | インストール・アカウント不要 | ストアから導入、ホーム画面から起動 |
| 広告 | ディスプレイ広告ほか([ADS_POLICY.md](ADS_POLICY.md)「Web 版」。既定は無効) | Anchored Adaptive Banner 1 枠のみ |
| 課金 | なし(完全無料) | $3.99 買い切りで広告永久削除 |
| ゲーム内容 | 8 ゲームすべて。機能差なし | 8 ゲームすべて |

**Play instantly on the web. Play quietly and offline in the app.**

ゲーム機能に差を付けない。広告視聴でも課金でも解放される機能は、どちらの版にも
存在しない(`docs/PRODUCT_PRINCIPLES.md`)。

## 配信構成

- **Cloudflare Pages の静的アセット配信のみ**。Pages Functions / Workers / D1 / KV /
  Durable Objects / R2 / 独自 API / 認証 / クラウドセーブ / サーバー側生成 /
  定期実行ジョブを一切使わない。追加の固定インフラ費を発生させない。
- 成果物はこのリポジトリの `vite build`(`apps/simple-games/dist/`)。`base: './'` の
  相対パスなので、サブパス配下にそのまま置ける。
- 配置先は別リポジトリ `pixapps-landing` の `simple-games/play/`
  (`pages_build_output_dir: "."` の「リポジトリ = サイト」構成)。同期は
  landing 側の `npm run sync:simple-games`。**`simple-games/play/` は生成物**であり、
  手で編集しない。直すのはこのリポジトリのソース。
- GitHub Pages でも配信できる純静的構成を維持する(ホスティング固有機能に依存しない)。

## オフラインの扱い(アプリとの決定的な違い)

- **Web 版は初回アクセスにアセットのダウンロードが必要**であり、アプリの
  「初回起動から完全オフライン」とは**同一ではない**。この差を曖昧にした表現を
  Web 版・Landing Page・ストア文言のいずれでも使わない。
- 読み込み後のプレイ自体はブラウザ内で完結する(盤面生成・Daily・保存・統計・
  言語・テーマ)。通信が切れてもゲームは止まらない。
- 再訪時のオフライン動作(PWA / Service Worker)は M3 で導入予定。導入後、
  「2 回目以降はオフラインで動作」をここに追記する。**そのとき、下記のホーム画面の
  タグラインを Web 版で出すかどうかを併せて判断する。**
- オフライン時、広告は静かに出ないだけ。エラーを出さず、リトライループも作らない
  (`docs/OFFLINE_POLICY.md` と同じ原則)。

## 広告

**正式な方針は [ADS_POLICY.md](ADS_POLICY.md)「Web 版」節が定める**(この節が
唯一の記述だった期間は 2026-08-02 の Phase A 実装で終了)。要点だけ再掲する:
形式はディスプレイ / アンカー / Vignette を制限付きで、**広告視聴や課金でゲーム
機能を解放しないことだけが版をまたぐ絶対原則**。
[PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md) の「Banner ads only」と
ADS_POLICY.md の禁止フォーマットは**アプリのスコープ**であり、この方針は
それを上書きするのではなく別スコープを定めている。

実装状況(2026-08-02):

- **実装済み**: 2 モードビルド(`--mode web` → `dist-web/`。AdSense 統合は
  このビルドだけに同梱され、native 側は成果物検査で不在を保証)、
  **アンカー(Auto ads)の起動時ブートストラップ + 全画面の下端退避余白**
  (プレイ中も出てよい — 2026-08-02 決定。`services/ads/web/boot.ts` +
  `data-sg-web-ads`)、ホーム画面のディスプレイ 1 枠(`WebAdSlot`)、
  **リザルト画面のディスプレイ 1 枠 — 3 局に 1 回のみ**(`ResultAdSlot` +
  `resultCadence.ts`。セッション最初のリザルトには出さない)、テスト用
  プレースホルダ(AdSense に公式テスト ID がないため、通信ゼロのローカル表示)、
  GitHub Actions「Web build」での test / production / disabled 切り替え。
- **既定は広告なし**: `VITE_ADSENSE_CLIENT` が注入されるまで、本番ビルドでも
  何も出ない(枠も余白も確保しない)。**配信中の Web 版に広告はまだ 1 つも
  出ていない**(本番有効化の前提となる人間作業は ADS_POLICY.md「Web 版」の
  一覧どおり。プライバシー文言の追記と「Auto ads はアンカーのみ有効化」も
  そこに含まれる)。
- **未実装**: デスクトップサイドレール(保留)、About の支援文言と
  アプリへの送客ブロック(en/ja)、Vignette(hash ナビゲーション導入後、
  [plans/2026-07-31-web-play.md](plans/2026-07-31-web-play.md) M4)。

## 保存

- Capacitor Preferences の web 実装 = `localStorage`(`pixapps.ai` オリジン)。
  スキーマとマイグレーションは Android と同一コードが担当する。
- **端末間・アプリとの同期はしない。** アカウントがないため技術的にできない、
  ではなく、作らないという選択(`docs/PRODUCT_PRINCIPLES.md`)。
- ブラウザのサイトデータ削除で消える。これは Web の仕様であり、静かに長く遊ぶなら
  アプリを勧める理由のひとつ。

## Web 版に存在しないもの

- **課金 UI**: Play Billing は web で `isBillingSupported` が false のままなので、
  購入・復元ボタンは表示されない(実行時ガード)。
- **AdMob**: `services/ads/banner.ts` は `Capacitor.isNativePlatform()` が false の
  とき何もしない。AdMob SDK はロードすらされない。バナー枠も確保しない。
- **「広告を削除して支援」セクション**: 設定画面から**丸ごと消える**。この版には
  バナーも買い切りも存在せず、説明が事実にならないため。実装は
  `ui/screens/SettingsScreen.tsx`、両プラットフォームの文言差は
  `SettingsScreen.test.tsx` が固定している。
  なお設定画面の「ローカルデータを削除」ボタン自体は Web でも動く。

  **Web 専用の文言は新造しない。** かつてここは「プライバシー要約 3 項目が
  Web では消える(privacy3 / privacy4 / privacy5 が事実にならないため)」と
  書いていたが、**2026-08-02 にプライバシー要約そのものを廃止した**ので、
  出し分ける対象がもう無い。ポリシーと規約は
  <https://pixapps.ai/simple-games/privacy> と `/terms` へのリンクになり、
  そのページが両版を 1 枚でカバーする(`docs/PRIVACY_POLICY.md` に経緯)。
  AdSense を入れる際に一度は Web 専用キー(`privacyWebAds`)を足したが、
  **同日中に撤回した** — 板挟みの原因は文面が 14 部あることだった。
  Web と native で文言を出し分けたくなったら、まずその文言がアプリの中に
  ある必要があるのかを疑うこと。
- **ホーム画面のタグライン**(`tagline` =「オフラインで遊べる。アカウント不要。
  機能課金なし。」): コレクションホームから**消える**。「オフラインで遊べる」は上記のとおり
  アプリの約束であって Web 版の約束ではなく、初回アクセスのダウンロードを曖昧にする
  表現にあたる。ここでも**書き換えではなくガード**にしている — Web 専用の
  タグラインは 14 言語の新規キーになり、しかも「無料・オフライン・paywall 不在の
  保証」は高リスクキーなので、設定画面と同じ理由(`docs/I18N_POLICY.md`)で
  今は出せない。実装は `ui/screens/CollectionHomeScreen.tsx`、両プラットフォームの
  差は `CollectionHomeScreen.test.tsx` が固定している。M3 の PWA で初回以降の
  オフラインが成立したら、文言を含めて再検討する。
  (ここは以前コレクション専用の `collectionTagline` =「完全無課金。…」だった。
  広告削除の買い切りがある以上その主張は使えないため廃止し、ゲーム別ホームと同じ
  `tagline` を共有している。docs/BRAND.md「表現ルール」)
- **ストアレビュー導線**: `shouldPromptReview()` がネイティブ限定。評価する対象の
  インストールが存在しないため、質問自体を出さない(`docs/REVIEW_PROMPT_POLICY.md`)。
- **ハードウェアバックキー処理・スプラッシュ**: Capacitor プラグインが no-op。

## アプリへの送客

Web 版には「もっと静かに遊びたい人向けにアプリがある」という案内を置く(未実装。
広告と同じ M2)。広告を嫌がらせとして使わない — 「広告が嫌なら出ていけ」ではなく
「より快適な選択肢がある」という案内にする。

> もっと静かに遊びたい方へ。Simple Games アプリなら完全オフラインで遊べます。
> 広告は小さなバナーだけ。$3.99 の買い切りで永久に削除できます。

> Prefer a quieter experience? Play fully offline in the Simple Games app.
> Only a small banner — or remove ads permanently for $3.99.

**掲出は en / ja のみ。** 価格・購入・削除・プライバシーに関わる文言の機械翻訳は
[I18N_POLICY.md](I18N_POLICY.md) で禁止しており、訳せていない言語では出さない。

## 実装上の約束

- ゲームロジック(`games/*/game/`)は Pure TypeScript のまま。React / DOM /
  Capacitor / 広告 / 課金 / ストレージに依存させない。Web 版のために
  巨大なプラグイン基盤や過剰な抽象化を作らない。
- web と native の違いは**実行時ガード**で表現する。ビルドを不必要に分岐させない
  (公開ソースと配信物が対応していることが、この製品の証明手段そのもの)。
  Web 広告はここだけが例外で、`--mode web` のビルド時ゲートに置く。その分離は
  `.github/scripts/check-dist-ads-separation.sh` が**ビルド成果物**で機械検証する
  (native 側に不在・web 側に存在。ビルドが要るので grep だけの
  `check-principles.sh` とは別スクリプトになっており、CI の verify ジョブが呼ぶ)。
- `index.html` は 1 枚のまま。Web 向けの meta / OGP / canonical は Android WebView が
  無視するので、分ける理由がない。
