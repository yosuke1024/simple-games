/**
 * 2026-09-05: 「ゲームのホームに入って戻るだけで中断した盤の経過秒が 0 に
 * なる」不具合(2026-09-05-seed-play-clock-refs.mjs で修正)の回帰テストを、
 * セッションを持つ 21 本の Root テストに 1 本ずつ足す codemod。
 *
 * テストは報告された再現手順そのまま:9 秒遊ぶ → background → プロセス死 →
 * 再起動 → ゲーム自身のホームで止まる(Resume を押さない)→ background。
 * 盤の `elapsedSeconds` が 9 のままであることを見る。種付けを戻すと
 * `expected +0 to be 9` で落ちる。
 *
 * ゲームごとに違うのは「盤の始め方」「キー定数」「CPU が非同期に指すか」
 * 「fake timer がファイル全体か各テストか」の 4 点だけなので、下の表で持つ。
 * 既に launch / background / settle を持つファイルはそのまま使い、無い
 * ファイルにだけ足す。sudoku は手本として先に書いたので対象外、number-match は
 * Root ではなく Provider を直接描くテストなので別扱い(どちらも SKIP)。
 *
 * 再実行は no-op(全件 SKIP already has the test)。
 *
 *   node scripts/codemods/2026-09-05-suspended-clock-tests.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');

/** start: how a board begins. timers: 'file' when a beforeEach already fakes them. */
const GAMES = {
  2048: { file: 'Game2048Root', keys: 'TM', start: '/New Game/' },
  'block-puzzle': { file: 'BlockPuzzleRoot', keys: 'BP', start: '/New Game/' },
  checkers: { file: 'CheckersRoot', keys: 'CK', start: '/Easy/', cpu: true },
  'connect-four': { file: 'ConnectFourRoot', keys: 'C4', start: '/Easy/', cpu: true },
  freecell: { file: 'FreeCellRoot', keys: 'FC', start: '/New deal/' },
  'gin-rummy': { file: 'GinRummyRoot', keys: 'GR', start: '/Easy/', cpu: true },
  gomoku: { file: 'GomokuRoot', keys: 'GM', start: '/Easy/', cpu: true },
  hearts: { file: 'HeartsRoot', keys: 'HT', start: '/Easy/', cpu: true, timers: 'file' },
  ludo: { file: 'LudoRoot', keys: 'LD', start: '/Easy/', cpu: true, timers: 'file' },
  'mahjong-solitaire': { file: 'MahjongRoot', keys: 'MJ', start: '/Level 1/' },
  'memory-match': { file: 'MemoryMatchRoot', keys: 'MM', start: '/Easy/' },
  // Nothing is timed before the first tap (§4), so a square has to be opened.
  minesweeper: {
    file: 'MinesweeperRoot',
    keys: 'MS',
    start: '/^Easy/',
    after: '      fireEvent.click(cellAt(5, 5));',
  },
  nonogram: { file: 'NonogramRoot', keys: 'NG', start: '/Level 1/' },
  'quick-math': { file: 'QuickMathRoot', keys: 'QM', start: '/Level 1/' },
  reversi: { file: 'ReversiRoot', keys: 'RV', start: '/Easy/', cpu: true },
  'sliding-puzzle': { file: 'SlidingPuzzleRoot', keys: 'SP', start: '/Level 1/' },
  solitaire: { file: 'SolitaireRoot', keys: 'SO', start: '/New deal/' },
  'spider-solitaire': { file: 'SpiderRoot', keys: 'SS', start: '/New deal/' },
  'water-sort': { file: 'WaterSortRoot', keys: 'WS', start: '/Level 1/' },
};

const MARKER = "describe('opening a suspended game without resuming (#109)'";

const storedHelper = (keys) => `
/** The suspended board's own clock, as it survives on disk. */
function storedBoardSeconds(): number {
  const raw = deviceStore.get(${keys}_STORAGE_KEYS.game);
  if (raw === undefined) return 0;
  return (JSON.parse(raw) as { elapsedSeconds: number }).elapsedSeconds;
}
`;

const launchHelper = (root) => `
/** Launches the app against the device store, the way a player's phone does. */
function launch() {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <${root} onExit={vi.fn()} />
    </SettingsProvider>,
  );
}
`;

