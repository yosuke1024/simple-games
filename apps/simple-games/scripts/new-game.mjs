#!/usr/bin/env node
/**
 * ゲーム 1 本ぶんの「接続点」を生成するスキャフォールド。
 *
 *   node scripts/new-game.mjs <id> <PREFIX> --title "<Title>" --category <logic|cards|puzzle|board|arcade|drills> [--glyph <char>] [--dry-run]
 *
 * 新しいゲームを足すたびに 4,000 行あるどれかの兄弟ゲームを丸ごとコピーして
 * 削るところから始めるのは、練習台としては重い。ここで生成するのは
 * 「シェルと繋がる」ために必要な最小限の骨組み ── ルート(画面の振り分け)・
 * ホーム / Quick Rules / ゲームの 3 画面・最小の GameContext(画面状態・
 * ハードウェア戻るボタンの唯一の持ち主・保存の継ぎ目)・共有ヘッダー /
 * 共有バナー / 共有 ShareAction の配線・keys/schemas・14 言語ぶんの i18n
 * カタログ ── であって、ゲームそのものではない。生成後にゲームロジックを
 * `game/` から書き始められる状態にすることが目的。
 *
 * 触れるファイルは 3 種類:
 *   1. `src/games/<id>/` 以下を新規作成(このスクリプトの主な仕事)
 *   2. `src/app/registry.ts` に import 1 行・GameId 1 行・GAMES 要素 1 個を追記
 *      (`loadStorageSchemas` を含む ── `GameDefinition` の必須フィールドで、
 *      無いと typecheck が落ちるうえ、Backup & Restore がこのゲームの記録を
 *      戻せない)
 *   3. `src/app/gameKeys.test.ts` の RELEASED_KEYS / PREFIXES に 1 行ずつ追記
 *      (この golden test は「登録されている全ゲームを、過不足なくカバーする」
 *      ことを検証しているので、ゲームを足したその場で更新しないと赤くなる)
 *
 * `docs/<ID>_RULES.md` のスタブも 1 本生成する。中身は空のままなので、本当の
 * ルールは実装より先に書くこと。
 *
 * 通す門(すべて `src/test/` 以下、詳細は各テストのコメントを参照)。生成物は
 * 手を入れずにこれら全部を通すことが約束で、通らなければ直すのは生成物では
 * なくこのスクリプト(2026-09-27 に #197 の足場で実測して直した):
 *   - app/gameKeys.test.ts ─ 上記 3 の追記で担保
 *   - importBoundaries.test.ts ─ keys.ts は import ゼロのまま生成
 *   - gameI18nWiring.test.ts ─ Root の先頭で `import '../i18n';`
 *   - homeActionsWiring.test.ts ─ HomeScreen が `<GameHomeHeader gameId="…" .../>` を
 *     ちょうど 1 回だけ描く
 *   - shareWiring.test.ts ─ 結果オーバーレイが `<ShareAction gameId="…" .../>` を持つ
 *   - refLeading.test.ts ─ GameContext の statsRef / sessionRef が
 *     「setState の直前で ref を進める」形になっている(下記 GameContext 生成部を参照)
 *   - gameBackButtonWiring.test.ts ─ GameContext が `backButton` リスナーを
 *     ちょうど 1 回、`if (!Capacitor.isNativePlatform()) return;` を先頭に置いた
 *     effect の中で登録し、`screen === 'home'` なら `exitToCollection()`、
 *     それ以外は自分の画面から抜け、cleanup で handle を外す
 *   - tutorialBackWiring.test.tsx ─ 初回起動は見出し「How to Play」(共有キー
 *     `howToPlay`)の Quick Rules 画面で始まり、閉じるボタンは完了後にしか出ない。
 *     そこからの Back は `completeTutorial()` を呼んでからホームへ戻り、
 *     flags が保存される(挙動で検査されるので、画面と context の両方が要る)
 *   - modalIsolationWiring.test.ts ─ `ui/screens/GameScreen.tsx` を全ゲームぶん
 *     読む(無いと ENOENT でスイート全体が落ちる)。ConfirmDialog / useGameKeys を
 *     持たない生成物は形の検査には掛からないが、`.game-content` に `inert` を
 *     置き、モーダルはその外に描く形で生成しておく
 *   - shortcutResumeWiring.test.ts ─ 保存スロットを持たないゲームは `entry` prop を
 *     宣言してはならない(宣言の形 `entry?: 'collection' | 'shortcut';` を行頭で
 *     検出する。散文で触れるのは可)。保存スロットを足した日に必要になる配線は
 *     生成する Root / GameContext のコメントに書いてある
 *   - playClockSeed.test.ts ─ `initialSession` を受け取る provider だけが対象。
 *     生成物は受け取らないので対象外(保存スロットを足すと対象になる)
 *   - pointerContractWiring.test.ts ─ 生成する画面は onClick しか聞かない
 *   - savedGameSlots.test.ts ─ 既定の保存キーは stats / flags のみで
 *     `dailyGame` を持たないので対象外
 *   - lifecycle.test.tsx ─ 生成したルートが登録するリスナー(visibilitychange と、
 *     native だけの pause / backButton)は effect の cleanup で全部外れる
 *   - resetLocalDataWiring.test.tsx ─ registry の `loadStorageSchemas` が
 *     `storage/schemas.ts` を返し、そこに `SchemaDef` 形の export が揃っている
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
  // The id appears in registry.ts only as a quoted literal (the GameId union
  // member and the entry's `id:`), so a plain substring check is exact — and
  // builds no RegExp from the command line (CodeQL: js/regex-injection).
  const registrySource = readFileSync(REGISTRY_PATH, 'utf8');
  if (registrySource.includes(`'${id}'`)) {
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

function gameContextFile({ pascal, prefix }) {
  return `/**
 * ${pascal}'s app context: a starting point generated by scripts/new-game.mjs.
 * It wires the shell's contract — records load, the three screens, the one
 * owner of the hardware Back button, a result worth sharing — so the next
 * step is writing the game, not the plumbing around it.
 *
 * The one placeholder round below exists only so the seams are real rather
 * than decorative: every context in this collection advances its ref
 * immediately before the matching setState call, because React batches one
 * task's updates and a second mutation in that task would otherwise read
 * what the first one just replaced (docs/ARCHITECTURE.md「状態と ref」,
 * src/test/refLeading.test.ts). Replace the round itself; keep the
 * ref-then-setState shape when you do.
 *
 * Nothing but statistics and flags survives a relaunch, and there is no
 * \`entry\` prop, on purpose: a game with no saved board has nothing a
 * home-screen shortcut could open onto, and src/test/shortcutResumeWiring.test.ts
 * holds a save-less game to that abstention (issue #113). The day
 * storage/keys.ts gets a \`${prefix}.save…\` slot — with storage/gamePersistence.ts
 * beside it — declare \`entry?: 'collection' | 'shortcut';\` on the provider
 * and the Root, pass it through as \`entry={entry}\`, decide once with
 * \`entry === 'shortcut'\`, seed the play clock from the mounted session
 * (src/test/playClockSeed.test.ts), and add a Root test that mounts with
 * \`entry="shortcut"\`.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { saveRecord } from '../../../storage/repo';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';

export type Screen = 'home' | 'tutorial' | 'game';

/** Stands in for "a round is in progress" — replace with the real session. */
export interface PlaceholderRound {
  readonly startedAt: number;
  readonly status: 'playing' | 'finished';
}

