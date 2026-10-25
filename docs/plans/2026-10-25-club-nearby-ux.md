# Nearby Play — 採用した体験と実装範囲

Updated: 2026-10-25 / #268

旧 Club House 配下の案を、この文書で置き換える。名称は Nearby Play。
Club House は記録を持ち寄る入口、Nearby Play は近くの人と対戦・チャットする別の入口。

## 画面遷移

1. コレクション → Nearby Play →「集まりを作る」「参加する」「履歴を見る」。
2. 作る: 表示名、仲間と／近くの人を募集、Bluetooth／同じ Wi-Fi を選び開始。
   発見用の短い番号を表示し、参加申請を待つ。最初はホストを含め2人。
3. 参加: 表示名と方式を選んで探索。見つかった集まりを選ぶと参加申請。
   自由コメント無し。ホストは相手の表示名を見て承認／断る。
4. 承認後の集まり: チャットだけでも使える。ホストは Yacht を提案できる。
   双方が「準備できました」を押したら対局。チャットと盤面は切替できる。
5. 終局: 両者の点数と勝敗。チャットへ戻る、ホストが再戦を提案する。
   結果確定／再戦は受信確認を待つ。終局しても集まりを解散しない。
6. 退出／解散／切断／background: 接続を終了。今回の履歴は残る。
   相手の離脱後に新しい相手とつながるには、新しく集まりを作る。
7. 履歴: 集まりの日時・表示名・送受信チャット・Yacht結果／中断を読む。
   通信・再接続ボタン無し。削除は自分の端末だけ。全データ削除にも含める。

## 仕様の境界

- 2人、Yacht、160文字までのテキスト。画像・DM・オンラインランキング・通知無し。
- 仲間との接続もホスト承認必須。表示名と発見番号は本人認証ではない。
- 公開探索には個人名を載せず、P-/F-付きランダム番号だけを広告する。
- 受信確認は既読ではない。送信中／届いた／未確認を区別する。
- 保存した履歴は退出で消さず、Club・自社サーバー・アプリ／OSバックアップへ渡さない。
- 旧PoC実機成功は新UI・参加承認・チャット・保存の実機成功を意味しない。
- 不快な相手からは退出、チャット非表示、インストール識別子のローカルブロック。
  通報は既存サポートへの本人操作で行い、履歴の自動送信はしない。
  UGCの規約・対応運用・ストア審査は公開前に別途確認する。

## 2026-10-25 実装・検証記録

- `src/nearby/` に製品画面、wire v3、暗号化channel、端末内履歴を実装。
  Android/iOS の小さな native plugin は OS 標準 BLE / LAN を使う。追加 SDK なし。
  既存ソロの保存・統計・Club の送信には入れず、Web には入口と通信実装を出さない。
- 最終 Nearby / import boundary: 8 files・127 tests PASS。実 WebCrypto の双方向通信、
  承認／拒否、双方 Ready、Yacht、ACK欠落、再戦、履歴保持、相手nonceの再使用、
  1000回の保存更新の集約、削除の順序、過剰な受信待ちの終了を含む。
- 既存ホーム／Club の94 tests、設定の16 tests PASS。Nearby削除の成功を待ってから
  他の保存を消し、失敗時は既存データと設定を保持することも確認。
  i18n gate／保存キーの回帰、型検査、ESLint、native/Web build、既存サイズgate、
  Web広告分離、PoC混入防止、原則gateもPASS。
- Android 製品Java/JUnit、unsigned release/R8のartifact audit、権限制約の回帰16件PASS。
  iOS nativeの署名なしgeneric buildとnative履歴16チェックPASS。
- 実UIを開発用の模擬peerに接続し、日本語390pxで作成・承認・chat・Yacht開始と切替、
  ドイツ語320pxで作成フォームの横はみ出し無しを確認。模擬通信であり実機証拠ではない。
- 初回のUI回帰試験は並行native build中に5秒timeoutが多発したため、負荷が下がってから
  単一worker・既定timeoutで再確認した。恒久的にtimeoutを延長してはいない。

独立レビューで修正した点: 拒否frameの短い送信猶予、旧接続の遅い完了から新接続を守るowner、
履歴IDの端末側生成、保存待ちの集約、受信待ちの上限、削除失敗の表示。
6桁コードは誤接続確認の補助であり、本人認証・能動的中間者攻撃への耐性を保証しない。

新製品版の両実機での相互接続・OSバックアップ除外、同OS／旧端末／WANなしLAN／電池、
規約・通報対応・公開プライバシー文面・翻訳の意味確認は残る。旧PoCの成功と混同せず、
PRはdraftを維持する。Epic #268 の全完了やストア公開済みとはしない。

### 最終製品bundleとAndroid容量

製品実装commit `c2102b63` と同じ runtime/native/build source で計測。
導入前baselineは `275c91f3f5b17e66a27110102abe84d63da86bf0`。
両者を隔離したstagingに置き、release/R8/resource shrink、version 0.0.0 / 1、
compile/target 36・min 24、Meta off・広告 off・同じGoogle test AdMob ID、同一の専用test署名、
同じ解決済み依存で作成した。Gradle 8.14.3 / AGP 8.13.0 / Java 21.0.12 / Node 25.5.0、
bundletool 1.18.1、保存済みPixel 9 Pro API 37のdevice spec（arm64-v8a、en/ja、xxhdpi）。

| 値 | 導入前 | Nearby Play同梱後 | 増分 |
| --- | ---: | ---: | ---: |
| bundletool推定download bytes（MIN=MAX） | 5,099,388 | 5,161,636 | **62,248** |
| release AABのファイルbytes | 7,646,894 | 7,729,100 | 82,206 |

配布に入るWeb assetsのbyte一致、R8後のPlugin/BLE/LAN/HistoryStore保持、PoC不在、
依存・署名の同一性、権限の意図した差分、release非debuggable、Meta不在を確認した。
これは1つのdevice spec・test署名・広告無効条件の圧縮download推定であり、実install size、
他端末、本番署名／広告条件、正式な+500KB gate全体の完了ではない。

ローカルの詳細出力はignoredな `apps/simple-games/prototypes/nearby/build/product-size-study/result.json`。
結果SHA256: `103da314d4df66837834aca366ff17640a1c53fca57e5677f4fb91102a33dc89`。
候補source snapshotのhash一覧SHA256: `77ad47a0c6c14dca82fcf5a83e0d61facfa0b91c2538f5c93eaae77b4bb8ca53`。
候補AAB SHA256: `0128e5272ed9a802864171792586fe33a1b4e1bd32e38c0c29c7f9ab1262090a`。

iOSも最終distを `cap copy ios` 後に署名なしgeneric build成功。
App.app内の全242 Webファイルがdistと一致し、同じ `nearby-BCKUmp82.js`
（SHA256 `f38236643f7bf3d13ce270a304a18a1bf0f0aea40b18b35ef2585771c51c75c2`）と
NearbyPlayPlugin／履歴store、14言語権限文言を同梱。署名・実機installはしていない。
最終UIでは参加→chat→退出→閲覧専用履歴も模擬peerで確認した。
