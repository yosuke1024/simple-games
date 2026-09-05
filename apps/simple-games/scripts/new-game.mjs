#!/usr/bin/env node
/**
 * ゲーム 1 本ぶんの「接続点」を生成するスキャフォールド。
 *
 *   node scripts/new-game.mjs <id> <PREFIX> --title "<Title>" --category <logic|cards|puzzle|board|arcade|drills> [--glyph <char>] [--dry-run]
 *
 * 新しいゲームを足すたびに 4,000 行あるどれかの兄弟ゲームを丸ごとコピーして
 * 削るところから始めるのは、練習台としては重い。ここで生成するのは
 * 「シェルと繋がる」ために必要な最小限の骨組み ── ルート・ホーム画面・
 * 最小の GameContext・共有ヘッダー / 共有 ShareAction の配線・keys/schemas・
 * 14 言語ぶんの i18n カタログ ── であって、ゲームそのものではない。
 * 生成後にゲームロジックを `game/` から書き始められる状態にすることが目的。
 *
 * 触れるファイルは 3 種類:
 *   1. `src/games/<id>/` 以下を新規作成(このスクリプトの主な仕事)
 *   2. `src/app/registry.ts` に import 1 行・GameId 1 行・GAMES 要素 1 個を追記
 *   3. `src/app/gameKeys.test.ts` の RELEASED_KEYS / PREFIXES に 1 行ずつ追記
 *      (この golden test は「登録されている全ゲームを、過不足なくカバーする」
 *      ことを検証しているので、ゲームを足したその場で更新しないと赤くなる)
 *
 * `docs/<ID>_RULES.md` のスタブも 1 本生成する。中身は空のままなので、本当の
 * ルールは実装より先に書くこと。
 *
 * 通す門(すべて `src/test/` 以下、詳細は各テストのコメントを参照):
 *   - app/gameKeys.test.ts ─ 上記 2 の追記で担保
 *   - importBoundaries.test.ts ─ keys.ts は import ゼロのまま生成
 *   - gameI18nWiring.test.ts ─ Root の先頭で `import '../i18n';`
 *   - homeActionsWiring.test.ts ─ HomeScreen が `<GameHomeHeader gameId="…" .../>` を
 *     ちょうど 1 回だけ描く
 *   - shareWiring.test.ts ─ 結果オーバーレイが `<ShareAction gameId="…" .../>` を持つ
 *   - refLeading.test.ts ─ GameContext の statsRef / sessionRef が
 *     「setState の直前で ref を進める」形になっている(下記 GameContext 生成部を参照)
 *   - savedGameSlots.test.ts ─ 既定の保存キーは stats / flags のみで
 *     `dailyGame` を持たないので対象外
 *   - lifecycle.test.tsx ─ 生成したルートはタイマー・リスナーを一切登録しない
 *   - src/i18n/i18n.test.ts / gate.test.ts ─ 14 言語すべてに非空の文字列を用意
 *     (英語をそのまま置いた「未翻訳」のプレースホルダーで足りる。高リスク
 *     キー一覧 `highRiskKeys.ts` は固定のキー名を列挙する方式で、新規ゲームの
 *     キーはそこに含まれないため gate.test.ts の対象にはならない)
 *   - src/ui/landing.test.ts ─ 新規ゲームは PUBLISHED_GAME_IDS に無くても
 *     テストは許容する(landing.ts 冒頭のコメントの通り)ので何もしない
 *
 * `size-baseline.json` は触らない。ゲームチャンクが無いビルドは「新規」表示に
 * なるだけで size:check は落ちない ── ただしコミット前に `pnpm size:update` を
 * 実行してベースラインへ載せること(成功時の出力で案内する)。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..');
const REPO_ROOT = join(APP, '..', '..');
const GAMES_DIR = join(APP, 'src/games');
const REGISTRY_PATH = join(APP, 'src/app/registry.ts');
const GAME_KEYS_TEST_PATH = join(APP, 'src/app/gameKeys.test.ts');
const DOCS_DIR = join(REPO_ROOT, 'docs');

const CATEGORIES = ['logic', 'cards', 'puzzle', 'board', 'arcade', 'drills'];
const DEFAULT_GLYPH = '•';

/** The 14 locales every game catalog must ship (src/i18n/index.ts `Locale`). */
const LOCALES = [
  { code: 'ja', varName: 'ja', label: 'Japanese' },
  { code: 'hi', varName: 'hi', label: 'Hindi' },
  { code: 'th', varName: 'th', label: 'Thai' },
  { code: 'id', varName: 'id', label: 'Indonesian' },
  { code: 'vi', varName: 'vi', label: 'Vietnamese' },
  { code: 'ko', varName: 'ko', label: 'Korean' },
  { code: 'zh-hans', varName: 'zhHans', label: 'Simplified Chinese' },
  { code: 'zh-hant', varName: 'zhHant', label: 'Traditional Chinese' },
  { code: 'es', varName: 'es', label: 'Spanish' },
  { code: 'pt-br', varName: 'ptBR', label: 'Brazilian Portuguese' },
  { code: 'fr', varName: 'fr', label: 'French' },
  { code: 'de', varName: 'de', label: 'German' },
  { code: 'tr', varName: 'tr', label: 'Turkish' },
];

