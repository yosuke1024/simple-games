/**
 * 2026-10-02: デイリーを「今日の 1 問」だけにする codemod
 * (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」)。
 *
 * デイリーを持つ 23 本から過去日への遡り(「過去のデイリー」一覧)を外し、
 * 中断スロットを持つ 21 本では日付が過ぎた中断盤面を読み込み時に捨てる。
 * 各ゲームで触る場所:
 *
 *   ui/screens/HomeScreen.tsx   「過去のデイリー」chip と IconCalendar を外す。
 *                               中断中のデイリーは今日の日付のものだけを「続きから」と扱い、
 *                               別の日付を添える注記(` · 2026-08-03`)を消す。
 *   ui/<X>Root.tsx              DailyScreen の import と `case 'daily'` を外す。
 *   state/GameContext.tsx       Screen 型から 'daily' を外し、startDaily から日付引数を外す。
 *   ui/screens/DailyScreen.tsx  削除。
 *   state/progressLogic.ts      遡り(availableDailyDates / canPlayDaily)しか無い 22 本は削除。
 *                               他の export を持つ Number Match は残す(手で縮める)。
 *   storage/gamePersistence.ts  loadSavedGames に `today` を足し、別の日のデイリーは
 *                               レコードごと捨てる(21 本)。
 *   i18n/*.ts                   一覧の案内文 `<game>DailyBacklogHint` を 14 言語から外す。
 *   storage/slots.test.ts       「別の日のデイリーは読み込みで消える」テストを足す(21 本)。
 *
 * 共有の i18n(src/i18n/locales/*.ts)からは dailyPast / dailyToday / dailyBacklogHint を外す。
 *
 * 期待する骨格と一致しない箇所は FAIL と報告してそのゲームには何も書かない。
 * 一度変換したゲームは DailyScreen が無いので SKIP になり、再実行は no-op。
 * 遡りに触るテスト(storage.test.ts / *Root.test.tsx)は意味を伴う書き換えなので
 * ここでは触らず、残っている import を NOTE として列挙する。
 *
 *   node scripts/codemods/2026-10-02-daily-today-only.mjs
 */
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '../..');
const GAMES = join(APP, 'src/games');
const report = [];
const touched = [];

/** Counts non-overlapping occurrences of a literal. */
function count(src, needle) {
  let n = 0;
  for (let i = src.indexOf(needle); i >= 0; i = src.indexOf(needle, i + needle.length)) n++;
  return n;
}

/** Replaces a literal that must appear exactly once, or throws. */
function replaceOnce(src, needle, replacement, what) {
  const n = count(src, needle);
  if (n !== 1) throw new Error(`${what}: expected 1 match, found ${n}`);
  return src.replace(needle, () => replacement);
}