/** What the result overlay shows. Replace with the game's real outcome. */
export interface LastResult {
  readonly playedAt: number;
}

export interface ${pascal}ContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The round on screen, or null between rounds. */
  round: PlaceholderRound | null;
  stats: Stats;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Placeholder for "start a game": opens the game screen on a new round. */
  startPlaceholderRound: () => void;
  /** Placeholder for "the round ended": books it and raises the result. */
  finishPlaceholderRound: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
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
  // Quick Rules first, and only until they have been completed: this is the
  // screen \`tutorialCompleted\` decides on, and the tutorial's own last
  // button — or hardware Back, below — is what sets that flag.
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [round, setRound] = useState<PlaceholderRound | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(round);
  sessionRef.current = round;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a round can be booked and the next one started
    // inside one tap, and the second write reads this ref — a stale read
    // would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /** The one door the round goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: PlaceholderRound | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the round the first one already replaced.
    sessionRef.current = next;
    setRound(next);
  }, []);

  /**
   * The one seam the round on screen leaves through. Every way off the game
   * screen and every background (visibilitychange / pause) passes here, so no
   * exit can forget to save. Nothing is written yet — the scaffold keeps no
   * saved game. Once storage/keys.ts has a save slot, this is where the round
   * is saved with its play time merged in and booked into the statistics
   * (the \`syncActiveGame\` of any sibling with a \`gamePersistence.ts\`).
   */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    // Save \`current\` here once there is a slot to save it to.
  }, []);

  const startPlaceholderRound = useCallback(() => {
    // Counted when it starts, as every game here does: a round the player
    // walks away from was still played.
    persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
    setLastResult(null);
    putSession({ startedAt: Date.now(), status: 'playing' });
    setScreen('game');
  }, [persistStats, putSession]);

  const finishPlaceholderRound = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    putSession({ ...current, status: 'finished' });
    setLastResult({ playedAt: Date.now() });
  }, [putSession]);

  const goHome = useCallback(() => {
    syncActiveGame();
    // A placeholder round is not resumable: leaving the screen ends it. Once
    // the round is saved, keep it here instead so the home can offer Resume.
    putSession(null);
    setScreen('home');
  }, [putSession, syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Sync when the app goes to background / gets hidden: the OS can kill a
  // backgrounded app without sending another event, so whatever this seam
  // has saved by then is all the next launch gets back.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection. Registered once, on native only, and the
  // handle goes with the effect: Capacitor delivers the event to every
  // listener ever registered, so a second owner would minimize the app under
  // whatever screen the first one just closed
  // (docs/ARCHITECTURE.md「ハードウェア戻るボタン」, src/test/gameBackButtonWiring.test.ts).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142):
        // otherwise this game opens on the tutorial on every launch
        // (src/test/tutorialBackWiring.test.tsx).
        if (screen === 'tutorial') completeTutorial();
        goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome, completeTutorial]);

  const value = useMemo<${pascal}ContextValue>(
    () => ({
      screen,
      navigate,
      round,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      startPlaceholderRound,
      finishPlaceholderRound,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      round,
      stats,
      flags.tutorialCompleted,
      lastResult,
      startPlaceholderRound,
      finishPlaceholderRound,
      goHome,
      exitToCollection,
      completeTutorial,
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

function rootFile({ id, pascal, prefix }) {
  return `/**
 * ${pascal}'s root: loads the game's own records (local, fast, offline), then
 * mounts the provider and routes its screens. The shell knows nothing beyond
 * this component and the storage keys; unmounting stops all of the game's
 * work (docs/GAME_LIFECYCLE.md).
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
import { ${pascal}Provider, use${pascal} } from '../state/GameContext';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import './${id}.css';
import { ${pascal}GameScreen } from './screens/GameScreen';
import { ${pascal}HomeScreen } from './screens/HomeScreen';
import { ${pascal}TutorialScreen } from './screens/TutorialScreen';

export function ${pascal}Screens() {
  const { screen } = use${pascal}();
  switch (screen) {
    case 'tutorial':
      return <${pascal}TutorialScreen />;
    case 'game':
      return <${pascal}GameScreen />;
    case 'home':
    default:
      return <${pascal}HomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
}

/**
 * What the shell hands a root (app/registry.ts \`GameRootProps\`). No \`entry\`
 * prop, deliberately: there is no saved game for a home-screen shortcut to
 * open onto, and src/test/shortcutResumeWiring.test.ts holds a save-less game
 * to that (issue #113). When a \`${prefix}.save…\` slot arrives, declare it
 * here, hand it to the provider as \`entry={entry}\`, and let the provider
 * decide (state/GameContext.tsx).
 */
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
      <${pascal}Screens />
    </${pascal}Provider>
  );
}
`;
}

function cssFile({ pascal, cssPrefix }) {
  return `/**
 * ${pascal}'s styles — scaffolded by scripts/new-game.mjs. The shared shell
 * classes (.screen, .home-hero, .game-content, .game-topbar, .tutorial-card,
 * .btn, .dialog, ...) already cover the frame; the board and everything else
 * the game itself draws go here, under the game's own \`${cssPrefix}-\` prefix.
 */

/* Placeholder board area — replace with the real board's layout. */
.${cssPrefix}-board {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
`;
}

function homeScreenFile({ id, pascal, camel, glyph }) {
  return `/**
 * ${pascal}'s home (scaffolded by scripts/new-game.mjs): the shared header,
 * the hero, one demo action that opens the game screen, and the way into
 * Quick Rules. The hero and the mode buttons are this game's own to shape
 * (docs/ARCHITECTURE.md「シェルの枠とゲームの中身」); the header is the shell's.
 */
import { useSettings } from '@/state/SettingsContext';
import { GameHomeHeader } from '@/ui/components/GameHomeHeader';
import { use${pascal} } from '../../state/GameContext';

export function ${pascal}HomeScreen() {
  const { stats, navigate, startPlaceholderRound, exitToCollection } = use${pascal}();
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
        {/* Scaffold placeholder — replace with the real game entry point(s). */}
        <button type="button" className="btn btn-primary btn-big" onClick={startPlaceholderRound}>
          {t('${camel}PlayPlaceholder')}
          {stats.played > 0 ? <span className="btn-note">{stats.played}</span> : null}
        </button>

        <div className="home-links">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('tutorial')}>
            {t('howToPlay')}
          </button>
        </div>
      </div>
    </div>
  );
}
`;
}

function gameScreenFile({ pascal, camel, cssPrefix }) {
  return `/**
 * ${pascal}'s game screen (scaffolded by scripts/new-game.mjs): the shell's
 * frame — the way home, the one banner, the result overlay — around a board
 * that does not exist yet. Two rules the frame already keeps, and a new
 * board must keep with it:
 *
 * - While anything modal is up, \`.game-content\` is \`inert\`
 *   (docs/ARCHITECTURE.md「モーダルの間、盤面は inert」): the result overlay
 *   is the one flag today; a ConfirmDialog's \`open\` flag joins the same
 *   expression, and the dialog renders after \`.game-content\`, never inside
 *   it. \`useGameKeys\`, when added, takes an explicit \`enabled\` argument
 *   that goes false on the same flags (src/test/modalIsolationWiring.test.ts).
 * - A board element that hears \`onPointerUp\` also hears \`onPointerCancel\`
 *   (src/test/pointerContractWiring.test.ts, issue #169).
 */
import { useSettings } from '@/state/SettingsContext';
import { BannerSlot } from '@/ui/components/BannerSlot';
import { IconBack } from '@/ui/components/icons';
import { use${pascal} } from '../../state/GameContext';
import { ${pascal}ResultOverlay } from '../components/ResultOverlay';

export function ${pascal}GameScreen() {
  const { round, lastResult, finishPlaceholderRound, goHome } = use${pascal}();
  const { t } = useSettings();

  if (!round) return null;

  const finished = round.status === 'finished';

  return (
    <div className="screen game-screen">
      <div className="game-content" inert={finished}>
        <header className="game-topbar">
          <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={goHome}>
            <IconBack />
          </button>
          <span className="game-mode">{t('${camel}Name')}</span>
          {/* Keeps the title centred until a retry or hint button takes this slot. */}
          <span aria-hidden="true" />
        </header>

        {/* Scaffold placeholder — the board goes here. */}
        <div className="${cssPrefix}-board">
          <button type="button" className="btn btn-secondary" onClick={finishPlaceholderRound}>
            {t('${camel}FinishPlaceholder')}
          </button>
        </div>

        <BannerSlot />
      </div>

      <${pascal}ResultOverlay result={lastResult} onDismiss={goHome} />
    </div>
  );
}
`;
}

function tutorialScreenFile({ id, pascal, camel, idUpper }) {
  return `/**
 * Quick Rules (docs/${idUpper}_RULES.md): at most three steps, one sentence
 * each, leading straight into play (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」).
 * Scaffolded by scripts/new-game.mjs with three placeholder steps: write the
 * real ones from the rule doc, and give each a figure that shows a position
 * the game could actually be in.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared \`howToPlay\` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx). The
 * long-form rules live on the game's landing page behind "Learn More", which
 * is absent until the page exists (ui/landing.ts) and quietly does nothing
 * offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { use${pascal} } from '../../state/GameContext';

export function ${pascal}TutorialScreen() {
  const { tutorialCompleted, completeTutorial, startPlaceholderRound, goHome } = use${pascal}();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('${id}', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('${camel}Step1Title'), body: t('${camel}Step1Body') },
    { title: t('${camel}Step2Title'), body: t('${camel}Step2Body') },
    { title: t('${camel}Step3Title'), body: t('${camel}Step3Body') },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startPlaceholderRound();
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={\`dot \${index === step ? 'dot-active' : ''}\`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-body">{current.body}</p>
      </div>

      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {lastStep ? (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        )}
      </div>

      {learnMoreUrl ? (
        <div className="home-links">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openExternal(learnMoreUrl)}
          >
            {t('learnMore')}
          </button>
        </div>
      ) : null}
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

/** The strings this scaffold's placeholder screens actually render. Everything
 * else (the tutorial heading, Next / Back / Close / Start Playing, the result
 * dialog's Home button, Learn More) is a shared shell key (`howToPlay`,
 * `next`, `backHome`, ...). */
function catalogEntries({ camel, title }) {
  return {
    [`${camel}Name`]: title,
    [`${camel}PlayPlaceholder`]: 'Play a sample round',
    [`${camel}FinishPlaceholder`]: 'Finish the sample round',
    [`${camel}Step1Title`]: 'Step 1',
    [`${camel}Step1Body`]: 'Placeholder. The first of at most three steps.',
    [`${camel}Step2Title`]: 'Step 2',
    [`${camel}Step2Body`]: 'Placeholder. What the player does next.',
    [`${camel}Step3Title`]: 'Step 3',
    [`${camel}Step3Body`]: 'Placeholder. How a round ends.',
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
    `    loadStorageSchemas: () => import('../games/${id}/storage/schemas'),`,
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
  // A CSS class cannot start with a digit; `2048` would need `.game2048-…`.
  const cssPrefix = /^[a-z]/.test(id) ? id : camel;
  const ctx = {
    id,
    prefix,
    prefixUpper,
    pascal,
    camel,
    title,
    category,
    glyph,
    idUpper,
    cssPrefix,
  };

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
    { path: join(gameRoot, 'ui/screens/TutorialScreen.tsx'), content: tutorialScreenFile(ctx) },
    { path: join(gameRoot, 'ui/screens/GameScreen.tsx'), content: gameScreenFile(ctx) },
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
  console.log(`  - replace the three Quick Rules placeholder steps (i18n *Step1..3Title/Body)`);
  console.log('  - add the game to ui/landing.ts PUBLISHED_GAME_IDS once its guide is deployed');
  console.log('  - run `pnpm size:update` before committing (size-baseline.json)');
  console.log('  - update the game count in README.md');
}

main();
