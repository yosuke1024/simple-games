/**
 * 2026-09-05: 30 ゲームのホーム画面のヘッダー(WebChromeSlot + 戻るボタン +
 * GameHomeActions、id を除いて byte 同一だった 16 行)を共有の
 * `<GameHomeHeader gameId onBack />` に置き換えた codemod。
 *
 * 全ゲームに同じ変更を入れるときの手本として残す(docs/ARCHITECTURE.md
 * 「シェルの枠とゲームの中身」):ブロックを厳密に特定し、期待と違う形の
 * ファイルは触らずに SKIP と報告する。適用後は触ったファイルだけ prettier を
 * 通し、`src/test/homeActionsWiring.test.ts` などの横断ゲートで受ける。
 * 一度きりの変換なので再実行しても対象は見つからない(全件 SKIP になる)。
 *
 *   node scripts/codemods/2026-09-05-game-home-header.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');
const report = [];
for (const id of readdirSync(GAMES).sort()) {
  const file = join(GAMES, id, 'ui/screens/HomeScreen.tsx');
  let src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const slotIdx = lines.findIndex((l) => l.trim() === '<WebChromeSlot />');
  if (slotIdx < 0) {
    report.push(`${id}: SKIP no WebChromeSlot`);
    continue;
  }
  // start: the {/* Web build only ... */} comment directly above, if present
  let start = slotIdx;
  let k = slotIdx - 1;
  while (k >= 0 && lines[k].trim() === '') k--;
  if (k >= 0 && lines[k].trim().endsWith('*/}')) {
    let j = k;
    while (j >= 0 && !lines[j].includes('{/*')) j--;
    if (j >= 0 && lines[j].includes('Web build only')) start = j;
  }
  const end = lines.findIndex((l, i) => i > slotIdx && l.trim() === '</header>');
  if (end < 0) {
    report.push(`${id}: SKIP no </header>`);
    continue;
  }
  const block = lines.slice(start, end + 1).join('\n');
  const gameIdMatch = /<GameHomeActions gameId="([^"]+)" \/>/.exec(block);
  const onBackMatch = /onClick=\{([^}]+)\}/.exec(block);
  if (!gameIdMatch || gameIdMatch[1] !== id || !onBackMatch) {
    report.push(`${id}: SKIP unexpected block`);
    continue;
  }
  const indent = /^(\s*)/.exec(lines[slotIdx])[1];
  const replacement = `${indent}<GameHomeHeader gameId="${id}" onBack={${onBackMatch[1]}} />`;
  lines.splice(start, end - start + 1, replacement);
  src = lines.join('\n');
  // imports
  const before = src;
  src = src.replace(/^import \{ WebChromeSlot \} from '@\/ui\/components\/WebChromeSlot';\n/m, '');
  src = src.replace(
    /^import \{ GameHomeActions \} from '@\/ui\/components\/GameHomeActions';\n/m,
    "import { GameHomeHeader } from '@/ui/components/GameHomeHeader';\n",
  );
  src = src.replace(/^import \{ ([^}]*) \} from '@\/ui\/components\/icons';\n/m, (m, names) => {
    const kept = names
      .split(',')
      .map((s) => s.trim())
      .filter((n) => n && n !== 'IconBack');
    return kept.length ? `import { ${kept.join(', ')} } from '@/ui/components/icons';\n` : '';
  });
  const leftovers = ['WebChromeSlot', 'GameHomeActions', 'IconBack'].filter((n) => src.includes(n));
  if (leftovers.length || before === src) {
    report.push(`${id}: FAIL leftovers=${leftovers.join(',')}`);
    continue;
  }
  writeFileSync(file, src);
  report.push(`${id}: ok (removed ${end - start + 1} lines)`);
}
console.log(report.join('\n'));
