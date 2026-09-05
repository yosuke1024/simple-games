/**
 * 2026-09-05: #109(ホームに戻るだけで中断盤の時計が消える)と #113(ショート
 * カットから中断中のゲームへ直接戻る)の合流。24 本の provider を **1 つの形**に
 * 揃える codemod。
 *
 * 두 変更は同じ不変条件に行き着く: **時計の種は「このマウントが指しているスロット」
 * から読む**。#113 はショートカット経路だけを種付けし(`resumedSeconds` は
 * コレクションから開いたときは 0)、#109 はホーム経路だけを種付けしていた
 * (`INITIAL_MODE` 固定でショートカット再開のスロットを見ない)。どちらも
 * 片側だけでは穴が残る:
 *
 * - main のまま → コレクションから開いてホームに居るまま background で 0 上書き
 * - #136 のまま → 日次/フリーだけ中断中のときショートカット再開の種が空スロット
 *
 * 合流後は `mountedMode = resumeMode ?? INITIAL_MODE` を 1 度だけ名前にして、
 * `activeMode` の初期値と時計の種の**両方**がそれを読む。スロットが 1 つの
 * ゲームは `initialSession` がそのままマウント中のセッションなので、扉に関係なく
 * そこから読む。
 *
 * main 側は同じ概念に 3 つの名前(`mountedMode` / `initialMode` /
 * `restoredSeconds` のインライン式)を持っていたので、ここで 1 つに正規化する。
 * 期待と違う形は触らず SKIP と報告。再実行は no-op。
 *
 *   node scripts/codemods/2026-09-05-merge-mounted-slot-clock.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');

const MOUNTED_MODE = [
  '  /**',
  '   * The slot this mount is pointed at: the one a shortcut opened straight',
  '   * onto (issue #113), or the one the home screen starts on. Named once and',
  '   * read by both the active mode and the clock seed below, because a mode',
  '   * taken from one slot and a clock taken from another is the whole trap.',
  '   */',
  '  const mountedMode = resumeMode ?? INITIAL_MODE;',
].join('\n');

const INITIAL_MODE_DOC = [
  '/**',
  ' * The mode a freshly mounted game is pointed at when nothing is resumed.',
  ' * Named because the play-clock baseline has to be read from the same slot.',
  ' */',
].join('\n');

/** The seed and the two refs that read it — the same wording in all 24. */
function seedBlock({ multi, noun, booked }) {
  const expr = multi
    ? 'initialSessions[mountedMode]?.elapsedSeconds ?? 0'
    : 'initialSession?.elapsedSeconds ?? 0';
  const why = multi
    ? [
        '   * The seconds the game on that slot already carries. Read from the slot',
        '   * itself rather than gated on the resume: a launch that stops on the',
        "   * game's own home reaches `syncActiveGame` too, and from a zero baseline",
        '   * that saves `elapsedSeconds: 0` over the suspended board (issue #109).',
      ]
    : [
        '   * The seconds the game this mount holds already carries. There is one',
        '   * slot, so it is the same session whichever door the launch came through',
        '   * — which is why this is not gated on the resume: a launch that stops on',
        "   * the game's own home reaches `syncActiveGame` too, and from a zero",
        '   * baseline that saves `elapsedSeconds: 0` over the suspended board',
        '   * (issue #109).',
      ];
  const lines = [
    '  /**',
    ...why,
    '   */',
    `  const mountedSeconds = ${expr};`,
    '  /**',
    '   * The live play clock (seconds). Mutated by the interval, never state.',
    '   *',
    '   * Starts on the mounted game rather than at zero, because every save merges',
    '   * this ref into the session and `syncActiveGame` runs on any background,',
    '   * not only from the game screen. `activate` re-establishes the baseline',
    '   * whenever a game comes on screen; this line covers the mount before that.',
    '   */',
    '  const elapsedRef = useRef(mountedSeconds);',
  ];
  if (booked) {
    lines.push(
      '  /**',
      `   * Play seconds already booked into the statistics for this ${noun}.`,
      '   *',
      '   * The same baseline, and it has to be: a suspended game arrives with its',
      '   * seconds already in `totalPlaySeconds` — they were booked by the sync',
      '   * that saved it. Seeding the clock alone would book its whole elapsed',
      '   * time a second time. The two are one invariant; neither moves without',
      '   * the other.',
      '   */',
      '  const bookedRef = useRef(mountedSeconds);',
    );
  }
  return lines.join('\n');
}

const isDoc = (line) => /^\s*(\/\*\*|\*|\*\/|\/\/)/.test(line);

const report = [];

