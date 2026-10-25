# 2026-10-25 Nearby Multiplayer PoC — issue #268

この文書は作業・検証記録。恒久的な原則の正は
[PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Nearby Multiplayer」、通信と製品化条件の
正は [architecture/nearby-multiplayer.md](../architecture/nearby-multiplayer.md)。
issue: [#268](https://github.com/yosuke1024/simple-games/issues/268)

## 現在の到達点

要求は Android / iOS の近隣端末同士が Bluetooth と同一 Wi-Fi で遊ぶこと。
インターネット・対戦サーバー・ログインは不要、Web は非対応、Android のサイズ増分を
抑える。まず 2 人、3〜4 人は実機検証後の拡張とする。

2026-10-25 は原則の例外と OS 標準 API の資料調査、隔離した通信 PoC と Yacht のデモを
対象とする。場所は `apps/simple-games/prototypes/nearby/`、app ID は
`com.pixapps.nearbypoc`。**通常製品の UI・権限・第三者通信 SDK 依存へは導入しない。**
既存 Managed Club House の判断と実装は維持する。

| Epic の段階 | この対応で用意するもの | 完了と扱わないもの |
| --- | --- | --- |
| Phase 0 | Core の任意の近隣通信を許容する canonical の更新、公式資料、2 台の role と検証 matrix、Android / iPhone 各 1 台の機種・OS 確認 | 旧 OS・低価格・advertising 非対応端末を含む台帳の確定と実測。Phase 0 全体は一部未完了。 |
| Phase 1 | BLE / LAN native adapter、共通 framing、相互確認。B1 / B2 の接続と論理 host の交替、B3 の逆の無線 role による接続、B1 / B3 の双方向 ping。補助試験 L1 と Android NSD 修正後の L2 の通常 Wi-Fi でも接続・相互確認・双方向 ping に成功 | 他の端末・OS 組み合わせ、WAN なし LAN、安定性、3〜4 台、電池、Android +500 KB の達成。 |
| Phase 2 | v1 の B1 / B2 / L1 / L2 と v2 の L3 で各 24 手番を完走し、各 121 公開 DOM 盤面と最終結果が一致。再戦開始、BLE の Android / LAN の iOS の background 終了、L3 の Wi-Fi OFF 後の次操作から state ACK timeout による終了と自動再開なしを確認 | v2 の BLE 完走、初期 / 最終 ACK 欠落の実機確認、WAN なし LAN の完走、その他の対局中の異常系・資源解放、製品 UI、多言語・accessibility、製品導入。 |
| Phase 3 | 必要な release gate の文書化 | Connect Four / Reversi への展開、3〜4 人検証、正式公開。 |

**Epic を close / complete にしない。** コードの自動検証と物理端末の試験結果を分ける。
ビルド・実行手順と自動チェック結果は、この文書末尾または PoC の README に追記する。

同日の実機確認では Pixel 9 Pro への PoC インストール・起動、明示 Start 後の BLE 権限要求、
探索の 60 秒 timeout、advertise 開始 callback、接続前の background / 復帰、権限拒否時の
終了・再試行・再許可後の探索開始まで確認した。iPhone 11 は初回の署名準備不足を解消し、
署名付きビルド・署名検証・インストール・起動に成功。Start 未操作の初回画面で権限ダイアログが
ないことも観測した。後続の B1 では iPhone advertise / game guest と Android browse /
game host で発見・接続・相互確認と双方向 1 KB ping に成功し、Yacht の 24 手番を完走した。
最終結果は両端末で 28 対 35、iPhone 勝利の表示が一致。両端末の記録を回収し、公開 DOM
盤面 121 / 121 件の一致を比較検査で確認した。WAN なし LAN・電池・配布サイズは未実施。

B2 では同じ無線 role のまま iPhone を game host、Android を guest にし、日本語の表示名と
確認コードを双方で確認して 24 手番を完走した。全 121 公開 DOM 盤面が一致し、最終 51 対 34、
iPhone 勝利を確認。双方 Ready による再戦開始と初回 Roll の同期後、Android を HOME で
background に移すと両端末が session を終了し、Android の前面復帰でも自動再開しなかった。
B3（Android advertise / game host、iPhone browse / guest）では発見・接続・双方 Confirm、
双方向 1 KB ping、Android の採点から iPhone の Roll へ手番をまたぐ部分進行を確認した。
iPhone の End 操作で両端末が終了した。B3 は 24 手番を完走した試験ではない。

L1 は通常 Wi-Fi の補助試験として別に記録する。Android LAN advertise / game host と
iPhone LAN browse / guest で接続・双方 Confirm・双方向 ping に成功し、24 手番を完走した。
全 121 公開 DOM 盤面が一致し、最終 41 対 37・Pixel 勝利。再戦開始後の iOS background による
両者終了と復帰時の自動再開なしも確認した。WAN 遮断操作は行っておらず、W1 の WAN なし条件を
満たす証拠にはしない。

LAN の通信 role を逆にした L2 の初回は Android の候補選択後に接続が失敗した。
Android の NSD service type 正規化を修正した `9b007638` の APK へ更新し、iOS は
`1131072b` のまま再試験すると、同じ条件で接続・双方 Confirm・双方向 ping に成功した。
この再試験は 24 手番を完走し、全 121 公開 DOM 盤面が一致。最終 iPhone 23 / Pixel 26、Pixel 勝利。
その後の再戦で Android guest の Wi-Fi を OFF にすると Android は終了したが、iOS host は 60 秒以上
Confirmed / Roll enabled のまま維持した。これは v1 の状態送信に受領確認がない問題として保持し、
修正後の L3 と区別する。一局完走と異常系の成功を同一視しない。

B1 / B2 / B3 / L1 / L2 はすべて wire v1 の結果として保持する。状態 ACK を加える wire v2 の
`418bda04` は 40 テスト・型検査・build に成功し、Android / iOS の新アプリを両端末へ導入した。
L3 の通常 Wi-Fi で 24 手番を完走し、全 121 公開 DOM 盤面が一致した。Android Wi-Fi OFF 後の
次の iOS Roll では ACK 待ちで操作を止め、15,009 ms 後に終了。Wi-Fi 復元後も両者の自動再開なし。
v1 の完走を v2 の合格件数へ加えない。

B1 の開始準備では両端末で Start を操作したが、相手の発見・接続へ進む前に 60 秒で終了した。
その時点の iOS advertising 開始や OS の Bluetooth 許可ダイアログは直接確認できておらず、
許可待ちだったかは未確定。この準備中の timeout は接続失敗率の試行数に含めない。
利用者が iPhone の初回 Bluetooth 許可をしたと回答した後の明示再試行で、1 回の接続成功を
記録した。機内モード ON / Bluetooth ON / Wi-Fi OFF は両端末で利用者が確認し、Android は
ADB の設定値 `1 / 1 / 0` でも確認した。終局後も Android で同じ設定値を再確認した。

## 設計判断

- Nearby は **Core の任意モード**。Club House の外側に新たなサービス層を作る判断ではない。
  既存ゲームを通常利用する端末には探索・権限要求・待ち時間を持ち込まない。
- 通信方式の詳細をゲームへ漏らさず、native adapter → 共通 session → Yacht デモに分ける。
  既存の純粋な採点関数を利用し、製品の保存、統計、レビュー計数、Club 結果は触らない。
- ゲーム host と advertise / browse は別々に選ぶ。Android advertising 非対応の場合は
  iOS peripheral + Android central が候補。Android 2 台とも非対応なら BLE 不可と表示する。
- 2 台だけ。framing は LF 区切り UTF-8 JSON、本文最大 4096 bytes、BLE chunk は最大 20 bytes。
  小さい MTU でも通る方式を検証し、書込み応答・送信 queue の backpressure を守る。
- 相手と確認コードを両者が確認してから Ready / ゲームへ進む。平文の確認コードに
  暗号化・本人認証・盗聴 / 中間者攻撃防止の保証はない。公開盤面だけを扱う。
- host が合法手・乱数・採点・revision を確定する。重複や古い操作を適用しない。
  host 自身による改造への対策ではない。通信の切断・background は終了し、保存や再開はしない。
- 3〜4 人、秘密手札、host 移譲、自動再接続、BLE / LAN 間移行、製品 UI は後段で判断する。

### L2 の異常系を受けた wire v2 の変更 — 実装・自動検証と L3 の実機確認済み

host の各 `state` に単調増加の `stateSeq` を付け、guest が検証・適用後に
`state-ack { stateSeq, round, revision }` を返す。host は一致 ACK まで pending とし、
追加の `act` / RNG / 新 command / Ready / `tryStart` を止める。初期と最終の state も ACK 対象。
通常盤面は変えず status に待機を示し、host の終局 state が未 ACK なら勝敗 / 再戦を表示しない。
古い / 重複 ACK では pending を解除せず、未来 / 不整合 ACK では session を終了する。
終局表示を抑止するのは host だけで、guest は最終 state の受信・検証で結果を確定する。
両端末の同時確定は保証しない。重複 command には ACK 済み state を同じ `stateSeq` で再送し、
未 ACK の間は追加応答を作らない。

既存の 15 秒 `commandTimer` を使う設計で、v1 との混在は `Protocol mismatch` となる。
周期 heartbeat は追加しないため、無通信 idle 中の即時切断検知は保証しない。切断後の次操作で
state を送ってから 15 秒の ACK 期限による終了と、無操作中の切断検知を別の観測として扱う。
修正後の実機再試験では、初期・途中・最終 state の未達、一局完走、Ready / 再戦、古い / 重複 ACK
を含める。`418bda04` の L3 では一局・再戦・途中 state の ACK timeout を確認済み。
初期 / 最終 ACK 欠落や不正 ACK 注入の実機試験は未実施で、40 件の自動テストとは分ける。

## 実機台帳 — B1 / B2 / B3 の Android ↔ iOS BLE 接続を確認

2026-10-25 に下記 A2 / I2 を確認した。未確認の欄を推測で埋めず、API の capability 値や
エミュレータ / Simulator の実行を advertising・端末間通信の実証にしない。

| ID | 機種 | OS / build | BLE advertising の実際の結果 | 備考 |
| --- | --- | --- | --- | --- |
| A1 | 未確認 | 未確認 | 未確認 | API 24–30 の旧権限世代を含める。 |
| A2 | Pixel 9 Pro | Android 17 / API 37 / CP3A.260905.009 | advertising 開始と、B3 で I2 からの発見・接続・双方向 ping を確認 | target 36 の PoC debug APK。`1131072b` で B1 / B2 と LAN の L1 を完走、B3 は部分進行まで。L2 再試験は `9b007638` へ更新して完走。L3 から wire v2 の `418bda04`。低価格 Android の検証は別途必要。 |
| A3 | 未確認 | 未確認 | 未確認 | advertising 非対応の実機が必要。模擬失敗だけで代用しない。 |
| I1 | 未確認 | 未確認 | 未確認 | iOS の最小サポート付近。 |
| I2 | iPhone 11 | iOS 26.6.2 / 23G90 | advertise で A2 からの発見・B1 / B2 接続を確認 | Developer Mode 有効、USB 接続、署名付き PoC。`1131072b` で B1 / B2 / L1 / L2 を完走、B3 は部分進行。L3 から wire v2 の `418bda04`。初回準備の timeout は下記に保持。 |
| AP1 | 未確認 | firmware 未確認 | 対象外 | WAN を外せる同一 LAN、AP isolation を切替できるもの。 |

実施時は app commit、app ID、build variant、権限の初期状態、位置情報設定、Bluetooth /
Wi-Fi の ON/OFF、周囲の電波条件、試行数を併記する。現在の baseline は Android minSdk 24 /
targetSdk・compileSdk 36、iOS deployment target 15.0。target 37 に上げる際は Android 17 の
`ACCESS_LOCAL_NETWORK` と NSD picker の選択を再確認する。

## 接続と対局の matrix — v1 の B1 / B2 / L1 / L2、v2 の L3 を各 1 局完走

BLE 条件は **機内モード ON、Bluetooth 明示 ON、Wi-Fi OFF、インターネットなし**。
LAN の必須 gate（W1〜W4）の条件は **同一 Wi-Fi、WAN / インターネットなし**。
通常 Wi-Fi の補助試験 L1 は下の別表に分ける。機内利用は航空会社・乗務員の指示に従う。

| ID | 方式 / 組み合わせ | 通信ロールと論理 host | 必須の確認 | 結果 |
| --- | --- | --- | --- | --- |
| B1 | BLE Android ↔ iOS | iOS advertise / Android browse、game host は Android | 発見、両者確認、双方向、大きな message、一局 24 手番 | 接続 1 回、両者 Confirm、各方向 1 回の 1 KB ping と 24 手番完走。全 121 公開 DOM 盤面と最終 28 対 35・iPhone 勝利が一致。準備中の timeout は接続失敗率に含めない。 |
| B2 | BLE Android ↔ iOS | B1 と同じ通信ロール、game host は iOS | host と無線 role の独立 | 日本語表示名・コード一致、双方 Confirm / Ready、24 手番完走。全 121 公開 DOM 盤面と最終 51 対 34・iPhone 勝利が一致。再戦開始と Android の対局中 background / 復帰も確認。 |
| B3 | BLE Android ↔ iOS | Android advertise / iOS browse、game host は Android | Android peripheral の対応端末 | 接続・双方 Confirm / Ready、各方向 1 回の 1 KB ping、rev 3 までの手番をまたぐ進行と iPhone の End による両者終了を確認。24 手番完走は未実施。 |
| B4 | BLE Android ↔ Android | 成功する側が advertise、game host を交替 | 両方向、旧/新 OS、低価格機 | 未実施 |
| B5 | BLE Android ↔ Android | 片方 advertising 非対応 | advertise 可能な相手を使う手動 fallback | 未実施 |
| B6 | BLE Android ↔ Android | 両方 advertising 非対応 | BLE 不可を説明し、LAN / 終了を選べる | 未実施 |
| B7 | BLE iOS ↔ iOS | advertise / browse を交替 | 最小付近 / 現行 OS、両方向、一局 | 未実施 |
| B8 | BLE Android ↔ iOS、wire v2 `418bda04` | iOS advertise / game host、Android browse / guest | v2 の一局 24 手番、全公開盤面一致、iOS 側 background | 未開始。iPhone の Wi-Fi OFF 設定の利用者回答待ち。B4〜B7 の別組み合わせとは分ける。 |
| W1 | LAN Android ↔ iOS | listen / browse と game host を交替 | WAN なしの発見、双方向、一局 | 未実施。利用者から通常の Wi-Fi のみ利用可能と回答があり、WAN なしの条件をまだ用意できていない。 |
| W2 | LAN Android ↔ Android | listen / browse を交替 | 同 OS、一局 | 未実施 |
| W3 | LAN iOS ↔ iOS | listen / browse を交替 | 同 OS、一局 | 未実施 |
| W4 | LAN AP isolation / multicast 制限 | W1 の同じ設定 | timeout、説明、退出、資源解放 | 未実施 |
| M1 | BLE 3〜4 台 | 今回の PoC 対象外 | 後続 spike で topology・接続上限を判断 | 未実施 / 未対応 |

各成功行にも、発見時間・接続時間の分布、試行数 / 成功数、切断回数、連続動作時間、
メモリ、電池の測定条件を記録する。平均だけで成功扱いにせず、失敗の OS / role と再現手順を残す。

### 補助試験 — 通常 Wi-Fi（WAN 遮断なし）

この表は上記の WAN なし LAN gate と別の観測記録。WAN / インターネット不要という条件を
実証した件数に含めない。

| ID | 方式 / 条件 | 通信ロールと論理 host | 結果 | 未実証の範囲 |
| --- | --- | --- | --- | --- |
| L1 | LAN Android ↔ iOS、同じ通常 Wi-Fi、WAN 遮断操作なし | Android advertise / game host、iOS browse / guest | 接続・相互確認、1000-byte payload ping を各方向 1 回、24 手番完走。全 121 公開 DOM 盤面と最終 41 対 37・Pixel 勝利が一致。再戦開始、iOS background による両者終了と復帰時の自動再開なしも確認。 | WAN なし動作、AP isolation、OS 資源の全解放は未実証。 |
| L2 | LAN Android ↔ iOS、同じ通常 Wi-Fi、WAN 遮断操作なし | iOS advertise / game host、Android browse / guest | 初回 `1131072b` は候補選択後に `invalid-peer` で接続失敗。Android の NSD 修正 `9b007638`（iOS は `1131072b`）で再試験し、接続・双方 Confirm・双方向 ping、24 手番完走。全 121 公開 DOM 盤面と最終 iPhone 23 / Pixel 26・Pixel 勝利が一致。 | 後続の Wi-Fi OFF で iOS host が終了しない v1 の不具合を観測。修正後の結果は L3 に分ける。WAN なし動作は未実証。 |
| L3 | LAN Android ↔ iOS、同じ通常 Wi-Fi、WAN 遮断操作なし、両端末 wire v2 `418bda04` | iOS advertise / game host、Android browse / guest | 24 手番完走、全 121 公開 DOM 盤面と最終 iPhone 50 / Pixel 37・iPhone 勝利が一致。初期 / 最終 state の ACK を経由し、双方 Ready で再戦 rev 0。Android Wi-Fi OFF 後の次の iOS Roll から 15,009 ms で ACK timeout 終了、復元後も両者自動再開なし。 | 追加 ping、初期 / 最終 ACK 欠落の実機試験は未実施。無操作中の即時検知を保証せず、WAN なし動作も未実証。 |

## 権限・異常・lifecycle の matrix — 一部確認、v1 の L2 の問題を v2 の L3 で再試験

| 条件 | 期待する結果 | 結果 |
| --- | --- | --- |
| 初回起動、Nearby を開始しない | 権限要求・探索・広告・接続をしない | A2: 初回の CONNECT / SCAN / ADVERTISE はすべて未許可。Capabilities 操作でも権限 prompt なし。I2: Start 未操作の初回画面で権限ダイアログなし。無線処理ゼロの実測は両端末とも未実施。 |
| BLE 権限拒否 / 取り消し | 接続を始めず / 終了し、再試行か退出を選べる | A2: PoC だけの権限を revoke 後、OS ダイアログで拒否。探索を始めずエラーを示して開始可能な画面へ戻り、拒否状態の再試行も同様。接続中の取り消し・iOS は未実施。 |
| Android API 24–30、位置情報拒否 / OFF | 原因を区別できる範囲で説明し、待ち続けない | 未実施 |
| iOS LAN 権限拒否 / 再許可 | 許可待ちと権限拒否・timeout を扱い、明示再試行できる | 未実施 |
| iOS LAN 初回許可 | 利用時の許可後、明示再試行で探索・接続へ進める | L1: 利用者が Local Network を許可済みと回答した後、明示 Start で接続に成功。許可の確認は本人回答によるもので、拒否 / 再許可試験とは分ける。 |
| OS 権限ダイアログ | 通常の background 終了と区別して、許可後の操作が行き詰まらない | A2: 明示 Start browse で Nearby devices ダイアログを表示し、許可後の探索開始と拒否後の終了を確認。PoC の `user-set` / `user-fixed` フラグを clear 後、通常の OS ダイアログで再許可し、再び探索開始を確認。I2: 利用者の初回許可の回答後、明示再試行で B1 接続成功。OS ダイアログ自体は直接観測していない。接続中の取り消しは未実施。 |
| Bluetooth OFF / 相手が離れる / 相手のアプリ終了 | session 終了。古い操作を再適用しない | 未実施 |
| 相手の明示 End | 両端末の session を終了し、対局操作を止めて明示開始へ戻る | B3: iPhone の End で iOS は Ended locally、Android は BLE peer disconnected。両者 Session ended / Start enabled / Roll disabled を確認。 |
| Wi-Fi 切断 / ネットワーク変更 | 検知した session を終了し、局を勝手に移行しない。無操作中の即時検知は保証しない | v1 の L2 では Android だけ終了して iOS host は操作可能なまま残った。v2 の L3 は Android が SocketException で終了し、切断後の次の iOS Roll が ACK 待ちへ移り、15,009 ms で終了。Wi-Fi 復元後も両者自動再開なし。初期 / 最終 ACK 欠落と他のネットワーク変更は未試験。 |
| background / 画面ロック / 復帰 | session 終了。復帰時に自動接続・再開をしない | A2 の待受け中に加え、B2 の再戦初回 Roll 後にも HOME で background へ移し、両端末が終了・操作不可・開始可能に戻ることを確認。A2 の前面復帰後も状態・ログ末尾が変わらず自動再開なし。L1 の再戦初回 Roll 後には iOS を background に移し、両者終了と iOS 復帰時の自動再開なしを確認。画面ロック・BLE での iOS background・OS 全資源解放は未実施。 |
| 同名の相手、別セッション、確認拒否 | 相手を確認でき、両者確認前に局を始めない | 未実施 |
| 不正 JSON / UTF-8、4096 bytes 超過、不完全 frame | 上限を超えて蓄積せず、安全に終了 | 未実施 |
| 日本語・分割・連結・最大長 message | BLE / TCP の read 境界によらず 1 message として復元 | B2 の日本語表示名を両端末で確認。1 KB payload は B1 で双方向確認。最大長・意図的な連結等の網羅試験は未実施。 |
| 重複 / 古い revision / 順序逆転 / 手番外 command | RNG・得点・手番を誤って進めない | 未実施 |
| 2 人で Ready / 再戦 | 両者の Ready で新 round。前 round の操作を採用しない | B2: 初回・再戦とも片方の Ready だけでは開始しない。双方 Ready 後に初期盤面へ戻り、host の初回 Roll で双方 rev 1・同じ出目を確認。L1 も双方 Ready で rev 0 に戻り、Android host の Roll で双方 rev 1・同じ出目を確認。前 round の古い操作を実機へ注入する試験は未実施。 |

## Android 配布サイズと性能 — 未測定

**+500 KB は初期の挑戦目標であって、達成値ではない。** 同一条件の変更前後の release AAB
から device spec に対応する配布 / install size を測る。署名、ABI、density、language、
build variant、minify、version、使用した bundletool / SDK と計測手順を残す。
別アプリ PoC の APK と製品 APK の差は、製品導入時の増分の代用にしない。

同じ基準 commit から baseline と組込候補を用意し、同じ release 設定（R8 / resource shrink
を含む）・同一テスト署名で AAB → device APK set を作れば、製品の release key なしでも
事前評価できる。`bundletool get-size total` は配布サイズの推定 min / max であり、install size
ではない。現在の未着手項目は候補に含める UI / protocol / native 権限の組込範囲、比較 AAB ペアと
測定スクリプトの用意であり、製品の署名鍵の入手を待ち条件にはしない。

測定準備として、既存 Gradle cache の bundletool 1.18.1 で A2 の device spec を取得した
（`arm64-v8a`、density 480、API 37）。保存先は PoC の
`measurements/device-spec-pixel9pro-api37.json`（gitignored）。GL extension 取得の warning が
出ている。これは実機構成の取得であり、release 配布差分 / install size の計算・実測は未実施。

| 測定対象 | 基準 commit / 値 | 変更後 commit / 値 | 差分・判定 |
| --- | --- | --- | --- |
| release AAB の同一 device spec 配布サイズ | 未測定 | 未測定 | 未測定 |
| 同一 device の install size | 未測定 | 未測定 | 未測定 |
| universal APK (補助値) | 未測定 | 未測定 | 未測定 |
| 起動時間 / メモリ / 電池 | 未測定 | 未測定 | 未測定 |

Web gzip、debug APK、ソースコード行数を配布サイズとして示さない。目標超過なら
依存・resource・native code の内訳、軽量化案、品質への影響を記録して採否を判断する。

## 未完了の release gate

- Phase 0 の実機台帳を確定する。
- Phase 1 の BLE / LAN 実測、低価格端末、advertising 非対応の fallback、サイズを確認する。
- wire v2 の L3 は通常 Wi-Fi の一局・再戦・途中 state の ACK timeout を確認済み。BLE の完走、初期 / 最終 ACK 欠落、v1 混在拒否・不正 ACK の実機確認を行う。無通信 idle と次操作後の検知は分ける。
- Phase 2 の WAN なし LAN を完走する。BLE での iOS 側 background・画面ロック・無線 OFF・不正操作等の未試験条件と、OS 資源の全解放を確認する。
- 製品向けの接続保護・プライバシー説明、権限文言、多言語、accessibility、入口を設計・検証する。
- 通常製品・Web への混入ゼロ、ソロ / CPU 戦、保存、lazy-load / size gate を確認する。
- Phase 3 の別ゲーム・3〜4 人を段階的に検証する。未検証の組み合わせを公開文面へ書かない。

## 自動検証・ビルド記録

2026-10-25、基準 `6dd795fc` から作成した `codex/nearby-multiplayer-poc` の変更で実施。
環境は macOS、Node 25.5、pnpm 10.34.5、Java 21、Android SDK 36、Xcode / iOS SDK 26.4。
実機 matrix の欄は下記の自動テストやコンパイル結果で埋めない。

| チェック | 結果 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 成功。製品の依存・lockfile の変更なし。 |
| `pnpm lint` / `pnpm typecheck` | 成功。 |
| `pnpm nearby:check` | 初回は型検査・26 テスト・PoC bundle 作成に成功。wire v2 `418bda04` では state ACK / timeout 等を含む 40 テスト・型検査・build が成功。確認 / Ready / 一局 / 再戦、重複・古い操作、接続イベント順序、古い非同期処理、Web 非対応を検査。 |
| `pnpm nearby:test-android` | 初回 304 checks 成功（framing 165、権限待ち lifecycle 11、CCC 前の notification 128）。L2 の Android NSD 修正時に service type の 54 checks を追加し、合計 358 checks 成功。無線の試験ではない。 |
| Yacht と import boundary の既存テスト | 11 files / 168 tests 成功。 |
| `pnpm build` / `pnpm --dir apps/simple-games build:web` | 成功。 |
| `pnpm nearby:isolation` | 製品ソース・両 bundle・native manifest 等、4012 files で混入なし。 |
| 既存 `size:check` / 広告分離 / brand principles gate | 成功。Web bundle の既存 gate であり、Android 配布サイズの実測ではない。 |
| `pnpm nearby:prepare android` → `:app:assembleDebug` | 別 app ID の debug APK を生成。 |
| `pnpm nearby:prepare ios` → unsigned `xcodebuild` | 別 app ID、generic iOS / arm64 のビルド成功。インストールや実機接続の証明ではない。 |
| Android NSD 修正 `9b007638` の検証 | 358 native checks、全 native Java の `javac`、Android debug Gradle build（offline、9 秒）、isolation 4012 files が成功。独立レビューで追加指摘なし。9 秒は当該ビルドの観測値であり、製品性能の測定ではない。 |
| wire v2 `418bda04` の build / 導入 | Android APK と iOS 署名付きアプリの build・install 成功。両端末で `index-CII7kdaW.js` をロードしたことを確認。独立レビューで追加指摘なし。実機の一局 / 異常系の成功とは分ける。 |

初回の接続端末一覧では Android は未接続、登録済み iPhone は unavailable だった。
同日後続の確認で A2 / I2 の接続と OS を確認した。以下は自動テストとは別の実機記録である。
再現手順は [PoC README](../../apps/simple-games/prototypes/nearby/README.md) を参照。

## 実機記録 — 2026-10-25

A2 の B1 / B2 / B3 / L1 と L2 の初回までは、同じコード `1131072b` から作成した同じ
PoC debug APK で実施した。L2 の再試験から Android だけ `9b007638` へ更新した（下記）。
この節の B1〜L2 は両端末とも wire v1。後続の wire v2 の再試験とは別の証拠である。
ログの秒数はアプリ内の相対時刻であり、発見・接続遅延の測定値ではない。

| 端末 / 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| A2 / PoC インストール・起動 | `com.pixapps.nearbypoc`、target 36 の debug APK をインストールし、MainActivity を起動。OS の `am start` 表示は 450 ms。 | 単発の起動操作の値。一般的な起動性能、cold start の分布、製品との差分の基準にはしない。 |
| A2 / 初回権限 | Bluetooth CONNECT / SCAN / ADVERTISE はすべて `granted=false`。 | 利用時要求の前の状態を確認。 |
| A2 / Capabilities | `bleSupported=true`、`canAdvertise=true`、`bluetoothEnabled=true`、`availabilityKnown=false`。権限 prompt なし。 | API の返した capability 値。advertising の開始成功や相手からの発見を示さない。 |
| A2 / 明示 Start browse | Nearby devices 権限ダイアログを観測。利用者の許可後に SCAN / CONNECT は `granted=true`、ADVERTISE は `granted=false`。画面に `BLE discovery started` を表示。 | 権限取得と探索開始まで。相手の発見・接続・双方向 message は未実施。機内モード / Wi-Fi OFF 条件の証拠にはしない。 |
| A2 / browse timeout | ログ 191.44 s に探索開始、251.45 s に `discovery-timeout`（60.01 s）。`startDisabled=false` / `setupHidden=false` となり再試行画面へ戻った。 | 1 回の探索期限と UI 復帰を確認。相手の発見、接続品質、接続後の timeout の証拠ではない。 |
| A2 / 明示 Start advertise | ログ 283.38 s に実機 callback から `BLE advertising started (60-second limit)` を表示。 | capability 値とは別に待受け開始を確認。iPhone 等の相手からの発見・接続は未実施。advertise 自体の 60 秒 timeout はこの試行では確認していない。 |
| A2 / 接続前の background・復帰 | advertise 待受け中、ログ 341.15 s に ADB HOME で background へ移した。`status=background` で開始可能な状態に戻り、`am start` の前面復帰後も同じ状態・ログ追加なし。 | 待受け中の UI 終了と自動再開なしを確認。対局中、iOS、画面ロック、無線の全資源解放の実証ではない。 |
| A2 / BLE 権限拒否・拒否後の再試行 | テスト準備で PoC だけの SCAN / CONNECT / ADVERTISE を ADB revoke。Start browse の OS ダイアログで「許可しない」を選び、`USER_FIXED` 付きの拒否状態を確認。ログ 11.60 s に `Error: Bluetooth permission denied`、`startDisabled=false` / `setupHidden=false`、探索開始ログなし。51.18 s の再試行も同じエラーで開始可能な状態へ戻った。 | 拒否したまま探索しないことと、拒否状態の再試行で行き詰まらないことを確認。接続中の権限取り消しの試験ではない。 |
| A2 / 拒否後の再許可・明示 Stop | PoC の `user-set` / `user-fixed` フラグを clear 後、通常の Start browse → OS の Allow を操作。ログ 464.35 s に `BLE discovery started`、iOS の準備を待つため 465.98 s に明示 Stop。 | OS ダイアログからの再許可と探索開始・明示停止を確認。相手の発見・接続はまだ未実施。 |
| I2 / 初回の接続・署名準備 | USB 接続、Developer Mode 有効を確認。署名ビルドは Xcode の `NoAccounts` と PoC 用 provisioning profile 不足で停止。 | 初回の停止理由として保持。unsigned build の成功とは分ける。 |
| I2 / 署名準備の再試行・導入 | 利用者が Xcode へサインイン後、生成した PoC の Signing で既存 team を選び、PoC 専用の Managed Profile を作成。CLI の署名付きビルド、`codesign` verify、`devicectl` の install / launch に成功。app ID は `com.pixapps.nearbypoc`。 | iPhone 11 / iOS 26.6.2 へのインストール・起動を確認。後続の開始操作は下記に分ける。個人名や team / profile の識別子は記録しない。 |
| I2 / Start 前の初回画面 | Xcode の Take Screenshot で実機画面を観測。Player / BLE / Advertise / Game host の既定値、Start 未操作で権限ダイアログなし。 | 初回画面の観測結果。Start 後の BLE 権限要求・advertising 開始や無線処理ゼロの実測ではない。 |
| A2 / I2 / BLE 試験の設定 | 利用者が両端末の機内モード ON / Bluetooth ON / Wi-Fi OFF を完了したと回答。A2 は ADB の設定値でも順に `1 / 1 / 0` を確認。 | I2 の設定は本人の回答による確認。設定完了を相互接続成功とは扱わない。 |
| I2 / Web Inspector 接続 | 利用者の Web Inspector ON の回答後、Safari から PoC の Inspector へ接続成功。DOM 上の入力を `iPhone` / `ble` / `advertise` / `host=false` に準備した。 | PoC の画面操作の準備を確認。Bluetooth 相互接続の証拠ではない。 |
| A2 / I2 / B1 開始準備中の timeout | 両端末で Start。I2 は `Starting` と一時的な radio label を表示した後、60 秒で `TIMEOUT: Discovery expired; start again explicitly.`。A2 も `discovery-timeout` で開始可能な画面へ戻り、peers は空だった。 | iOS の advertising 開始は未確認。相手は発見できておらず、接続は未試行。iOS の OS Bluetooth ダイアログ自体を直接観測していないため、許可待ちは推測であり確定原因ではない。接続失敗率へ計上しない。 |
| A2 / I2 / B1 明示再試行・接続 | 利用者が iPhone の初回 Bluetooth 許可をしたと回答後、I2 advertise / game guest、A2 browse / game host で明示再試行。A2 が相手を発見し、UI で選択すると両端末が `Transport connected`。hello は A2 が TX 92 / RX 94 bytes、I2 が TX 94 / RX 92 bytes。 | 許可後の接続 1 回成功。準備中の timeout と区別し、他の role・端末・方式や長時間の安定性へ一般化しない。 |
| A2 / I2 / B1 相互確認 | 両画面のテスト用プレイヤー名 `Pixel` / `iPhone` と確認コードの一致を確認。両方の UI で Confirm を操作し、双方 `Confirmed`。 | 利用者の相互確認が成立。平文コードによる誤接続防止の試験であり、暗号化・本人認証・MITM 耐性の実証ではない。 |
| A2 / I2 / B1 双方向 ping | 1 KB payload（wire 1082 bytes）の ping を各方向 1 回実行。A2 起点の往復 5434 ms、I2 起点の往復 617 ms。pong は 69 bytes。 | この接続での双方向 message を確認。各方向 1 回の観測値であり、平均・分布・接続遅延・切断率・最大 4096-byte message の検証にはしない。 |
| A2 / I2 / B1 24 手番完走 | 両端末で 121 件の公開盤面（rev 0〜119 と Finished）を記録。各端末 60 回の UI click（12 手番 × roll → 最初の die を hold → roll → roll → score）で完走し、両端末の記録は `issues: []`。最終 28 対 35、iPhone 勝利の表示が一致した。 | 1 局の完走を確認。後続の記録回収と比較検査で、全 121 公開 DOM 盤面の一致も確認した（下記）。 |
| A2 / B1 記録の保存・時刻 | 全 JSON を PoC の `build/measurements/android-b1.json` に保存。helper 開始は 03:53:51.148 UTC、自動操作開始 03:54:46.061 UTC、終局 03:58:09.567 UTC。helper 開始から初期 rev 0 は 31.359 秒後、終局は 258.419 秒後。 | ローカルの試験記録。相対時刻は Android 側の時間のみで、端末間の同期や通信遅延を示さない。iOS の全 JSON は一時 CUA / Safari timeout で回収できなかったが、後続の USB 回収で解消した。 |
| A2 / B1 終局後の無操作・無線設定 | 04:01:14.935 UTC にも `Confirmed` / `Finished` / Ready enabled を確認。終局から 3 分以上の無操作で状態を維持し、log 末尾に追加 ping 等なし。Android の機内モード / Bluetooth / Wi-Fi 設定値も `1 / 1 / 0` を再確認した。 | この接続で終局後の無操作により timeout しなかったことを確認。長時間の安定性、background、全通信の capture、電池測定の証拠ではない。 |
| I2 / B1 記録の USB 回収 | Safari の PoC Inspector だけを閉じると、loopback / USB の検証 helper が応答。iOS の全 JSON を PoC の `build/measurements/ios-b1.json` へ回収できた。 | 実機の公開 DOM 記録の回収。PoC runtime に保存・送信機能を追加したものではない。 |
| A2 / I2 / B1 全公開盤面の比較 | `compare-ui-trials.py` が PASS、13,158 checks、errors なし。rev 0〜119 と最終盤面の 121 / 121 件が一致し、24 手番・各端末 60 actions（計 120）・最終 28 対 35 を確認。比較結果は PoC の `build/measurements/b1-comparison.json`。 | 回収した公開 DOM 盤面と記録した DOM 操作の照合。端末時刻・一方向の通信遅延・非公開の内部状態の比較は含まない。 |

両端末の正規化した公開盤面列の SHA-256 は共通で、
`9a1d89262c0007c2497edf10714e327573689e8fba05ac7e3e05e5114fb8554f`。
この B1 比較対象は runtime `1131072b` の実機記録。B2 / B3 / L1 も同じ runtime であり、
後続の L2 再試験での Android runtime 更新とは分ける。
検証用 helper で取得したローカル記録は生成物であり、PoC 本体の保存機能ではない。

### B2 — game host を iPhone に交替

| 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| 相互確認と初回 Ready | I2 は advertise / game host、A2 は browse / guest。日本語表示名 `iPhone 主催` / `Pixel 参加` とコードの一致を確認し、双方 Confirm。iPhone だけ Ready の時点では双方 game hidden、Android も Ready にすると開始した。 | 無線 role を保ったまま論理 host を交替でき、片方の Ready だけではゲームを始めないことを確認。 |
| 24 手番・全公開盤面の比較 | `android-b2.json` / `ios-b2.json` を PoC の `build/measurements/` に保存。`b2-comparison.json` は PASS、13,158 checks、errors なし。各端末 60 actions（計 120）、24 手番、rev 0〜119 と最終盤面の 121 / 121 件が一致し、51 対 34・iPhone 勝利。Android の無線設定も `1 / 1 / 0` を再確認した。 | B2 の 1 局の公開 DOM 盤面と記録した DOM 操作を確認。端末時刻・通信遅延・非公開内部状態の比較ではない。 |
| 再戦の Ready | iPhone だけ Ready 後も両端末は Finished・51 対 34 を維持。Android も Ready にすると双方 rev 0、0 対 0、結果は空、filled 0 に戻り、host だけ Roll enabled。iPhone の Roll 後、双方 rev 1・出目 `1, 6, 1, 1, 1` が一致。 | 双方の明示 Ready による新しい局の開始を確認。この再戦は 24 手番完走の件数へ加えない。 |
| 対局中の Android background / 復帰 | 04:32:24 UTC ごろ、初回 Roll 後に Android を HOME へ移した。Android は visibility hidden / status background / Session ended / Roll disabled / Start enabled。iOS は peer-disconnected / Session ended / Roll disabled / Start enabled。Android を `am start` で前面へ戻すと visible になり、status とログ末尾の background は変わらず、自動再開なし。 | Android 側の background で両者の session が終了することを確認。BLE での iOS 側 background・画面ロック・OS 資源の全解放・電池は未実証。 |

B2 の両端末の正規化した公開盤面列の SHA-256 は共通で、
`218482b5a9283813c060018247ae0c4c1e4f1859792f57145db84212927c1dad`。

### B3 — Android を advertise に交替した部分試験

| 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| 発見・接続・相互確認 | A2 advertise / game host、I2 browse / guest。A2 の Start では通常の権限ダイアログは出ず、`BLE advertising started` を確認。I2 の候補 1 件の発見名は `SG-BLE` で、Android 画面の一時的な radio label とは表示が一致しなかった。候補選択後、双方 `Transport connected`。プレイヤー名 `Pixel` / `iPhone` と確認コードの一致を確認し、双方 Confirm。 | この試行では無線の発見名と画面の radio label が一致しなかった。表示名だけで確認完了とせず、接続後に双方のプレイヤー名・コードを確認した。表示差の原因はこの観測だけから断定しない。 |
| 双方向 ping | 1 KB payload（wire 1082 bytes、pong 69 bytes）を各方向 1 回実行。Android peripheral 起点の往復 444 ms、iOS central 起点の往復 3331 ms。 | この接続での各 1 回の観測値。平均・分布・接続遅延や端末一般の性能にはしない。 |
| Ready・手番をまたぐ進行 | 双方 Ready 後、Android Roll で双方 rev 1・出目 `2, 6, 3, 1, 3`。最初の採点欄の選択で rev 2・Pixel 1 点。iPhone guest の Roll 後、双方 rev 3・出目 `2, 3, 2, 1, 1`・合計 1 対 0 が一致。 | host と guest の手番をまたぐ部分進行を確認。B3 は 24 手番完走の件数へ加えない。 |
| iPhone の明示 End | iOS の End ボタンで iOS は `Ended locally`、Android は `connection-lost: BLE peer disconnected`。両端末が Session ended / Start enabled / Roll disabled になった。 | 相手の明示退出で双方の session が終了し、対局操作を停止することを確認。OS 資源の全解放やアプリ強制終了の試験ではない。 |

実装の確認では、iOS の探索名は best effort で、有効な label を最初の発見時に取得できないと
`SG-BLE` に fallback する。現在は後続の発見による候補名の更新も行わない。この試行で label を
取得できなかった理由が OS の省略か受信タイミングかは未確定。接続後のプレイヤー名・確認コードを
双方で確認し、探索名だけを本人確認に使わない。複数 peer の識別と名前更新の UX は製品化前の課題。

### L1 — 通常 Wi-Fi の補助 LAN 試験（24 手番・全公開盤面の一致を確認）

| 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| 条件と権限準備 | 利用者が両端末を同じ通常 Wi-Fi へ接続し、iPhone の Local Network を許可したと回答。Android の機内モード / Bluetooth / Wi-Fi の raw 設定値は `1 / 1 / 2`。UI transport は `lan`、native の LAN 開始も確認。前の PoC BLE session は End 済み。 | WAN 遮断操作なし。Bluetooth は ON のままだが、試験は明示選択した LAN adapter で実施。Wi-Fi の raw 値 `2` は機内モード override の値として記録し、`1` へ書き換えない。WAN なし動作の証明ではない。 |
| 初回の準備中 timeout | Android がまだ開始していない状態で iOS browse のみを開始し、権限準備中に 60 秒 timeout。 | 相手の準備前で接続は未試行。接続失敗率に計上せず、許可後の両端末での試行と区別する。 |
| 明示 Start・接続・相互確認 | 許可の回答後、04:49:09 UTC に A2 LAN advertise / game host、04:49:10 UTC に I2 LAN browse / guest で Start。iOS で発見した候補を選択し、双方 `Transport connected`。`Pixel` / `iPhone` と確認コードの一致を確認して双方 Confirm。 | 通常 Wi-Fi 上の接続・相互確認を確認。無線名・確認コードそのものは記録しない。 |
| 双方向 ping | payload 1000 bytes（wire 1082 bytes、pong 69 bytes）を各方向 1 回実行。A2 起点の往復 210 ms、I2 起点の往復 227 ms。 | 各方向 1 回の観測値であり、性能分布や WAN なし条件の証拠ではない。 |
| Ready・24 手番・全公開盤面の比較 | 双方 Ready 後に 24 手番を完走し、`android-l1.json` / `ios-l1.json` を PoC の `build/measurements/` に保存。`l1-comparison.json` は PASS、13,158 checks、errors なし。両端末の記録は `issues: []`。各端末 60 actions（計 120）、rev 0〜119 と最終盤面の 121 / 121 件が一致し、41 対 37・Pixel 勝利。 | 通常 Wi-Fi で 1 局の公開 DOM 盤面と記録した DOM 操作を確認。WAN なし条件、端末時刻、通信遅延、非公開内部状態の比較は含まない。 |
| 再戦の Ready | 双方 Ready で rev 0 に戻り、Android host の Roll 後、双方 rev 1・出目 `6, 2, 3, 3, 3` が一致。 | 新しい局の開始と初回 Roll の同期を確認。この再戦は 24 手番完走の件数へ加えない。 |
| 対局中の iOS background / 復帰 | 設定変更は行わず、`devicectl` の activate で iPhone の Settings を前面にした。PoC が background になり、Android は LAN peer closed / Session ended / Roll disabled / Start enabled。PoC を再び activate 後、iOS は visible / status background / Session ended / Start enabled / Roll disabled で自動再開なし。`ios-l1-lifecycle.json` に hidden 04:53:31.719 UTC → visible 04:53:51.482 UTC のイベントを保持。 | LAN 接続での iOS background による両者終了を確認。メモリ内の検証 global / イベント列は保持したが、厳密な `sameDocument` 判定は false（timeOrigin 差 -1 ms）。PID は照合しておらず、同一 PID の証明にはしない。BLE での iOS background、画面ロック、OS 資源の全解放、電池測定の証拠ではない。 |

L1 の両端末の正規化した公開盤面列の SHA-256 は共通で、
`ba02d4df6440d2b865daa3fdebdf81ff116496e1c470de02c5582a53628ce708`。

### L2 — 通常 Wi-Fi で LAN の advertise / browse を交替（NSD 修正後に完走、v1 の切断問題を記録）

| 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| 旧 runtime の明示 Start・接続試行 | runtime `1131072b` で、04:54:39 UTC に iOS LAN advertise / game host、04:54:44 UTC に Android LAN browse / guest を開始。Android が候補を発見して選択すると `invalid-peer: Resolved peer is outside selected Wi-Fi subnet`。iOS は未接続。 | L2 の接続失敗 1 回として記録する。複数の validation が同じエラー文言を返すため、この表示だけで実際の IP が別 subnet にあるとは断定しない。L1 の完走記録はそのまま保持する。 |
| 原因調査・修正 | AOSP の resolve 結果に現れる先頭 dot 付き service type を、Android adapter の旧 `normalizeType` が処理していないコード上の欠陥を確認。`9b007638e353902791cfb3e63300f6085d3bedac` で `NsdServiceType` helper と 54 regression checks を追加した。 | 旧実機試行の raw service type は未収集。正規化のコード欠陥と修正後の同条件での成功は確認したが、旧試行で失敗した生の値を取得したとは主張しない。 |
| Android APK 更新 | SHA-256 `11c157a6d9dbd28d3785fca3fe860a062c93232bd652aab2a2599dc14a809b78` の修正済み debug APK を A2 へ `-r` 更新。I2 は runtime `1131072b` を維持。 | L1 等の旧 runtime の結果を新 APK の再検証扱いにしない。 |
| 再試験の発見・接続・相互確認 | 同じ通常 Wi-Fi と通信 role で明示再試行。Android が候補を発見・選択後、接続に成功。両端末の `Pixel` / `iPhone` と確認コードが一致し、双方 Confirm。 | L2 の修正後の接続成功 1 回。WAN なし動作、他の端末 / OS、安定性の実証ではない。初回の接続失敗 1 回は保持する。 |
| 再試験の双方向 ping | payload 1000 bytes（wire 1082 bytes、pong 69 bytes）を各方向 1 回実行。A2 起点の往復 237 ms、I2 起点の往復 165 ms。 | この接続での各 1 回の観測値。性能分布や接続遅延の測定にはしない。 |
| Ready・24 手番・全公開盤面の比較 | `android-l2.json` / `ios-l2.json` を PoC の `build/measurements/` に保存。`l2-comparison.json` は PASS、13,158 checks、errors なし。各端末 60 actions（計 120）、24 手番、rev 0〜119 と最終盤面の 121 / 121 件が一致し、iPhone 23 / Pixel 26・Pixel 勝利。 | 修正後の runtime の組み合わせで 1 局の公開 DOM 盤面と記録した DOM 操作を確認。WAN なし条件や異常系の成功を示さない。 |
| 再戦・Android Wi-Fi OFF | 再戦の rev 1・出目 `2, 3, 6, 2, 5` が両者で一致後、Android guest を visible のまま `svc wifi disable`。Android は `connect-failed: LAN connection failed: SocketException` / Session ended / Roll disabled / Start enabled。iOS host は 60 秒以上 Confirmed / Roll enabled / rev 1 を維持した。`android-l2-wifi-off.json` / `ios-l2-wifi-off.json` に保存。 | v1 での異常系の不具合として保持。Android の終了だけを合格扱いにしない。期限付き state ACK の v2 修正は導入済みで、実機での改善確認は L3 へ分ける。 |
| Wi-Fi の復元 | `svc wifi enable` で Wi-Fi を戻し、Android の raw 設定値 `1 / 1 / 2` を確認。Android は Session ended のままで自動再開しなかった。 | Wi-Fi 復元と Android 側の自動再開なしを確認。iOS 側が正しく終了した証拠にはしない。 |

L2 の両端末の正規化した公開盤面列の SHA-256 は共通で、
`8ac0b3d7e63e89736e4ce290bf564d4524740a2ef3d0b610a0a12aa0cabdd96e`。

### L3 — wire v2 導入後の通常 Wi-Fi LAN 試験（24 手番・全公開盤面の一致を確認）

| 操作 | 観測結果 | 証拠の範囲・未確認事項 |
| --- | --- | --- |
| 新 runtime の導入 | 両端末を `418bda04ffd9853c87bce561fcfb5c9ea9cc9169` の wire v2 へ更新。Android APK の SHA-256 は `d5c8d7f94091f87f73bc3a812d15c36267285a89e9feb39177d941e9d773327f`。Android / iOS の build・install に成功し、両端末で `index-CII7kdaW.js` をロード。 | 新 runtime を両端末へ導入した証拠。旧 v1 の試験結果と区別する。 |
| 一局・全公開盤面の比較 | 通常 Wi-Fi、iOS advertise / game host、Android browse / guest で 24 手番を完走。両端末は各 60 actions・121 records・`issues: []`。`android-l3.json` / `ios-l3.json` / `l3-comparison.json` を PoC の `build/measurements/` に保存。比較は PASS、13,158 checks、errors なし、rev 0〜119 と最終盤面の 121 / 121 件が一致。最終 iPhone 50 / Pixel 37、iPhone 勝利。 | wire v2 の初期 / 最終 state の ACK を経由した 1 局の公開 DOM 盤面と操作記録を確認。追加 ping はこの試行では未実施。WAN 遮断操作は行っていない。 |
| 再戦 | 双方 Ready で新しい rev 0 に戻ることを確認。 | 新しい局の開始を確認。この再戦は 24 手番完走の件数へ加えない。 |
| 切断後の状態 ACK | Android Wi-Fi OFF で Android は foreground を保ったまま SocketException により終了。その後の iOS Roll で pending / Roll・Ready disabled。iOS の同一 performance 時計で 16,837 ms（05:21:38.399 UTC）→31,846 ms（05:21:53.408 UTC）、差 15,009 ms で Command timeout / Session ended。さらに 12 ms 後に Start enabled。結果は空、Roll / Ready は disabled。 | 途中 state の ACK 未達で、次操作後に追加操作を止め期限付きで終了する 1 試行を確認。無通信 idle 中の即時切断検知、初期 / 最終 ACK 欠落の実機試験ではない。端末間の時刻差を遅延計算に使っていない。 |
| Wi-Fi 復元と記録 | Android Wi-Fi を ON へ復元。`ios-l3-wifi-off.json` / `android-l3-wifi-off.json` の保存時の current でも両端末は Session ended / Roll・Ready disabled / Start enabled を維持し、自動再開なし。 | 両端末の UI 終了と復元後の明示開始待ちを確認。OS 資源の全解放や全異常系の証明ではない。 |

L3 の両端末の正規化した公開盤面列の SHA-256 は共通で、
`ef7884ab0b5845a1962a32f17202834ea35e3e71b54adb297585fccb272e6a01`。

この記録時点では v1 の B1 / B2 / L1 / L2 と v2 の L3 を各 1 局完走し、それぞれ全 121 公開 DOM 盤面の一致を確認した。
再戦開始、BLE の Android 側と LAN の iOS 側の background による終了・自動再開なしも確認。
B3 は逆の無線 role で部分進行と iPhone の明示 End まで確認した。L2 は旧 runtime で接続に失敗し、
Android の修正後は同条件で接続・双方 Confirm・双方向 ping と一局完走に成功したが、
後続の Wi-Fi OFF で iOS host が終了しない不具合を観測した。wire v2 の L3 では新たな一局・再戦を
確認し、Wi-Fi OFF 後の次の host 操作から ACK timeout まで 15,009 ms で終了。両者自動再開なし。
v2 の BLE 完走、初期 / 最終 ACK 欠落の実機試験、B3 の完走、その他の BLE 組み合わせ、
WAN なし LAN、3〜4 台、未試験の異常系、OS 資源の全解放、消費電力、
release 配布 / install size は未実施。利用者が用意できたのは通常の Wi-Fi で、
WAN を切った実機 LAN gate は満たしていない。L1 / L2 / L3 の結果を WAN なし条件の代用にはしない。
端末所有者の個人名、serial / UDID、Wi-Fi 名、開発 Team ID、証明書 ID は記録しない。
