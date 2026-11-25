#!/usr/bin/env bash
# ブランド原則のうち、機械が判定できるものを CI で守る。
#
# docs/PRODUCT_PRINCIPLES.md / docs/ADS_POLICY.md / docs/OFFLINE_POLICY.md /
# docs/PRIVACY_POLICY.md が約束していることを、「公開ソースで確認できる」状態に保つのが
# 目的。docs/RELEASE_CHECKLIST.md 「2. ブランド原則の実地確認」のうち、grep で確定判定
# できる項目をここに移してある(実機確認が要る項目は移せないので、チェックリストに残る)。
#
# 判定できるのは "存在しないこと" が中心である。ここが緑でも実地確認の代わりにはならない。
#
# ローカル実行:
#   bash .github/scripts/check-principles.sh
set -uo pipefail
cd "$(dirname "$0")/../.."

fail=0
report() { # report <見出し> <ヒット内容>
  printf '\n\033[31mFAIL\033[0m %s\n%s\n' "$1" "$2"
  fail=1
}
ok() { printf '\033[32mok\033[0m   %s\n' "$1"; }

src_dirs=()
for d in apps/*/src packages/*/src; do [ -d "$d" ] && src_dirs+=("$d"); done
manifests=(apps/*/android/app/src/main/AndroidManifest.xml)
pkg_jsons=(package.json apps/*/package.json packages/*/package.json)

# 本番の AdMob **アプリ** ID が入りうるネイティブ側のファイル。ユニット ID は
# `src` から注入されるが、アプリ ID はビルドシステムが持つ: Android は Gradle の
# manifestPlaceholder(build.gradle)、iOS は Xcode のビルド設定(project.pbxproj)
# から Info.plist の GADApplicationIdentifier へ入る。**どちらもテスト ID を
# フォールバックとして持つので、うっかり本番 ID を書き換えてコミットできてしまう**
# — §5 がここも見るのはそのためである。
native_ad_ids=()
for f in apps/*/android/app/build.gradle \
         apps/*/ios/App/App.xcodeproj/project.pbxproj \
         apps/*/ios/App/App/Info.plist; do
  [ -f "$f" ] && native_ad_ids+=("$f")
done

# 1. 通信しないこと ------------------------------------------------------------
# Core(apps/simple-games/src/club/ を除く全ソース)は fetch 系の API(fetch( /
# XMLHttpRequest / WebSocket / sendBeacon / EventSource)で通信しない。ネットワークの
# 用途はオンライン判定と広告 SDK / 課金 SDK / レビュー SDK だけで、Core 自身の
# コードが fetch 系で通信することはない。遠隔対戦の WebRTC / STUN(方針は採用済み・
# 未実装、issue #280)は fetch 系の語彙に入らず、§1c が見る(下の段落)。
#
# fetch 系の例外は 1 つだけ、パスで宣言する。2026-09-09、issue #176 で「Club House」
# (2026-09-09 時点の名は Shared / Private Game Club)という任意加入のレイヤーを
# 認めた: 利用者が明示的に
# 接続した端末だけが、利用者または友人が自前で立てたサーバーへ挑戦の結果
# (結果画面が表示した事実)だけを送る。PixApps 自身はサーバーを一切運用しない(詳細は
# docs/PRODUCT_PRINCIPLES.md「Club House」)。2026-09-30 に PixApps が運用する
# Public デプロイを 1 つ認めたが、**この例外は 1 ディレクトリのまま**である —
# fetch 系で通信するのは端末側の `club/` だけで、相手が誰のサーバかは関係しない
# (issue simple-games-club#1)。実装は issue #161 で apps/simple-games/src/club/
# に着地した(ゲートは先に宣言してあり、docs/architecture/club.md §12 が機械で
# 示す項目の一覧)。club/ の中で許すのは `fetch(` / XMLHttpRequest だけで、
# WebSocket / EventSource / sendBeacon と `setInterval(` は club/ でも禁止する
# (下の §1b)。
#
# 「有効化しない限り送信しない」は grep では示せない性質なので、reachability で
# 示す: src/test/importBoundaries.test.ts のルール 5 が、club/ の外から届くのは
# src/app/ からの動的 import() だけであることを強制し(静的 import・
# import type・`import('x').T` 型・import.meta.glob はすべて拒否)、サイズゲートが
# club/ をエントリの静的グラフから締め出す。サーバー実装自体は
# apps/*/src / packages/*/src の下に置かれない(別リポジトリ)ので、§1 のパスの例外は
# これ 1 つで尽きる。
#
# WebRTC は fetch 系の語彙に入らないので、§1 は見ない。別の語彙として §1c が見て、
# その例外は apps/simple-games/src/nearby/remote/ の 1 ディレクトリだけである(遠隔対戦、
# issue #280。未実装で、club/ のときと同じくゲートを先に宣言してある)。club/ の例外は
# WebRTC に及ばず、remote/ は §1 の例外ではない(remote/ にも fetch( / WebSocket は書けない)。
#
# 成果物(ビルド後のファイル)に対する fetch( の grep はわざと採用していない:
# ネイティブビルドには Vite の modulepreload polyfill、@capacitor/core
# (CapacitorHttp)、@capacitor/filesystem がそれぞれ fetch( を含むことを
# 2026-09-09 に確認済みで、成果物からは Core 由来か SDK 由来かを区別できない。
# ここで証明しているのは「トークンが無いこと」ではなく「到達できる経路が無い
# こと」である。
net_api='\bfetch\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|EventSource'
net_allowed='^apps/simple-games/src/club/'
hits="$(grep -rnE "$net_api" "${src_dirs[@]}" | grep -vE "$net_allowed" || true)"
if [ -n "$hits" ]; then
  report "Core のソースにネットワーク API があります(fetch 系の通信 API を書けるのは apps/simple-games/src/club/ だけです — docs/PRODUCT_PRINCIPLES.md「Club House」)" "$hits"
else
  ok "fetch 系の通信 API なし(Core。例外は apps/simple-games/src/club/ のみ。WebRTC は §1c)"
fi

# 位置情報は Club House でも使わない。除外なしの独立した検査にする。
hits="$(grep -rnE '\bnavigator\.geolocation' "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "位置情報 API があります(Club House を含め、いかなる経路でも使いません)" "$hits"
else
  ok "位置情報 API なし(例外なし)"
fi

# 自己検査(§7 と同じ理由): 不在を検査するガードの最悪の壊れ方は「何も見ていない
# 状態で緑になる」ことである。除外パターンが壊れると向きが 2 つある —— Core の
# 通信も見逃す向きと、club/ 以外の行まで拾って赤くする向き —— ので、トークン
# ごとに 1 本ずつ当て、除外の効き方(除外されない/される)を実データではなく
# 既知の文字列で確かめる。まとめて 1 文で当てると、どれか 1 つが生きているだけ
# で緑になり他が壊れても素通りする(§6/§7 と同じ落とし穴)。
probe_net_lines=(
  'apps/simple-games/src/services/network.ts:12:  const r = await fetch(url)'
  'apps/simple-games/src/services/network.ts:12:  const r = new XMLHttpRequest()'
  'apps/simple-games/src/services/network.ts:12:  const r = new WebSocket(url)'
  'apps/simple-games/src/services/network.ts:12:  navigator.sendBeacon(url)'
  'apps/simple-games/src/services/network.ts:12:  const r = new EventSource(url)'
)
probe_core_mentions_club='apps/simple-games/src/ui/x.ts:3:  // apps/simple-games/src/club/ may call fetch('
probe_club_line='apps/simple-games/src/club/api.ts:1:  const r = await fetch(url)'
probe_geo_club='apps/simple-games/src/club/x.ts:1: navigator.geolocation.getCurrentPosition(f)'
dead=""
for probe in "${probe_net_lines[@]}"; do
  if ! printf '%s' "$probe" | grep -qE "$net_api"; then
    dead="${dead}net_api がトークンを検出できません: ${probe}"$'\n'
  elif printf '%s' "$probe" | grep -qE "$net_allowed"; then
    dead="${dead}Core の行が誤って除外されています: ${probe}"$'\n'
  fi
done
if ! printf '%s' "$probe_core_mentions_club" | grep -qE "$net_api"; then
  dead="${dead}net_api がトークンを検出できません: ${probe_core_mentions_club}"$'\n'
elif printf '%s' "$probe_core_mentions_club" | grep -qE "$net_allowed"; then
  dead="${dead}行の中身に club/ が出てくるだけで除外されています(パス以外を見ています): ${probe_core_mentions_club}"$'\n'
fi
if ! printf '%s' "$probe_club_line" | grep -qE "$net_api"; then
  dead="${dead}net_api がトークンを検出できません: ${probe_club_line}"$'\n'
elif ! printf '%s' "$probe_club_line" | grep -qE "$net_allowed"; then
  dead="${dead}club/ の行が除外されていません: ${probe_club_line}"$'\n'
fi
if ! printf '%s' "$probe_geo_club" | grep -qE '\bnavigator\.geolocation'; then
  dead="${dead}位置情報パターンが検出できません: ${probe_geo_club}"$'\n'
fi
if [ -n "$dead" ]; then
  report "§1 の検査パターンまたは除外が壊れています(ガードが no-op です)" "$dead"
else
  ok "通信 / 位置情報の検査パターンと club/ 例外の自己検査(トークン別 ${#probe_net_lines[@]} 本 + 除外境界 2 本 + 位置情報 1 本)"
fi

# 1b. club/ の中でも使わない通信手段と、タイマー ---------------------------------
# §1 の例外は「club/ は `fetch(` で、人が押したときに 1 回だけ訊く」ためのものであって、
# 常時接続や裏での送信を認めるものではない(docs/architecture/club.md §12、
# docs/PRODUCT_PRINCIPLES.md「機械で示すこと」)。
#   - WebSocket / EventSource / sendBeacon: club/ を含む**全ソース**で禁止。
#     push・常時接続・ページを閉じる瞬間の送信は、この製品が約束していない通信である。
#   - setInterval(: club/ の中で禁止。順位表の更新は画面を開いたとき・押したときだけで、
#     時計で回さない(ポーリングは「接続していない端末は 0 件」の次に破れやすい約束)。
persistent_net='\bWebSocket\b|EventSource|sendBeacon'
club_dir='apps/simple-games/src/club/'
club_timer='\bsetInterval\('
hits="$(grep -rnE "$persistent_net" "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "WebSocket / EventSource / sendBeacon があります(club/ を含め、いかなる経路でも使いません — docs/architecture/club.md §12)" "$hits"
else
  ok "WebSocket / EventSource / sendBeacon なし(club/ にも例外なし)"
fi
if [ -d "$club_dir" ]; then
  hits="$(grep -rnE "$club_timer" "$club_dir" || true)"
else
  hits=""
fi
if [ -n "$hits" ]; then
  report "club/ に setInterval( があります(順位表は人が開いたとき・押したときにだけ取りに行きます — docs/architecture/club.md §12)" "$hits"
else
  ok "club/ に setInterval( なし"
fi

# 自己検査(§1 と同じ理由): トークンごとに既知の違反行を 1 本ずつ当てる。
probe_persistent_lines=(
  'apps/simple-games/src/club/live.ts:4:  const ws = new WebSocket(url)'
  'apps/simple-games/src/club/live.ts:4:  const es = new EventSource(url)'
  'apps/simple-games/src/club/live.ts:4:  navigator.sendBeacon(url, body)'
)
probe_timer_line='apps/simple-games/src/club/poll.ts:9:  const id = setInterval(refresh, 30000)'
dead=""
for probe in "${probe_persistent_lines[@]}"; do
  printf '%s' "$probe" | grep -qE "$persistent_net" ||
    dead="${dead}persistent_net がトークンを検出できません: ${probe}"$'\n'
done
printf '%s' "$probe_timer_line" | grep -qE "$club_timer" ||
  dead="${dead}club_timer が setInterval( を検出できません: ${probe_timer_line}"$'\n'
printf '%s' 'apps/simple-games/src/club/poll.ts:9:  setTimeout(refresh, 30000)' | grep -qE "$club_timer" &&
  dead="${dead}club_timer が setTimeout( まで拾っています(過剰検出)"$'\n'
if [ -n "$dead" ]; then
  report "§1b の検査パターンが壊れています(ガードが no-op です)" "$dead"
else
  ok "§1b の自己検査(通信トークン ${#probe_persistent_lines[@]} 本 + setInterval( 1 本 + setTimeout( を拾わないこと)"
fi

# 1c. WebRTC は nearby/remote/ だけ、STUN は Cloudflare の 1 つだけ、TURN は置かない ------
# 2026-11-14 のオーナー判断(issue #280)で、Nearby Play の対象ゲームを招待リンクで
# インターネット越しに遊ぶ遠隔対戦を、Core の任意モードとして採った。方針の採用であって、
# 実装も出荷もしていない。経路は WebView 標準の RTCPeerConnection の DataChannel だけで、
# 招待のリンクは本人が自分のメッセンジャーで渡し、相手が返事のリンクを返す(シグナリング
# サーバーは持たない)。STUN は Cloudflare の 1 社だけを使い、TURN(中継)は使わない。
# WebRTC の SDK・第三者の通信 SDK・native の実装は足さない
# (docs/PRODUCT_PRINCIPLES.md「遠隔対戦」7・8、docs/architecture/nearby-multiplayer.md)。
#
# §1 の net_api は WebRTC を見ていない —— RTCPeerConnection は fetch / XMLHttpRequest /
# WebSocket / sendBeacon / EventSource のどれでもないので、この節が無いと Core の
# どこに書いても §1 は緑のままになる。そこで WebRTC の語彙を全ソースで禁止し、例外を
# 1 ディレクトリだけパスで宣言する:
#   apps/simple-games/src/nearby/remote/  (NearbyPlugin と同じ口を持つ JS の実装 = 遠隔の transport)
# Session / GroupSession / Channel / Delivery とゲームの adapter は近隣と共有し、WebRTC の
# 語に触れるのはこのディレクトリだけにする。§1 の club/ の例外は fetch 系のためのもので
# WebRTC には及ばない(club/ に書いても赤)。逆に remote/ は §1 の例外ではない ——
# remote/ にも fetch( / WebSocket は書けない(シグナリングサーバーを足すなら、§1 / §1b と
# この節を、文書と同じ変更で意図的に改める)。ディレクトリはまだ無い —— club/ と同じく、
# ゲートを先に宣言する。
#
# 語彙は接続を「作る」語(コンストラクタと型)だけでなく、「動かす」語(offer / answer を作る・
# 記述を当てる・候補を足すメソッド、候補と DataChannel のイベント、ICE の設定のキー)も含める。
# remote/ が作った接続のオブジェクトを remote/ の外へ渡し、外でそれを動かす書き方も赤にするため
# である。語の前に \b を置かないのは意図: webkitRTCPeerConnection / mozRTCPeerConnection と、
# RTCSessionDescriptionInit / RTCIceCandidateInit / RTCDataChannelEvent のような派生の
# 型名、onicecandidateerror を同じ語で拾う。例外は 4 語 —— createOffer / createAnswer は前後に
# \b を置き(createOfferings / createAnswerChoices のような別の名前を拾わない。ゲームの関数を
# ちょうど createAnswer と名づけると赤になるので、そのときは名前を変える)、iceServers /
# iceTransportPolicy は前に \b を置く(deviceServers のような語の途中を拾わない)。コメントの中の
# 語も拾う(§1 と同じ。remote/ の外の説明文には「WebRTC」と書く)。
#
# STUN / TURN の宛先は remote/ を含む全ソースで許可リストにする(中継サーバーを使わない・STUN は
# Cloudflare の 1 社だけ、予備の事業者を足さない、という判断の形)。引用符(' " `)の直後に
# stun: / stuns: / turn: / turns: の URL を書いた行を拾い(大小文字を問わず、引用符の直後の空白も
# 飛ばす)、許すのは `stun:stun.cloudflare.com:3478` をそのまま 1 つの文字列にした形だけである。
# ポートを省いた `stun:stun.cloudflare.com` も同じ宛先(STUN の既定のポートは 3478)だが、許さない ——
# 書き方を 1 つに決めておけば宛先を探す grep が 1 つで済み、別のポート(53 など)や stuns: を
# 足した行が「似た形」として紛れない。同じ行に許可した URL と別の URL があれば、別の方で赤になる。
# スキームだけの文字列(`'turn:' + host`、`"stun:"`)も赤にする —— 連結で宛先を組めば、上の
# 許可リストを素通りするからである。コロンの直後が空白の行(`turn: 1` のようなキー、`turn: …` で
# 始まる文)は拾わない。
#
# ビルド時の注入も塞ぐ: 宛先を .env から VITE_TURN_URL / VITE_ICE_SERVERS のような名前で入れれば、
# ソースに URL が無くても成果物に入る。VITE_ の後の区切り(_)の頭が TURN / STUN / ICE / RTC /
# WEBRTC で始まる名前を、remote/ を含む全ソースで禁止する(VITE_SERVICE_… のような語の途中は
# 拾わない)。
#
# 依存も同じ節で見る(WebRTC の SDK・第三者の通信 SDK・native の WebRTC を足さない)。§3 / §3b は
# トラッキングの語彙で、見出しと例外(§3b の facebook-core)が違うので混ぜない。
#   - package.json: git 管理下のすべて(ルート、apps/*、packages/*、prototypes/ の下も。node_modules
#     は管理外なので入らない)のキーに、WebRTC / P2P のライブラリ名が無いこと。照合の形は §3 と同じ
#     (行頭の "名前": を見る)。
#   - Android の Gradle(*.gradle / *.gradle.kts / バージョンカタログの *.toml。settings も含む)と
#     iOS の依存宣言(Podfile / Podfile.lock / Package.swift / Package.resolved / *.pbxproj):
#     org.webrtc・io.getstream:stream-webrtc・libwebrtc・GoogleWebRTC・WebRTC.xcframework・
#     stasel/WebRTC・webrtc-sdk を webrtc の 1 語で拾い、libdatachannel と LiveKit / Twilio / Agora の
#     SDK も拾う。コメントの行も拾う。
#   - apps/*/android・apps/*/ios の下に git 管理で置いたファイルの名前(libs/ に libwebrtc.aar を
#     置くと、fileTree の宣言はライブラリの名前を出さない)。
#
# この節の限界 —— grep が示すのは「語が無いこと」までである:
#   - 計算したプロパティ名・文字列から組んだ識別子は見えない(`globalThis['RTCPeer' + 'Connection']`、
#     `pc[name](…)`)。remote/ に「到達できる経路」は別のゲートが示す ——
#     src/test/importBoundaries.test.ts の Nearby 規則(nearby/ の外から実行時に届くのは
#     app/nearbyGate.ts の動的 import() だけ)と、prototypes/nearby/check-isolation.mjs
#     (Web の成果物に src/nearby/ のモジュールが 1 つも無く、native のエントリの初期グラフにも
#     無い)。nearby/ の中の import は自由で、remote/ への入口を絞る規則と remote/ を別チャンクに
#     分ける検査は実装時(Phase 3)に足す(docs/architecture/nearby-multiplayer.md)。
#   - スキームを含まない断片から組んだ STUN / TURN の URL(`'st' + 'un:' + host` など)は見えない。
#     出荷した通信の宛先は docs/RELEASE_CHECKLIST.md 5.19 の実測が見る。
#   - VITE_ 以外の注入(src の外の vite.config の define など)と、依存が推移的に持ち込むもの
#     (lockfile・プラグイン自身の build.gradle / podspec)は見ない。依存の差分は人が読む
#     (docs/RELEASE_CHECKLIST.md 5.19)。
webrtc_api='RTCPeerConnection|RTCDataChannel|RTCIceCandidate|RTCIceServer|RTCSessionDescription|RTCConfiguration|createDataChannel|ondatachannel|onicecandidate|setLocalDescription|setRemoteDescription|addIceCandidate|\bcreateOffer\b|\bcreateAnswer\b|\biceServers|\biceTransportPolicy'
webrtc_allowed='^apps/simple-games/src/nearby/remote/'
ice_url="[\"'\`][[:space:]]*(stuns?|turns?):[^[:space:]\"'\`]"
ice_bare="[\"'\`][[:space:]]*(stuns?|turns?):[\"'\`]"
stun_allowed="'stun:stun\.cloudflare\.com:3478'|\"stun:stun\.cloudflare\.com:3478\"|\`stun:stun\.cloudflare\.com:3478\`"
vite_ice='VITE_([A-Z0-9]+_)*(TURN|STUN|ICE|(WEB)?RTC)'
webrtc_npm='^[[:space:]]*"([^"]*(webrtc|simple-peer|peerjs|datachannel|mediasoup|livekit|twilio-video|agora)[^"]*|(@[^"/]+/)?wrtc)"[[:space:]]*:'
webrtc_native='webrtc|datachannel|livekit|twilio|agora'
# 標準入力の行(path:line:content)のうち、許可した 1 つの URL を消してもなお STUN / TURN の
# URL かスキームだけの文字列が残る行を、元の形のまま出す。
ice_violations() {
  local line
  while IFS= read -r line; do
    printf '%s\n' "$line" | sed -E "s/${stun_allowed}//g" | grep -qiE "${ice_url}|${ice_bare}" &&
      printf '%s\n' "$line"
  done
  return 0
}
webrtc_pkg_jsons=()
while IFS= read -r f; do webrtc_pkg_jsons+=("$f"); done < <(git ls-files ':(glob)**/package.json')
webrtc_native_files=()
while IFS= read -r f; do webrtc_native_files+=("$f"); done < <(
  git ls-files ':(glob)apps/*/android/**/*.gradle' ':(glob)apps/*/android/**/*.gradle.kts' \
    ':(glob)apps/*/android/**/*.toml' ':(glob)apps/*/ios/**/Podfile' ':(glob)apps/*/ios/**/Podfile.lock' \
    ':(glob)apps/*/ios/**/Package.swift' ':(glob)apps/*/ios/**/Package.resolved' ':(glob)apps/*/ios/**/*.pbxproj'
)

hits="$(grep -rnE "$webrtc_api" "${src_dirs[@]}" | grep -vE "$webrtc_allowed" || true)"
if [ -n "$hits" ]; then
  report "nearby/remote/ の外に WebRTC があります(遠隔対戦の transport を書けるのは apps/simple-games/src/nearby/remote/ だけです — docs/PRODUCT_PRINCIPLES.md「遠隔対戦」、docs/architecture/nearby-multiplayer.md)" "$hits"
else
  ok "WebRTC なし(例外は apps/simple-games/src/nearby/remote/ のみ)"
fi
hits="$(grep -rniE "${ice_url}|${ice_bare}" "${src_dirs[@]}" | ice_violations)"
if [ -n "$hits" ]; then
  report "許可していない STUN / TURN の URL か、スキームだけの文字列があります(書けるのは 'stun:stun.cloudflare.com:3478' の 1 つだけで、nearby/remote/ も同じです — docs/PRODUCT_PRINCIPLES.md「遠隔対戦」8)" "$hits"
else
  ok "STUN / TURN の URL は stun:stun.cloudflare.com:3478 だけ(TURN なし・スキームの連結なし、nearby/remote/ にも例外なし)"
fi
hits="$(grep -rnE "$vite_ice" "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "STUN / TURN / ICE の宛先をビルド時に注入する名前があります(宛先はソースの 1 つの文字列に固定します — docs/PRODUCT_PRINCIPLES.md「遠隔対戦」8)" "$hits"
else
  ok "STUN / TURN / ICE を注入する VITE_ の名前なし"
fi
# /dev/null を足すのは、対象が 1 本でも grep が path: を付けるため(空なら何も読まない —— 走査対象が
# 空でないことは下の自己検査が見る)。
npm_hits="$(grep -niE "$webrtc_npm" "${webrtc_pkg_jsons[@]}" /dev/null || true)"
native_hits="$(grep -niE "$webrtc_native" "${webrtc_native_files[@]}" /dev/null || true)"
path_hits="$(git ls-files ':(glob)apps/*/android/**' ':(glob)apps/*/ios/**' | grep -iE "$webrtc_native" || true)"
hits="$(printf '%s\n' "$npm_hits" "$native_hits" "$path_hits" | grep -v '^$' || true)"
if [ -n "$hits" ]; then
  report "依存に WebRTC / 第三者の通信 SDK があります(使うのは WebView 標準の RTCPeerConnection だけです — docs/PRODUCT_PRINCIPLES.md「遠隔対戦」7)" "$hits"
else
  ok "依存に WebRTC / 通信 SDK なし(package.json ${#webrtc_pkg_jsons[@]} 本、Gradle / iOS の依存ファイル ${#webrtc_native_files[@]} 本、native のファイル名)"
fi

# 自己検査(§1 と同じ理由): トークンごとに既知の違反行を 1 本ずつ当て、除外の効き方を
# 実データではなく既知の文字列で確かめる。除外の壊れ方は 4 つある —— nearby/ 全体を
# 飲み込む向き(remote/ の外の nearby/ は Session や Channel が住む、いちばん書かれやすい
# 場所)、club/ の例外と取り違える向き、末尾の / が落ちて remote で始まる別の名前まで
# 飲む向き、行の中身に remote/ の文字があるだけで通す向き。STUN / TURN は、許可リストが
# 緩む向き(別の事業者・別のポート・同じ行の 2 つ目)と、スキームだけの文字列を見落とす向きを
# 見る。依存は名前の語ごとに 1 本ずつ当て、走査の対象が空(git ls-files の指定が外れた)でない
# ことも見る。最後に、ゲームの "turn"、端末間の暗号の Channel、似た名前の識別子・依存を
# 拾わないこと(過剰検出)も見る。
probe_webrtc_lines=(
  'apps/simple-games/src/nearby/session.ts:12:  const pc = new RTCPeerConnection(config)'
  'apps/simple-games/src/nearby/session.ts:12:  const pc = new webkitRTCPeerConnection(config)'
  'apps/simple-games/src/nearby/session.ts:12:  const open = (e: { channel: RTCDataChannel }) => attach(e.channel)'
  'apps/simple-games/src/nearby/session.ts:12:  const c = new RTCIceCandidate(init)'
  'apps/simple-games/src/nearby/session.ts:12:  const servers: RTCIceServer[] = []'
  'apps/simple-games/src/nearby/session.ts:12:  const d = new RTCSessionDescription(offer)'
  'apps/simple-games/src/nearby/session.ts:12:  const config: RTCConfiguration = {}'
  'apps/simple-games/src/nearby/session.ts:12:  const dc = pc.createDataChannel("sg")'
  'apps/simple-games/src/nearby/session.ts:12:  pc.ondatachannel = (e) => attach(e.channel)'
  'apps/simple-games/src/nearby/session.ts:12:  pc.onicecandidate = (e) => gather(e.candidate)'
  'apps/simple-games/src/nearby/session.ts:12:  await pc.setLocalDescription(offer)'
  'apps/simple-games/src/nearby/session.ts:12:  await pc.setRemoteDescription(answer)'
  'apps/simple-games/src/nearby/session.ts:12:  await pc.addIceCandidate(candidate)'
  'apps/simple-games/src/nearby/session.ts:12:  const offer = await pc.createOffer()'
  'apps/simple-games/src/nearby/session.ts:12:  const answer = await pc.createAnswer()'
  'apps/simple-games/src/nearby/session.ts:12:  pc.setConfiguration({ iceServers: [] })'
  "apps/simple-games/src/nearby/session.ts:12:  pc.setConfiguration({ iceTransportPolicy: 'all' })"
)
probe_webrtc_outside=(
  'apps/simple-games/src/club/rtc.ts:1:  const pc = new RTCPeerConnection(config)'
  'apps/simple-games/src/nearby/remoteInvite.ts:1:  const pc = new RTCPeerConnection(config)'
  'apps/simple-games/src/nearby/games/remote/chess.ts:1:  const pc = new RTCPeerConnection(config)'
  'apps/simple-games/src/ui/x.ts:3:  // apps/simple-games/src/nearby/remote/ may call new RTCPeerConnection('
)
probe_remote_line='apps/simple-games/src/nearby/remote/peer.ts:1:  const pc = new RTCPeerConnection(config)'
probe_ice_bad=(
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:stun.l.google.com:19302'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:stun.cloudflare.com'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:stun.cloudflare.com:53'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stuns:stun.cloudflare.com:5349'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['turn:relay.example.org:3478'],"
  'apps/simple-games/src/nearby/remote/ice.ts:3:  urls: "turns:relay.example.org:5349?transport=tcp",'
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: [' TURN:relay.example.org:3478'],"
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['turn:' + host],"
  'apps/simple-games/src/nearby/remote/ice.ts:3:  urls: [`turn:${host}`],'
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:' + 'stun.cloudflare.com:3478'],"
)
probe_ice_ok=(
  "apps/simple-games/src/nearby/remote/ice.ts:3:  urls: ['stun:stun.cloudflare.com:3478'],"
  'apps/simple-games/src/nearby/remote/ice.ts:3:  const STUN_URL = "stun:stun.cloudflare.com:3478"'
)
probe_vite_lines=(
  'apps/simple-games/src/nearby/remote/ice.ts:3:  const url = import.meta.env.VITE_TURN_URL'
  'apps/simple-games/src/nearby/remote/ice.ts:3:  const url = import.meta.env.VITE_REMOTE_STUN_URL'
  'apps/simple-games/src/nearby/remote/ice.ts:3:  const servers = import.meta.env.VITE_ICE_SERVERS'
  'apps/simple-games/src/nearby/remote/ice.ts:3:  const config = import.meta.env.VITE_WEBRTC_CONFIG'
)
probe_npm_bad=(
  '    "simple-peer": "^9.11.1",'
  '    "peerjs": "1.5.4",'
  '    "react-native-webrtc": "124.0.4",'
  '    "@capacitor-community/webrtc": "1.0.0",'
  '    "node-datachannel": "0.12.0",'
  '    "mediasoup-client": "3.7.17",'
  '    "livekit-client": "2.5.0",'
  '    "twilio-video": "2.28.1",'
  '    "agora-rtc-sdk-ng": "4.22.0",'
  '    "wrtc": "0.4.7",'
  '    "@roamhq/wrtc": "0.8.0",'
)
probe_native_bad=(
  "    implementation 'org.webrtc:google-webrtc:1.0.32006'"
  '    implementation "io.getstream:stream-webrtc-android:1.3.6"'
  "    implementation files('libs/libwebrtc.aar')"
  '    implementation "io.livekit:livekit-android:2.10.0"'
  '    implementation "com.twilio:video-android:7.6.4"'
  '    implementation "io.agora.rtc:full-sdk:4.5.0"'
  "  pod 'GoogleWebRTC', '~> 1.1'"
  '    .package(url: "https://github.com/stasel/WebRTC.git", from: "125.0.0"),'
  '        "location" : "https://github.com/webrtc-sdk/Specs",'
  '		A1B2C3D4E5F6A7B8C9D0E1F2 /* WebRTC.xcframework in Frameworks */ = {isa = PBXBuildFile; };'
  '    implementation "com.github.paullouisageneau:libdatachannel-android:0.1.0"'
)
probe_native_path='apps/simple-games/android/app/libs/libwebrtc.aar'
probe_not_hits=(
  'apps/simple-games/src/games/tangram/game/pieces.ts:132:  throw new Error(`turn: ${k} is off the turn lattice`)'
  'apps/simple-games/src/nearby/groupController.ts:46:  turn: (s) => s.turn,'
  "apps/simple-games/src/games/ludo/i18n.ts:9:  turnLabel: 'turn: ',"
  'apps/simple-games/src/nearby/channel.ts:40:  const channel = await createChannel(secret)'
  'apps/simple-games/src/games/shop/game/offers.ts:7:  export function createOfferings(n: number) {'
  'apps/simple-games/src/games/quick-math/game/round.ts:7:  const choices = createAnswerChoices(q)'
  'apps/simple-games/src/services/device.ts:7:  const deviceServers = []'
  'apps/simple-games/src/services/device.ts:8:  const serviceTransportPolicy = defaultPolicy'
  'apps/simple-games/src/services/ads/env.ts:7:  const notice = import.meta.env.VITE_SERVICE_NOTICE'
  'apps/simple-games/src/club/managed.ts:7:  const origin = import.meta.env.VITE_MANAGED_CLUB_ORIGIN'
)
probe_dep_not_hits=(
  '  "peerDependencies": {'
  '    "@capacitor/core": "8.4.2",'
  "    implementation project(':capacitor-app')"
)
dead=""
for probe in "${probe_webrtc_lines[@]}" "${probe_webrtc_outside[@]}"; do
  if ! printf '%s' "$probe" | grep -qE "$webrtc_api"; then
    dead="${dead}webrtc_api がトークンを検出できません: ${probe}"$'\n'
  elif printf '%s' "$probe" | grep -qE "$webrtc_allowed"; then
    dead="${dead}remote/ の外の行が誤って除外されています: ${probe}"$'\n'
  fi
done
if ! printf '%s' "$probe_remote_line" | grep -qE "$webrtc_api"; then
  dead="${dead}webrtc_api がトークンを検出できません: ${probe_remote_line}"$'\n'
elif ! printf '%s' "$probe_remote_line" | grep -qE "$webrtc_allowed"; then
  dead="${dead}nearby/remote/ の行が除外されていません: ${probe_remote_line}"$'\n'
fi
for probe in "${probe_ice_bad[@]}"; do
  [ -n "$(printf '%s\n' "$probe" | ice_violations)" ] ||
    dead="${dead}許可していない STUN / TURN の URL を検出できません: ${probe}"$'\n'
done
for probe in "${probe_ice_ok[@]}"; do
  printf '%s' "$probe" | grep -qiE "$ice_url" ||
    dead="${dead}ice_url が許可した URL の行を拾えていません(許可リストが何も見ていません): ${probe}"$'\n'
  [ -z "$(printf '%s\n' "$probe" | ice_violations)" ] ||
    dead="${dead}許可した 1 つの URL を赤にしています: ${probe}"$'\n'
done
for probe in "${probe_vite_lines[@]}"; do
  printf '%s' "$probe" | grep -qE "$vite_ice" ||
    dead="${dead}vite_ice が注入の名前を検出できません: ${probe}"$'\n'
done
for probe in "${probe_npm_bad[@]}"; do
  printf '%s' "$probe" | grep -qiE "$webrtc_npm" ||
    dead="${dead}webrtc_npm が依存を検出できません: ${probe}"$'\n'
done
for probe in "${probe_native_bad[@]}" "$probe_native_path"; do
  printf '%s' "$probe" | grep -qiE "$webrtc_native" ||
    dead="${dead}webrtc_native が依存を検出できません: ${probe}"$'\n'
done
for probe in "${probe_not_hits[@]}"; do
  if printf '%s' "$probe" | grep -qE "$webrtc_api|$vite_ice" ||
    [ -n "$(printf '%s\n' "$probe" | ice_violations)" ]; then
    dead="${dead}WebRTC / STUN / TURN 以外の行を拾っています(過剰検出): ${probe}"$'\n'
  fi
done
for probe in "${probe_dep_not_hits[@]}"; do
  printf '%s' "$probe" | grep -qiE "$webrtc_npm|$webrtc_native" &&
    dead="${dead}WebRTC 以外の依存を拾っています(過剰検出): ${probe}"$'\n'
done
printf '%s\n' "${webrtc_pkg_jsons[@]}" | grep -qxF 'apps/simple-games/package.json' ||
  dead="${dead}package.json の走査対象に apps/simple-games/package.json がありません(git ls-files の指定が外れています)"$'\n'
for f in apps/simple-games/android/app/build.gradle apps/simple-games/ios/App/App.xcodeproj/project.pbxproj; do
  printf '%s\n' "${webrtc_native_files[@]}" | grep -qxF "$f" ||
    dead="${dead}native の依存ファイルの走査対象に ${f} がありません(git ls-files の指定が外れています)"$'\n'
done
if [ -n "$dead" ]; then
  report "§1c の検査パターンまたは除外が壊れています(ガードが no-op です)" "$dead"
else
  ok "§1c の自己検査(WebRTC トークン別 ${#probe_webrtc_lines[@]} 本 + 除外境界 $(( ${#probe_webrtc_outside[@]} + 1 )) 本 + STUN / TURN の違反 ${#probe_ice_bad[@]} 本・許可 ${#probe_ice_ok[@]} 本 + VITE_ ${#probe_vite_lines[@]} 本 + 依存 $(( ${#probe_npm_bad[@]} + ${#probe_native_bad[@]} + 1 )) 本 + 走査対象 3 本 + 過剰検出なし $(( ${#probe_not_hits[@]} + ${#probe_dep_not_hits[@]} )) 本)"
fi

# 2. 広告フォーマット ----------------------------------------------------------
# Anchored Adaptive Banner 以外は「未使用」ではなく「不在」であることが約束(ADS_POLICY)。
# 散文の "no interstitial" を拾わないよう、識別子の形だけを見る。
hits="$(grep -rnE '\bInterstitial|\bRewarded[A-Z]|RewardVideo|RewardAd|\bAppOpen|\bNativeAd\b' "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "バナー以外の広告フォーマットが参照されています(docs/ADS_POLICY.md)" "$hits"
else
  ok "広告はバナーのみ"
fi

# 3. トラッキング系の依存 ------------------------------------------------------
# analytics / トラッキング / クラッシュレポートを入れない(PRIVACY_POLICY)。
hits="$(grep -rniE '^\s*"[^"]*(firebase|analytics|amplitude|mixpanel|segment\.io|posthog|sentry|appsflyer|onesignal|crashlytics|facebook)[^"]*"\s*:' "${pkg_jsons[@]}" || true)"
if [ -n "$hits" ]; then
  report "analytics / トラッキング系の依存が追加されています" "$hits"
else
  ok "トラッキング系の依存なし"
fi

# 3b. ネイティブ側のトラッキング系依存 -------------------------------------------
# package.json だけを見ていると、Gradle / Swift Package Manager に足した SDK は
# 素通りする(issue #204 が名指しした穴)。ネイティブの依存宣言も同じ語彙で見る。
#
# 例外は 1 つだけ、場所と形まで固定して宣言する(2026-09-27、issue #204):
# Android の Meta インストール計測 —— `apps/simple-games/android/app/build.gradle`
# の `if (sgMetaEnabled) {` の直後の行に置いた
#   releaseImplementation "com.facebook.android:facebook-core:$sgMetaSdkVersion"
# だけで、版は同じファイルの `def sgMetaSdkVersion = "X.Y.Z"` に固定値で書く
# (`+` / `latest.*` / 範囲指定は不可)。debug・iOS・Web には入らない。
# 他の Facebook / Meta モジュール(login / share / messenger / Audience Network …)、
# 他の analytics・MMP・クラッシュレポートはどこにも書けない。
# 方針: docs/PRODUCT_PRINCIPLES.md「Android の獲得計測」、手順と送信内容:
# docs/META_ANDROID_ACQUISITION.md。
native_tracking='facebook|fbsdk|audience-?network|firebase|crashlytics|appsflyer|adjust\.sdk|com\.adjust|branch\.io|io\.branch|kochava|singular\.net|tenjin|amplitude|mixpanel|segment\.(io|analytics)|posthog|sentry|bugsnag|datadog|newrelic|flurry|onesignal'
meta_gradle='apps/simple-games/android/app/build.gradle'
meta_dep_line='^[[:space:]]*releaseImplementation "com\.facebook\.android:facebook-core:\$sgMetaSdkVersion"[[:space:]]*$'
native_dep_files=()
while IFS= read -r f; do native_dep_files+=("$f"); done < <(
  git ls-files 'apps/*/android/*.gradle' 'apps/*/android/**/*.gradle' \
    'apps/*/ios/**/Package.swift' 'apps/*/ios/**/Package.resolved' \
    'apps/*/ios/**/Podfile' 'apps/*/ios/**/Podfile.lock' 'apps/*/ios/**/project.pbxproj'
)
hits=""
for f in "${native_dep_files[@]}"; do
  [ -f "$f" ] || continue
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    n="${line%%:*}"
    text="${line#*:}"
    if [ "$f" = "$meta_gradle" ] && printf '%s' "$text" | grep -qE "$meta_dep_line"; then
      prev="$(sed -n "$((n - 1))p" "$f")"
      if printf '%s' "$prev" | grep -qE '^[[:space:]]*if \(sgMetaEnabled\) \{[[:space:]]*$'; then
        continue
      fi
      hits="${hits}${f}:${n}: Meta の依存が if (sgMetaEnabled) { の直下にありません:${text}"$'\n'
      continue
    fi
    # Gradle のコメント行は依存宣言ではない(説明文で SDK 名を書くことはある)。
    if printf '%s' "$text" | grep -qE '^[[:space:]]*//'; then continue; fi
    hits="${hits}${f}:${n}:${text}"$'\n'
  done < <(grep -niE "$native_tracking" "$f" || true)
done
# 版は固定値で、同じファイルに 1 回だけ。
meta_version_lines="$(grep -cE '^def sgMetaSdkVersion = "[0-9]+\.[0-9]+\.[0-9]+"$' "$meta_gradle" || true)"
if grep -qE 'facebook-core' "$meta_gradle" && [ "$meta_version_lines" != "1" ]; then
  hits="${hits}${meta_gradle}: sgMetaSdkVersion が固定の X.Y.Z で 1 回だけ定義されていません"$'\n'
fi
if [ -n "$hits" ]; then
  report "ネイティブにトラッキング系の依存があります(許されるのは release 限定・フラグ付きの facebook-core だけです — docs/META_ANDROID_ACQUISITION.md)" "$hits"
else
  ok "ネイティブのトラッキング系依存なし(例外は Android release の facebook-core 1 行のみ)"
fi

# 自己検査: 例外の形が崩れた行と、他の SDK の行を、どちらも拾えること。
probe_native_bad=(
  'implementation "com.facebook.android:facebook-android-sdk:18.3.0"'
  'implementation "com.facebook.android:facebook-core:18.3.0"'
  'releaseImplementation "com.facebook.android:facebook-login:$sgMetaSdkVersion"'
  'implementation "com.facebook.android:audience-network-sdk:6.+"'
  "implementation 'com.google.firebase:firebase-analytics:22.0.0'"
  'implementation "com.appsflyer:af-android-sdk:6.14.0"'
  '.package(url: "https://github.com/facebook/facebook-ios-sdk", from: "18.0.0")'
)
dead=""
for probe in "${probe_native_bad[@]}"; do
  if ! printf '%s' "$probe" | grep -qiE "$native_tracking"; then
    dead="${dead}検出できません: ${probe}"$'\n'
  elif printf '%s' "$probe" | grep -qE "$meta_dep_line"; then
    dead="${dead}例外の形に誤って一致しています: ${probe}"$'\n'
  fi
done
if ! printf '%s' '        releaseImplementation "com.facebook.android:facebook-core:$sgMetaSdkVersion"' | grep -qE "$meta_dep_line"; then
  dead="${dead}例外の正しい形に一致しません"$'\n'
fi
if [ -n "$dead" ]; then
  report "§3b の検査パターンが壊れています(ガードが no-op です)" "$dead"
else
  ok "ネイティブ依存パターンの自己検査(${#probe_native_bad[@]} 本の違反形を検出し、例外の形だけを通す)"
fi

# 4. Android の権限 ------------------------------------------------------------
# Nearby の例外は Simple Games の製品 manifest だけ。旧 BT / 位置情報は maxSdk 30、
# scan は neverForLocation、BLE hardware は optional。merged manifest と同じ関数で検査する。
# XML として読み、改行・属性順・uses-permission-sdk-23 でも検査を省略しない。
if hits="$(python3 .github/scripts/android_permission_policy.py "${manifests[@]}" 2>&1)"; then
  ok "Android 権限は許可リスト内、Nearby の OS 範囲・非位置情報 scan・任意 hardware 制約も一致"
else
  report "Android 権限の許可リスト / Nearby 制約に違反しています" "$hits"
fi

# 4b. Meta の manifest overlay(issue #204)は権限を「足す」場所ではない。
# `src/metaOn/AndroidManifest.xml` は Meta SDK の自動動作を止めるためだけにあり、
# そこに書ける uses-permission は依存が持ち込む権限を外す `tools:node="remove"` だけ。
# ビルド後の merged manifest(依存由来の権限を含む)は
# .github/scripts/check-android-artifact.sh がリリースビルドで検査する。
hits=""
for m in apps/*/android/app/src/*/AndroidManifest.xml; do
  [ -f "$m" ] || continue
  case "$m" in */src/main/AndroidManifest.xml) continue ;; esac
  found="$(tr '\n' ' ' < "$m" | grep -oE '<uses-permission[^>]*>' | grep -v 'tools:node="remove"' || true)"
  [ -n "$found" ] && hits="${hits}${m}: ${found}"$'\n'
