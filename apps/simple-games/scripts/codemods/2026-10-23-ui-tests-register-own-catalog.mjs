/**
 * 2026-10-23: Root を通さずにゲームの画面や部品を直接 render するテストに、そのゲームの
 * カタログの登録 `import '<…>/i18n';` を足す codemod。
 *
 * それまで src/test/setup.ts が `import.meta.glob('../games/*\/i18n/index.ts', { eager: true })`
 * で全ゲームのカタログ(56 本 × 15 ファイル)を毎テストファイルの頭で読んでいた。
 * 1 ファイルの固定費がゲーム数に比例し、それをゲーム数に比例するファイル数で払う形で、
 * スイートの時間はゲーム数の二乗で伸びる。アプリでは各ゲームの Root(registry の
 * ローダーが指す chunk の入口)が `import '../i18n'` で自分のカタログを登録するので
 * (src/test/gameI18nWiring.test.ts の門)、Root を render するテストは何もしなくても
 * 自分のゲームの文字列を持っている。持っていないのは、Root を経由せずに結果画面・
 * 盤面・GameContext を直接 render するテストで、それらに「自分のゲームのカタログを
 * 自分で登録する」1 行を足す。アプリの現実と同じ形(文字列はその chunk が運ぶ)で、
 * テストが読むカタログはそのゲームの 1 本だけになる。
 *
 * 判定(ファイルごと):
 *   - `@testing-library/react` を import していない    → SKIP(何も描かないので文字列を読まない)
 *   - 既に `import '…/i18n';` を持つ                    → SKIP(再実行は no-op)
 *   - 相対 import が同じゲームの chunk 入口(`import '../i18n';` を持つファイル、
 *     つまり *Root.tsx / *SettingsSection.tsx)に届く → SKIP(その import が登録する)
 *   - それ以外                                           → 最初の import 文の前に 1 行の
 *                                                          コメントと side-effect import を挿す
 *
 * 期待する骨格と一致しないファイル(import 文が 1 つも無い)は FAIL と報告して何も書かない。
 * シェル側(src/ui, src/app, src/club)のテストは対象外 — ゲームのカタログを前提にしない
 * のが規則で、前提にしていればテストが落ちて教える。
 *
 *   node scripts/codemods/2026-10-23-ui-tests-register-own-catalog.mjs
 *   ls <touched files> | xargs pnpm exec prettier --write
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(APP, 'src');
const GAMES = join(SRC, 'games');

const RENDERS = /from '@testing-library\/react'/;
const OWN_CATALOG = /^import '(?:\.\.\/)+i18n';$/m;
const ENTRY_CATALOG = /^import '\.\.\/i18n';$/m;
const COMMENT =
  "// Rendered without the game's Root, so the catalog the Root registers is registered here.";

function listTests(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listTests(path));
    else if (/\.test\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out.sort();
}

/** Resolves a specifier the way Vite would, to a file or null (the alias '@/' is src/). */
function resolveImport(fromFile, specifier) {
  let base;
  if (specifier.startsWith('@/')) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(fromFile), specifier);
  else return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The file among this test's imports that registers the catalog itself, if any. */
function registeringImport(file, src, gameDir) {
  for (const [, specifier] of src.matchAll(/^import\b[^;]*?from '([^']+)';$/gm)) {
    const target = resolveImport(file, specifier);
    if (target === null || !target.startsWith(gameDir + '/')) continue;
    if (ENTRY_CATALOG.test(readFileSync(target, 'utf8'))) return relative(APP, target);
  }
  return null;
}

const report = [];
let failed = false;
let touched = 0;

for (const id of readdirSync(GAMES).sort()) {
  const gameDir = join(GAMES, id);
  if (!statSync(gameDir).isDirectory()) continue;
  for (const file of listTests(gameDir)) {
    const rel = relative(APP, file);
    if (relative(gameDir, file).startsWith('game/')) continue; // pure TypeScript: nothing renders
    const src = readFileSync(file, 'utf8');
    if (!RENDERS.test(src)) {
      report.push(`SKIP ${rel} — renders nothing`);
      continue;
    }
    if (OWN_CATALOG.test(src)) {
      report.push(`SKIP ${rel} — already registers its catalog`);
      continue;
    }
    const via = registeringImport(file, src, gameDir);
    if (via !== null) {
      report.push(`SKIP ${rel} — registered by ${via}`);
      continue;
    }
    const lines = src.split('\n');
    const at = lines.findIndex((line) => line.startsWith('import '));
    if (at === -1) {
      report.push(`FAIL ${rel} — renders but has no import statement to anchor on`);
      failed = true;
      continue;
    }
    const specifier = relative(dirname(file), join(gameDir, 'i18n')).split('\\').join('/');
    lines.splice(at, 0, COMMENT, `import '${specifier}';`);
    writeFileSync(file, lines.join('\n'));
    report.push(`ok   ${rel} — import '${specifier}'`);
    touched++;
  }
}

for (const line of report) console.log(line);
console.log(
  `\n${touched} file(s) written, ${report.filter((l) => l.startsWith('SKIP')).length} skipped, ${report.filter((l) => l.startsWith('FAIL')).length} failed`,
);
if (failed) process.exit(1);
