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

# 1. 通信しないこと ------------------------------------------------------------
# API サーバー・アプリ用 DB・コンテンツ配信サーバーを持たない(README / PRODUCT_PRINCIPLES)。
# ネットワークの用途はオンライン判定と広告 SDK / 課金 SDK / レビュー SDK だけで、
# アプリ自身のコードが通信することはない。
hits="$(grep -rnE '\bfetch\(|XMLHttpRequest|\bWebSocket\b|sendBeacon|EventSource|\bnavigator\.geolocation' "${src_dirs[@]}" || true)"
if [ -n "$hits" ]; then
  report "アプリのソースにネットワーク API があります(通信しない約束に反します)" "$hits"
else
  ok "ネットワーク API なし"
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

# 5. 本番広告ユニット ID -------------------------------------------------------
# 本番の AdMob ユニット ID はビルド時に環境変数で注入する。ソースに出てよいのは
# Google 公式のテスト ID だけ(収益が発生しないもの)。
test_ids='ca-app-pub-3940256099942544'
hits="$(grep -rn 'ca-app-pub-' "${src_dirs[@]}" | grep -v "$test_ids" || true)"
if [ -n "$hits" ]; then
  report "テスト用以外の AdMob ユニット ID がソースにあります(注入するもので、コミットするものではありません)" "$hits"
else
  ok "AdMob ID はテスト用のみ"
fi

if [ "$fail" -ne 0 ]; then
  printf '\n原則ガードが失敗しました。実装を直すか、約束そのものを変えるなら docs/ の該当\n'
  printf 'ポリシーとこのスクリプトを同じ PR で意図的に更新してください。\n'
  exit 1
fi
printf '\nすべての原則ガードを通過しました(機械判定できる範囲のみ)。\n'
