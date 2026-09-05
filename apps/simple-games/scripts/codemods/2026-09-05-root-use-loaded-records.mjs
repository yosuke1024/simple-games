/**
 * 2026-09-05: 30 ゲームの Root にあった「記録を Promise.all で読み、失敗は
 * 既定値に落とし、cancelled で守る」effect(読む記録の一覧だけが違う 30 本)を
 * `useLoadedRecords(kv, loadRecords, defaultRecords)` に置き換えた codemod。
 *
 * 括弧の釣り合いでオブジェクトリテラルを切り出し、残りが期待どおりの骨格と
 * 一致するファイルだけ変換する。一致しないものは SKIP と報告し、手で見る。
 * 一度きりの変換なので再実行しても対象は見つからない。
 *
 *   node scripts/codemods/2026-09-05-root-use-loaded-records.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');
const report = [];
function balanced(src, openIdx, open, close) {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
for (const id of readdirSync(GAMES).sort()) {
  const dir = join(GAMES, id, 'ui');
  const rootName = readdirSync(dir).find((f) => /Root\.tsx$/.test(f));
  const file = join(dir, rootName);
  let src = readFileSync(file, 'utf8');
  const startMarker = '  const [data, setData] = useState<LoadedData | null>(null);\n';
  const endMarker = '  if (data === null) return null;\n';
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e < 0) {
    report.push(`${id}: SKIP markers not found`);
    continue;
  }
  const block = src.slice(s, e + endMarker.length);
  // defaults
  const dKey = 'let loaded: LoadedData = ';
  const dIdx = block.indexOf(dKey);
  if (dIdx < 0) {
    report.push(`${id}: SKIP no defaults`);
    continue;
  }
  const dOpen = dIdx + dKey.length;
  const dClose = balanced(block, dOpen, '{', '}');
  const defaults = block.slice(dOpen, dClose + 1);
  // Promise.all
  const pKey = 'await Promise.all(';
  const pIdx = block.indexOf(pKey);
  if (pIdx < 0) {
    report.push(`${id}: SKIP no Promise.all`);
    continue;
  }
  const pOpen = pIdx + pKey.length - 1;
  const pClose = balanced(block, pOpen, '(', ')');
  const args = block.slice(pOpen + 1, pClose);
  const destructMatch = /const (\[[^\]]*\]) = await Promise\.all\(/.exec(block);
  if (!destructMatch) {
    report.push(`${id}: SKIP no destructure`);
    continue;
  }
  const names = destructMatch[1];
  // loaded = {...};
  const lKey = 'loaded = ';
  const lIdx = block.indexOf(lKey, pClose);
  if (lIdx < 0) {
    report.push(`${id}: SKIP no loaded assignment`);
    continue;
  }
  const lOpen = lIdx + lKey.length;
  const lClose = balanced(block, lOpen, '{', '}');
  const loaded = block.slice(lOpen, lClose + 1);
  // the block must contain nothing else of substance
  const stripped = block
    .replace(startMarker, '')
    .replace(endMarker, '')
    .replace(defaults, '')
    .replace(args, '')
    .replace(loaded, '')
    .replace(names, '')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\s+/g, ' ');
  const expected =
    'useEffect(() => { let cancelled = false; void (async () => { let loaded: LoadedData = ; try { const = await Promise.all(); loaded = ; } catch { } if (!cancelled) setData(loaded); })(); return () => { cancelled = true; }; }, [kv]);';
  if (stripped.trim() !== expected) {
    report.push(`${id}: SKIP block differs: ${stripped.trim().slice(0, 160)}`);
    continue;
  }
  const helpers = `function defaultRecords(): LoadedData {
  return ${defaults};
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const ${names} = await Promise.all(${args});
  return ${loaded};
}

`;
  const compMatch = /^export function \w+Root\(/m.exec(src);
  if (!compMatch) {
    report.push(`${id}: SKIP no Root export`);
    continue;
  }
  const newBody = '  const data = useLoadedRecords(kv, loadRecords, defaultRecords);\n' + endMarker;
  src = src.slice(0, s) + newBody + src.slice(e + endMarker.length);
  // The helpers go right before the component (and before its JSDoc, if any).
  const compMatch2 = /^export function \w+Root\(/m.exec(src);
  let insertAt2 = compMatch2.index;
  const before2 = src.slice(0, insertAt2);
  const doc2 = before2.lastIndexOf('/**');
  if (doc2 >= 0 && before2.slice(doc2).trimEnd().endsWith('*/')) insertAt2 = doc2;
  src = src.slice(0, insertAt2) + helpers + src.slice(insertAt2);
  // imports
  const reactLine = "import { useEffect, useState } from 'react';\n";
  if (!src.includes(reactLine)) {
    report.push(`${id}: FAIL react import line`);
    continue;
  }
  src = src.replace(reactLine, '');
  if (/\buseEffect\b|\buseState\b/.test(src)) {
    report.push(`${id}: FAIL hooks still used`);
    continue;
  }
  const anchor = /^import \{ loadRecord \} from '([^']*)storage\/repo';\n/m.exec(src);
  if (!anchor) {
    report.push(`${id}: FAIL no loadRecord import`);
    continue;
  }
  const prefix = anchor[1];
  src = src.replace(
    anchor[0],
    anchor[0] + `import { useLoadedRecords } from '${prefix}ui/useLoadedRecords';\n`,
  );
  writeFileSync(file, src);
  report.push(`${id}: ok (${rootName})`);
}
console.log(report.join('\n'));
