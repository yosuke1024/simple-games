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
banned_any='ad-?free|completely free of ads|no popup ads|no forced ads|no in-app purchases|lifetime access|fully free|completely free'
banned_claim='No (ads|purchases)\b'
hits=""
add() { [ -n "$1" ] && hits="${hits}${1}"$'\n'; return 0; } # $() は末尾改行を落とすので自前で足す
add "$(grep -rniE "$banned_any" "${src_dirs[@]}" || true)"
add "$(grep -rnE "$banned_claim" "${src_dirs[@]}" || true)"
add "$(grep -rnE '完全無課金|完全無料|広告なし' "${src_dirs[@]}" || true)"
add "$(grep -rnE '課金なし' "${src_dirs[@]}" | grep -vE '機能課金なし|課金ロックなし' || true)"
if [ -n "$hits" ]; then
  report "広告・課金について使用禁止の表現があります(docs/BRAND.md「表現ルール」)" "$hits"
else
  ok "禁止表現なし(英語・日本語の範囲)"
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
hits=""
add "$(grep -rniE "$efficacy_en" "${src_dirs[@]}" | grep -vE "$allow_marker" || true)"
add "$(grep -rnE "$efficacy_ja" "${src_dirs[@]}" | grep -vE "$allow_marker" || true)"
if [ -n "$hits" ]; then
  report "脳への効能を主張する表現があります(docs/SCHULTE_TABLE_RULES.md §14-2)" "$hits"
else
  ok "効能の主張なし(英語・日本語の範囲)"
fi

if [ "$fail" -ne 0 ]; then
  printf '\n原則ガードが失敗しました。実装を直すか、約束そのものを変えるなら docs/ の該当\n'
  printf 'ポリシーとこのスクリプトを同じ PR で意図的に更新してください。\n'
  exit 1
fi
printf '\nすべての原則ガードを通過しました(機械判定できる範囲のみ)。\n'
