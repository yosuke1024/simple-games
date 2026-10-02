/**
 * 2026-10-02: ヘッダの ↻ が出す確認を、結果カードと同じ 2 択にする codemod
 * (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」「ヘッダの ↻ は結果カードと
 * 同じ 2 択」)。
 *
 * ↻ は「同じ盤面で再挑戦」の確認(`<ConfirmDialog title={t('tryAgain')} …>`)
 * だったので、プレイ中に盤面そのものを替えたい人は Home → モードのボタン →
 * もう一度確認、と遠回りしていた。`<RestartDialog>` に置き換え、結果カードが
 * 第二のボタンとして既に出している「新しい盤面 / 新しい配札 / 新しいゲーム」を、
 * 同じラベル・同じ条件・同じ動作でヘッダの確認にも並べる。デイリーとレベルは
 * 結果カードと同じく第二の選択肢を持たない(表に無いゲームは再挑戦だけの 2 択)。
 *
 * ゲームごとに触る場所は `ui/screens/GameScreen.tsx` の 2 か所:
 *
 *   import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
 *     → import { RestartDialog } from '@/ui/components/RestartDialog';
 *   <ConfirmDialog open={FLAG} title={t('tryAgain')} body={t(BODY)} … onConfirm={() => { SET(false); RESTART(); }} />
 *     → <RestartDialog open={FLAG} onClose={() => SET(false)} onRetry={RESTART} newBoard={…} />
 *       (BODY が共有の confirmNewGameBody 以外 — ドリル 2 本 — なら `body={t(BODY)}` を残す)
 *
 * 難易度モードの 7 本(Minesweeper / Crown Grid / Number Path / Shape Regions /
 * Binary Balance / Box Regions / Sudoku 6×6)は `state/GameContext.tsx` にも 1 つ足す。
 * 結果カードが使う `startDifficulty` は **同じ難易度で進行中の盤面があれば再開する**
 * (ホームの入口の都合。結果カードの時点では盤面は終わっているので新しくなる)ので、
 * プレイ中の ↻ から呼ぶと何も起きない。進行中でも必ず新しい seed を引く
 * `startNewBoard(difficulty)` を足し、↻ の第二の選択肢はそれを呼ぶ:
 *
 *   startDifficulty: (difficulty: Difficulty) => void;   → 直後に startNewBoard の宣言
 *   const startDifficulty = useCallback(…);              → 直後に startNewBoard の実装
 *   startDifficulty,(value と deps の 2 行)              → 直後に startNewBoard,
 *   GameScreen の分割代入の startDifficulty,              → 直後に startNewBoard,
 *
 * 期待する骨格(12 行の ConfirmDialog、上の 4 つの行)と一致しない箇所は FAIL と
 * 報告してそのゲームには何も書かない。ConfirmDialog を他にも使っているゲームは import を
 * 残す。変換済みのゲームは SKIP になり、再実行は no-op。
 * 適用後は触ったファイルだけ prettier を通し、`src/test/restartDialogWiring.test.ts`
 * と `src/test/modalIsolationWiring.test.ts` の横断ゲートで受ける。
 *
 *   node scripts/codemods/2026-10-02-restart-dialog-new-board.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');

/**
 * The second option, per game — copied from the game's own result-card
 * wiring (`onNewBoard` / `onNewDeal` / `onNewFree` in the same GameScreen), so
 * the header offers exactly what the card offers. Games not listed keep the
 * retry alone: their other board is a level picked from the home, or a daily.
 */
const DIFFICULTY = (label) => ({
  when: "session.mode === 'difficulty'",
  label: `t('${label}')`,
  // Not `startDifficulty`: that resumes a board in progress (see the header).
  start: '() => startNewBoard(session.difficulty)',
  context: true,
});
const DEAL = (label) => ({
  when: "session.mode === 'free'",
  label: `t('${label}')`,
  start: 'startFree',
});
const FREE = (start) => ({
  when: "session.mode === 'free'",
  label: "t('newGame')",
  start,
});

