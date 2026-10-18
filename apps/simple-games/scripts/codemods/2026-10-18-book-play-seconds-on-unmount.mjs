/**
 * 2026-10-18: ゲームの provider がアンマウントされたら、画面を離れるときと同じ
 * 同期を 1 回走らせる codemod(docs/GAME_LIFECYCLE.md「アンマウントで計上する」)。
 *
 * Web 版でブラウザの戻るを押すと、シェル(app/App.tsx の popstate)はゲームの
 * Root をそのままアンマウントする。ゲーム自身の goHome / exitToCollection は
 * 呼ばれず、visibilitychange も来ないので、最後の同期以降のプレイ秒は盤面の時計
 * からも統計(`totalPlaySeconds`)からも消えていた。Android / iOS で別のゲームへの
 * ショートカットが今のゲームを入れ替えるとき(`appUrlOpen`)も同じ穴である。
 *
 * どの扉から出てもアンマウントだけは必ず起きるので、そこで同期する。走らせるのは
 * バックグラウンドで既に走っている同期そのもので、二重計上は各 provider の
 * `bookedRef`(まだ計上していない秒だけを足す)が防ぐ。アンマウントの検知は
 * `ui/useOnUnmount.ts`(最新の関数を ref に持ち、cleanup をアンマウントだけに
 * 結びつける)。
 *
 *   syncActiveGame を持つ 35 本      `useOnUnmount(syncActiveGame);`
 *   abandonActiveRound を持つ 2 本   `useOnUnmount(abandonActiveRound);`
 *   (Number Recall / Schulte Table ── ラウンドを保存しない。離脱と同じく破棄して計上する)
 *   アーケード 4 本                  対象外。盤面コンポーネントのループの cleanup が既に
 *                                    `flushSeconds()` を呼んでいる(計上は盤面が持つ)
 *
 * 置き場所はバックグラウンドの effect(`visibilitychange` を聞くもの)の直後。
 * 同じ同期の 3 つ目の入口なので、隣に並べて読めるようにする。import は
 * `../../../` の import 群の中に、パスの辞書順の位置へ入れる。
 *
 * テスト側にも 1 か所だけ波及する。`cleanup()` はアンマウントなので、いまは盤面と
 * 統計の保存を起こす。保存は fire-and-forget(storage/repo.ts の per-key キュー)で、
 * `afterEach` が `cleanup(); deviceStore.clear();` の順に同期で並んでいると、保存は
 * 消した後に着地し、次のテストは遊んでいない盤面の上に起動する(2026-10-18 に
 * 37 ファイル・126 件がこれで落ちた)。対象ゲームの Root を描くテストファイルでは
 * `cleanup()` の直後に `await act(async () => undefined);` を挟み、保存を着地させて
 * から消す(YachtRoot.test.tsx が先に持っていた形。`act` は fake timers の下でも
 * 進むので、`setTimeout` は使わない)。アーケード 4 本のテストは保存を起こさないので
 * 触らない。
 *
 * 期待する骨格と一致しないファイルは FAIL と報告して何も書かない。既に入っている
 * ファイルは SKIP になり、再実行は no-op。門は src/test/unmountBookingWiring.test.ts。
 *
 *   node scripts/codemods/2026-10-18-book-play-seconds-on-unmount.mjs
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');

const HOOK_PATH = '../../../ui/useOnUnmount';
const IMPORT = `import { useOnUnmount } from '${HOOK_PATH}';`;

const DOOR = [
  '  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):',
  "  // the browser's Back and a home-screen shortcut to another game take this",
  '  // provider off screen without goHome, exitToCollection or a',
];

/** The comment and the call, by the seam the provider already leaves through. */
function block(seam, src) {
  if (seam === 'abandonActiveRound') {
    return [
      ...DOOR,
      '  // visibilitychange. The round is abandoned then all the same, and only',
      '  // what is not booked yet is added — after either exit, or a background,',
      '  // nothing is.',
      '  useOnUnmount(abandonActiveRound);',
    ];
  }
  if (!/const bookedRef = /.test(src)) {
    // Number Match books a game's play time once, when it ends, from the
    // board's own clock — so what has to survive the unmount is that clock.
    return [
      ...DOOR,
      '  // visibilitychange. The same sync runs then, so the board keeps the',
      '  // seconds played since its last save; they are booked once, when the',
      '  // game ends.',
      '  useOnUnmount(syncActiveGame);',
    ];
  }
  return [
    ...DOOR,
    '  // visibilitychange, so the seconds since the last sync would be lost. The',
    '  // same sync runs then, and it books only what `bookedRef` has not — after',
    '  // either exit, or a background, it adds nothing.',
    '  useOnUnmount(syncActiveGame);',
  ];
}

