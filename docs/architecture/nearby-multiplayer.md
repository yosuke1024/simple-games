# Nearby Multiplayer — 近隣端末間対戦と遠隔対戦の契約

## 2026-11-14: 遠隔対戦(招待リンク・WebRTC DataChannel、issue #280)

オーナー判断で、Nearby Play の対象ゲームを招待リンクでインターネット越しに遊ぶ遠隔対戦を
Core の任意モードとして採る。製品の約束は [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)
「遠隔対戦」節、この節は技術の契約である。**方針の採用であって、実装・実機検証・出荷はしていない。**
下の数値のうち出典が実装のソースや文書のものは、実機の観測値ではない。#280 の Phase 1(PoC)で測り、
Phase 2 でこの方式で出すかを決める。その結果でこの節を改める。

**この節と古い節の関係**: 下の古い節の「すべての参加に host 承認」「同じ label を前面で再発見して戻る」
「探索 60 秒・承認待ち 60 秒」「アプリ切替・背景でも接続を保つ」「Android の connectedDevice
foreground service と iOS の Bluetooth 背景モード」は近隣(BLE / LAN)の契約である。遠隔はこの節に従う。
`Session` / `GroupSession` / `Channel` / `Delivery`、各ゲームの adapter と View、host 確定・投影・
CPU への切り替え・固定席の共通契約(2026-10-27 節)、端末内履歴、表現チェック・通報・ブロック、
iOS で出さない 2 本の扱いは、近隣と遠隔で共有する。遠隔のためにゲーム側を変えない。

### transport

- `src/nearby/remote/` に、`NearbyPlugin`(`native.ts`)と同じ口を持つ JS の実装を置く。使うのは
  WebView 標準の `RTCPeerConnection` と `RTCDataChannel` だけで、native の実装・WebRTC の SDK・
  第三者の通信 SDK を足さない。`Transport` に遠隔の種類を足す。
- controller から見た動き: 招待を開くと listing 付きの `peer` イベントが 1 件だけ出て、返事を受け取ると
  `connected` が出る。controller の「選ぶ → 接続 → 鍵交換 → hello の照合 → Ready」はそのまま通る。
  承認の段だけ、招待の確認(下)が通れば host が自動で承認する。
- DataChannel 上の 1 メッセージは、native と同じ 4096 UTF-8 bytes の上限を守る。暗号化前 JSON の
  上限、`Delivery` の seq / 累積 ACK、state の受信確認もそのまま使う。DTLS に加えて `Channel` の
  ECDH・AES-GCM を重ねる。
- ICE は STUN の `stun.cloudflare.com:3478` だけを使う。TURN と relay 候補は使わない。収集は trickle
  せず、時間で打ち切ってその時点の候補を使う(libwebrtc は STUN の応答を最長約 40 秒待つため。
  打ち切りの秒数は Phase 1 で決める)。

### 招待と返事

- 招待は host が席ごとに作る。中身は、形式の版・gameId・label・募集名・protocol・席・期限・最小化した
  SDP・招待秘密である。最小化した SDP は ice-ufrag・ice-pwd・DTLS の fingerprint・setup・候補だけを運び、
  受け手が組み立て直す。ufrag と pwd は省かない(ローカル SDP の書き換えに頼らない)。
- **候補は srflx だけを運び、srflx の raddr も載せない。** Android の WebView は host 候補に端末の
  LAN 内アドレス(私設 IPv4 か IPv6)をそのまま載せる見込みで(Chromium のソースの読解。実機では未確認)、
  iOS の WKWebView は mDNS 名(UUID.local)に置き換える。LAN 内アドレスを相手に渡さないために host 候補を
  落とす。同じ LAN の相手とは近隣対戦を使う。
- 返事は招待を開いた側が作る。中身は形式の版・招待の識別子・最小化した SDP(answer)である。
- 招待と返事は、アプリリンク(App Links / Universal Links。パスは未定で、`/simple-games/share/*` とは
  別のパスにする)のフラグメントに置き、コピーと貼り付けでも渡せる。フラグメントはサーバーに届かない。
  受けるページは中身を読まず、送らず、計測しない。共有リンクは何も与えないが、招待は席を与える。
  そのため共有リンクのハンドラと混ぜない([share-links.md](share-links.md))。
- 招待の大きさは、候補が 2〜3 個なら base64url で 200 文字前後の見込み。QR にも載る。実装時に測る。
- iOS アプリは、招待の gameId を `app/iosWithheldGames.ts` に問い、出していない 2 本の招待を開かない。
  理由は表示しない(近隣の既存の前例どおり)。

### 承認なしの着席

- 招待秘密は 1 席・1 回限りで、期限がある。鍵交換の後に、招待秘密を鍵として、新しい ECDH の
  transcript と送信者の役割に結びつけた HMAC の proof を guest が示す。継続鍵による復帰の proof と
  同じ形である。host は proof が通れば、その招待の席へ自動で承認する。通らない・使用済み・期限切れ・
  対局中なら、証明の無い断りを返す。
- 招待を作れるのは対局と対局の間だけである。対局が始まった時点で使われていない招待は無効になる。
  これは近隣の「参加の受付は対局と対局の間だけ」と同じ扱いである。
- 招待秘密は proof の後に捨てる。ディスクには保存しない。着席した後は、近隣と同じ継続鍵を
  初回の鍵交換から導出して、メモリ内だけに保持する。
- 6 桁の比較コードは遠隔では必須にしない(招待秘密の proof が束縛を担う)。ただし、招待は持参型の
  資格である。メッセンジャーから漏れたり転送されたりすれば、その人が座れる。proof は本人認証ではない。

### 再接続

- DataChannel・ICE が切れたら、近隣と同じく継続待ち・離席へ移り、盤面と未確認の操作を保持する。
  切れたと見なす時間の目安は、libwebrtc の既定値から約 5 秒で disconnected、約 15 秒で failed である
  (ソースの値で、未計測)。アプリ層の 15 秒の ACK 期限はそのまま使う。
