# 広告と課金

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

- 広告は `services/ads/` のバナーのみ(Anchored Adaptive Banner)。
  AdMob 初期化は起動後の fire-and-forget。UMP 同意はゲーム初期化と切り離す。
  オフライン時・購入済み時はリクエストしない。仕様は ADS_POLICY.md。
- `ui/` の `BannerSlot` は高さ確保方式(盤面のレイアウトシフトなし)。
  広告が出うる起動でだけ枠を確保し、出ない起動ではスロットごと消す。
- **広告側が問うのは「この起動で広告削除が効くか」**(`isAdRemovalActive()`)。
  購入済み、または購入状態が読めなかった起動がこれに当たる(fail-closed、
  issue #96 — 読めなかったを未購入と読むと、購入者にバナーが出る)。SDK の初期化
  (`app/boot.ts`)もスロットの確保もこの 1 つの判定に従うので、埋まりうるときだけ
  枠が出る。「購入したか」(`isAdRemovalPurchased()`)は別の問いで、設定画面
  だけが問う — 買っていない人を購入済みと表示しないため。
- `monetization/` は広告削除 IAP の基盤: `AdRemovalStore` 契約
  (`isAvailable` / `getPrice` / `purchase` / `restore`)と実装差し替え点。
  既定実装は「ストア未接続」(購入 UI は非表示、購入済みキャッシュだけ尊重)。
  ストア接続は Play Console での商品作成など人間作業を要する(計画書 §5)。