done
if [ -n "$hits" ]; then
  report "main 以外の manifest が権限を要求しています(外す tools:node=\"remove\" だけが書けます)" "$hits"
else
  ok "main 以外の manifest は権限を足していない"
fi

# <queries>(他のアプリが見えるようになる宣言)も同じ考え方で、main 以外の manifest に
# 書けるのは Meta の overlay の 1 行 —— Facebook アプリの AttributionIdProvider(SDK が
# 広告計測用 ID を読む先。docs/META_ANDROID_ACQUISITION.md §4)—— だけ。<package> や
# 別の authority を足すと、端末に入っているアプリを見る範囲が広がる。
meta_overlay='apps/simple-games/android/app/src/metaOn/AndroidManifest.xml'
meta_query='<provider android:authorities="com.facebook.katana.provider.AttributionIdProvider" />'
# 標準入力の manifest から、<queries> の中の要素(開始タグ)を 1 行ずつ出す。コメントは除く。
queries_entries() {
  tr '\n' ' ' | sed -E 's/<!--([^-]|-[^-])*-->//g' | grep -oE '<queries>.*</queries>' \
    | grep -oE '<[a-zA-Z][^>]*>' | grep -vE '^<queries>$' | sed -E 's/[[:space:]]+/ /g' || true
}
hits=""
for m in apps/*/android/app/src/*/AndroidManifest.xml; do
  [ -f "$m" ] || continue
  case "$m" in */src/main/AndroidManifest.xml) continue ;; esac
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    [ "$m" = "$meta_overlay" ] && [ "$e" = "$meta_query" ] && continue
    hits="${hits}${m}: ${e}"$'\n'
  done < <(queries_entries < "$m")
