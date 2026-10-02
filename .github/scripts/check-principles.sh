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
# Core(apps/simple-games/src/club/ を除く全ソース)は通信しない。ネットワークの
# 用途はオンライン判定と広告 SDK / 課金 SDK / レビュー SDK だけで、Core 自身の
# コードが通信することはない。
#
# 例外は 1 つだけ、パスで宣言する。2026-09-09、issue #176 で「Club House」
# (2026-09-09 時点の名は Shared / Private Game Club)という任意加入のレイヤーを
# 認めた: 利用者が明示的に
# 接続した端末だけが、利用者または友人が自前で立てたサーバーへ挑戦の結果
# (結果画面が表示した事実)だけを送る。PixApps 自身はサーバーを一切運用しない(詳細は
# docs/PRODUCT_PRINCIPLES.md「Club House」)。2026-09-30 に PixApps が運用する
# Public デプロイを 1 つ認めたが、**この例外は 1 ディレクトリのまま**である —
# 通信するのは端末側の `club/` だけで、相手が誰のサーバかは関係しない
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
# apps/*/src / packages/*/src の下に置かれない(別リポジトリ)ので、パスの例外は
# これ 1 つで尽きる。
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
  report "Core のソースにネットワーク API があります(通信できるのは apps/simple-games/src/club/ だけです — docs/PRODUCT_PRINCIPLES.md「Shared」)" "$hits"
else
  ok "ネットワーク API なし(Core。例外は apps/simple-games/src/club/ のみ)"
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
# 広告(INTERNET)と課金(BILLING)以外の権限は要求しない。
# 増やすときは、なぜ必要かを PR に書いた上でこの許可リストを意図的に更新する。
allowed='android.permission.INTERNET|com.android.vending.BILLING|com.google.android.gms.permission.AD_ID'
hits=""
for m in "${manifests[@]}"; do
  [ -f "$m" ] || continue
  found="$(grep -oE 'uses-permission android:name="[^"]+"' "$m" \
    | sed -E 's/.*name="([^"]+)".*/\1/' \
    | grep -vE "^($allowed)$" || true)"
  [ -n "$found" ] && hits="${hits}${m}: ${found}"$'\n'
done
if [ -n "$hits" ]; then
  report "許可リスト外の Android 権限があります" "$hits"
else
  ok "Android 権限は INTERNET / BILLING のみ"
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
# 決めた規則(docs/SCHULTE_TABLE_RULES.md §14-2)。「脳年齢」「IQ が上がる」
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

if [ "$fail" -ne 0 ]; then
  printf '\n原則ガードが失敗しました。実装を直すか、約束そのものを変えるなら docs/ の該当\n'
  printf 'ポリシーとこのスクリプトを同じ PR で意図的に更新してください。\n'
  exit 1
fi
printf '\nすべての原則ガードを通過しました(機械判定できる範囲のみ)。\n'
