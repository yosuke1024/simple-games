#!/usr/bin/env bash
# Android のリリース成果物を、ソースではなく**ビルドされたもの**で検査する(issue #204)。
#
# check-principles.sh はソースを grep する。だが Android の権限と ContentProvider の
# 多くは依存ライブラリの manifest から merge されて入り、ソースには 1 行も現れない
# (AdMob が AD_ID を、Meta SDK が起動時初期化の provider を持ち込む)。そこで
# `./gradlew assembleRelease` のあとに、merge 済みの manifest と APK の dex を見る:
#
#   1. 権限は下の許可リストの中だけ。依存の更新で 1 つでも増えたら落ちる —— 増えた
#      権限を人が読んでから、このリストを意図的に更新する。
#   2. Meta SDK の起動時初期化 provider(FacebookInitProvider)はどちらのモードでも
#      存在しない。
#   3. mode=off(既定。SG_META_ANDROID_ENABLED が true でないビルド)では Meta SDK の
#      クラスが dex に 1 つも無く、manifest に com.facebook が現れない。
#      「無効化された機能」ではなく「存在しない機能」であることをここで示す。
#   4. mode=on では SDK が入っていて、自動初期化・自動ログ・広告 ID 収集が
#      false で宣言されている(docs/META_ANDROID_ACQUISITION.md)。
#   5. 他のアプリが見えるようになる <queries> の provider / package は、mode=on の
#      Facebook アプリの AttributionIdProvider 1 つだけ。mode=on でこれが欠けると、
#      インストールの報告が広告と結べなくなる(しかもエラーにはならない)ので、
#      「無いこと」も落とす。intent の宣言(AdMob の https など)はここでは数えない。
#
# 使い方(apps/simple-games/android で assembleRelease したあと、リポジトリのルートで):
#   bash .github/scripts/check-android-artifact.sh off
#   bash .github/scripts/check-android-artifact.sh on
set -euo pipefail
cd "$(dirname "$0")/../.."

mode="${1:-}"
case "$mode" in
  on | off) ;;
  *)
    echo "usage: $0 on|off" >&2
    exit 2
    ;;
esac

app=apps/simple-games/android/app
# 署名済みなら app-release.apk、署名 secret の無いビルド(PR の検査・手動実行)では
# app-release-unsigned.apk。中身の検査にはどちらでもよい。
apk="$(find "$app/build/outputs/apk/release" -maxdepth 1 -name 'app-release*.apk' 2>/dev/null | head -n 1)"
manifest="$(find "$app/build/intermediates/merged_manifests/release" -name AndroidManifest.xml 2>/dev/null | head -n 1)"
[ -n "$apk" ] && [ -f "$apk" ] || { echo "::error::release の APK がありません(先に assembleRelease)"; exit 1; }
[ -n "$manifest" ] || { echo "::error::release の merged manifest が見つかりません"; exit 1; }

# 権限の許可リスト。2026-09-27 の main(Meta なし)の merged manifest を実測して作った。
#   INTERNET / BILLING / ACCESS_NETWORK_STATE / VIBRATE — アプリと Capacitor プラグイン
#   AD_ID / ACCESS_ADSERVICES_* / WAKE_LOCK / FOREGROUND_SERVICE /
#   DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION — AdMob(play-services-ads)と androidx
allowed_common=(
  android.permission.INTERNET
  com.android.vending.BILLING
  android.permission.ACCESS_NETWORK_STATE
  android.permission.VIBRATE
  com.google.android.gms.permission.AD_ID
  android.permission.ACCESS_ADSERVICES_AD_ID
  android.permission.ACCESS_ADSERVICES_ATTRIBUTION
  android.permission.ACCESS_ADSERVICES_TOPICS
  android.permission.WAKE_LOCK
  android.permission.FOREGROUND_SERVICE
  com.pixapps.simplegames.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
)
# Meta ビルドだけに増えてよいもの: Google Play の Install Referrer を読む権限
# (installreferrer ライブラリが持ち込む。Meta 広告のクリックとインストールを結ぶ
# 経路の 1 つで、2026-09-29 からは広告 ID と併用 — docs/META_ANDROID_ACQUISITION.md §5)。
# Meta SDK が宣言する ACCESS_ADSERVICES_CUSTOM_AUDIENCE(リターゲティング用)は
# overlay で外すので、ここには無い。
allowed_meta=(
  com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE
)