// ---------- CLI ----------

function usage() {
  return (
    'usage: new-game.mjs <id> <PREFIX> --title "<Title>" ' +
    '--category <logic|cards|puzzle|board|arcade|drills> [--glyph <char>] [--dry-run]'
  );
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--title') {
      flags.title = argv[++i];
    } else if (arg === '--category') {
      flags.category = argv[++i];
    } else if (arg === '--glyph') {
      flags.glyph = argv[++i];
    } else if (arg.startsWith('--')) {
      fail(`unknown option: ${arg}\n${usage()}`);
    } else {
      positional.push(arg);
    }
  }
  const [id, prefix] = positional;
  return { id, prefix, ...flags };
}

// ---------- name derivation ----------

/** `zz-sample` → `ZzSample`. A segment that starts with a digit (`2048`) is
 * kept as-is, and the whole name is prefixed with `Game` if that still leaves
 * an identifier starting with a digit — the same escape hatch the `2048`
 * game itself uses (`Game2048Root` in app/registry.ts). */
function pascalCase(id) {
  const pascal = id
    .split('-')
    .filter(Boolean)
    .map((segment) =>
      /^[a-z]/i.test(segment) ? segment[0].toUpperCase() + segment.slice(1) : segment,
    )
    .join('');
  return /^[0-9]/.test(pascal) ? `Game${pascal}` : pascal;
}

/** `zz-sample` → `zzSample`. Built from pascalCase so the digit-prefix escape
 * hatch above is shared instead of duplicated. */
function camelCase(id) {
  const pascal = pascalCase(id);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

// ---------- validation ----------

function validateId(id) {
  if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    fail(`invalid id "${id ?? ''}": expected kebab-case, e.g. "sample-game"`);
  }
}

function validatePrefix(prefix) {
  if (!prefix || !/^[a-z0-9]{2}$/.test(prefix)) {
    fail(
      `invalid prefix "${prefix ?? ''}": expected exactly two lowercase letters/digits, e.g. "sg"`,
    );
  }
}

function validateCategory(category) {
  if (!CATEGORIES.includes(category)) {
    fail(`invalid --category "${category ?? ''}": expected one of ${CATEGORIES.join(', ')}`);
  }
}

/** Every prefix already in use, read from each game's own zero-import keys
 * leaf — the same source app/registry.ts and gameKeys.test.ts pin their
 * literals against. */