- 戻るときの手順:
  - host が離席中の席の「再接続のリンク」を作り、戻る人が返事を返す。招待と同じ向きである。
  - 新しい鍵交換の後、最初の着席で得た継続鍵の proof を示す。既存の proof と同じで、鍵は回転しない。
  - proof が通れば承認なしで同じ席へ戻る。proof を示せない相手には証明の無い断りを返すので、
    リンクが転送されても席は取られない。
- host 自身が切れると、全員の席が離席になる。host は席ごとに再接続のリンクを作り直す。
  自動で相手を探し直すことはしない。

### 背景と生存確認

- 背景では OS がアプリを止める前提にする。目安は、iOS が数秒〜約 30 秒、Android 14 以上が約 70 秒で
  凍結される(Apple の文書と AOSP のソースから導いた値で、未計測)。
- 遠隔のために、foreground service・状態通知・背景モードを足さない。Android の connectedDevice
  foreground service は、近隣の BLE / LAN のためのものである。
- アプリ層では周期的な生存確認を足さない。WebRTC の下層は、接続中に ICE の consent(RFC 7675、
  約 5 秒ごと)と SCTP の heartbeat を送る。
- 開始の最後の段階(返事を開いて疎通を確かめる間)は、2 人ともアプリが前面にいる必要がある。

### プラットフォーム

- Android: WebView の Chromium 88 の下限で、必要な API はそろう。DataChannel だけなら追加の権限は
  要らない(INTERNET だけ)。targetSdk 37 で要る ACCESS_LOCAL_NETWORK は、インターネット宛ての srflx 経路には
  掛からない。
- iOS: 下限の 15 で WKWebView の RTCPeerConnection は使える見込みである。ただし資料ごとに版が
  食い違うので、実機で確かめる。15.4 で入った API(暗黙の rollback、`pc.sctp`、DataChannel の
  `closing` イベント)には頼らない。ロックダウンモードでは `RTCPeerConnection` が無くなるので、
  機能を検出して「この端末では使えない」と示す。WKWebView のトラフィックはローカルネットワーク許可の
  対象外とされている(Apple TN3179)。そのため、遠隔のために Info.plist は変えない。
- Web: 置かない。`src/nearby/` を Web 成果物とエントリの初期グラフから締め出す既存の検査を、
  `src/nearby/remote/` も前方一致で受け継ぐ。

### 機械で示すこと

- `.github/scripts/check-principles.sh` §1c: WebRTC の語は `src/nearby/remote/` の外では赤になる。
  STUN / TURN の URL は remote/ を含むどこでも、`stun:stun.cloudflare.com:3478` と完全に一致するもの以外が
  赤になる(TURN・ほかの STUN 事業者・スキームの文字列連結を含む)。STUN / TURN / ICE をビルド時に注入する
  `VITE_` の名前と、package.json・Gradle・iOS の依存ファイルにある WebRTC 系のライブラリも赤になる。
  トークン・除外境界・許可リストを自己検査する。§1 / §1b は変えない。remote/ にも fetch / WebSocket は書けない。
  grep で示せるのは語が無いことまでで、`globalThis['RTCPeer' + 'Connection']` のような組み立ては見えない
  (到達経路は下の 2 つが示す)。
- `src/test/importBoundaries.test.ts`: nearby/ の外から remote/ へ届かないことを確かめるプローブを置く。
- 実装時(Phase 3)に足すもの:
  - remote/ を別のチャンク(`nearby-` で始まる名前)に分ける。BLE / LAN の Nearby を開いただけでは
    WebRTC のコードを読み込まないようにする。
  - remote/ への入口を 1 ファイルの動的 import に限る規則を足す。`Session` などが remote/ を
    直接 import できないようにする。
  - Web とエントリの初期グラフに remote/ が無く、native には有ることを、空振りしない形で検査する。

### つながる見込みと、開始の時間の窓

- TURN を使わない直接接続の成功率は、公表値で 7〜8 割である(2015〜2025 年の測定。条件は揃っていない)。
  セルラーの CGN は約 4 割が宛先ごとに別のマッピングを持つと報告されていて、スマートフォン同士では
  これより下がりうる。日本の 4 キャリアの公開データは見つからなかった。
- 手動の 1 往復には時間の窓が 2 つある:
  - 招待を作ってから返事が開かれるまでに、招待側の NAT のマッピングが失効しうる。UDP のタイムアウトの
    中央値は、セルラーで 65 秒、それ以外で 35 秒と報告されている。
  - 返事を作った側は、すぐに疎通確認を始め、約 15 秒で諦める。
- Phase 1 では、経過時間ごとの成功率を測る。その結果で、招待の期限、「返事を送ったらすぐ開いてもらう」
  案内、Phase 2 のシグナリング案を比べる。

### 一次資料(2026-11-14 に確認)