for (const id of readdirSync(GAMES).sort()) {
  const file = join(GAMES, id, 'state/GameContext.tsx');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const multi = /^ {2}initialSessions: SavedGames;$/m.test(src);
  const single = /^ {2}initialSession: \w+ \| null;$/m.test(src);
  if (!multi && !single) {
    report.push(`${id}: SKIP keeps no saved session`);
    continue;
  }
  if (src.includes('const mountedSeconds =')) {
    report.push(`${id}: SKIP already merged`);
    continue;
  }

  const before = src;

  // main carried three names for these two ideas (`mountedMode` / `initialMode`,
  // `resumedSeconds` / `restoredSeconds`). Canonicalise first — in prose too, so
  // the comments that explain the invariant do not name a variable that is gone.
  src = src.replace(/\binitialMode\b/g, 'mountedMode');
  src = src.replace(/\b(?:resumedSeconds|restoredSeconds)\b/g, 'mountedSeconds');

  if (multi) {
    // 1. The literal the mount falls back to has to be a module-scope name.
    const activeRe = /^( {2}const \[activeMode, setActiveMode\] = useState<GameMode>\()(.+?)(\);)$/m;
    const active = activeRe.exec(src);
    if (!active) {
      report.push(`${id}: SKIP no activeMode useState`);
      continue;
    }
    if (!/^const INITIAL_MODE: GameMode = '[a-z]+';$/m.test(src)) {
      const literal = /^resumeMode \?\? ('[a-z]+')$/.exec(active[2]);
      if (!literal) {
        report.push(`${id}: SKIP cannot name activeMode fallback ${active[2]}`);
        continue;
      }
      const providerRe = /^export function \w+\(/m;
      src = src.replace(
        providerRe,
        (m) => `${INITIAL_MODE_DOC}\nconst INITIAL_MODE: GameMode = ${literal[1]};\n\n${m}`,
      );
    }

    // 2. One name for the mounted slot. main had three (mountedMode /
    //    initialMode / an inline expression) — replace or insert.
    const namedRe =
      /(?: {2}\/\*\*\n(?: {3}\*.*\n)* {3}\*\/\n)? {2}const (?:mountedMode|initialMode) = resumeMode \?\? INITIAL_MODE;/;
    if (namedRe.test(src)) {
      src = src.replace(namedRe, MOUNTED_MODE);
    } else {
      const resumeBlockRe = /( {2}const \[resumeMode\] = useState<GameMode \| null>\([\s\S]*?\n {2}\);\n)/;
      if (!resumeBlockRe.test(src)) {
        report.push(`${id}: SKIP no resumeMode block to anchor on`);
        continue;
      }
      src = src.replace(resumeBlockRe, `$1${MOUNTED_MODE}\n`);
    }
    src = src.replace(activeRe, `$1mountedMode$3`);
    // The old name must not survive anywhere else.
    src = src.replace(/\binitialSessions\[initialMode\]/g, 'initialSessions[mountedMode]');
  }

  // 3. The seed span: from the doc block above the seed (or above elapsedRef
  //    when the seed was inline) through the last ref that reads it.
  const lines = src.split('\n');
  const elapsedAt = lines.findIndex((l) => /^ {2}const elapsedRef = useRef\(/.test(l));
  if (elapsedAt < 0) {
    report.push(`${id}: SKIP no elapsedRef`);
    continue;
  }
  const bookedAt = lines.findIndex(
    (l, i) => i > elapsedAt && /^ {2}const bookedRef = useRef\(/.test(l),
  );
  // Contiguous means doc lines only — a blank line or real code in between
  // would mean that ref belongs to something else.
  const booked =
    bookedAt > elapsedAt &&
    lines.slice(elapsedAt + 1, bookedAt).every((l) => isDoc(l));
  let end = booked ? bookedAt : elapsedAt;

  let start = elapsedAt;
  while (start > 0 && isDoc(lines[start - 1])) start--;
  // A seed const directly above (with its own doc block) belongs to the span.
  const seedRe = /^ {2}const mountedSeconds = /;
  let k = start - 1;
  while (k > 0 && lines[k].trim() === '') k--;
  if (seedRe.test(lines[k] ?? '')) {
    start = k;
    while (start > 0 && isDoc(lines[start - 1])) start--;
  }

  const span = lines.slice(start, end + 1).join('\n');
  if (!/const elapsedRef = useRef\(/.test(span) || (booked && !/const bookedRef/.test(span))) {
    report.push(`${id}: FAIL span missed a ref`);
    continue;
  }
  const nounMatch = /booked into the statistics for this (\w+)\./.exec(span);
  const noun = nounMatch ? nounMatch[1] : 'session';

  lines.splice(start, end - start + 1, seedBlock({ multi, noun, booked }));
  src = lines.join('\n');

  // 4. Exactly one baseline, and it may not be gated on the resume — a gate is
  //    what left the collection-launch path seeding from zero (issue #109).
  const seeds = (src.match(/^ {2}const mountedSeconds = /gm) ?? []).length;
  const gated = /const mountedSeconds = resumeMode \?/.test(src);
  const refs = (src.match(/useRef\(mountedSeconds\)/g) ?? []).length;
  if (seeds !== 1 || gated || refs !== (booked ? 2 : 1) || src === before) {
    report.push(`${id}: FAIL seeds=${seeds} gated=${gated} refs=${refs}`);
    continue;
  }

  writeFileSync(file, src);
  report.push(`${id}: ok (${multi ? 'multi' : 'single'}${booked ? '' : ', no bookedRef'})`);
}

console.log(report.join('\n'));
