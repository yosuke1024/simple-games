#!/usr/bin/env node
/**
 * ローカル反復用のスコープ済み検証ループ。
 *
 *   node scripts/verify-changed.mjs                 変更ファイルだけを検証(既定 base: main)
 *   node scripts/verify-changed.mjs --base <ref>    比較元を変える(VERIFY_BASE 環境変数でも指定可)
 *   node scripts/verify-changed.mjs --full          フルスイート(typecheck・eslint src・vitest run)を実行
 *   node scripts/verify-changed.mjs --help          使い方を表示
 *
 * フルスイートは typecheck(30〜50秒)+ eslint src(60秒)+ vitest run(732 ファイル・
 * CI で 8 分半、2026-10-22)かかり、編集のたびに待てる時間ではない。このスクリプトは
 * 変更ファイルに絞った eslint と、常に必要な typecheck 全体と、差分に関係するテスト
 * (scripts/test-scoped.mjs —— import グラフで届くテスト + 触ったゲームのテスト全部 +
 * node:fs でソースを読む常時ゲート。規則は同ファイル冒頭)だけを実行する「速い方」の
 * ループ。CI は PR で同じ test-scoped.mjs を、main への push で全件を走らせるので、
 * ここで何を省略してもリリース判定は揺らがない(このスクリプトはローカル反復専用で、
 * マージの可否を決めるものではない)。
 *
 * typecheck は 2 つの tsconfig(アプリ用・Node 用)にまたがり意味のある形で
 * スコープできないため、スコープ済みモードでも常にフルで走らせる。
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { changedRepoRelFiles } from './changed-files.mjs';

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
  c. node scripts/test-scoped.mjs --base <base>(差分に関係するテスト + 常時ゲート。
     選び方は同ファイル冒頭。--list で集合だけ見られる)
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
 * base 以降の変更(scripts/changed-files.mjs)を apps/simple-games/src/** の
 * .ts/.tsx/.css に絞り、APP 相対('src/...')にして返す。
 */
function changedAppSrcFiles(base) {
  const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
  const appRelDir = relative(repoRoot, APP).split('\\').join('/'); // 'apps/simple-games'
  const prefix = `${appRelDir}/`;
  const srcPrefix = `${prefix}src/`;
  const exts = ['.ts', '.tsx', '.css'];
  return changedRepoRelFiles(base, { cwd: APP })
    .filter((f) => f.startsWith(srcPrefix) && exts.some((ext) => f.endsWith(ext)))
    .map((f) => f.slice(prefix.length)); // APP 相対('src/...')にする
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

const changed = changedAppSrcFiles(base);
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

header(`c. node scripts/test-scoped.mjs --base ${base}`);
run('vitest:scoped', process.execPath, [join(HERE, 'test-scoped.mjs'), '--base', base]);

printSummary();
process.exit(0);