function existingPrefixes() {
  const prefixes = new Set();
  for (const game of readdirSync(GAMES_DIR, { withFileTypes: true })) {
    if (!game.isDirectory()) continue;
    const keysPath = join(GAMES_DIR, game.name, 'storage/keys.ts');
    if (!existsSync(keysPath)) continue;
    const source = readFileSync(keysPath, 'utf8');
    for (const match of source.matchAll(/:\s*'([a-z0-9]+)\.[^']*'/g)) prefixes.add(match[1]);
  }
  return prefixes;
}

function checkAvailable(id, prefix) {
  if (existsSync(join(GAMES_DIR, id))) {
    fail(`refusing: src/games/${id}/ already exists`);
  }
  const registrySource = readFileSync(REGISTRY_PATH, 'utf8');
  if (
    new RegExp(`\\|\\s*'${id}'`).test(registrySource) ||
    new RegExp(`id:\\s*'${id}'`).test(registrySource)
  ) {
    fail(`refusing: "${id}" is already registered in src/app/registry.ts`);
  }
  const taken = existingPrefixes();
  if (taken.has(prefix)) {
    fail(
      `refusing: prefix "${prefix}" is already used by another game (src/games/*/storage/keys.ts)`,
    );
  }
}

// ---------- generated file bodies ----------

function keysFile({ prefix, prefixUpper }) {
  return `/**
 * The keys this game persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * Scaffolded by scripts/new-game.mjs. Add keys here as the game grows.
 */
export const ${prefixUpper}_STORAGE_KEYS = {
  stats: '${prefix}.stats',
  flags: '${prefix}.flags',
} as const;
`;
}

function schemasFile({ prefix, prefixUpper }) {
  return `/**
 * This game's own persisted records, under the \`${prefix}.\` prefix declared
 * in ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults.
 *
 * Scaffolded by scripts/new-game.mjs — a starting point. Add the game's real
 * fields here, and once there is something worth resuming, a \`game\` key plus
 * a saved-game schema (src/test/savedGameSlots.test.ts explains the two-slot
 * rule this needs if a daily mode is added later).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, isRecord } from '../../../storage/validate';

import { ${prefixUpper}_STORAGE_KEYS } from './keys';

export { ${prefixUpper}_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: ${prefixUpper}_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

export interface Stats {
  schemaVersion: 1;
  played: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: ${prefixUpper}_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, played: 0 }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    return played === null ? null : { schemaVersion: 1, played };
  },
};
`;
}

function gamePlaceholderFile({ title }) {
  // NOTE: keep this comment free of a literal "*" immediately followed by
  // "/" (e.g. a games/*/game/** glob) — that sequence closes a /** */
  // comment early and corrupts the rest of the generated file.
  return `/**
 * ${title}'s pure game logic goes here: no React, no storage, no service
 * imports (docs/ARCHITECTURE.md「レイヤー規則」; both
 * src/test/importBoundaries.test.ts and the ESLint rule scoped to every
 * game's own game folder (eslint.config.js) enforce that mechanically).
 * Nothing is implemented yet — this file only holds the folder open so the
 * layering is right from the first commit.
 *
 * Scaffolded by scripts/new-game.mjs.
 */
export {};
`;
}

function gameContextFile({ pascal }) {
  return `/**
 * ${pascal}'s app context: a starting point generated by scripts/new-game.mjs.
 * It wires the shell's contract — records load, a home screen, a result
 * worth sharing — so the next step is writing the game, not the plumbing
 * around it.
 *
 * The one placeholder round below (\`playPlaceholderRound\`) exists only so
 * the stats seam is real rather than decorative: every context in this
 * collection advances its ref immediately before the matching setState call,
 * because React batches one task's updates and a second mutation in that
 * task would otherwise read what the first one just replaced
 * (docs/ARCHITECTURE.md「状態と ref」, src/test/refLeading.test.ts). Replace
 * the round itself; keep the ref-then-setState shape when you do.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { saveRecord } from '../../../storage/repo';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';

/** Stands in for "a round is in progress" — replace with the real shape. */
interface PlaceholderRound {
  readonly startedAt: number;
}

/** What the result overlay shows. Replace with the game's real outcome. */
export interface LastResult {
  readonly playedAt: number;
}

export interface ${pascal}ContextValue {
  stats: Stats;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Placeholder for "play a round" — wire up the real game here. */
  playPlaceholderRound: () => void;
  dismissResult: () => void;
  completeTutorial: () => void;
  exitToCollection: () => void;
}

const ${pascal}Context = createContext<${pascal}ContextValue | null>(null);

export interface ${pascal}ProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function ${pascal}Provider({
  initialStats,
  initialFlags,
  onExit,
  children,
}: ${pascal}ProviderProps) {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [round, setRound] = useState<PlaceholderRound | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const statsRef = useRef(stats);
  statsRef.current = stats;
  const sessionRef = useRef(round);
  sessionRef.current = round;

  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const putSession = useCallback((next: PlaceholderRound | null) => {
    sessionRef.current = next;
    setRound(next);
  }, []);

  const playPlaceholderRound = useCallback(() => {
    putSession({ startedAt: Date.now() });
    persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
    putSession(null);
    setLastResult({ playedAt: Date.now() });
  }, [persistStats, putSession]);

  const dismissResult = useCallback(() => setLastResult(null), []);

  const completeTutorial = useCallback(() => {
    if (flags.tutorialCompleted) return;
    const next = { ...flags, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, [flags]);

  const value = useMemo<${pascal}ContextValue>(
    () => ({
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      playPlaceholderRound,
      dismissResult,
      completeTutorial,
      exitToCollection: onExit,
    }),
    [
      stats,
      flags.tutorialCompleted,
      lastResult,
      playPlaceholderRound,
      dismissResult,
      completeTutorial,
      onExit,
    ],
  );

  return <${pascal}Context.Provider value={value}>{children}</${pascal}Context.Provider>;
}

export function use${pascal}(): ${pascal}ContextValue {
  const value = useContext(${pascal}Context);
  if (!value) throw new Error('use${pascal} must be used inside ${pascal}Provider');
  return value;
}
`;
}

function rootFile({ id, pascal }) {
  return `/**
 * ${pascal}'s root: loads the game's own records (local, fast, offline), then
 * mounts the provider and the home screen. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work.
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
 *
 * Scaffolded by scripts/new-game.mjs.
 */
// Register this game's 14-locale catalog the moment the chunk loads, before
// anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { ${pascal}Provider } from '../state/GameContext';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './${id}.css';
import { ${pascal}HomeScreen } from './screens/HomeScreen';

interface LoadedData {
  stats: Stats;
  flags: Flags;
}

export interface ${pascal}RootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

function defaultRecords(): LoadedData {
  return { stats: statsSchema.defaultValue(), flags: flagsSchema.defaultValue() };
}

async function loadRecords(kv: KVStore): Promise<LoadedData> {
  const [stats, flags] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
  ]);
  return { stats, flags };
}

export function ${pascal}Root({ onExit, kv = preferencesKV }: ${pascal}RootProps) {
  const data = useLoadedRecords(kv, loadRecords, defaultRecords);
  if (data === null) return null;

  return (
    <${pascal}Provider initialStats={data.stats} initialFlags={data.flags} onExit={onExit}>
      <${pascal}HomeScreen />
    </${pascal}Provider>
  );
}
`;
}

function cssFile({ pascal }) {
  return `/**
 * ${pascal}'s styles — scaffolded by scripts/new-game.mjs. The shared shell
 * classes (.screen, .home-hero, .btn, .dialog, ...) already cover this
 * placeholder; add the game's own board and chrome here as it grows.
 */
`;
}

function homeScreenFile({ id, pascal, camel, glyph }) {
  return `/**
 * ${pascal}'s home (scaffolded by scripts/new-game.mjs): the shared header,
 * a title, a "How to Play" placeholder, and one demo action that exercises
 * the result overlay. Replace the demo action with the real game entry
 * point once there is a game to start.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { use${pascal} } from '../../state/GameContext';
import { ${pascal}ResultOverlay } from '../components/ResultOverlay';

export function ${pascal}HomeScreen() {
  const { stats, lastResult, playPlaceholderRound, dismissResult, exitToCollection } =
    use${pascal}();
  const { t } = useSettings();

  return (
    <div className="screen home-screen">
      <GameHomeHeader gameId="${id}" onBack={exitToCollection} />

      <div className="home-hero">
        {/* Matches the tile glyph in app/registry.ts. */}
        <div className="home-logo" aria-hidden="true">
          {${quote(glyph)}}
        </div>
        <h1 className="home-title">{t('${camel}Name')}</h1>
        <p className="home-tagline">{t('tagline')}</p>
      </div>

      <div className="home-actions">
        {/* Scaffold placeholder — replace with the real game entry point. */}
        <button type="button" className="btn btn-primary btn-big" onClick={playPlaceholderRound}>
          {t('${camel}PlayPlaceholder')}
          {stats.played > 0 ? <span className="btn-note">{stats.played}</span> : null}
        </button>

        <section className="home-links">
          <h2>{t('howToPlay')}</h2>
          <p className="tutorial-body">{t('${camel}HowToPlayPlaceholder')}</p>
        </section>
      </div>

      <${pascal}ResultOverlay result={lastResult} onDismiss={dismissResult} />
    </div>
  );
}
`;
}

function resultOverlayFile({ id, pascal, camel }) {
  return `/**
 * ${pascal}'s result overlay (scaffolded by scripts/new-game.mjs): the one
 * place \`ShareAction\` belongs (docs/ARCHITECTURE.md「結果画面の共有」,
 * issue #86). Replace the placeholder copy with the game's real outcome.
 */
import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import type { LastResult } from '../../state/GameContext';

export interface ${pascal}ResultOverlayProps {
  result: LastResult | null;
  onDismiss: () => void;
}

export function ${pascal}ResultOverlay({ result, onDismiss }: ${pascal}ResultOverlayProps) {
  const { t } = useSettings();
  if (result === null) return null;

  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('${camel}ResultTitle')}
      >
        <h2 className="dialog-title">{t('${camel}ResultTitle')}</h2>
        <p className="dialog-body">{t('${camel}ResultBody')}</p>

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onDismiss} autoFocus>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="${id}" outcome="played" details={[]} />
      </div>
    </div>
  );
}
`;
}

/** The strings this scaffold's placeholder actually renders. Everything else
 * (title text, buttons, dialog) is a shared shell key (`tagline`, `howToPlay`,
 * `backHome`, ...). */
function catalogEntries({ camel, title }) {
  return {
    [`${camel}Name`]: title,
    [`${camel}PlayPlaceholder`]: 'Play a sample round',
    [`${camel}HowToPlayPlaceholder`]: 'This game does not have rules yet — add them here.',
    [`${camel}ResultTitle`]: 'Nice work',
    [`${camel}ResultBody`]: 'This is a placeholder result. Replace it with the real outcome.',
  };
}

/** Single-quoted string literal, safe to splice into generated JS/TS source
 * even when `str` (a --title or --glyph the caller typed) contains a quote
 * or backslash of its own. */
function quote(str) {
  return `'${String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function objectLiteral(entries, indent) {
  return Object.entries(entries)
    .map(([key, value]) => `${indent}${key}: ${quote(value)},`)
    .join('\n');
}

function enLocaleFile({ pascal, camel, title }) {
  const entries = catalogEntries({ camel, title });
  return `/**
 * This game's own strings (issue #38 pattern): bundled into the game's
 * chunk, not the entry, and registered on chunk load by ./index.ts.
 *
 * Scaffolded by scripts/new-game.mjs — add real keys as the game grows.
 */
export const en = {
${objectLiteral(entries, '  ')}
} as const;

/** Every locale of this game must provide exactly these keys. */
export type ${pascal}Messages = Record<keyof typeof en, string>;
`;
}

function otherLocaleFile({ pascal, camel, title, locale }) {
  const entries = catalogEntries({ camel, title });
  return `/**
 * Placeholder ${locale.label} catalog, scaffolded by scripts/new-game.mjs
 * with the English text left untranslated. Replace every value below with a
 * real ${locale.label} translation before release (docs/I18N_POLICY.md); the
 * title (\`${camel}Name\`) is a proper noun and stays as-is in every locale.
 */
import type { ${pascal}Messages } from './en';

export const ${locale.varName}: ${pascal}Messages = {
${objectLiteral(entries, '  ')}
};
`;
}

function i18nIndexFile({ id, pascal }) {
  const imports = LOCALES.map((l) => `import { ${l.varName} } from './${l.code}';`).join('\n');
  const catalogAssignments = LOCALES.map((l) =>
    /^[a-z]+$/.test(l.code) ? `  ${l.code},` : `  '${l.code}': ${l.varName},`,
  ).join('\n');
  return `/**
 * This game's catalog: all 14 locales, riding in the game's chunk (issue #38
 * pattern). Importing this module is what makes the game's strings exist at
 * runtime — every chunk entry point does so via \`import '../i18n';\`, which
 * runs before React.lazy can render anything. The \`declare module\` block is
 * the type-side twin: it merges this game's keys into the app-wide
 * MessageKey union without the shell importing anything from src/games/
 * (src/i18n/registry.ts explains the pairing).
 *
 * Scaffolded by scripts/new-game.mjs.
 */
import type { Locale } from '@/i18n';
import { registerGameMessages } from '@/i18n/registry';
${imports}
import { en, type ${pascal}Messages } from './en';

declare module '@/i18n/registry' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- the extends clause is the contribution
  interface GameMessages extends ${pascal}Messages {}
}

export const catalogs: Record<Locale, ${pascal}Messages> = {
  en,
${catalogAssignments}
};

registerGameMessages('${id}', catalogs);
`;
}

function rulesDocFile({ id, title, camel, prefix }) {
  return `# ${title} — 正式ゲームルール

\`scripts/new-game.mjs\` が生成したスタブ。実装
(\`apps/simple-games/src/games/${id}/\`)、テスト、Quick Rules はここに従う。
コードはここへ \`§n\` で言及する。挙動を変えるときは、同じコミットでこの文書を直す。

ブランド原則([PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md))はこの文書より上位にある。

ゲーム ID は \`${id}\`、i18n キーの接頭辞は \`${camel}\`、保存キーの接頭辞は \`${prefix}.\` である。

## 1. TODO

実装より先に、ここへ本当のルールを書くこと:

- 終了条件・クリア条件
- 操作方法
- 保存する記録(\`storage/schemas.ts\` の Stats / Flags を実際の値に置き換える)
- Quick Rules(アプリ内チュートリアル、最大 3 ステップ)
`;
}

