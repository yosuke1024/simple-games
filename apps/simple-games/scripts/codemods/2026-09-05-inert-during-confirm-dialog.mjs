/**
 * 2026-09-05: `.game-content` を、結果画面だけでなく確認ダイアログ
 * (`<ConfirmDialog open={…}>`)が開いている間も `inert` にする codemod
 * (issue #120「modal / result overlay 中に keyboard で裏のゲーム状態を変えない」)。
 *
 * ダイアログの背景(`.overlay`)はポインタを遮るが、フォーカスは遮らない:
 * 自動フォーカスされた Cancel から Shift+Tab を一度押すと、DOM 順で直前の
 * フォーカス可能要素 — 盤面の最後のマスや Hint ボタン — に着地し、Space で
 * ダイアログの裏の手が進む。`useGameKeys` の `enabled` は window のキー
 * リスナーを外すだけで、フォーカスされたボタンの Enter / Space は止めない。
 * checkers / connect-four / gomoku / reversi / hearts / gin-rummy / ludo の
 * 7 本はすでに `inert={over || confirmNewGame}` の形で塞いでいたので、残る
 * 18 本(ConfirmDialog を持たない 5 本は対象外)を同じ形に揃える。
 *
 * 全ゲームに同じ変更を入れるときの作法(docs/ARCHITECTURE.md
 * 「シェルの枠とゲームの中身」): 対象行を厳密に特定し、期待と違う形は触らずに
 * SKIP / FAIL と報告する。ConfirmDialog が `.game-content` の内側にあるゲーム
 * があれば inert がダイアログ自身を殺すので FAIL にして書かない。適用後は触った
 * ファイルだけ prettier を通し、src/test/modalIsolationWiring.test.ts の
 * 横断ゲートで受ける。再実行しても全件 SKIP(already)になる。
 *
 *   node scripts/codemods/2026-09-05-inert-during-confirm-dialog.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');
const report = [];

for (const id of readdirSync(GAMES).sort()) {
  const file = join(GAMES, id, 'ui/screens/GameScreen.tsx');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    report.push(`${id}: SKIP no GameScreen.tsx`);
    continue;
  }
  const lines = src.split('\n');

  // The dialog and the flag that opens it. The flag is read from the JSX
  // rather than guessed from a name list, so a game that calls it something
  // else still converts — or is reported, never silently mis-converted.
  const dialogIdx = lines.findIndex((l) => l.trim().startsWith('<ConfirmDialog'));
  if (dialogIdx < 0) {
    report.push(`${id}: SKIP no ConfirmDialog`);
    continue;
  }
  let flag = null;
  for (let k = dialogIdx; k < Math.min(lines.length, dialogIdx + 12); k++) {
    const m = /^\s*open=\{(\w+)\}\s*$/.exec(lines[k]);
    if (m) {
      flag = m[1];
      break;
    }
  }
  if (!flag) {
    report.push(`${id}: FAIL ConfirmDialog open={…} is not a bare identifier`);
    continue;
  }

  const contentIdx = lines.findIndex((l) =>
    /^\s*<div className="game-content" inert=\{.+\}>$/.test(l),
  );
  if (contentIdx < 0) {
    report.push(`${id}: SKIP no <div className="game-content" inert={…}>`);
    continue;
  }
  const contentLine = lines[contentIdx];
  const indent = /^(\s*)/.exec(contentLine)[1];
  const expr = /inert=\{(.+)\}>$/.exec(contentLine)[1];

  // The dialog must be a sibling that follows the block, or inert would take
  // the dialog down with the board.
  const closeIdx = lines.findIndex((l, i) => i > contentIdx && l === `${indent}</div>`);
  if (closeIdx < 0 || dialogIdx < closeIdx) {
    report.push(`${id}: FAIL ConfirmDialog is not a sibling after .game-content`);
    continue;
  }

  if (new RegExp(`\\b${flag}\\b`).test(expr)) {
    report.push(`${id}: SKIP already (inert={${expr}})`);
    continue;
  }

  lines[contentIdx] = `${indent}<div className="game-content" inert={${expr} || ${flag}}>`;
  writeFileSync(file, lines.join('\n'));
  report.push(`${id}: ok inert={${expr} || ${flag}}`);
}

console.log(report.join('\n'));
