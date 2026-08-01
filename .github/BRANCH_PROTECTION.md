# ブランチ保護の設定案(未適用)

このリポジトリは公開されていて、main に入ったものはそのまま
`v*` タグからストア向けビルドになる
([android-release.yml](workflows/android-release.yml))。
一方でメンテナは 1 人なので、**自分の PR を自分で承認できない**設定
(Require approvals ≥ 1)を入れると開発が止まる。

そこで「人による承認」ではなく **機械が判定できるものを必須にする** 構成を提案する。
以下は提案であって、**適用していない**。適用は GitHub の設定変更なので、実行する前に
必ず内容を確認すること。

## 提案する main の保護

| 設定 | 値 | 理由 |
| --- | --- | --- |
| Require status checks | `verify`, `Brand principles` | lint / typecheck / test / build と原則ガードが緑でないと入らない |
| Require branches to be up to date | 有効 | 2 つの PR が別々には緑でも、合流すると原則を壊す場合がある |
| Require conversation resolution | 有効 | 指摘が未解決のまま merge されない |
| Require linear history | 有効 | 履歴が読める状態を保つ(squash merge 前提) |
| Block force pushes | 有効 | 公開済みの履歴を書き換えない |
| Block deletions | 有効 | — |
| Require approvals | **0(入れない)** | 単独メンテナのため。将来 contributor が増えたら 1 に上げる |
| Require review from Code Owners | **入れない** | 上と同じ理由。[CODEOWNERS](CODEOWNERS) は当面「レビュー依頼の自動付与と、高リスク領域の明示」として使う |
| Include administrators | **無効のまま** | ストア公開直前の緊急修正の逃げ道を残す。有効にするなら、その代償を理解した上で |

`verify` は [ci.yml](workflows/ci.yml) の job id、`Brand principles` は同ファイルの
`principles` job の表示名。**ジョブ名を変えたら、必須チェックの名前も変える**
(名前が一致しないチェックは「未実行」のまま永久に待たされる)。

## 適用コマンド(実行は承認後)

```bash
gh api -X PUT repos/yosuke1024/simple-games/branches/main/protection \
  --input .github/branch-protection.json
```

`.github/branch-protection.json` は次の内容(必要なら手元に作る。設定値を追跡したくない
場合はリポジトリに置かず、この文書の内容から都度作る):

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["verify", "Brand principles"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
```

現在の設定を確認する:

```bash
gh api repos/yosuke1024/simple-games/branches/main/protection
```

## タグとリリース

`v*` タグはストア向けビルドの引き金なので、タグ保護ルールも検討に値する
(Settings → Tags → New rule → `v*`)。ただし AAB のアップロード自体は
意図的に人の手作業として残してある([RELEASE_CHECKLIST.md](../docs/RELEASE_CHECKLIST.md))。

## 関連する GitHub 側の設定(コードでは表現できないもの)

- **Actions の権限**: fork からの PR に secrets を渡さない既定を維持する。
  リリースワークフローは `workflow_dispatch` とタグでしか動かないので、fork PR が
  署名鍵や本番広告 ID に触れる経路はない
- **secrets**: 署名鍵と本番 AdMob ユニット ID はリポジトリ secrets にのみ置く。
  未設定なら広告なしでビルドされる(テスト ID でも本番 ID でもない)のが正しい挙動
- **Dependabot**: 依存更新は歓迎だが、`pnpm-lock.yaml` の更新は高リスク扱い
  (WebView 下限と原則ガードに影響しうる)。自動 merge は設定しない