/** Every .ts/.tsx under a directory, recursively. */
function sources(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const DAILY_NOTE_RE =
  /\{dailyIsToday \? '' : ` · \$\{daily(?:Game|Set)\.dailyDate\}`\}( ·\{' '\}| · )?/;

function convertHome(src) {
  src = replaceOnce(
    src,
    '          <button type="button" className="home-chip" onClick={() => navigate(\'daily\')}>\n' +
      '            <IconCalendar className="home-chip-icon" />\n' +
      "            <span>{t('dailyPast')}</span>\n" +
      '          </button>\n',
    '',
    'past-dailies chip',
  );
  src = replaceOnce(src, 'import { IconCalendar, ', 'import { ', 'IconCalendar import');
  if (src.includes('IconCalendar')) throw new Error('IconCalendar still referenced');

  const slotLine =
    /^ {2}const (dailyGame|dailySet) = sessions\.daily\?\.status === 'playing' \? sessions\.daily : null;\n/m;
  const slot = slotLine.exec(src);
  if (slot) {
    const name = slot[1];
    const todayLine = '  const today = localDateString(new Date());\n';
    src = replaceOnce(src, todayLine, '', 'today line');
    src = src.replace(
      slotLine,
      () =>
        todayLine +
        "  // Today's board or nothing: a daily left from another day is not the one\n" +
        '  // this button names (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」).\n' +
        `  const ${name} =\n` +
        "    sessions.daily?.status === 'playing' && sessions.daily.dailyDate === today\n" +
        '      ? sessions.daily\n' +
        '      : null;\n',
    );
    src = replaceOnce(
      src,
      `  const dailyIsToday = ${name}?.dailyDate === today;\n`,
      '',
      'dailyIsToday line',
    );
    const note = DAILY_NOTE_RE.exec(src);
    if (!note) throw new Error('date note not found');
    if (note[1] === undefined) {
      // The note was a line of its own.
      src = replaceOnce(src, `              ${note[0]}\n`, '', 'date note line');
    } else {
      // The note led a longer line; keep the separator it carried.
      src = replaceOnce(src, note[0], "{' · '}", 'date note fragment');
    }
    if (src.includes('dailyIsToday')) throw new Error('dailyIsToday still referenced');
  }
  if (src.includes("navigate('daily')") || src.includes('dailyPast')) {
    throw new Error('daily screen still referenced');
  }
  return src;
}

function convertRoot(src) {
  const imp = /^import \{ (\w+) \} from '\.\/screens\/DailyScreen';\n/m.exec(src);
  if (!imp) throw new Error('DailyScreen import not found');
  src = src.replace(imp[0], '');
  src = replaceOnce(src, `    case 'daily':\n      return <${imp[1]} />;\n`, '', "case 'daily'");
  if (src.includes('DailyScreen')) throw new Error('DailyScreen still referenced');
  return src;
}

function convertContext(src) {
  const screen = /^export type Screen = .*;\n/m.exec(src);
  if (!screen) throw new Error('Screen type not found');
  if (!screen[0].includes("'daily' | ")) throw new Error("Screen type has no 'daily'");
  src = src.replace(screen[0], screen[0].replace("'daily' | ", ''));
  src = replaceOnce(
    src,
    '  startDaily: (date?: string) => void;\n',
    '  startDaily: () => void;\n',
    'startDaily type',
  );
  const block =
    '    (date?: string) => {\n      const target = date ?? localDateString(new Date());\n';
  const oneLiner =
    '    (date?: string) => beginSession(createDailySession(date ?? localDateString(new Date()))),\n';
  if (count(src, block) === 1) {
    src = src.replace(block, '    () => {\n      const target = localDateString(new Date());\n');
  } else if (count(src, oneLiner) === 1) {
    src = src.replace(
      oneLiner,
      '    () => beginSession(createDailySession(localDateString(new Date()))),\n',
    );
  } else {
    throw new Error('startDaily body matches neither shape');
  }
  if (src.includes('date ?? ') || src.includes('(date?: string)')) {
    throw new Error('a date parameter survived');
  }
  return src;
}

function convertPersistence(src) {
  const signature =
    'export async function loadSavedGames(kv: KVStore = preferencesKV): Promise<SavedGames> {\n';
  if (!src.includes('dailyGameSchema')) throw new Error('no dailyGameSchema');
  if (!/import \{[^}]*\bremoveRecord\b[^}]*\} from '\.\.\/\.\.\/\.\.\/storage\/repo';/.test(src)) {
    throw new Error('removeRecord is not imported');
  }
  src = replaceOnce(
    src,
    signature,
    'async function loadSlots(kv: KVStore): Promise<SavedGames> {\n',
    'loadSavedGames signature',
  );
  const start = src.indexOf('async function loadSlots(');
  const end = src.indexOf('\n}\n', start);
  if (end < 0) throw new Error('loadSlots has no end');
  const wrapper =
    '\n\n' +
    '/**\n' +
    " * The daily slot holds today's board or nothing (docs/PRODUCT_PRINCIPLES.md\n" +
    ' * 「デイリーは今日の 1 問」). A board left over from another day is dropped here,\n' +
    ' * record and all, so no door — the home button, a shortcut — can reopen it.\n' +
    ' * `today` is a seam for the tests; production reads the device clock.\n' +
    ' */\n' +
    'export async function loadSavedGames(\n' +
    '  kv: KVStore = preferencesKV,\n' +
    '  today: string = localDateString(new Date()),\n' +
    '): Promise<SavedGames> {\n' +
    '  const saved = await loadSlots(kv);\n' +
    '  if (saved.daily !== null && saved.daily.dailyDate !== today) {\n' +
    '    await removeRecord(dailyGameSchema.key, kv);\n' +
    '    return { ...saved, daily: null };\n' +
    '  }\n' +
    '  return saved;\n' +
    '}';
  src = src.slice(0, end + 2) + wrapper + src.slice(end + 2);

  // `localDateString` joins the game's own import.
  const gameImport = /import \{([^}]*)\} from '\.\.\/game';/.exec(src);
  if (!gameImport) throw new Error("no value import from '../game'");
  const names = gameImport[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (names.includes('localDateString')) throw new Error('localDateString already imported');
  const values = names
    .filter((n) => !n.startsWith('type '))
    .concat('localDateString')
    .sort();
  const types = names.filter((n) => n.startsWith('type '));
  const rebuilt = `import {\n${[...values, ...types].map((n) => `  ${n},`).join('\n')}\n} from '../game';`;
  src = src.replace(gameImport[0], rebuilt);
  return src;
}