// ---------- registry.ts / gameKeys.test.ts patches ----------

function patchRegistry(source, { id, prefixUpper, pascal, title, category, glyph }) {
  const lines = source.split('\n');

  const importLine = `import { ${prefixUpper}_STORAGE_KEYS } from '../games/${id}/storage/keys';`;
  const lastKeysImport = lines.reduce(
    (found, line, index) => (/^import \{ \w+_STORAGE_KEYS \}/.test(line) ? index : found),
    -1,
  );
  if (lastKeysImport === -1)
    throw new Error('registry.ts: no existing keys import found to anchor on');
  lines.splice(lastKeysImport + 1, 0, importLine);

  const unionLineIndex = lines.findIndex((line) => /^ *\| '[a-zA-Z0-9-]+';$/.test(line));
  if (unionLineIndex === -1) throw new Error('registry.ts: GameId union terminator not found');
  const withoutSemicolon = lines[unionLineIndex].replace(/;$/, '');
  lines.splice(unionLineIndex, 1, withoutSemicolon, `  | '${id}';`);

  const lastClosingArray = lines.reduce(
    (found, line, index) => (line === '];' ? index : found),
    -1,
  );
  if (lastClosingArray === -1) throw new Error('registry.ts: GAMES array terminator not found');
  const entry = [
    '  {',
    `    // Scaffolded by scripts/new-game.mjs — replace this comment (and the`,
    `    // glyph below) once the game has its own story.`,
    `    id: '${id}',`,
    `    title: ${quote(title)},`,
    `    category: '${category}',`,
    `    glyph: ${quote(glyph)},`,
    `    storageKeys: Object.values(${prefixUpper}_STORAGE_KEYS),`,
    `    loadRoot: () =>`,
    `      import('../games/${id}/ui/${pascal}Root').then((m) => ({ default: m.${pascal}Root })),`,
    '  },',
  ];
  lines.splice(lastClosingArray, 0, ...entry);

  return lines.join('\n');
}

