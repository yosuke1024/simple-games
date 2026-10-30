# 広告と課金

docs/ARCHITECTURE.md から 2026-09-05 に分割した全文。索引と要約は [../ARCHITECTURE.md](../ARCHITECTURE.md)。

- 広告は `services/ads/` のバナーのみ(Anchored Adaptive Banner)。
  AdMob 初期化は起動後の fire-and-forget。UMP 同意はゲーム初期化と切り離す。
  オフライン時・広告削除が有効なときはリクエストしない。仕様は ADS_POLICY.md。
- `ui/` の `BannerSlot` は高さ確保方式(広告が届いても盤面の大きさは変わらない。実広告が 64px より高くて枠が伸びたときの位置の動き — 最大 26px — は [ADS_POLICY.md](../ADS_POLICY.md)「バナー広告の仕様」)。
  広告が出うる起動でだけ枠を確保し、出ない起動ではスロットごと消す。
- **広告側が問うのは「この起動で広告削除が効くか」**(`isAdRemovalActive()`)。
  購入済み、有効な Managed オーナー特典、または購入状態が読めなかった起動がこれに当たる(fail-closed、
  issue #96 — 読めなかったを未購入と読むと、購入者にバナーが出る)。SDK の初期化
  (`app/boot.ts`)もスロットの確保もこの 1 つの判定に従うので、埋まりうるときだけ
  枠が出る。「購入したか」(`isAdRemovalPurchased()`)は別の問いで、設定画面
  だけが問う — 買っていない人を購入済みと表示しないため。
- `monetization/` は広告削除 IAP の基盤: `AdRemovalStore` 契約
  (`isAvailable` / `getPrice` / `purchase` / `restore`)と実装差し替え点。
  既定実装は「ストア未接続」(購入 UI は非表示、購入済みキャッシュだけ尊重)。
  ストア接続は Play Console での商品作成など人間作業を要する(計画書 §5)。
- Managed オーナー特典は `sg.club.managedOwner` に保存した資格をローカルで判定する。
  `sg.iap` や購入済み表示へ混ぜず、設定したサービスの origin・現在の契約キー・期限を検査する。
  起動時の契約照会や Core から Club コードへの静的 import は加えない。Web の広告も同じ
  有効判定に従う。条件・更新・SDK 停止は [../ADS_POLICY.md](../ADS_POLICY.md) が定める。
