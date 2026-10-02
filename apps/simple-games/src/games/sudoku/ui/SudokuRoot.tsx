/**
 * Sudoku's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 */
// Register this game's 14-locale catalog the moment the chunk loads,
// before anything below renders (issue #38, src/i18n/registry.ts).
import '../i18n';
import { useSettings } from '../../../state/SettingsContext';
import type { KVStore } from '../../../storage/kv';
import { preferencesKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import { IconBack } from '../../../ui/components/icons';
import { useLoadedRecords } from '../../../ui/useLoadedRecords';
import { SUDOKU_CHALLENGE } from '../challenge/contract';
import { boardDigestOf, createClubSession, type Difficulty, type SudokuSession } from '../game';
import { SudokuProvider, useSudoku } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { SudokuDailyScreen } from './screens/DailyScreen';
import { SudokuGameScreen } from './screens/GameScreen';
import { SudokuHomeScreen } from './screens/HomeScreen';
import { SudokuLevelSelectScreen } from './screens/LevelSelectScreen';
import { SudokuStatsScreen } from './screens/StatsScreen';
import { SudokuTutorialScreen } from './screens/TutorialScreen';
import './sudoku.css';

export function SudokuScreens() {
  const { screen } = useSudoku();
  switch (screen) {
    case 'tutorial':
      return <SudokuTutorialScreen />;
    case 'levels':
      return <SudokuLevelSelectScreen />;
    case 'daily':
      return <SudokuDailyScreen />;
    case 'game':
      return <SudokuGameScreen />;
    case 'stats':
      return <SudokuStatsScreen />;
    case 'home':
    default:
      return <SudokuHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
  prefs: Prefs;
  sessions: SavedGames;
  /** What the challenge this launch carries turned out to be (§15). */
  challenge: ChallengeOpening;
}

/**
 * A Club House challenge as the shell hands it over (app/registry.ts
 * `ChallengeStart`, docs/architecture/club.md §6-2). Declared here rather
 * than imported, like `onExit`; `loadRoot` is what checks the two agree.
 */
export interface SudokuChallengeStart {
  seed: string;
  params: unknown;
  boardDigest: string;
}

type ChallengeOpening =
  { kind: 'none' } | { kind: 'play'; session: SudokuSession } | { kind: 'mismatch' };

/**
 * The board a challenge names (§15): the suspended one when it is the same
 * challenge, otherwise a fresh one from its seed and tier — and either way
 * only if it is the board the challenge was made on. A digest that differs
 * means this version's generator builds another grid from the same inputs;
 * playing it would compare two different puzzles, so it is not played.
 */
export function openChallenge(
  challenge: SudokuChallengeStart | undefined,
  saved: SudokuSession | null,
): ChallengeOpening {
  if (challenge === undefined) return { kind: 'none' };
  const params = SUDOKU_CHALLENGE.validateParams(challenge.params);
  if (params === null) return { kind: 'mismatch' };
  const difficulty = params.difficulty as Difficulty;
  try {
    const session =
      saved !== null &&
      saved.status === 'playing' &&
      saved.seed === challenge.seed &&
      saved.difficulty === difficulty
        ? saved
        : createClubSession({ difficulty }, challenge.seed);
    return boardDigestOf(session) === challenge.boardDigest
      ? { kind: 'play', session }
      : { kind: 'mismatch' };
  } catch {
    return { kind: 'mismatch' };
  }
}

/** The one line a challenge from another version gets, and the way back. */
function SudokuChallengeMismatch({ onExit }: { onExit: () => void }) {
  const { t } = useSettings();
  return (
    <div className="screen">
      <header className="screen-header">
        <button type="button" className="icon-btn" aria-label={t('backHome')} onClick={onExit}>
          <IconBack />
        </button>
        <h1>{t('clubEntry')}</h1>
        <span className="icon-btn-placeholder" />
      </header>
      <p className="dialog-body" role="status">
        {t('sudokuChallengeMismatch')}
      </p>
    </div>
  );
}

export interface SudokuRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is the provider's
   * answer, taken once from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** A Club House challenge to open onto (§15); never touches the statistics. */
  challenge?: SudokuChallengeStart;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

/** The challenge's board, put in the club slot it will be played and saved in. */
function withChallenge(
  sessions: SavedGames,
  challenge: SudokuChallengeStart | undefined,
): { sessions: SavedGames; challenge: ChallengeOpening } {
  const opening = openChallenge(challenge, sessions.club);
  return {
    sessions: opening.kind === 'play' ? { ...sessions, club: opening.session } : sessions,
    challenge: opening,
  };
}

function defaultRecords(challenge?: SudokuChallengeStart): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    progress: progressSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    ...withChallenge({ level: null, daily: null, free: null, club: null }, challenge),
  };
}

async function loadRecords(kv: KVStore, challenge?: SudokuChallengeStart): Promise<LoadedData> {
  const [stats, flags, progress, prefs, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(progressSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, progress, prefs, ...withChallenge(sessions, challenge) };
}

export function SudokuRoot({ onExit, entry, challenge, kv = preferencesKV }: SudokuRootProps) {
  const data = useLoadedRecords(
    kv,
    (store) => loadRecords(store, challenge),
    () => defaultRecords(challenge),
  );
  if (data === null) return null;
  if (data.challenge.kind === 'mismatch') return <SudokuChallengeMismatch onExit={onExit} />;

  return (
    <SudokuProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialSessions={data.sessions}
      prefs={data.prefs}
      onExit={onExit}
      entry={entry}
      openOnChallenge={data.challenge.kind === 'play'}
    >
      <SudokuScreens />
    </SudokuProvider>
  );
}