function patchGameKeysTest(source, { id, prefix }) {
  const lines = source.split('\n');

  const releasedKeysClose = lines.indexOf('};');
  if (releasedKeysClose === -1)
    throw new Error('gameKeys.test.ts: RELEASED_KEYS terminator not found');
  lines.splice(releasedKeysClose, 0, `  '${id}': ['${prefix}.stats', '${prefix}.flags'],`);

  // The splice above shifted every later line down by one, including the
  // '};' that used to close RELEASED_KEYS — skip past *that* shifted line
  // too, or this would match it again instead of PREFIXES' own terminator.
  const prefixesClose = lines.indexOf('};', releasedKeysClose + 2);
  if (prefixesClose === -1) throw new Error('gameKeys.test.ts: PREFIXES terminator not found');
  lines.splice(prefixesClose, 0, `  '${id}': '${prefix}.',`);

  return lines.join('\n');
}

// ---------- plan ----------

function buildPlan({ id, prefix, title, category, glyph }) {
  const prefixUpper = prefix.toUpperCase();
  const pascal = pascalCase(id);
  const camel = camelCase(id);
  const idUpper = id.toUpperCase().replace(/-/g, '_');
  const ctx = { id, prefix, prefixUpper, pascal, camel, title, category, glyph };

  const gameRoot = join(GAMES_DIR, id);
  const files = [
    { path: join(gameRoot, 'game/placeholder.ts'), content: gamePlaceholderFile(ctx) },
    { path: join(gameRoot, 'state/GameContext.tsx'), content: gameContextFile(ctx) },
    { path: join(gameRoot, 'storage/keys.ts'), content: keysFile(ctx) },
    { path: join(gameRoot, 'storage/schemas.ts'), content: schemasFile(ctx) },
    { path: join(gameRoot, 'i18n/en.ts'), content: enLocaleFile(ctx) },
    ...LOCALES.map((locale) => ({
      path: join(gameRoot, `i18n/${locale.code}.ts`),
      content: otherLocaleFile({ ...ctx, locale }),
    })),
    { path: join(gameRoot, 'i18n/index.ts'), content: i18nIndexFile(ctx) },
    { path: join(gameRoot, `ui/${pascal}Root.tsx`), content: rootFile(ctx) },
    { path: join(gameRoot, `ui/${id}.css`), content: cssFile(ctx) },
    { path: join(gameRoot, 'ui/screens/HomeScreen.tsx'), content: homeScreenFile(ctx) },
    { path: join(gameRoot, 'ui/components/ResultOverlay.tsx'), content: resultOverlayFile(ctx) },
  ];

  const docsFile = { path: join(DOCS_DIR, `${idUpper}_RULES.md`), content: rulesDocFile(ctx) };

  return { ctx, files, docsFile };
}

