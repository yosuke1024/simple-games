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
| Phase 0 | Core の任意の近隣通信を許容する canonical の更新、公式資料、2 台の role と検証 matrix | 実機機種・OS の確定と実測。Phase 0 全体は一部未完了。 |
| Phase 1 | BLE / LAN native adapter、共通 framing、相互確認、手動の双方向 message 試験 | 実機接続、安定性、3〜4 台、電池、Android +500 KB の達成。 |
| Phase 2 | 既存採点を使う host 主導の 2 人 Yacht デモ | 実機での一局完走、製品 UI、多言語・accessibility、製品導入。 |
| Phase 3 | 必要な release gate の文書化 | Connect Four / Reversi への展開、3〜4 人検証、正式公開。 |

**Epic を close / complete にしない。** コードの自動検証と物理端末の試験結果を分ける。
ビルド・実行手順と自動チェック結果は、この文書末尾または PoC の README に追記する。

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

## 実機台帳 — 未実施

この作業では物理端末と OS の情報を確認できていない。欄を推測で埋めない。
エミュレータや Simulator の実行を Bluetooth 無線の実証にしない。

| ID | 機種 | OS / build | BLE advertising の実際の結果 | 備考 |
| --- | --- | --- | --- | --- |
| A1 | 未確認 | 未確認 | 未確認 | API 24–30 の旧権限世代を含める。 |
| A2 | 未確認 | 未確認 | 未確認 | API 31+ と現行 OS。少なくとも 1 台は低価格 Android。 |
| A3 | 未確認 | 未確認 | 未確認 | advertising 非対応の実機が必要。模擬失敗だけで代用しない。 |
| I1 | 未確認 | 未確認 | 未確認 | iOS の最小サポート付近。 |
| I2 | 未確認 | 未確認 | 未確認 | 現行 iOS。 |
| AP1 | 未確認 | firmware 未確認 | 対象外 | WAN を外せる同一 LAN、AP isolation を切替できるもの。 |

実施時は app commit、app ID、build variant、権限の初期状態、位置情報設定、Bluetooth /
Wi-Fi の ON/OFF、周囲の電波条件、試行数を併記する。現在の baseline は Android minSdk 24 /
targetSdk・compileSdk 36、iOS deployment target 15.0。target 37 に上げる際は Android 17 の
`ACCESS_LOCAL_NETWORK` と NSD picker の選択を再確認する。

## 接続と対局の matrix — 全行未実施

BLE 条件は **機内モード ON、Bluetooth 明示 ON、Wi-Fi OFF、インターネットなし**。
LAN 条件は **同一 Wi-Fi、WAN / インターネットなし**。機内利用は航空会社・乗務員の指示に従う。

| ID | 方式 / 組み合わせ | 通信ロールと論理 host | 必須の確認 | 結果 |
| --- | --- | --- | --- | --- |
| B1 | BLE Android ↔ iOS | iOS advertise / Android browse、game host は Android | 発見、両者確認、双方向、大きな message、一局 24 手番 | 未実施 |
| B2 | BLE Android ↔ iOS | B1 と同じ通信ロール、game host は iOS | host と無線 role の独立 | 未実施 |
| B3 | BLE Android ↔ iOS | Android advertise / iOS browse | Android peripheral の対応端末 | 未実施 |
| B4 | BLE Android ↔ Android | 成功する側が advertise、game host を交替 | 両方向、旧/新 OS、低価格機 | 未実施 |
| B5 | BLE Android ↔ Android | 片方 advertising 非対応 | advertise 可能な相手を使う手動 fallback | 未実施 |
| B6 | BLE Android ↔ Android | 両方 advertising 非対応 | BLE 不可を説明し、LAN / 終了を選べる | 未実施 |
| B7 | BLE iOS ↔ iOS | advertise / browse を交替 | 最小付近 / 現行 OS、両方向、一局 | 未実施 |
| W1 | LAN Android ↔ iOS | listen / browse と game host を交替 | WAN なしの発見、双方向、一局 | 未実施 |
| W2 | LAN Android ↔ Android | listen / browse を交替 | 同 OS、一局 | 未実施 |
| W3 | LAN iOS ↔ iOS | listen / browse を交替 | 同 OS、一局 | 未実施 |
| W4 | LAN AP isolation / multicast 制限 | W1 の同じ設定 | timeout、説明、退出、資源解放 | 未実施 |
| M1 | BLE 3〜4 台 | 今回の PoC 対象外 | 後続 spike で topology・接続上限を判断 | 未実施 / 未対応 |

