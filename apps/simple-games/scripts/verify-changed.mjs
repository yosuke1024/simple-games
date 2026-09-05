#!/usr/bin/env node
/**
 * ローカル反復用のスコープ済み検証ループ。
 *
 *   node scripts/verify-changed.mjs                 変更ファイルだけを検証(既定 base: main)
 *   node scripts/verify-changed.mjs --base <ref>    比較元を変える(VERIFY_BASE 環境変数でも指定可)
 *   node scripts/verify-changed.mjs --full          フルスイート(typecheck・eslint src・vitest run)を実行
 *   node scripts/verify-changed.mjs --help          使い方を表示
 *
 * フルスイートは typecheck(30〜50秒)+ eslint src(60秒)+ vitest run(317 ファイル・
 * 約7分)かかり、編集のたびに待てる時間ではない。このスクリプトは変更ファイルに
 * 絞った eslint / vitest --changed と、常に必要な最小限(typecheck 全体・下記の
 * 常時ゲート)だけを実行する「速い方」のループ。CI は今までどおりフルスイートを
 * 走らせ続けるので、ここで何を省略してもリリース判定は揺らがない
 * (このスクリプトはローカル反復専用で、マージの可否を決めるものではない)。
 *
 * src/test/*.test.ts(x) の一部(gameI18nWiring / importBoundaries / refLeading /
 * homeActionsWiring / savedGameSlots / shareWiring)と src/app/*.test.ts(x)・
 * src/i18n/*.test.ts は node:fs でソースファイルを直接読むテストで、import
 * グラフを辿らない。だから vitest --changed はゲームファイルを変更しても
 * これらを「無関係」と判定して再実行しない。3 ディレクトリ(src/test src/app
 * src/i18n)は変更の有無に関わらず常時実行するのはそのため。
 *
 * typecheck は 2 つの tsconfig(アプリ用・Node 用)にまたがり意味のある形で
 * スコープできないため、スコープ済みモードでも常にフルで走らせる。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');

const HELP = `usage: verify-changed.mjs [--base <git ref>] [--full] [--help]

  --base <ref>   比較元の git ref(既定: main。VERIFY_BASE 環境変数でも指定可)
  --full         スコープ済みループの代わりにフルスイートを実行
                 (typecheck, eslint src, vitest run)
  --help         このメッセージを表示

既定(スコープ済み)では次を順に実行し、最初の失敗で止まる:
  a. eslint <base 以降に変更された .ts/.tsx>(変更なしならスキップ)
  b. typecheck(tsconfig.json と tsconfig.node.json の両方。常にフル)
  c. vitest run --changed <base>(apps/simple-games/src 配下に変更がなければスキップ)
  d. vitest run src/test src/app src/i18n(常時ゲート。上の理由はファイル先頭のコメント参照)
`;

function printHelp() {
  console.log(HELP);
}

function parseArgs(argv) {
  let base = process.env.VERIFY_BASE || 'main';
  let full = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (arg === '--full') {
      full = true;
    } else if (arg === '--base') {
      const value = argv[++i];
      if (value === undefined) {
        console.error('error: --base requires a value');
        process.exit(2);
      }
      base = value;
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else {
      console.error(`error: unknown option "${arg}"`);
      printHelp();
      process.exit(2);
    }
  }
  return { help: false, base, full };
}

const { help, base, full } = parseArgs(process.argv.slice(2));
if (help) {
  printHelp();
  process.exit(0);
}

function bin(name) {
  const path = join(APP, 'node_modules/.bin', name);
  if (!existsSync(path)) {
    console.error(`error: ${path} not found (run \`pnpm install\` in ${APP})`);
    process.exit(2);
  }
  return path;
}

function git(gitArgs) {
  return execFileSync('git', gitArgs, { cwd: APP, encoding: 'utf8' });
}

/**
 * base と HEAD のマージベース以降に触られたファイルの和集合(git 管理下)+
 * ワーキングツリー(未追跡ファイルも含む)を、apps/simple-games/src/** の
 * .ts/.tsx/.css に絞って返す。パスはリポジトリルート相対。
 */
