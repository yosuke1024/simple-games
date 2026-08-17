# 広告削除の買い切りを「実際に買える」状態にする計画 (2026-08-17)

報告された事象: **広告停止オプション(Remove Ads)が購入できなかった。**
本文書はその原因の切り分けと、購入可能にするまでの作業計画である。

## 現状 — アプリ側のコードは完成している

調査の結論から: 購入フローのコードは初期リリース時点から一通り実装済みで、
main に入っている。欠けているのはコードではなく **Play Console 側の設定
(RELEASE_CHECKLIST.md §5 の未完了項目)** である可能性が最も高い。

実装済みの範囲(証拠):

- 課金の継ぎ目: `src/monetization/adRemoval.ts`(唯一の商品 `remove_ads`、
  端末内キャッシュ `sg.iap`、購入/復元/価格取得)
- 実装本体: `src/monetization/playBilling.ts`(@capgo/native-purchases 8.6.4。
  ピン止めバージョンの API と使用コードの一致を確認済み)
- UI: `src/ui/screens/SettingsScreen.tsx` に購入・復元ボタン(14 ロケールの
  文言あり: `removeAdsTitle` / `adSupportBody` / `removeAdsAction` /
  `restorePurchase` / `purchaseThanks`)
- 起動配線: `src/main.tsx` が `initAdRemoval()`(同期的・オフライン可)と
  `initPlayBilling()`(fire-and-forget)を呼ぶ
- Android: `capacitor.settings.gradle` にプラグイン組み込み済み、
  `AndroidManifest.xml` に `com.android.vending.BILLING` 権限あり、
  `proguard-rules.pro` の監査コメントで R8 対応も確認済み
- テスト: `adRemoval.test.ts` / `playBilling.test.ts`

## なぜ購入できないか — 症状別の判別表

購入 UI はゲート付きで、どこで止まっているかは**設定画面の見え方**で分かる:

| 観察された症状 | 原因 | 対処 |
| --- | --- | --- |
| 説明文はあるが「広告を削除」ボタン自体が出ない | `isBillingSupported` が false。**サイドロード APK / debug ビルドでは正常動作**(checklist §5 の注記どおり)。Play 配布ビルドで出ないなら Play 未公開が疑い | 内部テストトラック経由でインストールして確認(Phase 1・3) |
| ボタンは出るが価格が付かず、押しても何も起きない | Play Console に商品 `remove_ads` が存在しない/有効でない。`getProduct` と `purchaseProduct` が例外 → 設計により静かに握りつぶされ「無反応」に見える | **Phase 1(本丸)**: 商品の作成・有効化 |
| Play の購入シートは出るが完了しない | ライセンステスター未登録、または支払い方法の問題 | Phase 1: テスター登録 |
| 購入は完了したがバナーが消えない | エンタイトルメント反映の不具合(現時点で兆候なし) | 再現手順を添えて要調査 |

コードが最初から入っていた以上、ユーザーの体験(「購入できなかった」)は
上の 1 行目か 2 行目のはずである。**どちらだったかで Phase 3 の確認観点が
変わるので、着手時に症状を 1 行確認するのが望ましい**(どちらでも Phase 1
の作業内容は同じ)。

## 計画

### Phase 1 — Play Console 設定(人間作業。ここが本丸)

コードでは解決できない、RELEASE_CHECKLIST.md §5 の未完了項目そのもの:

- [ ] Play Console にアプリ内商品 `remove_ads` を作成
      (ID はコード側 `AD_REMOVAL_PRODUCT_ID` と一致必須。
      基準価格 USD 3.99・国別自動価格 — ADS_POLICY.md)
- [ ] 商品を**有効化**する(作成しただけの下書き状態では取得できない)
- [ ] 「設定 → ライセンス テスト」にテスト用 Google アカウントを登録
- [ ] 課金コードを含む AAB が**内部テストトラックに公開済み**であることを確認
      (課金は Play 配布ビルドでしか動かない。サイドロードでは
      `isBillingSupported` が false になり購入 UI が出ない — それは正常)