各成功行にも、発見時間・接続時間の分布、試行数 / 成功数、切断回数、連続動作時間、
メモリ、電池の測定条件を記録する。平均だけで成功扱いにせず、失敗の OS / role と再現手順を残す。

## 権限・異常・lifecycle の matrix — 全行未実施

| 条件 | 期待する結果 | 結果 |
| --- | --- | --- |
| 初回起動、Nearby を開始しない | 権限要求・探索・広告・接続をしない | 未実施 |
| BLE 権限拒否 / 取り消し | 接続を始めず / 終了し、再試行か退出を選べる | 未実施 |
| Android API 24–30、位置情報拒否 / OFF | 原因を区別できる範囲で説明し、待ち続けない | 未実施 |
| iOS LAN 権限拒否 / 再許可 | 許可待ちと権限拒否・timeout を扱い、明示再試行できる | 未実施 |
| OS 権限ダイアログ | 通常の background 終了と区別して、許可後の操作が行き詰まらない | 未実施 |
| Bluetooth OFF / 相手が離れる / 相手のアプリ終了 | session 終了。古い操作を再適用しない | 未実施 |
| Wi-Fi 切断 / ネットワーク変更 | TCP と discovery を閉じ、局を勝手に移行しない | 未実施 |
| background / 画面ロック / 復帰 | session 終了。復帰時に自動接続・再開をしない | 未実施 |
| 同名の相手、別セッション、確認拒否 | 相手を確認でき、両者確認前に局を始めない | 未実施 |
| 不正 JSON / UTF-8、4096 bytes 超過、不完全 frame | 上限を超えて蓄積せず、安全に終了 | 未実施 |
| 日本語・分割・連結・最大長 message | BLE / TCP の read 境界によらず 1 message として復元 | 未実施 |
| 重複 / 古い revision / 順序逆転 / 手番外 command | RNG・得点・手番を誤って進めない | 未実施 |
| 2 人で Ready / 再戦 | 両者の Ready で新 round。前 round の操作を採用しない | 未実施 |

## Android 配布サイズと性能 — 未測定

**+500 KB は初期の挑戦目標であって、達成値ではない。** 同一条件の変更前後の release AAB
から device spec に対応する配布 / install size を測る。署名、ABI、density、language、
build variant、minify、version、使用した bundletool / SDK と計測手順を残す。
別アプリ PoC の APK と製品 APK の差は、製品導入時の増分の代用にしない。

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
- Phase 2 の 2 台 Yacht を両方式で完走し、切断や不正操作で進行が壊れないことを確認する。
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
| `pnpm nearby:check` | 型検査・26 テスト・PoC bundle 作成に成功。確認 / Ready / 一局 / 再戦、重複・古い操作、接続イベント順序、古い非同期処理、Web 非対応を検査。 |
| `pnpm nearby:test-android` | 304 checks 成功（framing 165、権限待ち lifecycle 11、CCC 前の notification 128）。無線の試験ではない。 |
| Yacht と import boundary の既存テスト | 11 files / 168 tests 成功。 |
| `pnpm build` / `pnpm --dir apps/simple-games build:web` | 成功。 |
| `pnpm nearby:isolation` | 製品ソース・両 bundle・native manifest 等、4012 files で混入なし。 |
| 既存 `size:check` / 広告分離 / brand principles gate | 成功。Web bundle の既存 gate であり、Android 配布サイズの実測ではない。 |
| `pnpm nearby:prepare android` → `:app:assembleDebug` | 別 app ID の debug APK を生成。 |
| `pnpm nearby:prepare ios` → unsigned `xcodebuild` | 別 app ID、generic iOS / arm64 のビルド成功。インストールや実機接続の証明ではない。 |

接続端末の読み取りでは `adb devices -l` に端末なし。`xcrun devicectl list devices`
の登録済み iPhone は unavailable で、実行時 OS と通信動作を確認できなかった。
端末へのインストール・Bluetooth / LAN 試験・実配布サイズ計測は未実施のまま。
再現手順は [PoC README](../../apps/simple-games/prototypes/nearby/README.md) を参照。