function changedRepoRelFiles(base) {
  const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
  const appRelDir = relative(repoRoot, APP).split('\\').join('/'); // 'apps/simple-games'

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
  const diffOut = git(['diff', '--name-only', mergeBase]);
  for (const line of diffOut.split('\n')) {
    const path = line.trim();
    if (path) files.add(path);
  }

  // 2. ワーキングツリーの状態(未追跡ファイルを含む)。-z で引用符の揺れを避ける。
  const statusOut = execFileSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: APP, encoding: 'utf8' },
  );
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

  const prefix = `${appRelDir}/`;
  const srcPrefix = `${prefix}src/`;
  const exts = ['.ts', '.tsx', '.css'];
  return [...files]
    .filter((f) => f.startsWith(srcPrefix) && exts.some((ext) => f.endsWith(ext)))
    .map((f) => f.slice(prefix.length)) // APP 相対('src/...')にする
    .sort();
}

// ---------- 実行の骨組み ----------

const summary = [];
const overallStart = Date.now();

function header(text) {
  console.log(`\n== ${text} ==`);
}

function run(label, cmd, cmdArgs) {
  console.log(`running: ${[cmd, ...cmdArgs].join(' ')}`);
  const start = Date.now();
  try {
    execFileSync(cmd, cmdArgs, { cwd: APP, stdio: 'inherit' });
  } catch (err) {
    const seconds = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`\nFAIL: ${label}(${seconds}s)`);
    printSummary();
    process.exit(typeof err.status === 'number' && err.status !== 0 ? err.status : 1);
  }
  const seconds = (Date.now() - start) / 1000;
  summary.push({ label, status: 'ran', seconds });
}

function skip(label, reason) {
  console.log(`skip: ${reason}`);
  summary.push({ label, status: 'skipped', seconds: 0 });
}

function printSummary() {
  const totalSeconds = ((Date.now() - overallStart) / 1000).toFixed(1);
  const parts = summary.map((s) =>
    s.status === 'ran' ? `${s.label}=ran(${s.seconds.toFixed(1)}s)` : `${s.label}=skipped`,
  );
  const ranCount = summary.filter((s) => s.status === 'ran').length;
  const skippedCount = summary.filter((s) => s.status === 'skipped').length;
  console.log(
    `\nsummary: ${ranCount} step(s) run, ${skippedCount} skipped, ${totalSeconds}s wall-clock — ${parts.join(', ')}`,
  );
}

// ---------- フルスイート ----------

if (full) {
  header('full suite: eslint src');
  run('eslint', bin('eslint'), ['src']);

  header('full suite: typecheck (tsconfig.json)');
  run('typecheck:app', bin('tsc'), ['-p', 'tsconfig.json']);
  header('full suite: typecheck (tsconfig.node.json)');
  run('typecheck:node', bin('tsc'), ['-p', 'tsconfig.node.json']);

  header('full suite: vitest run');
  run('vitest', bin('vitest'), ['run']);

  printSummary();
  process.exit(0);
}

// ---------- スコープ済みループ ----------

const changed = changedRepoRelFiles(base);
const changedTsFiles = changed.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

header(`a. eslint — changed .ts/.tsx files vs ${base}`);
if (changedTsFiles.length === 0) {
  skip('eslint', `apps/simple-games/src 配下に base(${base})以降変更された .ts/.tsx がない`);
} else {
  // 削除されたファイルは eslint に渡すと存在しないパスとしてエラーになるので除く。
  const existing = changedTsFiles.filter((f) => existsSync(join(APP, f)));
  if (existing.length === 0) {
    skip('eslint', '変更された .ts/.tsx はすべて削除されたファイルだった');
  } else {
    run('eslint', bin('eslint'), existing);
  }
}

header('b. typecheck — tsconfig.json && tsconfig.node.json (常にフル)');
run('typecheck:app', bin('tsc'), ['-p', 'tsconfig.json']);
run('typecheck:node', bin('tsc'), ['-p', 'tsconfig.node.json']);

header(`c. vitest run --changed ${base}`);
if (changed.length === 0) {
  skip(
    'vitest:changed',
    `apps/simple-games/src 配下に base(${base})以降変更された .ts/.tsx/.css がない`,
  );
} else {
  run('vitest:changed', bin('vitest'), ['run', '--changed', base]);
}

header('d. vitest run src/test src/app src/i18n (常時ゲート)');
run('vitest:gates', bin('vitest'), ['run', 'src/test', 'src/app', 'src/i18n']);

printSummary();
process.exit(0);