done
# 自己検査: 抽出が空振りしていないこと(許可外の 2 要素を拾い、許可した 1 行だけを残す)。
probe="<manifest><!-- <queries><package android:name=\"x\" /></queries> --><queries>
    ${meta_query}
    <package android:name=\"com.facebook.katana\" />
    <intent><action android:name=\"android.intent.action.VIEW\" /></intent>
  </queries></manifest>"
probe_hits="$(printf '%s' "$probe" | queries_entries | grep -vxF "$meta_query" | wc -l | tr -d ' ')"
probe_kept="$(printf '%s' "$probe" | queries_entries | grep -cxF "$meta_query" || true)"
if [ "$probe_hits" -ne 3 ] || [ "$probe_kept" -ne 1 ]; then
  report "§4b の <queries> 抽出が壊れています(ガードが no-op です)" "許可外の要素: ${probe_hits} 件(期待 3)、許可した行: ${probe_kept} 件(期待 1)"
elif [ -n "$hits" ]; then
  report "main 以外の manifest が <queries> で他のアプリを見ようとしています(Meta の AttributionIdProvider 1 行だけが書けます)" "$hits"
else
  ok "main 以外の manifest の <queries> は Meta の AttributionIdProvider 1 行だけ(自己検査つき)"
fi

# 5. 本番広告 ID ---------------------------------------------------------------
# 本番の AdMob ID はビルド時に注入する(ユニット ID は環境変数、アプリ ID は
# Gradle / Xcode のビルド設定)。ソースに出てよいのは Google 公式のテスト ID
# だけ(収益が発生しないもの)。
test_ids='ca-app-pub-3940256099942544'
hits="$(grep -rn 'ca-app-pub-' "${src_dirs[@]}" "${native_ad_ids[@]}" | grep -v "$test_ids" || true)"
if [ -n "$hits" ]; then
  report "テスト用以外の AdMob ユニット ID がソースにあります(注入するもので、コミットするものではありません)" "$hits"
