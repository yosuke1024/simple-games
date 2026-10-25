# Nearby Multiplayer — 近隣端末間対戦の契約

Updated: 2026-10-25 / issue #268

この文書は近隣端末間対戦の製品契約と検証条件の正本であり、旧通信 PoC の記録も分けて保持する。
上位原則は [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Nearby Play」、
オフラインの範囲は [OFFLINE_POLICY.md](../OFFLINE_POLICY.md)、Yacht の規則は
[YACHT_RULES.md](../YACHT_RULES.md) §13。進捗と実測結果は
[作業記録](../plans/2026-10-25-nearby-multiplayer-poc.md)へ記入する。

## 製品 Nearby Play の契約（2026-10-25 採用）

オーナーの実装指示により製品へ導入し、1.5.1 の実機フィードバック後に継続動作と
ゲームを起点とする導線を改定した。以下は採用した製品契約であり、この新設計を出荷済み・
実機検証済みとは扱わない。1.5.1 で確認した範囲は下に記す。
旧PoC記録の「製品へ導入しない」「保存しない」「前面限定」は当時の状態であり、現在の製品契約ではない。

- native の対応ゲームtopに「誰かと遊ぶ」を置き、近くの相手とBluetooth／同一Wi-Fiで遊ぶことを
  短く補足する。最初はYachtだけ。コレクションの独立Nearby入口を削除し、Club Houseからも
  開始しない。未対応ゲームには未実装のボタンを出さない。
  ゲームはシェルから渡されたcallbackを呼び、`src/app/nearbyGate.ts` からだけ動的に
  `src/nearby/` を読み込む。ゲームからNearbyをimportしない。
  Web buildでは入口もchunkも除く。未利用時の探索・権限要求・履歴読取は無い。
- 初期範囲2人、Bluetooth優先／同一LANを明示選択。host=advertise/listen、参加者=browse。
  ゲーム選択済み → 募集／参加 → 表示名で申請 → host承認 → 双方Ready → 既存と共通のゲーム画面。
  初回に同じゲームを改めて提案する操作を求めない。内部protocolの提案・確認は維持でき、
  同時に同じroundを提案した場合は1件へ合流して既存のReadyを消さない。参加前自由コメント無し。
- シェルの `App` は接続を所有する `NearbyRoot` とcontrollerをマウントしたまま保持する。
  ゲームtopへ戻ると `visible=false` で非表示にし、同じ入口から同じ対戦へ戻す。
  通常ゲーム画面のアンマウントや会話を閉じる操作では切らず、新しい集まりを重複開始しない。
  非表示中のNearby画面では入力・キーボード・戻る操作のリスナーやアニメーションを無効化し、
  接続と論理状態を保持する。明示退出／解散で接続を終了するほか、`NearbyRoot` 自体の
  最終アンマウントでは停止・資源解放する(エラー／reset／アプリ終了時のcleanup)。
  一時切断や終了条件の詳細は下記に従う。
- ゲームが主で、チャットは「会話」ボタンから任意に開く。ゲームと同格のタブにはしない。
  受信で会話を自動表示しない。終局後は結果と再戦を主にし、接続を保持して双方Readyで再戦する。
  将来は同じ相手と別ゲームへ続けられる構成とするが、今回はYachtのみで、ゲーム切替機能は含めない。
- 仲間／公開の発見labelは `F-` / `P-` + ランダム6桁hex。個人名を広告に含めない。
  どちらもhost承認必須。labelは公開される番号で、招待秘密や本人証明ではない。
- native plugin名 `NearbyPlay`。BLE UUIDは `9b5d2000/2001/2002-7a4c-4e13-a280-75d53c01a268`、
  Bonjourは `_sgnearplay._tcp`。PoCと混在させない。native最大4096 UTF-8 bytes + LF、20byte BLE。
- アプリ間の鍵交換は WebCrypto P-256 ECDH、HKDF-SHA-256、方向別AES-256-GCM。
  物理接続ごとに新しい鍵を作り、ciphertextの通番を単調増加で照合し、暗号文の再送／改変を拒否。
  初回鍵交換のHKDFから方向別暗号鍵とは別にHMAC-SHA-256継続鍵を導出し、
  nonextractable CryptoKeyとしてその集まりのメモリ内だけに保持する。ディスクへは保存しない。
  暗号化前JSONは最大2800 bytes。交換した公開鍵の順序付きhashから6桁の比較コードを表示する。
  比較コードは誤接続確認の補助。公開鍵の commitment 段階がない短縮hashなので、
  **コードが一致しても本人認証・能動的な中間者攻撃への耐性は保証しない**。
  仲間同士はコードも見比べるが、認証済み／安全な相手などとは表示しない。
- room wire v4（v3/1.5.1とは混在不可）。helloに表示名・host/guest・sessionnonce・ローカルブロック用install ID。
  hostのadmissionとguestのadmission-ack完了前はチャット・Ready・対局操作を認めない。
  install IDは端末内に作るランダム値で、OS識別子を使わずサーバーへ蓄積しない。
  ブロックはそのIDだけを対象とし、再インストール／改造で回避できる。
- チャットはUnicode160文字、制御文字／双方向制御／不正surrogate拒否。各方向1件だけ
  未ACKで送信できる。独立したchat seq/ACKで受信済みを示し、既読とは呼ばない。
  送受合計1000件で接続終了。チャットACKでstateのpendingを解除しない。
- Yachtの合法手・乱数・採点はhostが確定。初期／各操作／最終stateのACKを待つ旧v2の
  契約を継承する。host終局はACK待ち、guestは検証済み終局受信で確定。host改造耐性は無い。
- 探索60秒、接続／鍵交換15秒、承認待ち60秒。helloで相手が定まる前の失敗や承認待ちの期限超過は終了する。
  承認後のstate/chat/admission ACK各15秒とdeliveryの最古未ACK15秒は、物理切断と同様に
  継続待ちへ移る。無関係なメッセージで期限を延ばさない。backgroundではタイマーを止める。
- `delivery.ts` は承認・提案・Ready・操作・state・chatの全メッセージをseq/累積ACKで包み、
  最大64件の未確認outboxを保持する。新しい物理接続へ同じ論理メッセージを再送し、
  適用済みseqは再適用せずACKだけ返す。出目・採点・チャットの重複を防ぎ、提案やReadyの
  片方向欠落も15秒で検出する。暗号化は再接続ごとに新しい鍵・通番で行う。
- 一時中断はSessionをendせずsuspendし、盤面・キープ・手番・pending・履歴IDを保持する。
  前面で同じlabelを再発見し、初回の継続鍵で新しいECDH transcript hash＋送信者roleへ
  HMACしたproofを双方確認してからdeliveryを再開する。label一致だけで再参加を認めない。
  前のproofの再利用・別の鍵・role反射は拒否する。初回の本人認証限界は改善したと主張しない。
- Androidは明示開始中だけprivateなconnectedDevice foreground serviceと静かな状態通知を使う。
  iOSはbluetooth-central/peripheral背景モードを使う。非アクティブ時のnativeイベントは
  64件/256KiBまでFIFO保持し、復帰時にFIFO→lifecycle trueで渡す。超過時は物理接続を閉じ、
  復帰後に継続待ちへ渡す。JSデータbacklogは64件まで、lifecycleは未解決sendに塞がれない
  制御経路で扱う。古い物理接続世代の処理は新しい世代の受信キューを塞がない。
- 背景に移ったこと自体では明示切断しないが、OSの無制限実行は保証しない。特にiOS背景の
  peripheral広告はAndroidから再発見できない場合があり、新しい再接続試行は前面で行う。
  前面復帰時に1回だけ疎通確認を送る。周期heartbeatは行わず、無操作の片側だけが切断を
  検知した場合の相手の即時検知は保証しない。実際のOS切断通知は実機で確認する。
  LANの背景維持も保証しない。プロセス終了・強制終了・端末再起動からの復元は未対応。
  退出・解散・ブロック・protocol違反は終了し、以後の自動再接続はしない。
- `nearby/yacht.ts` が既存 `games/yacht/game/{engine,types}` の純粋な採点と型へ到達し、
  `NearbyRoot.tsx` は `games/yacht/ui/components/YachtPlaySurface` をCPU戦と共有する。
  それ以外のゲーム内部参照はしない。通常のYacht state/storage/Club bridgeは使わない。

背景制約の一次資料:
[Apple Core Bluetooth Background Processing](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html)、
[Android connectedDevice foreground service](https://developer.android.com/develop/background-work/services/fgs/service-types#connected-device)。

1.5.1 (10501) の内部テスト/TestFlightでは、iPhone host→Pixel guestのBluetooth接続・承認・
双方向日本語/emojiチャットがユーザー報告で成功。その後、アプリ切替で終了、hostのみの提案、
独自Yacht画面、チャット先行の動線が不適切と指摘された。PR #285 の継続・共通UI・ゲーム優先の
変更に続き、ゲームtopからの開始、初回の重複提案の廃止、画面から独立した接続保持、
会話ボタン、結果／再戦を主とする導線を採用した。いずれも修正版の実機確認済みを意味しない。

### 端末内の履歴

`nearby/history.ts` がversion=1の専用ファイルを検証・直列更新する。Androidは
`getNoBackupFilesDir()/nearby-play-history.json`、iOSはApplication Supportの専用directory/fileへ
backup除外属性を設定しatomicに保存。Preferences、通常backupのkey一覧、Clubのoutboxには入れない。
各参加者が自分の送受信チャットと参加した対局（日時・表示名・点数・完了／中断）だけを保存する。
session鍵・native接続先は保存しない。参加前申請は履歴化しない。
履歴IDは各端末で新規生成し、相手から届くsession IDの再使用で過去の履歴を置換させない。
同じ集まりの未実行保存は最新1件へまとめる。読み込み・削除・ブロックの順序を越えて
まとめず、削除済みの記録を古い保存待ちから復活させない。復号前のJSイベント待ちも64件で制限する。

退出・切断で消さず、読むだけで通信しない。履歴1件削除、Nearby全削除、設定のローカルデータ削除を
用意する。相手側のコピーには影響しない。上限1MiB/100集まり、native境界2MiB。
容量不足・破損・未知versionでは保存失敗を表示し、保存済みデータを初期値で上書きしない。
上限で古い履歴を自動削除しない。保存に失敗した新しい内容は永続化を保証しない。

### 公開前に残る確認

今回の導線は、両端末で次を確認する。記載しただけでは完了としない。

- Yacht topの入口だけから募集／参加でき、初回の重複提案操作なしでhost承認・双方Readyを経て
  共通画面へ進む。コレクション・Club・未対応ゲーム・Webに開始入口を残さない。
- ゲームtopへ戻ってから同じ入口で同じ盤面へ戻れる。会話を閉じる・結果へ進む・再戦する操作で
  接続を終了せず、明示退出／解散では接続資源を解放する。
- 受信しても閉じている会話を自動表示せず、対局操作を妨げない。終局結果と再戦の導線を主にする。
- アプリ切替と無線のOFF／ONから、PR #285の継続条件どおり同じ相手・盤面へ戻れる。
  CPU戦の保存・統計とNearbyの端末内履歴を混ぜない。

新しい暗号化・承認・chat・履歴の実機相互接続、OSバックアップ除外、旧OS／同OS／他機種、
新製品全体の容量・電池、UGCポリシーに応じた規約／通報対応・公開プライバシー文面、
高リスク翻訳の意味確認は、コードのbuild成功から推定しない。
画面には行動ルールへの同意、受信chat非表示、install IDブロック、退出、既存supportへの
メール起動（履歴自動添付なし）を設けるが、これだけでストア審査適合を保証しない。

---

## 以下は隔離 PoC の契約と実測記録

## 1. 採用範囲と現在の状態

Android / iOS の近くにいる人が各自の端末で遊ぶ **Core の任意のオフラインモード**を
許容する。Bluetooth と同一 Wi-Fi の LAN を対象とし、インターネット、セルラー、
アカウント、PixApps の対戦サーバー、クラウド DB、外部シグナリングを必要としない。
Club House への加入・結果送信とは独立する。Web は対象外。

**現在は開発用 PoC であり、製品には導入していない。**
`apps/simple-games/prototypes/nearby/` にコードを置き、別の Capacitor アプリ
`com.pixapps.nearbypoc` として生成する。製品 UI、registry、Android / iOS の製品権限、
製品への第三者通信 SDK 依存を増やさない。製品から PoC への import は禁止する。
開発用ブラウザ画面はロジック・UI の確認用であり、Web 版への機能追加ではない。

最初の範囲は **2 台の発見・相互確認・双方向メッセージと Yacht のデモ**である。
3〜4 台、他のゲーム、秘密手札、途中復帰、host 移譲、BLE / LAN 間の自動移行は範囲外。
現行 wire v2（`418bda04`）は 40 テスト・型検査・build に成功し、Pixel 9 Pro / iPhone 11 へ
導入した。BLE の iOS advertise / game host（B8）と Android advertise / game host（B9）、
通常 Wi-Fi の LAN（L3）を各 1 局・24 手番完走し、各 121 公開 DOM 盤面と最終結果が一致。
B9 は 32 対 32 の引き分けと、各方向 1 回の 1 KB ping も確認した。
B8 の iOS background / 復帰、B9 の Android Bluetooth OFF / ON で両者の session が終了し、
自動再開しなかった。B8 の Android の切断通知は即時ではなく、正確な切断遅延は未計測。
L3 は Wi-Fi OFF 後の次の iOS Roll で state ACK 待ちへ移り、操作を止めて 15,009 ms 後に終了。
これは次操作後の ACK timeout の 1 試行であり、無操作中の即時検知を保証しない。
wire v1 の B1 / B2 / L1 / L2 の完走、B3 の部分試験、NSD / 状態 ACK の修正前の不具合は
作業記録に保持し、v2 の証拠へ転用しない。
LAN の WAN 遮断操作は行っていない。利用可能な実機は上記 2 台だけで、WAN を切れる router も
用意できていない。他の端末・OS、同 OS、advertising 非対応、3〜4 台、WAN なし LAN は未実施。
初期 / 最終 ACK 欠落、画面ロック、OS 資源の全解放、電池も未確認。Android の隔離 staging による
容量見積もりは監査済み（配布推定 +32,983 bytes）だが、製品 UX 統合後の増分・実 install size・
正式な +500 KB gate は未検証。条件と最終 JSON の参照は作業記録に保持する。
実施条件と結果は作業記録を参照し、コードや自動テストの成功を実機成功と読み替えない。
Epic #268 はこの PoC だけでは完了しない。

## 2. 構成と依存方向

| 層                      | 責務                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------- |
| 開発用画面              | 利用者が transport、通信ロール、ゲーム host / guest を選ぶ。相手・確認コード・Ready・手番を表示する。       |
| 共通 TypeScript session | protocol version、session、両者の確認、command 順序、revision、host が確定した状態を扱う。OS に依存しない。 |
| Yacht デモ              | 既存の純粋な採点・型定義を利用する。操作の合法性、乱数、状態更新を host で確定する。                        |
| Capacitor Plugin        | 明示開始・発見・接続・送受信・停止とエラーを渡す。ゲームルールを持たない。                                  |
| Android                 | 標準 BLE scan / advertise / GATT、`NsdManager` + TCP socket。                                               |
| iOS                     | `CoreBluetooth` central / peripheral、Bonjour + `Network.framework` TCP。                                   |

依存方向は PoC → 既存 Yacht の純粋な `game/` の関数・型に限る。製品のゲームから
PoC や native transport を参照しない。BLE と LAN は同じ JSON message を運ぶ。
OS 標準 API を使う方針で、Google Nearby Connections、Multipeer Connectivity 等の
別方式や第三者通信 SDK を前提にしない。

LAN PoC は既存の Wi-Fi の **IPv4** に限定する。IPv6-only のネットワーク、手入力の接続先、
cellular や peer-to-peer への fallback は対象外。Android API 34+ は NSD の複数アドレスから
同一 subnet の IPv4 を選ぶが、API 24–33 は単一 host が IPv6 として解決されると接続できない。
iOS の IPv4 socket 指定だけで Bonjour の返すアドレスまでは保証できないため、dual-stack
ネットワークと旧 Android の組み合わせは実機で確認する。接続失敗を AP isolation と断定しない。

## 3. 2 台の通信ロール

**ゲーム host と BLE central / peripheral は別の概念**である。画面では別々に選び、
hello でゲーム host がちょうど 1 台であることを確認する。2 台とも host、または
2 台とも guest なら開始しない。LAN の listen / browse とも独立させる。

| 組み合わせ        | PoC で試す通信ロール                                                                              | 非対応時                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Android ↔ iOS     | iOS が peripheral / advertise、Android が central / browse を優先。ゲーム host はどちらでもよい。 | Pixel 9 Pro / iPhone 11 では発見・双方向通信を確認。他の組み合わせと advertising 非対応 Android は実機待ち。 |
| Android ↔ Android | advertising が成功する側を peripheral、他方を central にする。                                    | 両方が advertising 非対応なら BLE は使えない。同一 LAN を案内する。                                          |
| iOS ↔ iOS         | 片方 peripheral、他方 central。                                                                   | 権限・無線状態・接続失敗を示して終了できる。                                                                 |
| 同一 LAN          | 片方 listen / advertise、他方 browse / connect。                                                  | WAN は不要。AP isolation や multicast 制限で発見・接続できない場合がある。                                   |

Android では BLE feature、adapter の状態、advertiser の取得、実際の開始 callback を
それぞれ扱う。`isMultipleAdvertisementSupported()` だけを成功の証拠にしない。
advertising 非対応、使用可能な advertising instance がない、Bluetooth OFF は同じ原因
ではない。[BluetoothAdapter](https://developer.android.com/reference/android/bluetooth/BluetoothAdapter)、
[AdvertiseCallback](https://developer.android.com/reference/android/bluetooth/le/AdvertiseCallback)

4 台で必要な同時接続数・帯域・通知キューの処理を一般的な端末へ保証する根拠はない。
1 peripheral + 複数 central 等の topology は次の実機 spike で選ぶ。PoC の人数上限は 2 台。

## 4. Wire protocol と session

| 項目                     | PoC 契約                                                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Encode                   | UTF-8 JSON 1 件 + LF。JSON 本文は最大 4096 bytes、LF は別の 1 byte。生の改行を本文に含めない。                                               |
| Decode                   | TCP read / BLE packet の境界と message 境界を同一視しない。分割・連結を処理し、上限超過、不正 UTF-8、不正 JSON を拒否する。                  |
| BLE service              | `9b5d1000-7a4c-4e13-a280-75d53c01a268`                                                                                                       |
| BLE central → peripheral | `9b5d1001-7a4c-4e13-a280-75d53c01a268`、write with response。                                                                                |
| BLE peripheral → central | `9b5d1002-7a4c-4e13-a280-75d53c01a268`、notify / indicate と送信 queue の backpressure。                                                     |
| BLE chunk                | 最大 20 bytes。書込み応答・通知の送信可能 callback を待って順に送る。大きな MTU を成立条件にしない。                                         |
| DNS-SD                   | `_sgnearby._tcp.`。固定種別だけを許容し、Android の先頭 / 末尾ドットと `.local` の表記差を adapter 内で正規化する。port は OS が割り当てる。 |
| Scope                    | 1 接続に 1 相手。session ごとに新しい識別子を作り、永続 ID や相手履歴を保存しない。                                                          |

最初に `hello` で version、表示名、host / guest、nonce を交換する。両端末が確認コードを
見比べ、両方が明示確認した後で `Ready` を受け付ける。双方向の試験 message は手動操作から
送り、定期 ping や接続監視の polling を追加しない。

guest は操作・順序番号・round・期待する revision を送り、host が手番、合法手、古い revision、
重複を検証する。host だけが乱数を決め、点数・共有状態・新 revision を配信する。受信側も
型・配列長・値域・状態の順序を検証する。重複 command によって乱数や得点を再度進めない。
host を信頼するモデルであり、改造 host の不正を検出できる保証ではない。

### Wire v2 の状態 ACK — 実装・自動検証と一部の実機試験を確認

v1 で観測した、相手の Wi-Fi 切断後にも host が操作可能な表示のまま残る問題に対し、各 `state` の
受領確認を必須にした。初期盤面と最終盤面も対象とする。以下は `418bda04` の契約であり、
実機の全異常系が解決したとの主張ではない。`hello` の version は 2 とし、v1 との混在は
`Protocol mismatch` で終了する。

- host は各 `state` に単調増加する `stateSeq` を付ける。guest は検証・適用後に
  `state-ack { stateSeq, round, revision }` を返す。
- host は全項目が一致する ACK まで pending にし、`act`、RNG の次の実行、新しい command、
  `Ready`、`tryStart` を止める。通常盤面は保持し、status に相手の受領待ちを示す。
- host の終局 state が未 ACK の間は勝敗と再戦を表示しない。古い / 重複 ACK では pending を
  解除せず、未来の ACK や round / revision の不整合では終了する。
- guest は最終 state を受信・検証して結果を確定する。終局表示の抑止は host 側だけであり、
  両端末の同時確定を保証する契約ではない。
- 重複 command には ACK 済みの state を同じ `stateSeq` で再送する。未 ACK の間は追加応答を
  作らず、乱数・採点・手番を再実行しない。
- 既存の 15 秒 `commandTimer` を状態 ACK にも使う。ACK が届かなければ state の送信開始から
  15 秒で session を終了する設計とし、初期・途中・最終盤面の欠落をそれぞれ再試験する。

周期 heartbeat は追加しない。state を送らない無操作中の即時切断検知は保証せず、次の操作で
state を送った後の未達を期限付きで扱う。無操作中の状態と、切断後の次操作から ACK timeout
までの状態を、実機記録でも区別する。

確認コードは**誤接続防止の補助**である。同じ平文経路で送った値を表示しても、本人認証、
暗号化、盗聴防止、中間者攻撃への耐性にはならない。PoC は公開盤面と試験データだけを送り、
秘密手札・個人情報・token を送らない。OS 標準の transport security を含む製品向け判断は
公開前の門とし、この PoC に独自暗号を追加しない。

## 5. 権限と lifecycle

現在の製品 baseline は Android minSdk 24 / targetSdk・compileSdk 36、iOS 15.0。
PoC の権限は生成する別アプリのみに付与し、製品 manifest / Info.plist を変更しない。

| OS / 方式                  | 利用時の扱い                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Android API 31+ BLE        | `BLUETOOTH_SCAN` / `CONNECT`、advertise 時は `ADVERTISE` を runtime request。位置推定をしないため scan に `neverForLocation`。                                                   |
| Android API 24–30 BLE      | `BLUETOOTH` / `BLUETOOTH_ADMIN` と scan の位置情報権限。旧権限は maxSdk 30。位置情報設定が OFF の場合も実機で確認する。位置の推定・保存には使わない。                            |
| Android LAN、target 36     | 現在は `INTERNET` で利用可能。製品の権限が LAN 利用へ自動的に拡張されたことにはしない。                                                                                          |
| Android target 37 への移行 | Android 17 は `ACCESS_LOCAL_NETWORK` または適用可能な system NSD picker を要求する。target 36 の段階では新権限を宣言・要求しない。移行時に双方の listen / connect を再検証する。 |
| iOS BLE                    | `NSBluetoothAlwaysUsageDescription`。利用前に manager を初期化しない。拒否・restricted・unsupported・poweredOff を扱う。                                                         |
| iOS LAN                    | `NSLocalNetworkUsageDescription` + `NSBonjourServices` に固定サービス種別。利用時に browser / listener を開始する。                                                              |

Android 12+ の `neverForLocation` は一部 beacon を除外するため、組み合わせごとの発見を
確認する。BLE hardware feature は optional として、非対応端末でも通常製品を利用できる
方針を保つ。[Android permissions](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions)、
[AOSP BLE](https://source.android.com/docs/core/connect/bluetooth/ble)

Android LAN 権限の変更は 2026-10 時点で公式に記載された target 37 移行要件である。
Android 16 の opt-in 試験で使われた `NEARBY_WIFI_DEVICES` と混同しない。
[Local network permission](https://developer.android.com/privacy-and-security/local-network-permission)

iOS の Bonjour 登録・検索・解決はローカルネットワーク許可の対象。固定 service の
Bonjour API 利用には、独自 UDP multicast / broadcast や全 service の検索に必要な
multicast entitlement を追加しない。権限拒否と timeout を区別できる場合は区別する。
AP isolation の有無を timeout だけから断定しない。
[Core Bluetooth](https://developer.apple.com/documentation/corebluetooth)、
[TN3179: Local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)

探索は明示操作から開始し、時間制限を設ける。接続後に探索を止め、退出・接続失敗・
権限取り消し・background で session と socket / GATT / browser / advertiser を閉じる。
アプリへ戻っても自動探索・自動再接続・局の再開をしない。再試行は本人の操作で行う。
OS の権限ダイアログを開いたときの lifecycle と、通常の background を実機で区別して検証する。
[Android BLE discovery](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)

iOS の background peripheral は service UUID を overflow 領域へ移し、Android からの発見を
保証できない。background mode の追加で解決したと扱わない。Android も process 終了で
接続が失われる。前面限定は機能条件であり、バックグラウンド維持用の service や定期処理を
導入しない。[iOS background](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/CoreBluetooth_concepts/CoreBluetoothBackgroundProcessingForIOSApps/PerformingTasksWhileYourAppIsInTheBackground.html)、
[Android background](https://developer.android.com/develop/connectivity/bluetooth/ble/background)

## 6. Yacht の境界

host と guest の 2 人が 12 手番ずつ遊ぶ。既存の `scoreFor` と採点表定義を使い、最大 3 投、
キープ、空欄への採点、合計点・同点を扱う。CPU の思考は使わない。
得点は host が計算し、相手の申告点数をそのまま採用しない。
再戦する場合も両者の Ready が必要で、新しい round にする。

デモはメモリ内で完結する。既存 `yt.saveGame` / `yt.stats`、自己ベスト、レビュー依頼の
計数、バックアップ、Club House の `standard` 結果を読み書きしない。切断後の勝敗を
勝手に確定せず終了する。切断前に完了していた結果も外部のランキングへ送らない。

## 7. 実機検証と製品化の門

実施記録には date、commit、app ID / build、機種、OS、通信ロール、game host、権限状態、
無線条件、試行数、成功数、所要時間、切断、再現手順を残す。実機がなければ **未実施**。
必要な matrix と未入力欄は [作業記録](../plans/2026-10-25-nearby-multiplayer-poc.md)にある。

1. **BLE**: 機内モード ON → Bluetooth を明示 ON → Wi-Fi OFF、インターネットなし。
   Android ↔ iOS、Android ↔ Android、iOS ↔ iOS。Android advertising 非対応を含める。
   航空会社・乗務員の指示に従う。機内モードだけから無線状態を推定しない。
2. **LAN**: WAN を切った同一 Wi-Fi。Android ↔ iOS を必須とし同 OS 組も記録する。
   AP isolation、発見失敗、TCP timeout、権限拒否で安全に終了する。
3. **protocol / game**: 双方向・4096-byte 境界・日本語を含む UTF-8・分割/連結・不正入力、
   古い/重複操作を確認。2 台の盤面一致と 24 手番完了を BLE / LAN の双方で確認する。
4. **lifecycle**: 権限拒否/再許可、Bluetooth OFF、Wi-Fi 切断、相手終了、画面ロック、
   background / 復帰。探索や接続が残らず、古い message が次の局へ混ざらない。
5. **性能とサイズ**: 接続時間、切断率、電池・メモリ・起動時間、低価格 Android を測る。
   Android の変更前後の release AAB から同一 device spec の配布 / install size を比べる。
   +500 KB は挑戦目標であり、達成した事実ではない。PoC APK と製品 APK の単純比較、
   Web gzip、debug APK で代用しない。増分が超えたら理由・代替案を記録して採否を判断する。
   製品入口 / UX 未統合の隔離 staging 見積もりは作業記録へ別記し、正式判定や実 install size の代用にしない。
6. **製品境界**: 通常起動と Web で探索・権限要求・通信がないこと、製品の lazy-load /
   size gate と既存ゲーム・保存が退行しないことを確認する。native 権限説明、多言語、
   accessibility、プライバシーと平文通信の扱いを製品化前に完了する。

3〜4 台は追加の実機 gate。未検証の台数・端末・方式をストアや LP へ載せない。
公開できるのは検証済みの組み合わせだけで、「機内で必ず動く」「全端末で 4 人対応」等は
約束しない。Phase 0 / 1 の完了、Phase 2 の製品導入、Phase 3 の公開を別々に判定する。

## 8. 公式資料の確認

確認日: 2026-10-25。API の存在は確認したが、実機の動作証明ではない。
権限・background の資料は §3〜§5、以下は採用 API と試験時の補助資料。

- [Android NSD](https://developer.android.com/develop/connectivity/wifi/use-nsd): DNS-SD 登録・発見と OS が選んだ TCP port。
- [Apple Bonjour / Network.framework](https://developer.apple.com/news/?id=0oi77447): `NWBrowser` / `NWListener` / `NWConnection` による discovery と通信。
- [Apple write length](<https://developer.apple.com/documentation/corebluetooth/cbperipheral/maximumwritevaluelength(for:)>)、[notification length](https://developer.apple.com/documentation/corebluetooth/cbcentral/maximumupdatevaluelength): 相手ごとの上限。PoC の 20-byte chunk を緩和する際にも必要。
- [Android 14 MTU](https://developer.android.com/about/versions/14/behavior-changes-all): 最初の request は 517 を要求するが、相手と成立する payload を固定値とみなさない。
- [Apple 機内モード](https://support.apple.com/en-la/108785)、[Google 機内モード](https://support.google.com/pixelphone/answer/12639358): 無線の再有効化・状態記憶があり、実際の設定を確認する。