const NEW_BOARD = {
  minesweeper: DIFFICULTY('minesNewBoard'),
  'crown-grid': DIFFICULTY('crownGridNewBoard'),
  'number-path': DIFFICULTY('numberPathNewBoard'),
  'shape-regions': DIFFICULTY('shapeRegionsNewBoard'),
  'binary-balance': DIFFICULTY('binaryBalanceNewBoard'),
  'box-regions': DIFFICULTY('boxRegionsNewBoard'),
  'sudoku-6x6': DIFFICULTY('sudoku6x6NewBoard'),
  solitaire: DEAL('solNewDeal'),
  freecell: DEAL('fcNewDeal'),
  'spider-solitaire': DEAL('spiderNewDeal'),
  sudoku: FREE('() => startFree(session.difficulty)'),
  kakuro: FREE('() => startFree(session.freeTier)'),
  futoshiki: FREE('() => startFree(session.freeTier ?? freeTier)'),
  takuzu: FREE('() => startFree(freeTierForSize(session.size))'),
  nonogram: FREE('() => startFree(session.freeTier)'),
  'number-match': FREE('() => startFree(session.freeTier ?? undefined)'),
  'water-sort': FREE('() => startFree(session.freeTier ?? freeTier)'),
};

const OLD_IMPORT = "import { ConfirmDialog } from '@/ui/components/ConfirmDialog';";
const NEW_IMPORT = "import { RestartDialog } from '@/ui/components/RestartDialog';";

const report = [];
const touched = [];

/**
 * The difficulty games' GameContext: `startNewBoard`, a fresh board at a
 * difficulty whatever the state of the board in that slot. Idempotent.
 */
function addStartNewBoard(id) {
  const file = join(GAMES, id, 'state/GameContext.tsx');
  const src = readFileSync(file, 'utf8');
  if (src.includes('startNewBoard')) return `${id}: SKIP GameContext already has startNewBoard`;
  const lines = src.split('\n');

  const decl = lines.indexOf('  startDifficulty: (difficulty: Difficulty) => void;');
  const impl = lines.indexOf('  const startDifficulty = useCallback(');
  const implEnd = impl < 0 ? -1 : lines.findIndex((l, i) => i > impl && l === '  );');
  const uses = lines.map((l, i) => (l === '      startDifficulty,' ? i : -1)).filter((i) => i >= 0);
  if (decl < 0 || impl < 0 || implEnd < 0 || uses.length !== 2) {
    return `${id}: FAIL GameContext does not have the expected startDifficulty lines (decl ${decl}, impl ${impl}..${implEnd}, uses ${uses.length})`;
  }

  // Bottom-up so earlier indices stay valid.
  for (const i of [...uses].reverse()) lines.splice(i + 1, 0, '      startNewBoard,');
  lines.splice(
    implEnd + 1,
    0,
    '',
    '  /**',
    '   * A fresh board at this difficulty even while one is in progress — the',
    '   * second answer of the ↻ dialog (ui/components/RestartDialog.tsx).',
    '   * `startDifficulty` above resumes a board in progress, which is right for',
    '   * the home; here replacing it is the point.',
    '   */',
    '  const startNewBoard = useCallback(',
    '    (difficulty: Difficulty) => {',
    '      beginSession(createDifficultySession(difficulty));',
    '    },',
    '    [beginSession],',
    '  );',
  );
  lines.splice(decl + 1, 0, '  startNewBoard: (difficulty: Difficulty) => void;');

  writeFileSync(file, lines.join('\n'));
  touched.push(file);
  return `${id}: ok GameContext startNewBoard`;
}

