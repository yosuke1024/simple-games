#!/usr/bin/env bash
# Web 広告コードの「分離」を、ソースではなく**ビルド成果物**で検証する
# (docs/WEB_VERSION.md「実装上の約束」/ docs/ADS_POLICY.md「Web 版」)。
#
#   native (apps/simple-games/dist/)    — AdSense の痕跡が**不在**であること。
#       「アプリの広告はバナー 1 枠のみ」は公開ソースと成果物で証明する約束であり、
#       WebAdSlot の build-time ゲート(import.meta.env.MODE === 'web')が
#       実際に効いていることをバンドラの出力で確かめる。
#   web    (apps/simple-games/dist-web/) — AdSense 統合が**存在**すること。
#       ゲートの配線が切れると Web 版は「静かに広告なし」になり誰も気付かない。
#       存在検査はその配線切れの検知器。
#
# check-principles.sh は grep だけで動く(ビルド不要)という分担なので、
# ビルドを前提とするこの検査は別スクリプトになっている。ci.yml が
# `pnpm build` と `pnpm --filter simple-games build:web` の後に呼ぶ。
#
# ローカル実行:
#   pnpm build && pnpm --filter simple-games build:web
#   bash .github/scripts/check-dist-ads-separation.sh          # 両方
#   bash .github/scripts/check-dist-ads-separation.sh native   # native のみ
#   bash .github/scripts/check-dist-ads-separation.sh web      # web のみ
set -uo pipefail
cd "$(dirname "$0")/../.."

target="${1:-both}"
native_dist="apps/simple-games/dist"
web_dist="apps/simple-games/dist-web"
# 検査語彙: ローダー・タグ・ID 接頭辞。native 側はどれか 1 つでも出たら失敗。
ads_pattern='adsbygoogle|googlesyndication|ca-pub-'

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
printf 'ビルド成果物の広告分離を確認しました。\n'
