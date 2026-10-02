/**
 * Minesweeper's root: loads the game's own records (local, fast, offline), then
 * mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than added to the shared one,
 * so everything Minesweeper looks like arrives and leaves with Minesweeper.
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
import { MINESWEEPER_CHALLENGE } from '../challenge/contract';
import {
  boardDigestOf,
  createClubSession,
  type Difficulty,
  type MinesweeperSession,
} from '../game';
import { MinesweeperProvider, useMinesweeper } from '../state/GameContext';
import { loadSavedGames, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { MinesGameScreen } from './screens/GameScreen';
import { MinesHomeScreen } from './screens/HomeScreen';
import { MinesStatsScreen } from './screens/StatsScreen';
import { MinesTutorialScreen } from './screens/TutorialScreen';
import './minesweeper.css';

export function MinesweeperScreens() {
  const { screen } = useMinesweeper();
  switch (screen) {
    case 'tutorial':
      return <MinesTutorialScreen />;
    case 'game':
      return <MinesGameScreen />;
    case 'stats':
      return <MinesStatsScreen />;
    case 'home':
    default:
      return <MinesHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  prefs: Prefs;
  sessions: SavedGames;
  /** What the challenge this launch carries turned out to be (§14). */
  challenge: ChallengeOpening;
}

/**
 * A Club House challenge as the shell hands it over (app/registry.ts
 * `ChallengeStart`, docs/architecture/club.md §6-2). Declared here rather
 * than imported, like `onExit`; `loadRoot` is what checks the two agree.
 */
export interface MinesweeperChallengeStart {
  seed: string;
  params: unknown;
  boardDigest: string;
}

type ChallengeOpening =
  { kind: 'none' } | { kind: 'play'; session: MinesweeperSession } | { kind: 'mismatch' };

/**
 * The board a challenge names (§14): the suspended one when it is the same
 * challenge, otherwise a fresh one from its seed, tier and first cell — and
 * either way only if its mines are where the challenge's were. A digest that
 * differs means this version lays other mines from the same inputs; playing
 * it would compare two different minefields, so it is not played.
 */
export function openChallenge(
  challenge: MinesweeperChallengeStart | undefined,
  saved: MinesweeperSession | null,
): ChallengeOpening {
  if (challenge === undefined) return { kind: 'none' };
  const params = MINESWEEPER_CHALLENGE.validateParams(challenge.params);
  if (params === null) return { kind: 'mismatch' };
  const difficulty = params.difficulty as Difficulty;
  const firstIndex = params.firstIndex as number;
  try {
    const session =
      saved !== null &&
      saved.status === 'playing' &&
      saved.seed === challenge.seed &&
      saved.difficulty === difficulty &&
      saved.firstIndex === firstIndex
        ? saved
        : createClubSession({ difficulty, firstIndex }, challenge.seed);
    return boardDigestOf(session) === challenge.boardDigest
      ? { kind: 'play', session }
      : { kind: 'mismatch' };
  } catch {
    // A first cell outside this tier's board: not a board this game can build.
    return { kind: 'mismatch' };
  }
}

/** The one line a challenge from another version gets, and the way back. */
function MinesChallengeMismatch({ onExit }: { onExit: () => void }) {
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
        {t('minesChallengeMismatch')}
      </p>
    </div>
  );
}

export interface MinesweeperRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is the provider's
   * answer, taken once from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** A Club House challenge to open onto (§14); never touches the statistics. */
  challenge?: MinesweeperChallengeStart;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

/** The challenge's board, put in the club slot it will be played and saved in. */
function withChallenge(
  sessions: SavedGames,
  challenge: MinesweeperChallengeStart | undefined,
): { sessions: SavedGames; challenge: ChallengeOpening } {
  const opening = openChallenge(challenge, sessions.club);
  return {
    sessions: opening.kind === 'play' ? { ...sessions, club: opening.session } : sessions,
    challenge: opening,
  };
}

function defaultRecords(challenge?: MinesweeperChallengeStart): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    ...withChallenge({ difficulty: null, daily: null, club: null }, challenge),
  };
}

async function loadRecords(
  kv: KVStore,
  challenge?: MinesweeperChallengeStart,
): Promise<LoadedData> {
  const [stats, flags, prefs, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, prefs, ...withChallenge(sessions, challenge) };
}

export function MinesweeperRoot({
  onExit,
  entry,
  challenge,
  kv = preferencesKV,
}: MinesweeperRootProps) {
  const data = useLoadedRecords(
    kv,
    (store) => loadRecords(store, challenge),
    () => defaultRecords(challenge),
  );
  if (data === null) return null;
  if (data.challenge.kind === 'mismatch') return <MinesChallengeMismatch onExit={onExit} />;

  return (
    <MinesweeperProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
      openOnChallenge={data.challenge.kind === 'play'}
    >
      <MinesweeperScreens />
    </MinesweeperProvider>
  );
}
