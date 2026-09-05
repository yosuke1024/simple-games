/**
 * 2026-09-06: 初回起動時の Quick Rules(チュートリアル)を Android の Back で
 * 抜けたとき `completeTutorial()` を呼ばないまま帰ってしまう不具合を直す
 * codemod(issue #142「Zero Friction」)。
 *
 * 初期画面は `initialFlags.tutorialCompleted ? 'home' : 'tutorial'` で決まり、
 * `tutorialCompleted` が false の間 TutorialScreen は閉じるボタンを出さない。
 * `state/GameContext.tsx` の Back ハンドラは `screen === 'home'` でなければ
 * `syncActiveGame(); setScreen('home');`(または `goHome();`)でホームへ戻すだけで、
 * チュートリアル画面から Back で抜けた場合も同じ扱いになる ——
 * `completeTutorial()` を呼ばないので、次回そのゲームを開くたびにまた
 * チュートリアルから始まる。`docs/PRODUCT_PRINCIPLES.md`「初回体験の原則」は
 * 説明が 3 ステップ以内でゲームへ直結することだけを求めており、毎回表示しろとは
 * 言っていない。直し方は「Back でチュートリアルを抜けるのは見たものとして扱う」
 * ——else 分岐が `screen === 'tutorial'` のときだけ `completeTutorial()` を呼ぶ。
 *
 * 全 30 本が同じ形(`useEffect` → `if (!Capacitor.isNativePlatform()) return;`
 * → `addListener('backButton', ...)` → `if (screen === 'home') {...} else {...}`)
 * を持つので、docs/ARCHITECTURE.md「シェルの枠とゲームの中身」の作法どおり
 * codemod で揃える。else 分岐の中身は 2 種類:
 *   - Shape A(24 本): `syncActiveGame(); setScreen('home');`
 *   - Shape B(6 本。brick-breaker / bubble-pop / bunny-hop / number-recall /
 *     schulte-table / sky-fighter): `goHome();`
 * どちらでも deps 配列の末尾トークン(`syncActiveGame` / `goHome`)以外は共通。
 * `completeTutorial` は `useCallback(..., [])` で安定しているので deps に足しても
 * リスナーの再登録は起きないが、`react-hooks/exhaustive-deps` を通すために
 * 追加は必須。`completeTutorial` の宣言がこの effect より後にある場合は
 * TDZ になるため FAIL にして書かない。
 *
 * 対象行を一字一句突き合わせ、外れた形は SKIP / FAIL として報告するだけで
 * 書き換えない。再実行しても全件 SKIP(already)になる。
 * 受け皿は src/test/tutorialBackWiring.test.tsx(30 本の Root を実際に描いて Back を
 * 押す挙動テスト。配線の形は src/test/gameBackButtonWiring.test.ts が見る)。
 *
 *   node scripts/codemods/2026-09-06-tutorial-back-completes.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');

const BACK_HANDLE_LINE = "    const backHandle = CapacitorApp.addListener('backButton', () => {";

// The fixed prefix of the effect block, ending right at `} else {`.
// `HOME_PREFIX[2]` is `BACK_HANDLE_LINE` itself, kept as one literal array so
// the whole shape is compared in one go rather than field by field.
const HOME_PREFIX = [
  '  useEffect(() => {',
  '    if (!Capacitor.isNativePlatform()) return;',
  BACK_HANDLE_LINE,
  "      if (screen === 'home') {",
  '        exitToCollection();',
  '      } else {',
];

const LEAVE_A = ['        syncActiveGame();', "        setScreen('home');"];
const LEAVE_B = ['        goHome();'];

const TAIL = [
  '      }',
  '    });',
  '    return () => {',
  '      void backHandle.then((handle) => handle.remove()).catch(() => undefined);',
  '    };',
];

const INSERTED = [
  '        // Leaving Quick Rules by Back counts as having seen them (issue #142):',
  '        // otherwise this game opens on the tutorial on every launch.',
  "        if (screen === 'tutorial') completeTutorial();",
];

const DEPS_A_OLD = '  }, [screen, exitToCollection, syncActiveGame]);';
const DEPS_B_OLD = '  }, [screen, exitToCollection, goHome]);';
const DEPS_A_NEW = '  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);';
const DEPS_B_NEW = '  }, [screen, exitToCollection, goHome, completeTutorial]);';

const COMPLETE_TUTORIAL_DECL = '  const completeTutorial = useCallback(() => {';

const sameSlice = (lines, start, expected) =>
  expected.every((line, i) => lines[start + i] === line);

const report = [];
let failed = false;

for (const id of readdirSync(GAMES).sort()) {
  const file = join(GAMES, id, 'state/GameContext.tsx');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    report.push(`${id}: SKIP no GameContext`);
    continue;
  }

  const occurrences = (src.match(/addListener\('backButton'/g) ?? []).length;
  if (occurrences !== 1) {
    report.push(`${id}: FAIL expected exactly one addListener('backButton', got ${occurrences}`);
    failed = true;
    continue;
  }

  const lines = src.split('\n');
  const backIdx = lines.indexOf(BACK_HANDLE_LINE);
  if (backIdx < 0) {
    report.push(`${id}: FAIL backButton listener line does not match the expected shape`);
    failed = true;
    continue;
  }

  const startIdx = backIdx - 2;
  if (startIdx < 0 || !sameSlice(lines, startIdx, HOME_PREFIX)) {
    report.push(`${id}: FAIL effect prefix does not match the expected skeleton`);
    failed = true;
    continue;
  }

  const ctIdx = lines.indexOf(COMPLETE_TUTORIAL_DECL);
  if (ctIdx < 0) {
    report.push(`${id}: FAIL no "${COMPLETE_TUTORIAL_DECL}" declaration found`);
    failed = true;
    continue;
  }
  if (ctIdx >= startIdx) {
    report.push(`${id}: FAIL completeTutorial is declared after the effect (would be a TDZ)`);
    failed = true;
    continue;
  }

  const bodyIdx = startIdx + HOME_PREFIX.length;

  // Already converted? Recognise it by the inserted comment/if, then confirm
  // the rest still matches one of the two shapes exactly (including the deps
  // line), so a hand-edited variant is reported rather than silently kept.
  if (sameSlice(lines, bodyIdx, INSERTED)) {
    const afterInsertedIdx = bodyIdx + INSERTED.length;
    const shapes = [
      { leave: LEAVE_A, depsOld: DEPS_A_NEW, label: 'A' },
      { leave: LEAVE_B, depsOld: DEPS_B_NEW, label: 'B' },
    ];
    let matched = null;
    for (const shape of shapes) {
      if (!sameSlice(lines, afterInsertedIdx, shape.leave)) continue;
      const tailIdx = afterInsertedIdx + shape.leave.length;
      if (!sameSlice(lines, tailIdx, TAIL)) continue;
      const depsIdx = tailIdx + TAIL.length;
      if (lines[depsIdx] !== shape.depsOld) continue;
      matched = shape;
      break;
    }
    if (!matched) {
      report.push(`${id}: FAIL already has the completeTutorial marker but the rest deviates`);
      failed = true;
      continue;
    }
    report.push(`${id}: SKIP already (shape ${matched.label})`);
    continue;
  }

  const shapes = [
    { leave: LEAVE_A, depsOld: DEPS_A_OLD, depsNew: DEPS_A_NEW, label: 'A' },
    { leave: LEAVE_B, depsOld: DEPS_B_OLD, depsNew: DEPS_B_NEW, label: 'B' },
  ];

  let converted = false;
  for (const shape of shapes) {
    if (!sameSlice(lines, bodyIdx, shape.leave)) continue;
    const tailIdx = bodyIdx + shape.leave.length;
    if (!sameSlice(lines, tailIdx, TAIL)) continue;
    const depsIdx = tailIdx + TAIL.length;
    if (lines[depsIdx] !== shape.depsOld) continue;

    const newLines = [
      ...lines.slice(0, bodyIdx),
      ...INSERTED,
      ...lines.slice(bodyIdx, depsIdx),
      shape.depsNew,
      ...lines.slice(depsIdx + 1),
    ];
    writeFileSync(file, newLines.join('\n'));
    report.push(`${id}: ok shape ${shape.label}`);
    converted = true;
    break;
  }

  if (!converted) {
    report.push(`${id}: FAIL else body/tail/deps do not match shape A or shape B`);
    failed = true;
  }
}

console.log(report.join('\n'));
if (failed) process.exitCode = 1;