else
  ok "AdMob ID はテスト用のみ"
fi

# Web 版の AdSense(ADS_POLICY.md「Web 版」)には公式のテスト client ID が存在しない
# ため、client / slot ID は一切ソースに書かない(テスト表示はローカルのプレースホルダ、
# 本番 ID は VITE_ADSENSE_* で注入)。ゆえに ca-pub- は例外なしの不在検査になる。
# なお「native ビルドに AdSense コードが不在」の検査はビルド成果物が要るので、
# ここではなく ci.yml の check-dist-ads-separation.sh が担当する(このスクリプトは
# grep だけで動く、という分担を崩さないため)。
hits="$(grep -rn 'ca-pub-' "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "AdSense の client ID がソースにあります(注入するもので、コミットするものではありません)" "$hits"
else
  ok "AdSense ID はソースに不在"
fi

# 6. 禁止表現 -----------------------------------------------------------------
# docs/BRAND.md「表現ルール」の使用禁止表現は、ストア文面だけの規則ではなく、
# ソースに入る文字列にも同じくかかる(i18n カタログ・packages/brand)。
# docs/I18N_POLICY.md の「機械チェック … 禁止表現」が指しているのはこの検査である。
#
# **見ているのは英語と日本語だけ。** 残り 12 言語で同じ主張がされていないことは
# grep では判定できない(「完全無料」は言語ごとに別の字面になる)。そこは
# I18N_POLICY.md の高リスクキーの門と別モデル監査の担当で、ここが緑でも
# 12 言語を見たことにはならない。
#
# 「主張」だけを拾い、広告の存在を認めている説明文は拾わない。英語では主張が
# 文頭に来る(= 大文字)ことを利用して、"No ads" は拾い "…, no ads are shown"
# (privacy2)と "Prefer no ads?"(adSupportBody = ADS_POLICY.md の説明文の正文)は
# 拾わない。日本語は「機能課金なし」「課金ロックなし」が BRAND.md の指定する
# 代替表現なので、「課金なし」の一致から除く。
#
# **§7 と同じ除外マーカーを持つ**(`[check-principles: allow]` を書いた行だけ)。
# 理由も同じで、この規則を 14 言語ぶん強制しているテスト自身は、禁止語を書かな
# ければ「無いこと」を検査できない(src/ui/components/WebAppStoreCard.test.tsx が
# 実例)。除外はソース上に見える形で 1 行ずつ残り、grep すれば全件出る。
# ファイル種別でまとめて除外しない: 除外の範囲が黙って広がる。
banned_any='ad-?free|completely free of ads|no popup ads|no forced ads|no in-app purchases|lifetime access|fully free|completely free'
banned_claim='No (ads|purchases)\b'
banned_allow_marker='\[check-principles: allow\]'
hits=""
add() { [ -n "$1" ] && hits="${hits}${1}"$'\n'; return 0; } # $() は末尾改行を落とすので自前で足す
add "$(grep -rniE "$banned_any" "${src_dirs[@]}" | grep -vE "$banned_allow_marker" || true)"
add "$(grep -rnE "$banned_claim" "${src_dirs[@]}" | grep -vE "$banned_allow_marker" || true)"
add "$(grep -rnE '完全無課金|完全無料|広告なし' "${src_dirs[@]}" | grep -vE "$banned_allow_marker" || true)"
add "$(grep -rnE '課金なし' "${src_dirs[@]}" | grep -vE '機能課金なし|課金ロックなし' | grep -vE "$banned_allow_marker" || true)"
if [ -n "$hits" ]; then
  report "広告・課金について使用禁止の表現があります(docs/BRAND.md「表現ルール」)" "$hits"