python3 - "$manifest" "$mode" "${allowed_common[*]}" "${allowed_meta[*]}" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, mode, common, meta = sys.argv[1], sys.argv[2], sys.argv[3].split(), sys.argv[4].split()
A = '{http://schemas.android.com/apk/res/android}'
root = ET.parse(path).getroot()
app = root.find('application')
errors = []

allowed = set(common) | (set(meta) if mode == 'on' else set())
perms = sorted(
    {p.get(A + 'name') for tag in ('uses-permission', 'uses-permission-sdk-23') for p in root.findall(tag)}
)
for p in perms:
    if p not in allowed:
        errors.append(f'許可リスト外の権限: {p}')

names = [(el.tag, el.get(A + 'name') or '') for el in app]
if any(n == 'com.facebook.internal.FacebookInitProvider' for _, n in names):
    errors.append('FacebookInitProvider が manifest に残っています(起動時に SDK が初期化されます)')

raw = open(path, encoding='utf-8').read()
if mode == 'off':
    if 'com.facebook' in raw:
        errors.append('Meta なしのビルドの manifest に com.facebook が現れます')
else:
    meta_data = {el.get(A + 'name'): el.get(A + 'value') for el in app.findall('meta-data')}
    for flag in ('AutoInitEnabled', 'AutoLogAppEventsEnabled', 'AdvertiserIDCollectionEnabled'):
        key = f'com.facebook.sdk.{flag}'
        if meta_data.get(key) != 'false':
            errors.append(f'{key} が false で宣言されていません(実際: {meta_data.get(key)!r})')
    if 'android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE' in perms:
        errors.append('ACCESS_ADSERVICES_CUSTOM_AUDIENCE が外れていません')

queries = root.findall('queries')
q_providers = sorted({p.get(A + 'authorities') or '' for q in queries for p in q.findall('provider')})
q_packages = sorted({p.get(A + 'name') or '' for q in queries for p in q.findall('package')})
want_providers = ['com.facebook.katana.provider.AttributionIdProvider'] if mode == 'on' else []
if q_providers != want_providers:
    errors.append(f'<queries> の provider が想定と違います(想定: {want_providers}、実際: {q_providers})')
if q_packages:
    errors.append(f'<queries> に package があります(他のアプリの可視範囲が広がります): {q_packages}')

print(f'merged manifest: {path}')
print('permissions: ' + ', '.join(perms))
print('queried providers: ' + (', '.join(q_providers) or '(none)'))
if errors:
    for e in errors:
        print(f'::error::{e}')
    sys.exit(1)
PY

# dex に Meta SDK のクラスがあるか。R8 は名前を縮めるが、SDK 自身の consumer rules が
# `com.facebook.core.Core` などを名前ごと残すので、入っていれば必ず見える。
listing="$(mktemp)"
trap 'rm -f "$listing"' EXIT
unzip -Z1 "$apk" > "$listing"
# 数えるのは Meta のクラス記述子(`Lcom/facebook/…;`)の種類。
meta_refs="$(
  while IFS= read -r dex; do
    unzip -p "$apk" "$dex" | LC_ALL=C grep -a -o 'Lcom/facebook/[A-Za-z0-9_/$]*;' || true
  done < <(grep -E '^classes[0-9]*\.dex$' "$listing") | sort -u | wc -l | tr -d ' '
)"
if [ "$mode" = off ] && [ "$meta_refs" -ne 0 ]; then
  echo "::error::Meta なしのビルドの dex に com/facebook のクラスがあります($meta_refs 箇所)"
  exit 1
fi
if [ "$mode" = on ] && [ "$meta_refs" -eq 0 ]; then
  echo "::error::Meta を有効にしたビルドの dex に Meta SDK がありません(フラグが効いていません)"
  exit 1
fi
echo "dex の com/facebook クラス記述子: $meta_refs 種類(mode=$mode)"
echo "APK: $(wc -c < "$apk" | tr -d ' ') bytes"
echo "Android 成果物の検査を通過しました(mode=$mode)。"