const settleHelper = `
/** Lets the local reads and the saves they trigger resolve (they are promises,
 * not timers, so this works under fake timers too). */
const settle = () => act(async () => undefined);
`;

const backgroundHelper = `
/** The app goes to background. Android may kill it without another event. */
function background() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  Reflect.deleteProperty(document, 'visibilityState');
}
`;

function testBlock({ keys, start, after, cpu, timers }) {
  const advance = (ms) =>
    cpu
      ? `      await act(async () => {\n        await vi.advanceTimersByTimeAsync(${ms});\n      });`
      : `      act(() => vi.advanceTimersByTime(${ms}));`;
  const body = [
    `    deviceStore.set(${keys}_STORAGE_KEYS.flags, tutorialDone[${keys}_STORAGE_KEYS.flags]!);`,
    ...(timers === 'file'
      ? []
      : [
          '    // The play clock is a plain interval, so it has to be faked before the game',
          '    // screen mounts — which rules out userEvent here (it waits on real timers).',
          '    vi.useFakeTimers();',
        ]),
    timers === 'file' ? null : '    try {',
    '      launch();',
    '      await settle();',
    `      fireEvent.click(screen.getByRole('button', { name: ${start} }));`,
    after ?? null,
    '',
    advance('9_000'),
    '      background();',
    '      await settle();',
    '      expect(storedBoardSeconds()).toBe(9);',
    '',
    "      // The process dies here. Relaunch and stop on the game's own home.",
    '      cleanup();',
    '      launch();',
    '      await settle();',
    "      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();",
    '',
    '      // Away again without ever resuming: the nine seconds are still there.',
    '      background();',
    '      await settle();',
    '      expect(storedBoardSeconds()).toBe(9);',
    timers === 'file' ? null : '    } finally {',
    timers === 'file' ? null : '      vi.useRealTimers();',
    timers === 'file' ? null : '    }',
  ]
    .filter((line) => line !== null)
    .map((line) => (timers === 'file' && line.startsWith('      ') ? line.slice(2) : line))
    .join('\n');

  return `
${MARKER}, () => {
  // The board is not the only thing a suspended game carries — the minutes on
  // its clock are the player's too. \`syncActiveGame\` runs on every background
  // from whichever screen is showing, and it writes this provider's play clock
  // into the session it saves. Open the game, never press Resume, background:
  // a clock that never took the restored board's seconds saves a zero over
  // them, and the board comes back looking untouched.
  it("keeps a suspended board's clock when backgrounded from the game's home", async () => {
${body}
  });
});
`;
}

const report = [];

for (const [id, config] of Object.entries(GAMES)) {
  const path = join(APP, 'src/games', id, 'ui', `${config.file}.test.tsx`);
  let src = readFileSync(path, 'utf8');

  if (src.includes(MARKER)) {
    report.push(`${id}: SKIP already has the test`);
    continue;
  }
  // Everything below leans on these three, so refuse rather than guess.
  for (const need of [`${config.keys}_STORAGE_KEYS`, 'const tutorialDone', 'deviceStore']) {
    if (!src.includes(need)) throw new Error(`${id}: no ${need}`);
  }

  // `act` drives both new helpers; the rest of the import is already there.
  const importRe = /^import \{ ([^}]+) \} from '@testing-library\/react';$/m;
  const names = importRe.exec(src);
  if (!names) throw new Error(`${id}: no testing-library import`);
  if (!/\bact\b/.test(names[1])) {
    const merged = [...names[1].split(',').map((s) => s.trim()), 'act'].sort();
    src = src.replace(importRe, `import { ${merged.join(', ')} } from '@testing-library/react';`);
  }

  // Helpers go in front of the fixtures that the test reads, which every one
  // of these files declares as `const tutorialDone`.
  const anchor = '\nconst tutorialDone = {';
  let helpers = '';
  if (!src.includes('\nfunction launch()')) helpers += launchHelper(config.file);
  if (!src.includes('\nconst settle =')) helpers += settleHelper;
  if (!src.includes('\nfunction background()')) helpers += backgroundHelper;
  helpers += storedHelper(config.keys);
  src = src.replace(anchor, `\n${helpers.trimStart()}${anchor}`);

  src = `${src.trimEnd()}\n${testBlock(config)}`;
  writeFileSync(path, src);
  report.push(`${id}: ok`);
}

console.log(report.join('\n'));