else
  ok "禁止表現なし(英語・日本語の範囲)"
fi

# パターンと除外マーカーの生存確認(§7 の自己検査と同じ理由)。除外を足したぶん
# 「何も見ていない状態で緑になる」壊れ方が 1 つ増えている —— `banned_allow_marker`
# が空文字なら `grep -v` は全行を落とし、§6 は永久に緑になる。そこで既知の違反文が
# (1)パターンに当たり、(2)マーカーの無い行として除外を生き延びることを両方見る。
probe_banned=(
  'Ad-free forever'
  'No ads'
  'No purchases'
  '完全無料'
  '完全無課金'
  '広告なし'
)
dead=""
for probe in "${probe_banned[@]}"; do
  if printf '%s' "$probe" | grep -qiE "$banned_any" ||
    printf '%s' "$probe" | grep -qE "$banned_claim" ||
    printf '%s' "$probe" | grep -qE '完全無課金|完全無料|広告なし'; then
    printf '%s' "$probe" | grep -qvE "$banned_allow_marker" ||
      dead="${dead}除外マーカーが無印の行を落としています: ${probe}"$'\n'
  else
    dead="${dead}検出できません: ${probe}"$'\n'
  fi
done
if [ -n "$dead" ]; then
  report "§6 の検査パターンまたは除外マーカーが壊れています(ガードが no-op です)" "$dead"