- WebKit: [A Closer Look Into WebRTC](https://webkit.org/blog/7763/a-closer-look-into-webrtc/)、
  `PeerConnectionBackend.cpp`(ICE 候補のフィルタ)、`UnifiedWebPreferences.yaml`(ロックダウンモード)
- Chromium: `net/features.gni`(Android の通常ビルドは mDNS を持たない)、`filtering_network_manager.cc`
- libwebrtc: `p2p_constants.h` / `connection.cc` / `p2p_transport_channel.cc` / `stun_port.cc`
- [RFC 7675](https://www.rfc-editor.org/rfc/rfc7675.html)、[RFC 4787](https://www.rfc-editor.org/rfc/rfc4787.html)、
  Richter et al., IMC 2016(CGN の実測)
- [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)、
  [Android local network permission](https://developer.android.com/privacy-and-security/local-network-permission)、
  [Android cached apps freezer](https://source.android.com/docs/core/perf/cached-apps-freezer)
- [Cloudflare Realtime TURN FAQ](https://developers.cloudflare.com/realtime/turn/faq/)(STUN は無料・無制限と明記。
  STUN だけのログ方針と SLA は公開されていない)
- [webrtcHacks: The Minimum Viable SDP](https://webrtchacks.com/the-minimum-viable-sdp/)

## 2026-11-11: iOSアプリはTexas Hold'em / Blackjackを出さない(iOS 1.8.5)

App Storeの審査(Guideline 2.3.6)を受けたオーナー判断で、iOSアプリは模擬ギャンブルの2本を出さない
([PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「iOS で出さないタイトル」)。
**iOSアプリのNearbyは26本(2席18本、4席8本)**。Androidは28本(2席18本、4席10本)のまま、
Webの無効な案内も28本のまま。以下の古い日付の対象数は、iOSについては本節を優先する。

- 実行時に絞る。判定は葉の`app/iosWithheldGames.ts`(`src/nearby/`はregistryをimportできない —
  `src/test/importBoundaries.test.ts`)。`nearby/discovery.ts`の`gameForLabel`はiOSアプリでこの2本の
  code(1A / 1B)をnullにする — この版が知らないcodeと同じ扱いで、`P-` / `F-`どちらのlabelでも、
  Androidのhostが開いた卓はpeerにもlistingにもならず、一覧に出ず、参加できない
  (既存の前例どおり説明文は出さない)。`NearbyBrowser`の「対戦サポートゲーム」は描画時に絞る。
  4席の集まりの履歴は保存を残して表示だけ外す。`app/nearbyGate.ts`の`nearbyAvailable`もこの2本で偽を返し、
  `NearbyRoot`はほかの扉からidが届いても卓をmountせず探索画面を出す。
- **意図して変えないもの**: `NEARBY_GAME_CODES`と`NEARBY_GROUP_GAME_IDS`(idの表と履歴の検証は
  全プラットフォームで同じ。iOSで外すと、この2本の集まりの履歴を持つ端末で履歴の読み込みが失敗し、
  Nearby全体が使えなくなる)。nativeのlabelの範囲(Android `DiscoveryLabel.metadataCapable`、
  iOS `NearbyPlayListing.supportsProbe`とも`0x81`〜`0x9C`。上にIndian Rummy(1C)があるので2本だけは
  抜けず、`src/test/nearbyNativeLabelRange.test.ts`が範囲を固定する)。iOSのnativeはAndroidの
  `0x9A` / `0x9B`のhostを引き続きBLEでprobeして公開listingを読むが、JSが捨てるので画面には何も出ず、
  参加・承認・対局も始まらない。
- Androidのhostには参加申請・承認・対局は届かない(公開listingのBLE probeだけは起きる)。いま公開中のiOS 1.7.2は
  code 01〜0Eしか知らないので、この2本の卓はもともとiPhoneに見えていない。

## 2026-11-07: 新しい14本が接続できなかった件(1.8.2)

1.8.0/1.8.1の実機で、Hearts(0F)〜Indian Rummy(1C)の14本はBluetooth・Wi-Fiとも
「接続できませんでした」になり、Ludo(0E)までは接続できた。新codeを`nearbyGameIds.ts`へ足したとき、
native側の受理範囲(Android `DiscoveryLabel.metadataCapable`、iOS `NearbyPlayListing.supportsProbe`)を
`0x8E`のまま上げなかったため、hostの`start()`がlisting付きの募集を拒否し、guestも該当hostをprobeしなかった。
1.8.2で両方を`0x81`〜`0x9C`(= `0x80` | 最大code)へ上げた。**ゲームを足すときはこの上限も上げる**。
`src/test/nearbyNativeLabelRange.test.ts`が表とnative 2か所の一致を検査する。
範囲は「上位bitが立っていれば可」には広げない(下記、最初期のランダムlabelのhostをprobeしないため)。
Pixel 9 Pro / iPhone 11で、Bluetooth・同じWi-Fi、両方向のhost、2席(Backgammon)・4席(Sevens / Hearts /
Indian Rummy)の対局開始まで確認した(2026-11-07、修正版のdebugビルド同士)。
1.8.1のままのguestはBluetoothでは修正版のhostを見つけられない(probeの判断が旧版のnative側にあるため)。
Wi-FiはTXTを範囲で絞らないので見つかる。Bluetoothで遊ぶには両端末の更新が要る。

## 2026-11-05: トランプ6本を追加し28本へ

オーナーの明示指示でCrazy Eights / Durak / Spades / Texas Hold'em / Blackjack / Indian Rummyを
CPU戦と近隣対戦込みで収録する。コード上は正式78本・Web先行2本・取り下げ2本の全82エントリ(2026-11-07にWeb先行2本を正式収録し正式80本。Nearbyの対象は変わらない)。
Nearbyは2席18本、4席10本。以下の古い日付の対象数より本節を優先する。配布済みという意味ではない。

- 新6本は固定席のグループ層を使う。Durakは2席、他5本は4席。席数とグループ通信経路は別の概念。
  Durakでも人間/CPU交代、切断中の席確保、復帰、host終了、明示退出の共通契約に従う。チャットは付けない。
- hostのみが全配札・山札を保持し、各端末へ本人の手札と公開情報だけを送る。新codeは17〜1C。
  CPUは本人の手札と公開情報だけを使う。未知codeを旧版が拒否する既存仕様は維持。
  native側のlabel範囲の更新が漏れ、1.8.2まで接続できなかった(冒頭の2026-11-07節)。
- Spadesのペアは席0+2と1+3。ハンド間はhostの明示操作で進める。Hold'emも同様で、
  ホストの持ち点がなくなっても次のハンドを開始できる。公開するホールカードはショーダウンの参加者のみ。
- Blackjackは各席対自動ディーラー。複数人の勝利・負の得点を保持し、唯一の勝者を捏造しない。
  配札時のナチュラルで即終了しても結果の席名を固定し、人間のReadyをリセットする。
  最大16スプリット手札を4KiB暗号化frameに収めるため手札をtuple化し、本人の公開手札の重複を除く。
  UIには検証済みの通常viewへ復号し、4096-byte上限は拡大しない。
- 履歴v1はgameIdごとの席数を検証する。省略gameIdは従来どおり4席Ludo。
  負の得点はSpades/Blackjackだけに許可。通常のCPU保存と対戦履歴は分離。
- Webは全28本に無効な対戦ボタンとアプリ専用説明を表示する。Nearby runtimeを含めない。
- 規則・試験・ブラウザ確認は各RULESと[実装記録](../plans/2026-11-05-six-card-games.md)。
  実機のBluetooth/LAN試験、ストア年齢区分の反映と公開は別途であり、今回の実装完了と混同しない。

## 2026-11-04: Nearby Playを22本へ拡張

オーナーの「未対応で入れられるゲームに追加、Webベータも対象」と「対象ゲームをアプリにも収録する」の
指示により、Hearts / Backgammon / Ridge Cannons / Fleet Search / Chain Territory / Daifugo / Sevens / Old Maid の8本を追加。
2席は17本、4席はLudo / Hearts / Daifugo / Sevens / Old Maidの5本。
Backgammon / Ridge Cannons / Fleet Search / Chain Territory / Daifugo / Sevens / Old Maid の7本を正式収録へ変更し、正式72本・Webベータ2本
(Frost Route / River Cargo)・収録見送り2本の全76エントリとする。
Webには対応22本の無効な「誰かと遊ぶ」とアプリ専用の説明を表示し、通信runtimeを含めない。
通常のソロ／CPU戦と保存形式は維持し、Nearbyの履歴は専用保存に分離する。
これはオーナーの明示判断による収録で、2週間の安定稼働・計測の達成を意味しない。
実機でのBLE/LAN対戦、ストア掲載・配布、landing側の掲載変更はこの実装に含めて完了扱いにしない。
以下の日付つきの公開経緯は当時の記録で、本節の対象・本数が優先する。

### 追加ゲームの通信と共通UI

- 2席4本は既存のhost確定・受信確認・再接続・任意チャットを使う。
  Chain Territoryは合法手列、Ridge Cannonsは地形seedと公開済みの射撃・現在の風だけを同期する。
  Backgammonの出目、Ridge Cannonsの次ラウンドの風はhostが都度生成する。
  Fleet Searchは自分の艦・受けた射撃・相手への既知情報だけを送り、終局時のみ相手の全配置を公開する。
- 4席カードゲームは既存の固定席・承認・Ready・人間/CPU切替・切断中の待機を共有する。
  hostだけが全配札を持ち、暗号化リンクごとに受信者の手札と公開情報へ投影する。
  seed、他席の手札、未確定の交換札、Old Maidの他人が引いた単独札は送らない。
  `GroupGame.project/valid/result`で投影・検証・結果をゲームごとに定義し、共有UIと履歴はgameIdを持つ。
  旧履歴のgameId省略はLudoとして読む。これらのグループにチャットは追加しない。
- Heartsは4枚が揃ったトリックを全人間のACK後に自動回収し、ハンド結果を表示してhostが次へ進める。
  Daifugoは再戦時に前回順位を引き継ぎ、上位2席の選択が揃ってから同時交換する。
  SevensとOld Maidはhostが上がっても残りの席が最後まで対局する。
- 追加8本の対局完了・不正手拒否・投影・通信量、4人の実暗号化リンクと復帰を自動検証する。
  319〜360px幅の各盤面と620px幅のカード表示をブラウザで確認。Native/Webビルドの分離とサイズ検査を行う。
  無線の実機検証とストア配布は未実施。7本の保存fixtureは上記公開済みWeb成果物からの採取であり、終了結果は未採取。
- 通常ゲームと共有するのは純粋な規則と表示部品のみ。通常のGameContext、保存、統計、Clubには到達しない。
  HeartsのCPUは公開情報用viewからのみ選択し、既存のLudoと同じくグループ側で実行する。
  フォーマットは既存discovery/wireを維持し、新game codeは0F〜16。旧版は未知のcodeを拒否する。
  native側のlabel範囲も上げる必要があったが漏れていた(冒頭の2026-11-07節。1.8.2で修正)。

Updated: 2026-10-27 / issue #268

この文書は近隣端末間対戦の製品契約と検証条件の正本であり、旧通信 PoC の記録も分けて保持する。
2026-11-14 から遠隔対戦(招待リンク・WebRTC)の技術契約も冒頭の同日の節に置く。
上位原則は [PRODUCT_PRINCIPLES.md](../PRODUCT_PRINCIPLES.md)「Nearby Play」、
オフラインの範囲は [OFFLINE_POLICY.md](../OFFLINE_POLICY.md)、Yacht の規則は
[YACHT_RULES.md](../YACHT_RULES.md) §13。進捗と実測結果は
[作業記録](../plans/2026-10-25-nearby-multiplayer-poc.md)へ記入する。

## 2026-10-26: 1.6.0の公開準備

オーナーが本番公開を依頼した。探索画面の最下部に「対戦サポートゲーム」と対応13本の
通常ゲームトップへのリンクを置く。無線を新たに始めず、探索中なら停止完了後に移動する。
戻る・非表示・unmount・別操作で古い停止完了が返っても、後から画面遷移を上書きしない。

公開に向けたUGC対策として、募集・参加申請・会話・履歴から対象を選ぶ通報画面を追加する。
本人が全文と理由を確認して同意した後に、既存サポート宛メールの草稿を開くかコピーする。
アプリは自動送信せず、メール作成やコピーを通報送信完了として扱わない。全履歴、端末ID、
相手のアプリ識別子を通報へ自動添付しない。募集一覧の非表示はその探索中だけであり、
継続的な相手ブロックとは区別する。接続後の相手は承認前でもブロックできる。
履歴v1にoptional `peerIdentity` を加え、退出後も同じインストール単位でブロックできる。
旧履歴を破棄せず、識別子のない履歴にブロック可能と表示しない。保存範囲と削除・backup除外は従来どおり。

募集名・表示名・チャットには、端末内の限定的な有害表現チェックを送受信双方で行う。
検査のための外部送信はしない。既存履歴は書き換えず、該当内容を表示時に隠す。
チェックは全表現・全回避手段を検出するものではなく、通報対応とルール改善を継続する。
アカウントによる本人単位の追放、他端末の履歴の遠隔削除、再インストールへの永続ブロックは保証しない。

iOSはアプリのPrivacyInfo.xcprivacyに、SystemBootTime `35F9.1`、UserDefaults `CA92.1`、
FileTimestamp `C617.1`を実使用に対応させて同梱する。LANのIPv4固定を外す。
AndroidもIPv6の同じWi-Fiの具体アドレス／scope／prefixを検査し、待受と接続候補を制限する。
backgroundではBLE scanを止め、接続・広告・対局を維持し、必要な探索だけforegroundで再開する。
追加の背景位置情報権限を要求しない。IPv6-only実機ネットワークの検証はコード／ビルド検証と区別する。

## 2026-10-26: Ludoの4席と人間／CPUの切り替え

オーナーが複数人対戦と対局中の操作担当切り替えを指示した。ゲームごとに席数を宣言し、
既存13本は2席、Ludoは4席とする。今回、人間／CPU混成を実装するのはLudoのみ。
4席の内訳は4人、3人＋1CPU、2人＋2CPU、1人＋3CPU。空席のまま対局は始めない。
この節は3席以上の集まり（グループ層）の導入であり、下の既存13本の2人用通信・チャット・再接続の契約を置き換えない。
離席・退出・復帰・参加の受付・探索への出し方は次の2026-10-27の節が正で、この節より優先する。
配布済みや実機で4台の相互接続が確認できたことを意味しない。

- 入口は同じゲームトップの「誰かと遊ぶ」。全体探索と対応ゲーム一覧はLudoを加えた14本。
  Webは無効ボタンとアプリ専用の説明だけを表示し、通信の実行コードを読み込まない。
- hostと最大3台の参加端末を接続する。各peerに独立したChannel、暗号鍵、受信処理を持たせ、
  ある参加者への操作や切断が別の参加者へ誤配送されないようにする。nativeの複数peer経路は
  明示的な`maxPeers: 3`で選び、既存13本の単一peer経路を維持する。
- 部屋には4つの席を置き、`open`／`human`／`cpu`の担当状態、接続・Ready状態、担当世代を持つ。
  hostは席0で人間のまま。残り3席はCPUを初期値にして、人間の参加をhostが席ごとに承認する。
  開始時には全席が人間またはCPUで埋まり、すべての人間が接続済み・Readyであることを確認する。
- `groupSession.ts`が席・盤面・操作の唯一の正を持つ。hostは対局中も参加者の席をCPUに変更できる。
  接続中の同じ参加者へ操作を戻せる。別の人がCPUの席に入れるのは対局の間だけである（次の節）。
  担当変更は盤面、現在の手番、振り終えた出目を変えない。旧担当から遅れて届いた操作は
  revisionと担当世代の照合で拒否する。CPUも同じ合法手検査を通る。
- 操作・確定状態の送信先は部屋に承認された参加者だけ。対局の進行は必要な人間端末が
  現在の状態を受信確認してから進める。再送や切断で同じ操作を二重適用しない。
- 参加者の退出・離席・復帰とhostの離脱は、次の2026-10-27の節に従う。host移譲はしない。
- Ludoのルールは`LUDO_RULES.md` §14。共有の純粋なルール・CPU・盤面部品を使い、
  `games/ludo.ts`の公開状態にはseedや未来の乱数を入れない。hostは受理した投擲ごとに
  出目を生成し、CPUは現在の盤面・出目だけを読む。通常1人用の保存・統計・CPU難易度設定は変えない。
- Ludoの集まりは対戦操作だけで、チャットを提供しない。対局の日時・参加名・結果はNearby専用の
  端末内履歴へ追加する。既存の2人用履歴を壊さず、個別削除・全削除、通常／OSバックアップからの
  除外を維持する。履歴は再開用のセーブではなく、プロセス終了後の対局復元は提供しない。
- 確認項目は4人、3人＋1CPU、進行中の4人から3人＋1CPUへの変更、振った後の交代、
  CPUから接続済みの本人への復帰、旧操作の拒否と、次の節の離席・退出・復帰・参加の受付・探索への出し方。
  自動テストとnativeのコンパイルは4台の実機検証の代わりにしない。BLE/LAN、Android/iOS混在、
  同OS、背景移行、電池、旧端末の確認は未実施である。

## 2026-10-27: 3席以上の集まりの共通契約

オーナーが、Ludoで先に決めた席の扱いを見直し、**3席以上のNearby対戦すべてが従う共通の約束**とした。
現在このグループ層を使うのはLudoだけで、既存13本の2人用の契約は変えない。
この節は、2026-10-26の節にあった退出・切断・再参加・host離脱の扱いを置き換える。
実装はゲームに依存しない。`GroupGame`が`id`を持ち、発見labelのゲーム識別とlistingの`gameId`はゲームから取る。
ただし履歴の検証（4席固定）と`GroupRoot`の表示はLudo用のままである。

- 退出と離席を分ける。ゲストの明示的な退出（Leave）は意図的な操作なので、その席は即座にCPUへ替わり、
  席の保持を解除する。退出した人はその対局へ戻れない。対局と対局の間なら、新しい参加申請として入れる。
  終わった対局の結果と履歴は、終局の時点の席の名前を保ち、その後の退出やCPUへの切り替えで書き換えない。
  hostは終局時の席を固定してstateに`final`として添え、後から戻ったゲストも同じ名前で結果を示す
  （`final`を送らない以前のhostに対しては、ゲストが最初に見た終局のstateで代える）。
- 離席は、承認後のstate ACKが15秒届かない場合（前面のhostだけが計時し、背景ではタイマーを止める）、
  または物理切断・送信失敗の場合に起きる。ゲスト側でも、自分の操作に15秒答えが無ければ（hostの離席や
  半開きの接続）リンクを閉じてhostを探し直す。いずれも席の保持は解かない。その席は「離席中」になり、hostはその物理リンクを閉じるが、
  席は本人が保持したまま人間担当で、全員が待つ。システムは自動でCPUへ替えない。離れている時間や
  事情はさまざまなので、CPUへ替えるかはhostが手動で決める。hostがCPUへ替えても席の保持は続く。
  ただし承認の後、最初のstateを受信確認する前にリンクが切れた人は、席を見ておらず戻る手がかりも無いので、
  その席を保持せずCPUへ戻す。承認は対局と対局の間だけなので、対局には影響しない。
- 離席した人は、hostの承認なしに同じ席へ戻る。ゲストのアプリは前面で、hostのlabelを再発見する。
  一覧のmetadataは要らず、labelの一致は候補を選ぶだけである。最初に承認されたリンクの継続鍵で、
  新しいECDHのtranscriptに結びついたHMAC proofを双方が確認すると席に戻る。
  仕組みは上の「既存13本の2人用 Nearby Play の契約」の継続鍵と同じで、鍵は回転しない。
  hostがCPUへ替えていた席はCPU担当のまま接続し直し、操作を戻すかはhostが決める。
  席の保持が解除済み（退出・ブロック・追い出し・別の人への承認）なら、hostは解除前の継続鍵で証明を付けた`declined`（日本語は「参加申請が承認されませんでした。」）を返し、
  その人の端末は探すのをやめる。proofが合わない相手には証明の無い断りを返す。
  再接続中のゲストは、継続鍵の証明を示せない相手からの終了・断り・置き換えの通知を受け付けず、探し続ける。
  hostのhello（IDと募集名）は承認前の誰にでも届くので、helloの一致は本人確認にならない。
  labelとhelloを真似た機器が、戻ろうとしている人の席を終わらせないためである。
- hostの離席では全員が待ち、hostのアプリが前面に戻れば再開する。hostの無線がエラーで落ちた場合は、
  hostが前面で同じlabelのまま無線を起動し直し、各ゲストは上の手順で戻る。起動し直しの途中でnativeがエラーを
  報告した場合は（iOSはLAN listenerの失敗をerrorで知らせ、startは完了を返す）失敗として3秒後に再び試す。
  集まりを終えるのはhostの明示的な退出だけで、host移譲はしない。
  最後の通知（hostの終了、ゲストの退出）は、nativeの`send`が送信待ちへの受理で完了し、無線の停止がその待ちを捨てるため、
  2人用と同じく最大1秒の受理待ちと750msの送出時間を取ってから無線を止める。届かなければ、受け手には離席に見える。
- プロトコル違反（同じ接続での名前・IDの変更、暗号文の再送など）は2人用と同じく終了とし、自動復帰しない。
  host側ではその席をCPUへ替えて保持を解除し、断りを送る。受信の詰まりは送り主ごとに数え、hostは詰まらせた参加者だけを
  同じように外し、集まり全体は終えない。確認済みのhostからの詰まりは、ゲストにとって2人用と同じく終了である。
  接続と切断を繰り返して毎回新しいIDを名乗る相手に備え、全体の受信待ちにも上限（256件）を置き、超えている間は
  今つながっている相手と無線全体のイベントだけを受け付け、見知らぬ相手の新しい接続は閉じる。hostによるブロックも、その席をCPUへ替えて保持を解除し、断りを送る。
- 参加の受付は対局と対局の間だけ。対局中の参加申請と、渡せる席（CPUの席）が無い間の参加申請には
  既存の断り（declined）を返し、対局の開始時点で未承認だった申請も断る。人間の席には、離席中でも承認できない。
  CPUの席（hostが替えた離席者の席を含む）には対局の間に承認でき、元の保持者は`replaced`で外れる。
- 対局中、またはゲスト席がすべて人間の間は、部屋を探索一覧に出さない。発見labelは広告し続け、
  listingだけを出さない（BLEはmetadataの読み取りが成功の空、LANはTXTのlisting項目を省く。空文字にはしない）。
  離席したゲストがlabelから部屋を見つけ直せるようにするためで、この非表示を説明する文は画面にもストアにも置かない。
  切り替えは多席hostだけが持つnativeの`setListingVisible`で行い、端末側の満員判定（リンク数）とANDをとる。
  JS側のフラグはnativeが公開する範囲を狭めるだけで、広げない。nativeが切り替えを拒んだ場合
  （AndroidのNSDが登録の解除を拒むなど）は、前の状態のままとみなして3秒後に再び試す。
- 既知の制約（いずれも実機未確認）。AndroidのLANはTXTをその場で更新できないため、切り替えのたびにNSD登録を
  解除して再登録し、約1秒labelが広告されない。hostが無線を起動し直した直後は、非表示に戻すまでの短い間
  listingが出る（その間の申請も断る）。BLEの非表示が探索側に届くまで10〜25秒かかる。
  物理リンクの上限は3本のままなので、ゲスト3人が着席したWi-Fi（LAN）の部屋で、自分の手番の途中に回線を失った人は、
  host側に古い接続が半開きで残ると接続を断られ、戻れない。hostがその席をCPUへ替えると、状態の送信で古い接続が
  15秒で外れて戻れるようになる。2人用と同じく周期的な生存確認は行わない。
  hostが明示的に退出したとき、離席中のゲストには終了の通知が届かないため、その人が自分で退出するまで
  「再接続しています…」のまま残る。1.6.1以前のhostは`resume`を無視するので、版をそろえて使う。
- 画面は、離席した席に「離席中」、ゲストの再接続中に「再接続しています…」を示す。
  ゲストのLeave確認は、席がCPUに替わり、このゲームには戻れないことを伝える。
  hostのLeave確認は従来どおり、hostが退出すると全員のゲームが終了することを伝える。
  文言の来歴は[I18N_POLICY.md](../I18N_POLICY.md)。
- 保証しないもの。初回ECDHの本人認証の限界（上の2人用と同じ）、OSによる無制限の実行、
  プロセス終了後の復元、リンクが切れている間に押された退出（相手に届かないので、
  その席はhostがCPUへ替えるまで離席中のまま）。
- 検証の範囲は、自動テスト（`groupSession`、`groupController`の結合、`GroupRoot`、AndroidのJVM、
  iOSのswiftc）と、Androidのコンパイル、iOSシミュレータのビルドだけである。
  離席しても席を保持して全員が待つ、hostがCPUへ替える、proofによる復帰、退出がCPUになる、
  対局中の参加の断り、対局中の非表示、hostの無線の起動し直し、プロトコル違反の追放を検査する。
  BLE/LANの実機、OSの混在、背景への移行、iOSのLAN listenerの`.waiting`（現在は`fail`になり、
  JSがhostの無線を起動し直す）は未確認である。

## 既存13本の2人用 Nearby Play の契約（2026-10-25 採用）

オーナーの実装指示により製品へ導入し、1.5.1 の実機フィードバック後に継続動作と
ゲームを起点とする導線を改定した。以下は採用した製品契約であり、この新設計を出荷済み・
実機検証済みとは扱わない。1.5.1 で確認した範囲は下に記す。
旧PoC記録の「製品へ導入しない」「保存しない」「前面限定」は当時の状態であり、現在の製品契約ではない。

- native の対応ゲームtopに「誰かと遊ぶ」を置き、近くの相手とBluetooth／同一Wi-Fiで遊ぶことを
  短く補足する。対応は Yacht / Reversi / Connect Four / Gomoku / Checkers / Gin Rummy / Mancala / Dominoes / Dots and Boxes / Chess / Nested Tic-Tac-Toe / Scopa / Nim の13本。コレクションには参加専用の「近くの対戦相手を探す」を置く。
  Club House直下に、Club Houseと同程度の控えめなテキスト行として配置する。
  Club Houseの内部からは開始しない。未対応ゲームには未実装のボタンを出さない。
  ゲームはシェルから渡されたcallbackを呼び、`src/app/nearbyGate.ts` からだけ動的に
  `src/nearby/` を読み込む。ゲームからNearbyをimportしない。
  Webのコレクションには無効な「近くの対戦相手を探す」、対応13本のtopには無効な「誰かと遊ぶ」ボタンと「アプリ専用の機能です」を表示する
  （英語は “Play with someone” / “Available in the app only.”）。開始callbackは渡さず、
  接続画面へ遷移しない。Web buildには `src/nearby/` の実行コード・通信chunkを含めず、
  探索・権限要求・接続・Nearby履歴読取を行わない。nativeでも未利用時の探索・権限要求・履歴読取は無い。
- 初期範囲2人、Bluetooth優先／同一LANを明示選択。host=advertise/listen、参加者=browse。
  ゲーム選択済み → 募集／参加 → 表示名で申請 → host承認 → 双方Ready → 既存と共通のゲーム画面。
  コレクションからは接続方法選択 → 明示探索 → 全13本の募集名＋ゲーム名・人数一覧 → 募集選択 →
  自分の表示名 → 接続・host承認 → 双方Ready → 対象ゲームへ進む。募集作成は各ゲームtopのまま。
  探索中は盤面/Viewや履歴を読み込まず、選択後にそのゲームのmoduleを読み込み、同じcontrollerと
  native探索世代を保って接続する。全体探索を閉じると探索を停止し、参加後はホームへ戻っても保持する。
  初回に同じゲームを改めて提案する操作を求めない。内部protocolの提案・確認は維持でき、
  同時に同じroundを提案した場合は1件へ合流して既存のReadyを消さない。参加前自由コメント無し。
  既存の共通Sessionが持つYacht互換adapter/engineへの静的参照は残る。選択前に全ゲームのadapter/Viewを読み込む構成にはしない。
  1.5.4向けに「仲間と／近くの人を募集」の2択を廃止し、すべてhost承認制・定員2人とする。
  募集名はゲーム名＋短い番号を初期値に編集できる24 Unicode文字以内の別フィールドとし、
  個人の表示名で代用しない。一覧・待合・新履歴の主見出しは募集名、参加者の表示名は別行に示す。

- シェルの `App` は接続を所有する `NearbyRoot` とcontrollerをマウントしたまま保持する。
  ゲームtopへ戻ると `visible=false` で非表示にし、同じ入口から同じ対戦へ戻す。
  通常ゲーム画面のアンマウントや会話を閉じる操作では切らず、新しい集まりを重複開始しない。
  非表示中のNearby画面では入力・キーボード・戻る操作のリスナーやアニメーションを無効化し、
  接続と論理状態を保持する。明示退出／解散で接続を終了するほか、`NearbyRoot` 自体の
  最終アンマウントでは停止・資源解放する(エラー／reset／アプリ終了時のcleanup)。
  一時切断や終了条件の詳細は下記に従う。
- ゲームが主で、募集時にhostがチャットの有無を選ぶ（初期値OFF）。その集まりの終了まで固定し、
  再戦・再接続でも維持する。参加者には接続後、対局の準備前から有無を示す。OFFでは双方の
  会話ボタン・未読表示・送信欄を出さず、Sessionでもメッセージの送受信を認めない。
  ONのチャットは「会話」ボタンから任意に開く。ゲームと同格のタブにはしない。
  受信で会話を自動表示しない。終局後は結果と再戦を主にし、接続を保持して双方Readyで再戦する。
  集まりは開始時のゲームに固定し、別ゲームへ続ける切替機能は含めない。
- 新規募集の発見labelは共通の `P-` + ゲーム識別2桁hex + ランダム4桁hex。ゲーム識別に
  `0x80`を加えた `81`〜`9C`(2026-11-07時点。上限は `0x80` | `nearbyGameIds.ts` の最大code)を使い、
  公開募集metadataのreadが部屋を占有しない実装だと示す。
  従来の`01`〜`0D`にBLE metadata probeを行うと旧ホストを終了させるため、決してprobeしない。
  discovery v1／metadata無し／非対応protocolの募集はゲーム別・全体探索の両方で表示しない。
  募集名を交換する両端末を1.5.4へ更新する。1.5.3以前との混在対戦は提供しない。
  公開metadataはUTF-8 JSON `v:2 / label / roomName / gameId / protocol:7 / available:true`、
  LANはBonjour TXTの`listing`（keyと`=`込み255byte以内）、BLEはread-only META UUID
  `9b5d2003-7a4c-4e13-a280-75d53c01a268`。購読せず募集情報だけを読むprobeは参加・承認・対局を開始しない。
  probeは同時1件、候補16件、個別5秒、全体探索60秒で上限を持つ。消失候補は一覧から外す。
  metadataの型・文字数・gameCode対応・対応protocolを検査し、接続後のhelloでもgameと募集名を照合する。
  接続中・継続待ちの部屋は新規募集metadataを公開しない。3席以上の部屋は、対局中、
  またはゲスト席がすべて人間の間も公開しない（発見labelは広告し続ける。2026-10-27の節）。
  名前は未認証の自己申告である。
  募集開始前に募集名とゲームが近くの人に見えることを説明し、個人の表示名・端末名・install ID・履歴を含めない。
  すべてhost承認必須。labelは公開される番号で、招待秘密や本人証明ではない。
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
- room wire v7（v6以前とは混在不可）。helloに個人の表示名・host/guest・sessionnonce・ローカルブロック用install ID。
  hostのhelloで募集名を共有し、探索で選んだ募集名と照合する。個人の表示名は別に扱う。
  hello・admission・各対局wireでgameIdを照合する。hostのhelloにはチャット可否を必須とし、guestが部屋の設定を上書きすることは認めない。
  admission／admission-ackでも同じ設定を照合し、不一致は承認しない。
  hostのadmissionとguestのadmission-ack完了前はチャット・Ready・対局操作を認めない。
  install IDは端末内に作るランダム値で、OS識別子を使わずサーバーへ蓄積しない。
  ブロックはそのIDだけを対象とし、再インストール／改造で回避できる。
- チャットOFFの集まりでチャットwireを受け取った場合はprotocol違反として終了し、内容を保存しない。
  ONのチャットはUnicode160文字、制御文字／双方向制御／不正surrogate拒否。各方向1件だけ
  未ACKで送信できる。独立したchat seq/ACKで受信済みを示し、既読とは呼ばない。
  送受合計1000件で接続終了。チャットACKでstateのpendingを解除しない。
- 各ゲームの合法手・乱数・採点はhostが確定。初期／各操作／最終stateのACKを待つ旧v2の
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
- `nearby/games.ts` が選択ゲームのadapterとViewだけをlazy loadする。`nearby/games/<id>.ts` は
  同じゲームの純粋engine/typesを使い、Viewは既存の盤面・手札・操作hook・i18n・CSSを共有する。
  別ゲームやCPU・通常ゲームのstate/provider/storage・Clubへのruntime依存は禁止する。
  境界テストはbarrelを含む推移的runtime依存も確認する。旧`nearby/yacht.ts`は互換re-export。
- hostの完全状態と各席へ投影した公開状態を分離する。Gin Rummy / Dominoes / Scopaは自分の手札、
  相手の枚数、場札、公開結果だけを投影し、seed・山札順・未公開の相手手札を送らない。
  配札はhostの乱数関数を直接使い、32bitのseedから手札を推測できる形に縮約しない。
  Ginの精算時に両手札が公開されることはゲーム規則による。
- 各対局はgameId/round/revisionを持つ。Session JSON上限2600 UTF-8 bytes、delivery込み2800、
  native暗号文4096の各上限を維持する。Chessは盤面FENと終局理由・直前手だけを送る。
  手順履歴・三fold反復判定はhostが保持する。切断時も同じhost状態を保持する。
- 公開盤面ゲームはhostが先手。カード・Dominoesは既存の配札・開始規則に従う。
  Dots and Boxesは募集時に3×3 / 4×4 / 5×5を選び、再戦も同じサイズ。一方的なUndoは無い。
  通常CPU戦の保存・統計・Club結果を更新しない。履歴にはgameId/勝敗を追加し、旧v1 Yacht履歴も読める。

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
各参加者が自分の送受信チャットと参加した対局（日時・募集名・参加者の表示名・点数・完了／中断）を保存する。
同じhistory v1に任意の `displayName` を追加し、自分の表示名をこの端末で次回入力に再利用する。
個人の表示名は24 Unicode文字以内で、開始前に変更できる。別端末へ設定同期せず、公開探索metadataにも含めない。
各履歴の任意の `roomName` は募集名の主見出しとし、参加者名は別に表示する。
これらのフィールドが無い旧history v1も読み込み、募集名の無い旧履歴は従来の参加者名を見出しに使う。
session鍵・native接続先は保存しない。参加前申請は履歴化しない。
履歴IDは各端末で新規生成し、相手から届くsession IDの再使用で過去の履歴を置換させない。
同じ集まりの未実行保存は最新1件へまとめる。読み込み・削除・ブロックの順序を越えて
まとめず、削除済みの記録を古い保存待ちから復活させない。復号前のJSイベント待ちも64件で制限する。

退出・切断で消さず、読むだけで通信しない。履歴1件削除、Nearby全削除、設定のローカルデータ削除を
用意する。相手側のコピーには影響しない。上限1MiB/100集まり、native境界2MiB。
個別の履歴削除では次回入力用の表示名を保ち、Nearby全削除・設定のローカルデータ削除では
保存した表示名とブロック情報も削除する。通常バックアップ・OSバックアップ除外はこれらの設定にも適用する。
容量不足・破損・未知versionでは保存失敗を表示し、保存済みデータを初期値で上書きしない。
上限で古い履歴を自動削除しない。保存に失敗した新しい内容は永続化を保証しない。

### 公開前に残る確認

今回の導線は、アプリの両端末とWebで次を確認する。記載しただけでは完了としない。

- 対応13本それぞれのtopの入口から募集／参加でき、初回の重複提案操作なしでhost承認・双方Readyを経て
  共通画面へ進む。コレクションにはClub House直下の参加専用入口を置き、募集作成は各ゲームtopから行う。
  Clubの内部・未対応ゲームには開始入口を置かない。
- Webの対応13本のtopでは無効ボタンとアプリ専用の説明だけが表示され、接続画面を開けない。
  Web成果物にNearbyの実行コード・通信chunkが無く、探索・権限要求・接続・Nearby履歴読取が発生しない。
- ゲームtopへ戻ってから同じ入口で同じ盤面へ戻れる。会話を閉じる・結果へ進む・再戦する操作で
  接続を終了せず、明示退出／解散では接続資源を解放する。
- 募集時のチャットON／OFFが両端末に一致し、OFFでは会話操作・送受信が無くても対局・再戦・再接続できる。
  ONでは受信しても閉じている会話を自動表示せず、対局操作を妨げない。終局結果と再戦の導線を主にする。
- アプリ切替と無線のOFF／ONから、PR #285の継続条件どおり同じ相手・盤面へ戻れる。
  CPU戦の保存・統計とNearbyの端末内履歴を混ぜない。
- 募集名と個人の表示名が一覧・接続後・履歴で混ざらず、探索では個人名を公開しない。
  旧履歴読取、表示名の次回入力、個別削除と全削除の違いを確認する。定員は2人で、すべてhost承認を経る。

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
