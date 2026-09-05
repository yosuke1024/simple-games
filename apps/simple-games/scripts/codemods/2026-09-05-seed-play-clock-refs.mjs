/**
 * 2026-09-05: 中断した盤の経過秒が「ゲームのホームに入って戻るだけ」で 0 に
 * 潰れる不具合を、24 本のセッション保持ゲームで直す codemod。
 *
 * `syncActiveGame` はどの画面が出ていても visibilitychange / pause で走り、
 * `withElapsed` が `elapsedSeconds: elapsedRef.current` を書き込む。`elapsedRef`
 * は `activate`(= Resume)でしか種を貰わないので、ホームから戻っただけの
 * マウントでは 0 のまま — 中断した盤の時計だけが消える。`bookedRef` を同じ値で
 * 種付けするのは対になる不変条件で、片方だけ直すと今度は再生時間が二重計上に
 * なる(futoshiki / kakuro / takuzu が先に持っていた形をそのまま広げる)。
 *
 * 形は 2 つ:単一セッション(`initialSession`)と複数スロット(`initialSessions`)。
 * 後者は「マウント直後に指しているスロット」から読む必要があるので、
 * `INITIAL_MODE` を名前として起こしてから参照する。セッションを持たない
 * アーケード 4 本と number-recall / schulte-table(盤を保存しない)は SKIP。
 *
 * 再実行は no-op(全件 SKIP already seeded)。
 *
 *   node scripts/codemods/2026-09-05-seed-play-clock-refs.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');

const CLOCK_DOC = '  /** The live play clock (seconds). Mutated by the interval, never state. */';

const clockDoc = () =>
  [
    '  /**',
    '   * The live play clock (seconds). Mutated by the interval, never state.',
    '   *',
    '   * Seeded from the restored game rather than from zero, because every save',
    '   * merges this ref into the session and `syncActiveGame` runs on any',
    '   * background, not only from the game screen. Open the game, stay on its own',
    '   * home without pressing Resume, then background the app: from a zero',
    '   * baseline that writes `elapsedSeconds: 0` over a suspended board, and the',
    '   * minutes already on its clock are gone. `activate` re-establishes the',
    '   * baseline whenever a game comes on screen; this line covers the mount',
    '   * before that.',
    '   */',
  ].join('\n');

const bookedDoc = (noun) =>
  [
    '  /**',
    `   * Play seconds already booked into the statistics for this ${noun}.`,
    '   *',
    '   * Seeded from the restored game rather than from zero, because a suspended',
    '   * game arrives with its seconds already in `totalPlaySeconds` — they were',
    '   * booked by the sync that saved it. `activate` re-establishes this baseline',
    '   * whenever a game comes on screen, but the mount before that is reachable:',
    '   * opening the game and leaving from its home without resuming runs',
    '   * `syncActiveGame` against the restored session, and from a zero baseline',
    '   * that books its whole elapsed time a second time. Open and leave twice and',
    '   * it lands twice. The comment on the visibility effect below already states',
    '   * this invariant — this is the line that makes it true.',
    '   */',
  ].join('\n');

const INITIAL_MODE_DOC = [
  '/**',
  ' * The mode a freshly mounted game is pointed at, before anything is resumed.',
  ' * Named because the play-clock baseline has to be read from the same slot.',
  ' */',
].join('\n');

const report = [];

for (const id of readdirSync(GAMES).sort()) {
  const file = join(GAMES, id, 'state/GameContext.tsx');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    report.push(`${id}: SKIP no GameContext`);
    continue;
  }

  // Which shape is this provider? Anything that does not restore a session on
  // mount has no clock to lose, and is left alone.
  const multi = /^ {2}initialSessions: SavedGames;$/m.test(src);
  const single = /^ {2}initialSession: \w+ \| null;$/m.test(src);
  if (!multi && !single) {
    report.push(`${id}: SKIP keeps no saved session`);
    continue;
  }

  let seed;
  const before = src;

  if (multi) {
    // The slot the provider mounts on has to be a name, so both the state and
    // the clock baseline read the same one.
    const stateRe = /^( {2}const \[activeMode, setActiveMode\] = useState<GameMode>\()(.+?)(\);)$/m;
    const state = stateRe.exec(src);
    if (!state) {
      report.push(`${id}: SKIP no activeMode useState`);
      continue;
    }
    const init = state[2];
    if (init !== 'INITIAL_MODE') {
      const literal = /^'([a-z]+)'$/.exec(init);
      if (!literal) {
        report.push(`${id}: SKIP activeMode initialiser ${init}`);
        continue;
      }
      const providerRe = /^export function \w+\(/m;
      if (!providerRe.test(src)) {
        report.push(`${id}: SKIP no provider function`);
        continue;
      }
      src = src.replace(stateRe, `$1INITIAL_MODE$3`);
      src = src.replace(
        providerRe,
        (m) => `${INITIAL_MODE_DOC}\nconst INITIAL_MODE: GameMode = '${literal[1]}';\n\n${m}`,
      );
    }
    seed = 'initialSessions[INITIAL_MODE]?.elapsedSeconds ?? 0';
  } else {
    seed = 'initialSession?.elapsedSeconds ?? 0';
  }

  // The play clock itself: the ref the board's elapsedSeconds is written from.
  // `no-regex-spaces`: the block's indentation is a run of spaces, so it is
  // written as a count rather than left for a reader to measure.
  const literal = CLOCK_DOC.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ {2}/g, ' {2}');
  const elapsedRe = new RegExp(`^${literal}\\n {2}const elapsedRef = useRef\\(.+?\\);$`, 'm');
  if (elapsedRe.test(src)) {
    src = src.replace(elapsedRe, `${clockDoc()}\n  const elapsedRef = useRef(${seed});`);
  } else if (!src.includes(`const elapsedRef = useRef(${seed});`)) {
    report.push(`${id}: SKIP unexpected elapsedRef block`);
    continue;
  }

  // The booking baseline. number-match has none (it books at the end), so its
  // absence is expected rather than a failure.
  const bookedRe =
    /^ {2}\/\*\* Play seconds already booked into the statistics for this (\w+)\. \*\/\n {2}const bookedRef = useRef\(0\);$/m;
  const booked = bookedRe.exec(src);
  if (booked) {
    src = src.replace(bookedRe, `${bookedDoc(booked[1])}\n  const bookedRef = useRef(${seed});`);
  }

  if (src === before) {
    report.push(`${id}: SKIP already seeded`);
    continue;
  }

  // Nothing may be left reading a zero baseline, and a multi-slot game must
  // have picked up the name it now indexes with.
  const leftovers = [];
  if (/const elapsedRef = useRef\(0\);/.test(src)) leftovers.push('elapsedRef');
  if (/const bookedRef = useRef\(0\);/.test(src)) leftovers.push('bookedRef');
  if (multi && !/^const INITIAL_MODE: GameMode = '[a-z]+';$/m.test(src)) {
    leftovers.push('INITIAL_MODE');
  }
  if (leftovers.length) {
    report.push(`${id}: FAIL leftovers=${leftovers.join(',')}`);
    continue;
  }

  writeFileSync(file, src);
  report.push(`${id}: ok (${multi ? 'multi' : 'single'}${booked ? '' : ', no bookedRef'})`);
}

console.log(report.join('\n'));