else
  ok "禁止表現パターンの自己検査(${#probe_banned[@]} 本の既知違反文を検出し、無印の行は除外しない)"
fi

# 6b. Core のカタログに順位の語を入れない ---------------------------------------
# docs/architecture/club.md §11: 「leaderboard」は Club House の語で、club/ の中でだけ
# 使ってよい。Core(apps/simple-games/src/i18n/locales/ の 14 言語カタログ)に
# 入れると、接続していない端末の画面に「順位表」があるように読める文面が出る。
# 英語の単語だけを見る(他言語は別の字面になる — §6 と同じ限界)。
leaderboard_pattern='leaderboard'
hits="$(grep -rniE "$leaderboard_pattern" apps/simple-games/src/i18n/locales/ || true)"
if [ -n "$hits" ]; then
  report "Core のカタログに leaderboard があります(club/ の中でだけ使えます — docs/architecture/club.md §11)" "$hits"
else
  ok "Core のカタログに leaderboard なし(club/ の語は club/ に)"
fi
dead=""
for probe in 'leaderboard: "Leaderboard"' "  'Open the LEADERBOARD'" 'weeklyLeaderboardTitle'; do
  printf '%s' "$probe" | grep -qiE "$leaderboard_pattern" ||
    dead="${dead}検出できません: ${probe}"$'\n'
done
if [ -n "$dead" ]; then
  report "§6b の検査パターンが壊れています(ガードが no-op です)" "$dead"
else
  ok "§6b の自己検査(大小文字・語中の leaderboard を検出)"
fi