function applyPlan(plan) {
  for (const file of plan.files) {
    mkdirSync(dirname(file.path), { recursive: true });
    writeFileSync(file.path, file.content, 'utf8');
  }
  writeFileSync(plan.docsFile.path, plan.docsFile.content, 'utf8');

  const registrySource = readFileSync(REGISTRY_PATH, 'utf8');
  writeFileSync(REGISTRY_PATH, patchRegistry(registrySource, plan.ctx), 'utf8');

  const testSource = readFileSync(GAME_KEYS_TEST_PATH, 'utf8');
  writeFileSync(GAME_KEYS_TEST_PATH, patchGameKeysTest(testSource, plan.ctx), 'utf8');
}

function relToApp(path) {
  return path.startsWith(APP) ? path.slice(APP.length + 1) : path;
}

function relToRepo(path) {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function printPlan(plan, { dryRun }) {
  const prefix = dryRun ? '[dry-run] ' : '';
  console.log(`${prefix}files created:`);
  for (const file of plan.files) console.log(`  apps/simple-games/${relToApp(file.path)}`);
  console.log(`  ${relToRepo(plan.docsFile.path)}`);
  console.log(`${prefix}files modified:`);
  console.log(`  apps/simple-games/${relToApp(REGISTRY_PATH)}`);
  console.log(`  apps/simple-games/${relToApp(GAME_KEYS_TEST_PATH)}`);
}

// ---------- main ----------

function main() {
  const {
    id,
    prefix,
    title,
    category,
    glyph = DEFAULT_GLYPH,
    dryRun,
  } = parseArgs(process.argv.slice(2));

  if (!id || !prefix || !title || !category) fail(usage());
  validateId(id);
  validatePrefix(prefix);
  validateCategory(category);
  checkAvailable(id, prefix);

  const plan = buildPlan({ id, prefix, title, category, glyph });

  if (dryRun) {
    printPlan(plan, { dryRun: true });
    console.log('\n[dry-run] no files were changed.');
    return;
  }

  applyPlan(plan);
  printPlan(plan, { dryRun: false });

  console.log('\nnext steps:');
  console.log(`  - translate the 14 locale strings in src/games/${id}/i18n/*.ts`);
  console.log(`  - write docs/${id.toUpperCase().replace(/-/g, '_')}_RULES.md (stub generated)`);
  console.log('  - add the game to ui/landing.ts PUBLISHED_GAME_IDS once its guide is deployed');
  console.log('  - run `pnpm size:update` before committing (size-baseline.json)');
  console.log('  - update the game count in README.md');
}

main();
