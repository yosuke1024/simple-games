#!/usr/bin/env bash
# Web 専用コードの「分離」を、ソースではなく**ビルド成果物**で検証する
# (docs/WEB_VERSION.md「計測」/ docs/ADS_POLICY.md「Web 版」)。
#
#   native (apps/simple-games/dist/)    — AdSense / GA4 / サイトクロームの痕跡が
#       **不在**。アプリの約束は「バナー 1 枠のみ」「Analytics なし」、そして
#       インストール済みアプリに「サイトへ戻る」ヘッダーは要らない。build-time
#       ゲートが実際に効いていることをバンドラの出力で確かめる。
#   web    (apps/simple-games/dist-web/) — AdSense 統合とサイトクロームが**存在**。
#       GA4 は EXPECT_WEB_ANALYTICS=1 のとき統合と測定 ID が存在し、
#       それ以外では測定 ID が成果物に存在しないことを確認する。
#
# check-principles.sh は grep だけで動く(ビルド不要)という分担なので、
# ビルドを前提とするこの検査は別スクリプトになっている。ci.yml が
# `pnpm build` と `pnpm --filter simple-games build:web` の後に呼ぶ。
#
# ローカル実行:
#   pnpm build && pnpm --filter simple-games build:web
#   bash .github/scripts/check-dist-ads-separation.sh          # 両方
#   bash .github/scripts/check-dist-ads-separation.sh native   # native のみ
#   EXPECT_WEB_ANALYTICS=1 bash .github/scripts/check-dist-ads-separation.sh web
set -uo pipefail
cd "$(dirname "$0")/../.."

target="${1:-both}"
native_dist="apps/simple-games/dist"
web_dist="apps/simple-games/dist-web"
# 検査語彙: ローダー・タグ・ID 接頭辞。native 側はどれか 1 つでも出たら失敗。
# admax / shinobi は忍者AdMax(実行時フォールバック — ADS_POLICY.md「Web 版」)。
ads_pattern='adsbygoogle|googlesyndication|ca-pub-|admax|shinobi'
analytics_pattern='googletagmanager|simple_games_play|game_open|game_close'
measurement_id_pattern='G-[A-Z0-9]{6,}'
chrome_pattern='global-header|data-global-header|sg-web-chrome'

fail=0

check_native() {
  if [ ! -d "$native_dist" ]; then
    printf '\033[31mFAIL\033[0m %s がありません。先に `pnpm build` を実行してください。\n' "$native_dist"
    fail=1
    return
  fi

  hits="$(grep -rlE "$ads_pattern" "$native_dist" || true)"
  if [ -n "$hits" ]; then
    printf '\n\033[31mFAIL\033[0m native ビルドに Web 広告(AdSense)のコードが混入しています:\n%s\n' "$hits"
    printf 'アプリの成果物に Web 広告コードは「不在」が約束です(docs/ADS_POLICY.md)。\n'
    fail=1
  else
    printf '\033[32mok\033[0m   native dist に AdSense なし\n'
  fi

  hits="$(grep -rlE "$analytics_pattern|$measurement_id_pattern" "$native_dist" || true)"
  if [ -n "$hits" ]; then
    printf '\n\033[31mFAIL\033[0m native ビルドに Web Analytics(GA4)のコードが混入しています:\n%s\n' "$hits"
    printf 'アプリの成果物に Analytics は「不在」が約束です(docs/PRODUCT_PRINCIPLES.md)。\n'
    fail=1
  else
    printf '\033[32mok\033[0m   native dist に GA4 なし\n'
  fi

  hits="$(grep -rlE "$chrome_pattern" "$native_dist" || true)"
  if [ -n "$hits" ]; then
    printf '\n\033[31mFAIL\033[0m native ビルドにサイトクロームのコードが混入しています:\n%s\n' "$hits"
    printf 'ヘッダーは Web 版だけのものです(docs/WEB_VERSION.md「サイトクローム」)。\n'
    fail=1
  else
    printf '\033[32mok\033[0m   native dist にサイトクロームなし\n'
  fi
}

check_web() {
  if [ ! -d "$web_dist" ]; then
    printf '\033[31mFAIL\033[0m %s がありません。先に `pnpm --filter simple-games build:web` を実行してください。\n' "$web_dist"
    fail=1
    return
  fi
  if grep -rqE 'adsbygoogle' "$web_dist"; then
    printf '\033[32mok\033[0m   web dist に AdSense 統合あり\n'
  else
    printf '\n\033[31mFAIL\033[0m web ビルドに AdSense 統合が見つかりません。\n'
    printf 'WebAdSlot の --mode web ゲートか lazy import の配線が切れています(静かに広告なしになるだけなので、ここで検知します)。\n'
    fail=1
  fi

  if grep -rqE 'admaxads' "$web_dist"; then
    printf '\033[32mok\033[0m   web dist に AdMax フォールバック統合あり\n'
  else
    printf '\n\033[31mFAIL\033[0m web ビルドに忍者AdMax のフォールバック統合が見つかりません。\n'
    printf 'services/ads/web/admax.ts の配線が切れています(AdSense 失敗時に静かに何も出なくなるだけなので、ここで検知します)。\n'
    fail=1
  fi

  if grep -rqE "$chrome_pattern" "$web_dist"; then
    printf '\033[32mok\033[0m   web dist にサイトクロームあり\n'
  else
    printf '\n\033[31mFAIL\033[0m web ビルドにサイトクローム統合が見つかりません。\n'
    printf 'WebChromeSlot の --mode web ゲートか lazy import の配線が切れています(静かにヘッダーなしになるだけなので、ここで検知します)。\n'
    fail=1
  fi

  if [ "${EXPECT_WEB_ANALYTICS:-0}" = "1" ]; then
    if grep -rqE "$analytics_pattern" "$web_dist" && grep -rqE "$measurement_id_pattern" "$web_dist"; then
      printf '\033[32mok\033[0m   web dist に GA4 統合と測定 ID あり\n'
    else
      printf '\n\033[31mFAIL\033[0m Analytics 有効ビルドに GA4 統合または測定 IDが見つかりません。\n'
      printf 'VITE_GA_MEASUREMENT_ID の注入と web-only dynamic import を確認してください。\n'
      fail=1
    fi
  elif grep -rqE "$measurement_id_pattern" "$web_dist"; then
    printf '\n\033[31mFAIL\033[0m Analytics 無効ビルドに GA4 測定 ID が残っています。\n'
    printf 'ID 未設定時は計測を既定 OFF にする約束です(docs/WEB_VERSION.md)。\n'
    fail=1
  else
    printf '\033[32mok\033[0m   web dist に GA4 測定 ID なし(既定 OFF)\n'
  fi
}

case "$target" in
  native) check_native ;;
  web) check_web ;;
  both)
    check_native
    check_web
    ;;
  *)
    printf 'usage: %s [native|web]\n' "$0"
    exit 2
    ;;
esac

if [ "$fail" -ne 0 ]; then
  exit 1
fi
printf 'ビルド成果物の Web 専用コード分離を確認しました。\n'