# 7. 効能の主張 ---------------------------------------------------------------
# 脳トレドリル 3 本(Quick Math / Schulte Table / Number Recall)の収録にあたって
# 決めた規則(docs/SCHULTE_TABLE_RULES.md §14-2)。drills の棚の Echo Pads(Web 先行
# 公開)も docs/ECHO_PADS_RULES.md §15 でこの規則を自分に適用している — 検査の範囲は
# ゲームごとではなく src 全体なので、その文言もここで見る。「脳年齢」「IQ が上がる」
# 「認知症予防」の類は、このジャンルの定番の売り文句でありながら科学的裏付けが
# 係争的で、Honest by design と両立しない。**このジャンルを収録している以上、
# 書かない理由を文書に置くだけでは足りない**ので、ここで不在を検査する。
#
# 6 と同じ限界を持つ: **英語と日本語しか見ていない。** 残り 12 言語で同じ主張が
# されていないことは grep では判定できない(I18N_POLICY.md の門と別モデル監査の
# 担当)。ゲーム名・ジャンル名としての "brain training" 自体を禁じているので、
# 説明文の中で言い訳的に使うこともできない。
#
# 誤検出を避ける工夫: "brain" 単体は拾わず、効能を主張する結合のみを見る。
#
# **例外は 1 つだけ、明示的に置く。** この規則を強制しているテスト自身は、禁止語を
# 書かなければ「無いこと」を検査できない。そこで `[check-principles: allow]` を
# 書いた行だけを除外する — 除外はソース上に見える形で残り、grep すれば全件出る。
# ファイル種別(*.test.ts など)でまとめて除外しない: 除外の範囲が黙って広がる。
efficacy_en='brain (age|training|power|fitness|health)|train(s|ing)? your brain|boosts? (your )?(memory|IQ|brainpower)|improves? (your )?(memory|focus|concentration|cognition|cognitive)|cognitive (decline|improvement|training)|prevents? dementia|mental age|sharpen your mind'
efficacy_ja='脳年齢|脳トレ|脳を鍛|脳力|記憶力が(上が|向上)|集中力が(上が|向上)|認知症(予防|の予防)|認知機能の(改善|向上)|頭が良くな|IQ が(上が|伸び)'
allow_marker='\[check-principles: allow\]'

