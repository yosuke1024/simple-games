#!/usr/bin/env node
/**
 * CI のテスト実行:差分スコープとシャード。
 *
 *   node scripts/test-scoped.mjs                            全件(vitest run と同じ)
 *   node scripts/test-scoped.mjs --shard 2/4                全件を 4 分割した 2 番目
 *   node scripts/test-scoped.mjs --base origin/main         base 以降の差分に関係するテストだけ
 *   node scripts/test-scoped.mjs --base origin/main --shard 2/4
 *   node scripts/test-scoped.mjs --base main --list        選ばれる集合を印字するだけ(走らせない)
 *   node scripts/test-scoped.mjs --help
 *
 * スイートはゲーム数に比例して伸びる(2026-10-22 時点で 732 ファイル・14,681 件、
 * CI の `pnpm test` は 1 ジョブで 8 分半)。PR では差分に関係するテストだけを、main への
 * push では全件を走らせ、どちらも ci.yml が N 個のジョブに分割する。
 *
 * 「関係するテスト」は 4 つの和集合:
 *
 *   1. import グラフで差分から届くテスト —— vitest --changed と同じ判定で、
 *      `vitest list --changed <base> --filesOnly` が列挙する。共有層(src/ui、
 *      src/storage など)を触ればそこから届くゲームが全部入る。app/registry.ts の
 *      動的 import も辿るので、ゲームを 1 本触るとレジストリを import する共有部品
 *      経由で各ゲームの Root テストと App のテストまで入る(2026-10-22 時点で
 *      約 160 ファイル。過剰だが安全側)。
 *   2. 触ったゲームのテスト全部(src/games/<id>/)。ゲームの中には node:fs で自分の
 *      ソースや CSS を読むテストがある(searchBoundary、contrast、*Css.test など)。
 *      それらは何も import しないのでグラフに乗らない。ゲームは「A は B を import
 *      しない」単位なので、ゲームを触ったらそのゲームのテストを全部走らせるのが
 *      いちばん単純で、漏れがない。
 *   3. src/games/ の外の CSS(src/ui/styles.css など)を触ったら全件。各ゲームの
 *      contrast テストが fs で読むため。ゲームの CSS は 2. が受け、全ゲームの CSS を
 *      読む src/test/styles.test.ts は 4. が受ける。
 *   4. 常時ゲート(always-on-tests.mjs)—— node:fs でソースを読む横断ゲート。
 *   5. .github/scripts/ の門スクリプトを触ったら全件(unblock-puzzle の catalogue
 *      テストが check-dist-ads-separation.sh を読み、自分の符号がその grep に
 *      かからないことを確かめている)。
 *   6. import グラフに乗らないのにテストの前提を変えるファイル —— package.json /
 *      pnpm-lock.yaml / tsconfig*.json / vite.config.* / src/test/setup.ts —— を触ったら
 *      全件。vitest の forceRerunTriggers(既定で package.json と config)も同じ意図
 *      だが、picomatch の既定はドット始まりのディレクトリを跨がないので、
 *      `.claude/worktrees/` 配下の worktree では一度も発火しない(2026-10-22 に確認。
 *      CI とメインの checkout では効く)。ここで判定すれば場所によらない。
 *
 * fs でソースを読むテストが常時ゲートの 4 ディレクトリ(src/test・src/app・src/i18n・
 * src/club)か、自分のゲームの中にしか無いことが、この規則が完全であるための前提
 * (2026-10-22 に全 732 ファイルを走査して確認。src/ui にあった styles.test.ts は
 * そのとき src/test へ移した)。
 *
 * 差分は base と HEAD のマージベース以降(scripts/changed-files.mjs。CI の checkout は
 * clean なので未コミットの変更は無い)。base は fetch 済みの ref でなければならず、
 * ci.yml はそのために fetch-depth: 0 で checkout する。
 *
 * --shard は vitest の --shard をそのまま渡す。和集合には常時ゲートの 50 ファイル
 * 前後が必ず入るので、分割数がそれを超えない限り空のシャードは生まれない。
 *
 * ローカルの反復は verify-changed.mjs(eslint / typecheck も含む)。こちらは
 * テストだけで、CI の 1 ジョブ 1 プロセスに合わせてある。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { ALWAYS_ON_TEST_DIRS } from './always-on-tests.mjs';
import { changedRepoRelFiles } from './changed-files.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');

const HELP = `usage: test-scoped.mjs [--base <git ref>] [--shard <index>/<count>] [--list] [--help]

  --base <ref>              base 以降の差分に関係するテストだけを走らせる
                            (選び方はファイル冒頭)。省略すると全件
  --shard <index>/<count>   vitest の --shard をそのまま渡す
  --list                    選ばれる集合を印字して終わる(vitest は走らせない)
  --help                    このメッセージを表示
`;

function parseArgs(argv) {
  let base = null;
  let shard = null;
  let list = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      return { help: true };
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--base' || arg === '--shard') {
      const value = argv[++i];
      if (value === undefined) {
        console.error(`error: ${arg} requires a value`);
        process.exit(2);
      }
      if (arg === '--base') base = value;
      else shard = value;
    } else if (arg.startsWith('--base=')) {
      base = arg.slice('--base='.length);
    } else if (arg.startsWith('--shard=')) {
      shard = arg.slice('--shard='.length);
    } else {
      console.error(`error: unknown option "${arg}"`);
      console.log(HELP);
      process.exit(2);
    }
  }
  if (shard !== null && !/^[1-9]\d*\/[1-9]\d*$/.test(shard)) {
    console.error(`error: --shard expects <index>/<count>, got "${shard}"`);
    process.exit(2);
  }
  return { help: false, base, shard, list };
}

const { help, base, shard, list } = parseArgs(process.argv.slice(2));
if (help) {
  console.log(HELP);
  process.exit(0);
}

const vitest = join(APP, 'node_modules/.bin/vitest');
if (!existsSync(vitest)) {
  console.error(`error: ${vitest} not found (run \`pnpm install\` in ${APP})`);
  process.exit(2);
}

/** 1. import グラフ:`vitest list --changed <base> --filesOnly`、APP 相対で 1 行 1 ファイル。 */
function graphRelatedTestFiles(base) {
  let out;
  try {
    out = execFileSync(vitest, ['list', '--changed', base, '--filesOnly'], {
      cwd: APP,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (err) {
    console.error(
      `error: vitest list --changed ${base} failed (is "${base}" a fetched ref? CI checks out with fetch-depth: 0)`,
    );
    process.exit(typeof err.status === 'number' && err.status !== 0 ? err.status : 1);
  }
  const files = out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // 列挙にファイル以外の行が混ざったら、黙って無視せず止める(フィルタとして
  // vitest に渡すので、変な行は「何も選ばれない」ではなく「別の何かが選ばれる」になる)。
  const stray = files.filter((file) => !existsSync(join(APP, file)));
  if (stray.length > 0) {
    console.error(`error: unexpected lines from vitest list:\n  ${stray.join('\n  ')}`);
    process.exit(2);
  }
  return files;
}

/** 6.:import グラフに乗らないのにテストの前提を変えるファイル(リポジトリ相対パス)。 */
const FOUNDATION_FILE =
  /(^|\/)(package\.json|pnpm-lock\.yaml|tsconfig[^/]*\.json|vite\.config\.[^/]+|vitest\.config\.[^/]+)$/;

/**
 * 2.・3.・5.・6.:差分のパスから決まる追加フィルタ。全件に倒す差分なら `full` に理由。
 */
function pathRuleFilters(base) {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: APP,
    encoding: 'utf8',
  }).trim();
  const srcPrefix = `${relative(repoRoot, APP).split('\\').join('/')}/src/`; // 'apps/simple-games/src/'
  const filters = new Set();
  for (const file of changedRepoRelFiles(base, { cwd: APP })) {
    if (FOUNDATION_FILE.test(file))
      return { full: `a file every test is built on changed: ${file}` };
    if (file.startsWith('.github/scripts/')) return { full: `a CI guard script changed: ${file}` };
    if (!file.startsWith(srcPrefix)) continue;
    const rel = `src/${file.slice(srcPrefix.length)}`;
    if (rel === 'src/test/setup.ts') return { full: `the shared test setup changed: ${rel}` };
    const game = /^src\/games\/([^/]+)\//.exec(rel)?.[1];
    if (game !== undefined) filters.add(`src/games/${game}`);
    if (rel.endsWith('.css') && game === undefined) {
      return { full: `a stylesheet outside src/games/ changed: ${rel}` };
    }
  }
  return { full: null, filters: [...filters].sort() };
}

const filters = [];
if (base === null) {
  console.log('test-scoped: full suite');
} else {
  // パスの規則が先:全件に倒すなら vitest list(Vite サーバの起動込みで数秒)は要らない。
  const rules = pathRuleFilters(base);
  if (rules.full !== null) {
    console.log(`test-scoped: full suite — ${rules.full}`);
  } else {
    const related = graphRelatedTestFiles(base);
    console.log(`test-scoped: diff vs ${base}`);
    console.log(`  import graph: ${related.length} test file(s)`);
    for (const file of related) console.log(`    ${file}`);
    console.log(`  touched games: ${rules.filters.length ? rules.filters.join(' ') : '(none)'}`);
    console.log(`  always-on: ${ALWAYS_ON_TEST_DIRS.join(' ')}`);
    filters.push(...related, ...rules.filters, ...ALWAYS_ON_TEST_DIRS);
  }
}

const args = ['run', ...(shard === null ? [] : ['--shard', shard]), ...filters];
const command = `vitest ${args.slice(0, shard === null ? 1 : 3).join(' ')}${filters.length > 0 ? ` <${filters.length} filters>` : ''}`;
if (list) {
  console.log(`would run: ${command}`);
  process.exit(0);
}
console.log(`running: ${command}`);
const result = spawnSync(vitest, args, { cwd: APP, stdio: 'inherit' });
if (result.error) {
  console.error(`error: could not run vitest: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