function convertSlotsTest(src) {
  if (src.includes('left over from another day'))
    throw new Error('stale-daily test already present');
  const record = /const dailyRecord = toPersisted\(createDailySession\('(\d{4}-\d\d-\d\d)'/.exec(
    src,
  );
  if (!record) throw new Error('dailyRecord line not found');
  const date = record[1];
  if (!src.includes("from './schemas';") || !/\bdailyGameSchema\b/.test(src)) {
    throw new Error('dailyGameSchema not imported');
  }
  const persistence = /import \{([^}]*)\} from '\.\/gamePersistence';/.exec(src);
  if (!persistence) throw new Error('gamePersistence import not found');
  const names = persistence[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .concat('loadSavedGames')
    .sort();
  src = src.replace(persistence[0], `import { ${names.join(', ')} } from './gamePersistence';`);
  src = replaceOnce(
    src,
    "import { describe, expect, it } from 'vitest';\n",
    "import { describe, expect, it } from 'vitest';\nimport { createMemoryKV } from '@/storage/kv';\n",
    'vitest import',
  );
  src =
    src.trimEnd() +
    '\n\n' +
    "describe('a daily left over from another day (docs/PRODUCT_PRINCIPLES.md「デイリーは今日の 1 問」)', () => {\n" +
    "  it('is dropped at load, record and all, while the same day still resumes', async () => {\n" +
    '    const stored = () => createMemoryKV({ [dailyGameSchema.key]: JSON.stringify(dailyRecord) });\n' +
    '\n' +
    '    const sameDay = stored();\n' +
    `    expect((await loadSavedGames(sameDay, '${date}')).daily?.dailyDate).toBe('${date}');\n` +
    '    expect(await sameDay.get(dailyGameSchema.key)).not.toBeNull();\n' +
    '\n' +
    '    const nextDay = stored();\n' +
    `    expect((await loadSavedGames(nextDay, '${nextDay(date)}')).daily).toBeNull();\n` +
    '    expect(await nextDay.get(dailyGameSchema.key)).toBeNull();\n' +
    '  });\n' +
    '});\n';
  return src;
}

/** Removes `<game>DailyBacklogHint` from the game's 14 catalogs. */
function convertCatalogs(dir) {
  const en = readFileSync(join(dir, 'en.ts'), 'utf8');
  const key = /^\s*(\w+DailyBacklogHint):/m.exec(en);
  if (!key) return null;
  const edits = [];
  for (const name of readdirSync(dir)) {
    if (!/^[a-z-]+\.ts$/.test(name) || name === 'index.ts') continue;
    const file = join(dir, name);
    const src = readFileSync(file, 'utf8');
    // One entry: `key: '…',` on a line, or `key:` with the string wrapped onto the next.
    const line = new RegExp(`^\\s*${key[1]}:(?: .*|\\n\\s+'.*',)\\n`, 'm');
    const m = line.exec(src);
    if (!m) throw new Error(`${name} lacks ${key[1]}`);
    if (count(src, `${key[1]}:`) !== 1) throw new Error(`${name} has ${key[1]} more than once`);
    edits.push([file, src.replace(m[0], '')]);
  }
  return { key: key[1], edits };
}

for (const id of readdirSync(GAMES).sort()) {
  const dir = join(GAMES, id);
  if (!statSync(dir).isDirectory()) continue;
  const dailyScreen = join(dir, 'ui/screens/DailyScreen.tsx');
  if (!existsSync(dailyScreen)) {
    report.push(`${id}: SKIP no daily screen`);
    continue;
  }
  const writes = [];
  const deletes = [dailyScreen];
  const notes = [];
  try {
    const home = join(dir, 'ui/screens/HomeScreen.tsx');
    writes.push([home, convertHome(readFileSync(home, 'utf8'))]);

    const rootName = readdirSync(join(dir, 'ui')).find((f) => /Root\.tsx$/.test(f));
    if (!rootName) throw new Error('no Root');
    const root = join(dir, 'ui', rootName);
    writes.push([root, convertRoot(readFileSync(root, 'utf8'))]);

    const context = join(dir, 'state/GameContext.tsx');
    writes.push([context, convertContext(readFileSync(context, 'utf8'))]);

    const progress = join(dir, 'state/progressLogic.ts');
    if (existsSync(progress)) {
      const importers = sources(dir).filter(
        (f) =>
          f !== progress && f !== dailyScreen && /progressLogic'/.test(readFileSync(f, 'utf8')),
      );
      const production = importers.filter((f) => !/\.test\.tsx?$/.test(f));
      if (production.length > 0) {
        notes.push(
          `progressLogic kept (imported by ${production.map((f) => relative(dir, f)).join(', ')})`,
        );
      } else {
        deletes.push(progress);
        const tests = importers.filter((f) => /\.test\.tsx?$/.test(f));
        if (tests.length > 0) {
          notes.push(
            `tests still import progressLogic: ${tests.map((f) => relative(dir, f)).join(', ')}`,
          );
        }
      }
    }

    const keys = join(dir, 'storage/keys.ts');
    const persistence = join(dir, 'storage/gamePersistence.ts');
    if (existsSync(persistence) && readFileSync(keys, 'utf8').includes('dailyGame')) {
      writes.push([persistence, convertPersistence(readFileSync(persistence, 'utf8'))]);
      const slots = join(dir, 'storage/slots.test.ts');
      if (!existsSync(slots)) throw new Error('no slots.test.ts');
      writes.push([slots, convertSlotsTest(readFileSync(slots, 'utf8'))]);
    } else {
      notes.push('no daily slot');
    }

    const catalogs = convertCatalogs(join(dir, 'i18n'));
    if (catalogs) {
      const users = sources(dir).filter(
        (f) =>
          !f.includes('/i18n/') &&
          f !== dailyScreen &&
          readFileSync(f, 'utf8').includes(`'${catalogs.key}'`),
      );
      if (users.length > 0) throw new Error(`${catalogs.key} used outside DailyScreen`);
      writes.push(...catalogs.edits);
    } else {
      notes.push('no per-game backlog hint');
    }
  } catch (error) {
    report.push(`${id}: FAIL ${error.message}`);
    continue;
  }
  for (const [file, src] of writes) {
    writeFileSync(file, src);
    touched.push(file);
  }
  for (const file of deletes) unlinkSync(file);
  report.push(`${id}: ok${notes.length ? ` (${notes.join('; ')})` : ''}`);
}

// Shared catalogs: the three keys only the backlog used.
const SHARED_KEYS = ['dailyPast', 'dailyToday', 'dailyBacklogHint'];
const sharedDir = join(APP, 'src/i18n/locales');
for (const name of readdirSync(sharedDir).sort()) {
  if (!/^[a-z-]+\.ts$/.test(name)) continue;
  const file = join(sharedDir, name);
  let src = readFileSync(file, 'utf8');
  let removed = 0;
  for (const key of SHARED_KEYS) {
    const line = new RegExp(`^\\s*${key}: .*\\n`, 'm');
    const m = line.exec(src);
    if (!m) continue;
    src = src.replace(m[0], '');
    removed++;
  }
  if (removed === 0) {
    report.push(`i18n/${name}: SKIP`);
  } else if (removed !== SHARED_KEYS.length) {
    report.push(`i18n/${name}: FAIL removed ${removed} of ${SHARED_KEYS.length}`);
  } else {
    writeFileSync(file, src);
    touched.push(file);
    report.push(`i18n/${name}: ok`);
  }
}

console.log(report.join('\n'));
if (touched.length > 0) {
  console.log(`\ntouched ${touched.length} files; format them with:`);
  console.log(`pnpm exec prettier --write ${touched.map((f) => relative(APP, f)).join(' ')}`);
}