### Phase 2 — コード改善: 失敗を「無反応」にしない(このリポジトリで実施)

現状は「失敗は静かに」を購入ボタンにまで適用しており、店側の設定漏れが
ユーザーには**無反応**として見え、開発者にも診断材料が残らない。ポリシー
(ポップアップ禁止・静かに正直に)を守ったまま:

1. **購入ボタンを商品取得の成功にゲートする。** `getProduct` が成功して
   価格が取れたときだけ「広告を削除」ボタンを描画する(復元ボタンは
   billing 対応なら常に出す — 復元は商品情報なしで動くため)。
   商品未設定の Play 状態で「押しても何も起きないボタン」が出る現状を
   構造的に無くす。
2. **復元の結果を行内の一時メッセージで返す**(`useTransientTimeout` 既存)。
   見つからなかったとき用に新キー `restoreNotFound`(14 ロケール +
   gateRecord)。復元にはキャンセル経路がないので、これは
   checklist §5「キャンセル時にエラー表示を出さない」と両立する。
3. **購入失敗時の文言は追加しない。** プラグインのネイティブ実装を確認した
   結果、ユーザーのキャンセルもストア障害も同一の reject
   (`"Purchase is not purchased"`)で届き、JS 側で区別できない。
   失敗表示を足すとキャンセルにもエラーが出て checklist §5 に違反する。
   購入成功は既存の `purchaseThanks` 表示で既に見える。
4. **catch に `console.warn` を追加**(adRemoval.ts / playBilling.ts)。
   ポリシーの「失敗は静かに握りつぶし、ログのみ」の「ログ」を実装し、
   実機の `adb logcat` で原因(Product not found 等)を特定可能にする。
5. テスト更新(ボタンのゲート条件、復元フィードバック、ログ)。

### Phase 3 — 実機検証(内部テストトラック経由・release ビルド)

RELEASE_CHECKLIST.md §4.5 / §5 の該当項目をそのまま消化する:

- [ ] 広告削除の購入と「購入を復元」が動く(R8 リリースビルドで)
- [ ] 購入 → バナーが消える → アプリ再起動後も消えたまま
- [ ] 購入キャンセル → 何も変わらない・エラー表示が出ない
- [ ] 別端末で「購入を復元」が機能する

## 提案(実装はこの既定で進める。変える場合は本文書を更新してから)

| 項目 | 提案 |
| --- | --- |
| 進め方 | Phase 1(Play Console)と Phase 2(コード)は独立・並行可。検証(Phase 3)は両方の後 |
| 購入ボタンの表示条件 | `billing 対応 && 商品取得成功`(価格が取れたときだけ)。復元は billing 対応のみで表示 |
| 新規 i18n キー | `restoreNotFound` のみ(purchaseFailed は上記の理由で作らない) |
| 価格変更 | しない(USD 3.99・国別自動価格のまま — ADS_POLICY.md が正本) |
| Web 版 | 対象外のまま(Web 版は何も販売しない — WEB_VERSION.md / ADS_POLICY.md) |

## 検討の経緯(記録)

- **プラグイン差し替えは不要。** @capgo/native-purchases 8.6.4 の型定義と
  Android 実装(`NativePurchasesPlugin.java`)を取得して照合済み。
  `isBillingSupported` / `getProduct` / `purchaseProduct` / `restorePurchases` /
  `getPurchases` / `purchaseState === "1"` の使い方はすべて現行 API と一致。
- **「購入失敗しました」表示は見送り。** キャンセルと障害が JS で区別不能
  (両方 `"Purchase is not purchased"` reject)という実装上の制約による。
  プラグインが将来エラーコードを返すようになったら再検討。
- **サイドロードで購入 UI が出ないのは仕様。** checklist §5 に明記済み。
  Phase 2 の 1 によって「billing 非対応」と「商品未設定」の見え方が
  どちらも「ボタンなし」に揃うが、logcat のログ(Phase 2 の 4)で区別できる。