/** Puts the hook's import among the `../../../` imports, in path order. */
function addImport(lines) {
  const shellImports = [];
  for (let i = 0; i < lines.length; i++) {
    const from =
      /^(?:import .*)?\} from '(\.\.\/\.\.\/\.\.\/[^']+)';$|^import .* from '(\.\.\/\.\.\/\.\.\/[^']+)';$/.exec(
        lines[i],
      );
    if (from) shellImports.push({ end: i, path: from[1] ?? from[2] });
  }
  if (shellImports.length === 0) return false;
  const after = shellImports.filter((s) => s.path < HOOK_PATH).at(-1);
  let at;
  if (after) {
    at = after.end + 1;
  } else {
    // Before the first one: walk back to where that import statement starts.
    at = shellImports[0].end;
    while (at > 0 && !lines[at].startsWith('import ')) at--;
  }
  lines.splice(at, 0, IMPORT);
  return true;
}

const report = [];
let failed = false;

for (const id of readdirSync(GAMES).sort()) {
  const path = join(GAMES, id, 'state', 'GameContext.tsx');
  if (!existsSync(path)) continue;
  const src = readFileSync(path, 'utf8');

  const seam = /const syncActiveGame = useCallback/.test(src)
    ? 'syncActiveGame'
    : /const abandonActiveRound = useCallback/.test(src)
      ? 'abandonActiveRound'
      : null;
  if (seam === null) {
    report.push(`${id}: SKIP no leave seam (the board books on its own unmount)`);
    continue;
  }
  if (src.includes(`useOnUnmount(${seam});`)) {
    report.push(`${id}: SKIP already books on unmount`);
    continue;
  }

  // The background effect: the one that listens for visibilitychange. Its
  // closing deps line is where the new call goes.
  const lines = src.split('\n');
  const listen = lines.findIndex((l) => l.includes("addEventListener('visibilitychange'"));
  if (listen < 0) {
    report.push(`${id}: FAIL no visibilitychange listener`);
    failed = true;
    continue;
  }
  const close = lines.findIndex((l, i) => i > listen && /^ {2}\}, \[[^\]]*\]\);$/.test(l));
  if (close < 0) {
    report.push(`${id}: FAIL background effect has no closing deps line`);
    failed = true;
    continue;
  }
  lines.splice(close + 1, 0, '', ...block(seam, src));
  if (!addImport(lines)) {
    report.push(`${id}: FAIL no ../../../ import to sit beside`);
    failed = true;
    continue;
  }

  writeFileSync(path, lines.join('\n'));
  report.push(`${id}: ok (${seam})`);
}

// ---------- the tests: let the unmount's saves land before the store is wiped ----------

const DRAIN = [
  '  // Unmounting saves: the provider runs its leave sync on the way out',
  '  // (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and saves are',
  '  // fire-and-forget. Let them land before wiping the store, or the next test',
  '  // launches onto a game it never played.',
  '  await act(async () => undefined);',
];

/** Every test file under `dir`, recursively. */
function testsUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...testsUnder(p));
    else if (/\.test\.tsx$/.test(entry.name)) out.push(p);
  }
  return out;
}

const booksOnUnmount = (id) =>
  /useOnUnmount\(/.test(readFileSync(join(GAMES, id, 'state', 'GameContext.tsx'), 'utf8'));

const candidates = [
  ...readdirSync(GAMES)
    .filter((id) => existsSync(join(GAMES, id, 'state', 'GameContext.tsx')) && booksOnUnmount(id))
    .flatMap((id) => testsUnder(join(GAMES, id))),
  // Mounts every game's Root, one after another, against one store.
  join(APP, 'src/test/tutorialBackWiring.test.tsx'),
];

for (const path of candidates.sort()) {
  const name = path.slice(APP.length + 1);
  let src = readFileSync(path, 'utf8');
  if (!src.includes('deviceStore.clear()')) continue;
  if (src.includes(DRAIN[0])) {
    report.push(`${name}: SKIP already drains`);
    continue;
  }
  if (/^afterEach\(async \(\) => \{$/m.test(src)) {
    report.push(`${name}: SKIP drains its own way`);
    continue;
  }
  const head = 'afterEach(() => {\n  cleanup();\n';
  if (src.split(head).length !== 2) {
    report.push(`${name}: FAIL afterEach does not open with cleanup()`);
    failed = true;
    continue;
  }
  src = src.replace(head, `afterEach(async () => {\n  cleanup();\n${DRAIN.join('\n')}\n`);

  // `act` from testing-library, beside whatever the file already takes from it.
  const importRe = /^import \{ ([^}]+) \} from '@testing-library\/react';$/m;
  const names = importRe.exec(src);
  if (!names) {
    report.push(`${name}: FAIL no single-line testing-library import`);
    failed = true;
    continue;
  }
  if (!/\bact\b/.test(names[1])) {
    const merged = ['act', ...names[1].split(',').map((s) => s.trim())];
    src = src.replace(importRe, `import { ${merged.join(', ')} } from '@testing-library/react';`);
  }
  writeFileSync(path, src);
  report.push(`${name}: ok (drains before wiping)`);
}

console.log(report.join('\n'));
if (failed) process.exitCode = 1;