# **アプリ内の文字列だけでは足りない。** 効能を誤って謳うリスクが最も高いのは
# ストア掲載文面であり、そこは `src` の外にある。対象を明示列挙で足す。
#
# docs/ 全体を舐めないのは意図である: ポリシー文書は禁止表現そのものを説明する
# ために書いており(SCHULTE_TABLE_RULES.md §14-2 が実例)、blanket scan すると
# 規則を書くこと自体が違反になる。線引きは「利用者に向けて言うかどうか」で
# あって「どのファイルにあるか」ではない。
copy_targets=("${src_dirs[@]}")
for f in apps/*/store/listing.md; do [ -f "$f" ] && copy_targets+=("$f"); done

hits=""
add "$(grep -rniE "$efficacy_en" "${copy_targets[@]}" | grep -vE "$allow_marker" || true)"
add "$(grep -rnE "$efficacy_ja" "${copy_targets[@]}" | grep -vE "$allow_marker" || true)"
if [ -n "$hits" ]; then
  report "脳への効能を主張する表現があります(docs/SCHULTE_TABLE_RULES.md §14-2)" "$hits"
else
  ok "効能の主張なし(英語・日本語の範囲、ストア掲載文面を含む)"
fi

# パターン自身の生存確認。**不在を検査するガードの最悪の壊れ方は、落ちなくなる
# ことではなく「何も見ていない状態で緑になる」ことである** — 正規表現を編集して
# 壊しても、対象ディレクトリの綴りを間違えても、上の検査は静かに ok を出す。
#
# **プローブは 1 本では足りない。** 最初はまとめて 1 文で叩いていたが、それでは
# 式のどれか 1 つが生きていれば緑になり、他の節を壊しても素通りした(実際に
# `brain (age|…)` の節だけを壊して確かめた)。節ごとに 1 本ずつ当てる。
probe_en=(
  'Brain age is a claim'
  'Brain training every day'
  'It trains your brain'
  'Boosts your memory'
  'Improves your concentration'
  'Cognitive decline is a claim'
  'Prevents dementia'
  'Your mental age drops'
  'Sharpen your mind'
)
probe_ja=(
  '脳年齢が下がる'
  '毎日の脳トレ'
  '脳を鍛える'
  '脳力が伸びる'
  '記憶力が向上する'
  '集中力が上がる'
  '認知症予防になる'
  '認知機能の改善が期待できる'
  '頭が良くなる'
  'IQ が上がる'
)
dead=""
for probe in "${probe_en[@]}"; do
  printf '%s' "$probe" | grep -qiE "$efficacy_en" || dead="${dead}en: ${probe}"$'\n'
done
for probe in "${probe_ja[@]}"; do
  printf '%s' "$probe" | grep -qE "$efficacy_ja" || dead="${dead}ja: ${probe}"$'\n'
done
if [ -n "$dead" ]; then
  report "§7 の検査パターンが既知の効能表現を検出できません(ガードが no-op です)" "$dead"
else
  ok "効能パターンの自己検査(${#probe_en[@]} + ${#probe_ja[@]} 本の既知違反文を検出できる)"
fi

# 8. Android の獲得計測(Meta)の形 --------------------------------------------
# issue #204 で認めた例外は「新しいインストールを 1 回だけ Meta に知らせる」ことだけで、
# 分析基盤ではない(docs/PRODUCT_PRINCIPLES.md「Android の獲得計測」)。2026-09-29 の
# オーナー判断で、同意の質問をやめ、同意が要る地域(EU 等)を除いて自動で送り、
# 広告 ID を含める形になった(docs/META_ANDROID_ACQUISITION.md §5・§6)。
# その形を grep で判定できる範囲で固定する:
#
# (a) Meta SDK に触れてよいのは android/app/src/metaOn/ だけ。main・debug・metaOff、
#     そして JS のソースは com.facebook を参照しない。
# (b) metaOn は任意のイベントを送る API・自動収集を戻す API・識別子を足す API を
#     呼ばない。広告 ID の収集だけは、報告の 1 回のためにコードで有効にする
#     (docs/META_ANDROID_ACQUISITION.md §5。manifest では off のまま — (c))。
# (c) metaOn の manifest overlay は SDK の自動初期化・自動ログ・広告 ID 収集を
#     false で宣言し、起動時に SDK を初期化する ContentProvider を外す。
# (d) JS には Meta への窓口が無い。metaOn のプラグインは @PluginMethod を持たず
#     (起動時に自分で判断して動く)、JS のソースは MetaInstall を参照しない。
meta_on='apps/simple-games/android/app/src/metaOn'
hits="$(grep -rn 'com\.facebook' apps/simple-games/android/app/src "${src_dirs[@]}" 2>/dev/null \
  | grep -v "^${meta_on}/" || true)"
[ -n "$hits" ] && report "Meta SDK を metaOn 以外が参照しています(§8 a)" "$hits"

meta_forbidden='\.logEvent\(|\.logPurchase\(|activateApp\(|logPushNotificationOpen\(|logProductItem\(|augmentWebView\(|setUserData\(|setUserID\(|setPushNotificationsRegistrationId\(|setDataProcessingOptions\(|setAutoLogAppEventsEnabled\(true|setAutoInitEnabled\(true|setCodelessDebugLogEnabled\(true|setMonitorEnabled\(true|setIsDebugEnabled\(true|addLoggingBehavior\('
if [ -d "$meta_on" ]; then
  hits="$(grep -rnE "$meta_forbidden" "$meta_on" || true)"
  [ -n "$hits" ] && report "Meta アダプタが許可外の SDK API を呼んでいます(§8 b)" "$hits"
  overlay="$meta_on/AndroidManifest.xml"
  missing=""
  for flag in AutoInitEnabled AutoLogAppEventsEnabled AdvertiserIDCollectionEnabled; do
    tr '\n' ' ' < "$overlay" 2>/dev/null \
      | grep -qE "android:name=\"com\.facebook\.sdk\.${flag}\"[[:space:]]+android:value=\"false\"" \
      || missing="${missing}com.facebook.sdk.${flag}=false がありません"$'\n'
  done
  tr '\n' ' ' < "$overlay" 2>/dev/null \
    | grep -qE 'android:name="com\.facebook\.internal\.FacebookInitProvider"[^>]*tools:node="remove"' \
    || missing="${missing}FacebookInitProvider を tools:node=\"remove\" で外していません"$'\n'
  [ -n "$missing" ] && report "Meta の manifest overlay が SDK の自動動作を止めていません(§8 c)" "$missing"
fi
hits="$(grep -rn '@PluginMethod' "$meta_on" 2>/dev/null || true)"
hits="${hits}$(grep -rn 'MetaInstall' "${src_dirs[@]}" 2>/dev/null || true)"
[ -n "$hits" ] && report "JS から Meta 計測に届く口があります(§8 d)" "$hits"

# 自己検査: 禁止 API のパターンが生きていること。
probe_meta_bad=(
  'AppEventsLogger.newLogger(ctx).logEvent("fb_mobile_level_achieved");'
  'AppEventsLogger.activateApp(getActivity().getApplication());'
  'FacebookSdk.setAutoLogAppEventsEnabled(true);'
  'FacebookSdk.setAutoInitEnabled(true);'
  'AppEventsLogger.setUserData(email, null, null, null, null, null, null, null, null, null);'
)
dead=""
for probe in "${probe_meta_bad[@]}"; do
  printf '%s' "$probe" | grep -qE "$meta_forbidden" || dead="${dead}検出できません: ${probe}"$'\n'
done
printf '%s' 'FacebookSdk.setAutoLogAppEventsEnabled(false);' | grep -qE "$meta_forbidden" \
  && dead="${dead}許可された呼び出しを誤って拾っています: setAutoLogAppEventsEnabled(false)"$'\n'
if [ -n "$dead" ]; then
  report "§8 の検査パターンが壊れています(ガードが no-op です)" "$dead"
elif [ -d "$meta_on" ]; then
  ok "Meta 計測の形(metaOn 限定・禁止 API なし・自動動作の停止・JS からの口なし、自己検査 ${#probe_meta_bad[@]} 本)"
else
  ok "Meta 計測のアダプタは未導入(JS からの口なし、自己検査 ${#probe_meta_bad[@]} 本)"
fi

# 9. Android の文字の倍率の上限 ------------------------------------------------
# 2026-10-31 のオーナー判断で、Android アプリの WebView の文字の倍率に上限 100% を置いた
# (docs/PRODUCT_PRINCIPLES.md「Android の文字の倍率」)。WebView は、アプリが倍率を
# 決めない限り端末のフォントサイズの倍率で文字だけを大きくする。盤を画面の高さから決める
# ゲームは上部バーや操作バーの高さを文字 100% の px で見積もっているので、130% で 14 本が
# 崩れ、200% では盤がバナーの枠の下へ出た(docs/plans/2026-10-30-android-os-text-size.md)。
# 上限は MainActivity の 1 か所にしかなく、Capacitor の更新やリファクタで黙って消えると、
# 盤と操作に枠を重ねない約束(ADS_POLICY)が端末の設定しだいに戻る。grep で判定できる範囲で
# MainActivity の形を固定する(コメントの行は読まない。コメントに残した古い値や外した呼び出しで
# 緑にしない):
#
# (a) 上限の定数は 1 つで、値は 100。端末の倍率との小さい方を percent に取る行のすぐ次で、
#     それを setTextZoom に渡す。setTextZoom の呼び出しは MainActivity にその 1 か所だけ。
#     onCreate の中で、super.onCreate の後に端末の設定へ当てる(bridge は super.onCreate の中で
#     作られるので、その前に呼ぶと何もしない)。上限を上げるのは原則の節が挙げる計測を済ませて
#     からで、原則の節とこの値を同じ PR で変える。
# (b) 倍率を決める経路はそこだけ。アプリのネイティブのコードに倍率を決めるほかの書き方
#     (Java の setTextZoom・Kotlin の textZoom への代入・古い WebSettings.TextSize)が無く、
#     依存の宣言(package.json と Capacitor が生成するプラグインの Gradle 一覧)に text-zoom の
#     プラグインが無い —— 入れると上限を JS が上書きできる。依存するライブラリの中身までは見ない。
main_activity='apps/simple-games/android/app/src/main/java/com/pixapps/simplegames/MainActivity.java'
comment_line='^[[:space:]]*(//|\*|/\*)'
zoom_native='setTextZoom\(|\.textZoom[[:space:]]*=|WebSettings\.TextSize'
zoom_plugin='text-?zoom'
plugin_lists=(apps/simple-games/android/capacitor.settings.gradle apps/simple-games/android/app/capacitor.build.gradle)
missing=""
ma_code="$(grep -vE "$comment_line" "$main_activity" 2>/dev/null || true)"
[ -n "$ma_code" ] || missing="${missing}${main_activity} がありません"$'\n'
cap_defs="$(printf '%s\n' "$ma_code" | grep -E 'TEXT_ZOOM_CAP_PERCENT[[:space:]]*=' || true)"
[ "$(printf '%s\n' "$cap_defs" | grep -c .)" = "1" ] \
  && printf '%s\n' "$cap_defs" | grep -qE '^[[:space:]]*static final int TEXT_ZOOM_CAP_PERCENT = 100;$' \
  || missing="${missing}上限の定数が 1 つで値が 100(static final int TEXT_ZOOM_CAP_PERCENT = 100;)になっていません"$'\n'
min_at="$(printf '%s\n' "$ma_code" | grep -nE '^[[:space:]]*int percent = Math\.min\(Math\.round\([a-zA-Z]+\.fontScale \* 100\), TEXT_ZOOM_CAP_PERCENT\);$' | cut -d: -f1)"
set_at="$(printf '%s\n' "$ma_code" | grep -nE '^[[:space:]]*bridge\.getWebView\(\)\.getSettings\(\)\.setTextZoom\(percent\);$' | cut -d: -f1)"
{ [ "$(printf '%s\n' "$min_at" | grep -c .)" = "1" ] && [ "$(printf '%s\n' "$set_at" | grep -c .)" = "1" ] \
    && [ "$set_at" -eq "$((min_at + 1))" ]; } \
  || missing="${missing}端末の倍率と上限の小さい方(percent)を、取った次の行で setTextZoom に渡していません"$'\n'
[ "$(printf '%s\n' "$ma_code" | grep -cE 'setTextZoom\(')" = "1" ] \
  || missing="${missing}MainActivity の setTextZoom の呼び出しが 1 か所ではありません"$'\n'
on_create="$(sed -n '/^    protected void onCreate(Bundle savedInstanceState)/,/^    }$/p' "$main_activity" 2>/dev/null \
  | grep -vE "$comment_line" || true)"
super_at="$(printf '%s\n' "$on_create" | grep -nE '^[[:space:]]*super\.onCreate\(savedInstanceState\);$' | head -1 | cut -d: -f1)"
cap_at="$(printf '%s\n' "$on_create" | grep -nE '^[[:space:]]*capTextZoom\(getResources\(\)\.getConfiguration\(\)\);$' | head -1 | cut -d: -f1)"
{ [ -n "$super_at" ] && [ -n "$cap_at" ] && [ "$cap_at" -gt "$super_at" ]; } \
  || missing="${missing}onCreate が super.onCreate の後で端末の設定に上限を当てていません"$'\n'
[ -n "$missing" ] && report "Android の文字の倍率の上限が MainActivity の形になっていません(§9 a。変える・外すなら PRODUCT_PRINCIPLES「Android の文字の倍率」を先に改め、この節と同じ PR で)" "$missing"

# (b) MainActivity の許された 1 行(percent を渡す行)だけを除き、コメントでない行を拾う。
# 探す場所が外れていれば、その許された 1 行も見つからないので赤にする(no-op にしない)。
native_hits="$(grep -rnE "$zoom_native" apps/simple-games/android/app/src 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' || true)"
allowed="$(printf '%s\n' "$native_hits" \
  | grep -E "^${main_activity}:[0-9]+:[[:space:]]*bridge\.getWebView\(\)\.getSettings\(\)\.setTextZoom\(percent\);$" || true)"
hits="$(printf '%s\n' "$native_hits" | grep -vxF "$allowed" | grep -v '^$' || true)"
[ -z "$allowed" ] && hits="${hits}${hits:+$'\n'}android/app/src の中に MainActivity の setTextZoom(percent) が見つかりません(探す場所が外れています)"
plugin_hits="$(grep -niE "\"[^\"]*${zoom_plugin}[^\"]*\"[[:space:]]*:" "${pkg_jsons[@]}" 2>/dev/null || true)"
plugin_hits="${plugin_hits}${plugin_hits:+$'\n'}$(grep -niE "$zoom_plugin" "${plugin_lists[@]}" 2>/dev/null || true)"
plugin_hits="$(printf '%s\n' "$plugin_hits" | grep -v '^$' || true)"
hits="${hits}${hits:+${plugin_hits:+$'\n'}}${plugin_hits}"
[ -n "$hits" ] && report "MainActivity のほかに文字の倍率を決める経路があります(§9 b)" "$hits"

# 自己検査(§1・§8 と同じ理由): 不在を見るパターンは、既知の違反行を拾い、拾ってはいけない行を
# 拾わないことを確かめる。
probe_zoom_bad=(
  '        webView.getSettings().setTextZoom(130);'
  '        settings.textZoom = 130'
  '        settings.setTextSize(WebSettings.TextSize.LARGER);'
)
probe_plugin_bad=(
  '    "@capacitor/text-zoom": "^8.0.0",'
  '    "capacitor-textzoom": "1.0.0",'
  "include ':capacitor-text-zoom'"
)
dead=""
for probe in "${probe_zoom_bad[@]}"; do
  printf '%s\n' "$probe" | grep -qE "$zoom_native" || dead="${dead}検出できません: ${probe}"$'\n'
done
for probe in "${probe_plugin_bad[@]}"; do
  printf '%s\n' "$probe" | grep -qiE "$zoom_plugin" || dead="${dead}検出できません: ${probe}"$'\n'
done
printf '%s\n' '        label.setTextSize(14);' | grep -qE "$zoom_native" \
  && dead="${dead}TextView の文字の大きさを誤って拾っています: label.setTextSize(14)"$'\n'
printf '%s\n' '        // capTextZoom(getResources().getConfiguration());' | grep -qvE "$comment_line" \
  && dead="${dead}コメントの行を落とせていません"$'\n'
[ -n "$dead" ] && report "§9 の検査パターンが壊れています(ガードが no-op です)" "$dead"
[ -z "$missing" ] && [ -z "$hits" ] && [ -z "$dead" ] \
  && ok "Android の文字の倍率の上限(MainActivity の形・上限 100%・ほかに倍率を決める経路なし、自己検査 $(( ${#probe_zoom_bad[@]} + ${#probe_plugin_bad[@]} + 2 )) 本)"

if [ "$fail" -ne 0 ]; then
  printf '\n原則ガードが失敗しました。実装を直すか、約束そのものを変えるなら docs/ の該当\n'
  printf 'ポリシーとこのスクリプトを同じ PR で意図的に更新してください。\n'
  exit 1
fi
printf '\nすべての原則ガードを通過しました(機械判定できる範囲のみ)。\n'
