/**
 * base と HEAD のマージベース以降に触られたファイル(git 管理下)+ ワーキングツリー
 * (未追跡ファイルも含む)の和集合を、リポジトリルート相対のパスで返す。
 * vitest --changed <base> が見る範囲(git diff base...HEAD + staged + unstaged)と同じ。
 * 使う側: verify-changed.mjs(ローカルの反復)と test-scoped.mjs(CI)。
 */
import { execFileSync } from 'node:child_process';

export function changedRepoRelFiles(base, { cwd }) {
  const git = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

  let mergeBase;
  try {
    mergeBase = git(['merge-base', base, 'HEAD']).trim();
  } catch (err) {
    console.error(`error: could not resolve merge-base for "${base}" and HEAD`);
    console.error(err.message);
    process.exit(2);
  }

  const files = new Set();

  // 1. base との共通祖先以降、ワーキングツリーまでの追跡ファイルの差分
  //    (コミット済み・未コミットの変更の両方を含む。git diff <ref> の定義どおり)。
  for (const line of git(['diff', '--name-only', mergeBase]).split('\n')) {
    const path = line.trim();
    if (path) files.add(path);
  }

  // 2. ワーキングツリーの状態(未追跡ファイルを含む)。-z で引用符の揺れを避ける。
  const statusOut = git(['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const tokens = statusOut.split('\0').filter((t) => t.length > 0);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const status = token.slice(0, 2);
    const path = token.slice(3);
    if (path) files.add(path);
    if (status.includes('R') || status.includes('C')) {
      i++; // rename/copy: 次のトークンは移動元パス(現在地ではないので捨てる)
    }
  }

  return [...files].sort();
}