/** The GameScreen pulls `startNewBoard` out of the context beside `startDifficulty`. */
function destructureStartNewBoard(id, lines) {
  if (lines.some((l) => /^\s+startNewBoard,$/.test(l))) return true;
  const i = lines.findIndex((l) => /^\s+startDifficulty,$/.test(l));
  if (i < 0) return false;
  lines.splice(i + 1, 0, lines[i].replace('startDifficulty', 'startNewBoard'));
  return true;
}

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

  if (NEW_BOARD[id]?.context) report.push(addStartNewBoard(id));

  const start = lines.findIndex((l) => l.trim() === '<ConfirmDialog');
  if (start < 0) {
    // Already converted. A screen converted by an earlier run of this script
    // still pointed the second answer at `startDifficulty`; repair that here
    // so one run from any starting point lands on the same code.
    const stale = lines.findIndex((l) =>
      l.includes('start: () => startDifficulty(session.difficulty)'),
    );
    if (stale >= 0 && NEW_BOARD[id]?.context) {
      lines[stale] = lines[stale].replace('startDifficulty(', 'startNewBoard(');
      if (!destructureStartNewBoard(id, lines)) {
        report.push(`${id}: FAIL GameScreen does not destructure startDifficulty on its own line`);
        continue;
      }
      writeFileSync(file, lines.join('\n'));
      touched.push(file);
      report.push(`${id}: ok GameScreen second answer now startNewBoard`);
      continue;
    }
    report.push(`${id}: SKIP no ConfirmDialog`);
    continue;
  }
  if (lines[start + 2]?.trim() !== "title={t('tryAgain')}") {
    // The board games' "New Game" confirmation (confirmNewGameTitle): there is
    // no same board to retry, so there is nothing for this codemod to offer.
    report.push(`${id}: SKIP ConfirmDialog is not the tryAgain confirmation`);
    continue;
  }
  const indent = /^(\s*)/.exec(lines[start])[1];
  const block = lines.slice(start, start + 12);
  const expected = [
    /^<ConfirmDialog$/,
    /^open=\{(\w+)\}$/,
    /^title=\{t\('tryAgain'\)\}$/,
    /^body=\{t\('(\w+)'\)\}$/,
    /^cancelLabel=\{t\('cancel'\)\}$/,
    /^confirmLabel=\{t\('confirm'\)\}$/,
    /^onCancel=\{\(\) => (\w+)\(false\)\}$/,
    /^onConfirm=\{\(\) => \{$/,
    /^(\w+)\(false\);$/,
    /^(\w+)\(\);$/,
    /^\}\}$/,
    /^\/>$/,
  ];
  const captures = [];
  let ok = block.length === expected.length;
  for (let k = 0; ok && k < expected.length; k++) {
    const m = expected[k].exec(block[k].trim());
    if (!m) ok = false;
    else captures.push(m);
  }
  if (!ok) {
    report.push(`${id}: FAIL ConfirmDialog is not the 12-line tryAgain confirmation`);
    continue;
  }
  const flag = captures[1][1];
  // The drills say what starting over costs in their own words
  // (`qmathConfirmRestartBody`); every other game uses the shared sentence,
  // which is the dialog's default.
  const bodyKey = captures[3][1];
  const setter = captures[6][1];
  const restart = captures[9][1];
  if (captures[8][1] !== setter) {
    report.push(`${id}: FAIL onConfirm clears ${captures[8][1]}, onCancel clears ${setter}`);
    continue;
  }

  const newBoard = NEW_BOARD[id];
  const replacement = [
    `${indent}<RestartDialog`,
    `${indent}  open={${flag}}`,
    `${indent}  onClose={() => ${setter}(false)}`,
    `${indent}  onRetry={${restart}}`,
    ...(bodyKey === 'confirmNewGameBody' ? [] : [`${indent}  body={t('${bodyKey}')}`]),
    ...(newBoard
      ? [
          `${indent}  newBoard={`,
          `${indent}    ${newBoard.when}`,
          `${indent}      ? { label: ${newBoard.label}, start: ${newBoard.start} }`,
          `${indent}      : undefined`,
          `${indent}  }`,
        ]
      : []),
    `${indent}/>`,
  ];
  lines.splice(start, 12, ...replacement);
  if (newBoard?.context && !destructureStartNewBoard(id, lines)) {
    report.push(`${id}: FAIL GameScreen does not destructure startDifficulty on its own line`);
    continue;
  }

  let out = lines.join('\n');
  const importIdx = lines.indexOf(OLD_IMPORT);
  if (importIdx < 0) {
    report.push(`${id}: FAIL ConfirmDialog import not found in the expected form`);
    continue;
  }
  const stillUsesConfirm = out.includes('<ConfirmDialog');
  lines[importIdx] = stillUsesConfirm ? `${OLD_IMPORT}\n${NEW_IMPORT}` : NEW_IMPORT;
  out = lines.join('\n');

  writeFileSync(file, out);
  touched.push(file);
  report.push(
    `${id}: ok ${newBoard ? `retry + new board (${newBoard.when})` : 'retry only'}` +
      (bodyKey === 'confirmNewGameBody' ? '' : ` (body ${bodyKey})`) +
      (stillUsesConfirm ? ' (ConfirmDialog kept for another dialog)' : ''),
  );
}

console.log(report.join('\n'));
if (touched.length > 0) {
  console.log(`\nprettier --write ${touched.map((f) => f.replace(`${APP}/`, '')).join(' ')}`);
}
