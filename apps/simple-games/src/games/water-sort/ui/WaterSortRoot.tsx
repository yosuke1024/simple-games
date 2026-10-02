/**
 * Water Sort's root: loads the game's own records (local, fast, offline),
 * then mounts the provider and screens. The shell knows nothing beyond this
 * component and the storage keys; unmounting stops all of the game's work
 * (battery: an off-screen game renders nothing).
 *
 * The game's stylesheet is imported here rather than from the shell, so the
 * whole title — logic, screens, and looks — lives inside this one folder.
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
import { WATER_SORT_CHALLENGE } from '../challenge/contract';
import { boardDigestOf, createClubSession, type FreeTier, type WaterSession } from '../game';
import { useWaterSort, WaterProvider } from '../state/GameContext';
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
import './water-sort.css';
import { WaterDailyScreen } from './screens/DailyScreen';
import { WaterGameScreen } from './screens/GameScreen';
import { WaterHomeScreen } from './screens/HomeScreen';
import { WaterLevelSelectScreen } from './screens/LevelSelectScreen';
import { WaterStatsScreen } from './screens/StatsScreen';
import { WaterTutorialScreen } from './screens/TutorialScreen';

export function WaterScreens() {
  const { screen } = useWaterSort();
  switch (screen) {
    case 'tutorial':
      return <WaterTutorialScreen />;
    case 'levels':
      return <WaterLevelSelectScreen />;
    case 'daily':
      return <WaterDailyScreen />;
    case 'game':
      return <WaterGameScreen />;
    case 'stats':
      return <WaterStatsScreen />;
    case 'home':
    default:
      return <WaterHomeScreen />;
  }
}

interface LoadedData {
  stats: Stats;
  flags: Flags;
  progress: Progress;
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
export interface WaterSortChallengeStart {
  seed: string;
  params: unknown;
  boardDigest: string;
}

type ChallengeOpening =
  { kind: 'none' } | { kind: 'play'; session: WaterSession } | { kind: 'mismatch' };

/**
 * The board a challenge names (§14): the suspended one when it is the same
 * challenge, otherwise a fresh deal from its seed and tier — and either way
 * only if it is the deal the challenge was made on. A digest that differs
 * means this version deals other tubes from the same inputs; playing them
 * would compare two different boards, so they are not played.
 */
export function openChallenge(
  challenge: WaterSortChallengeStart | undefined,
  saved: WaterSession | null,
): ChallengeOpening {
  if (challenge === undefined) return { kind: 'none' };
  const params = WATER_SORT_CHALLENGE.validateParams(challenge.params);
  if (params === null) return { kind: 'mismatch' };
  const tier = params.tier as FreeTier;
  try {
    const session =
      saved !== null &&
      saved.status === 'playing' &&
      saved.seed === challenge.seed &&
      saved.freeTier === tier
        ? saved
        : createClubSession({ tier }, challenge.seed);
    return boardDigestOf(session) === challenge.boardDigest
      ? { kind: 'play', session }
      : { kind: 'mismatch' };
  } catch {
    return { kind: 'mismatch' };
  }
}

/** The one line a challenge from another version gets, and the way back. */
function WaterChallengeMismatch({ onExit }: { onExit: () => void }) {
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
        {t('waterChallengeMismatch')}
      </p>
    </div>
  );
}

export interface WaterSortRootProps {
  /** Hands control back to the collection home. */
  onExit: () => void;
  /**
   * Which door the shell opened this game through (app/registry.ts, issue
   * #113). Passed straight through: what a door means is the provider's
   * answer, taken once from the records loaded below.
   */
  entry?: 'collection' | 'shortcut';
  /** A Club House challenge to open onto (§14); never touches the statistics. */
  challenge?: WaterSortChallengeStart;
  /** Test seam; production always uses the device store. */
  kv?: KVStore;
}

/** The challenge's board, put in the club slot it will be played and saved in. */
function withChallenge(
  sessions: SavedGames,
  challenge: WaterSortChallengeStart | undefined,
): { sessions: SavedGames; challenge: ChallengeOpening } {
  const opening = openChallenge(challenge, sessions.club);
  return {
    sessions: opening.kind === 'play' ? { ...sessions, club: opening.session } : sessions,
    challenge: opening,
  };
}

function defaultRecords(challenge?: WaterSortChallengeStart): LoadedData {
  return {
    stats: statsSchema.defaultValue(),
    flags: flagsSchema.defaultValue(),
    progress: progressSchema.defaultValue(),
    prefs: prefsSchema.defaultValue(),
    ...withChallenge({ level: null, daily: null, free: null, club: null }, challenge),
  };
}

async function loadRecords(kv: KVStore, challenge?: WaterSortChallengeStart): Promise<LoadedData> {
  const [stats, flags, progress, prefs, sessions] = await Promise.all([
    loadRecord(statsSchema, kv),
    loadRecord(flagsSchema, kv),
    loadRecord(progressSchema, kv),
    loadRecord(prefsSchema, kv),
    loadSavedGames(kv),
  ]);
  return { stats, flags, progress, prefs, ...withChallenge(sessions, challenge) };
}

export function WaterSortRoot({
  onExit,
  entry,
  challenge,
  kv = preferencesKV,
}: WaterSortRootProps) {
  const data = useLoadedRecords(
    kv,
    (store) => loadRecords(store, challenge),
    () => defaultRecords(challenge),
  );
  if (data === null) return null;
  if (data.challenge.kind === 'mismatch') return <WaterChallengeMismatch onExit={onExit} />;

  return (
    <WaterProvider
      initialStats={data.stats}
      initialFlags={data.flags}
      initialProgress={data.progress}
      initialPrefs={data.prefs}
      initialSessions={data.sessions}
      onExit={onExit}
      entry={entry}
      openOnChallenge={data.challenge.kind === 'play'}
    >
      <WaterScreens />
    </WaterProvider>
  );
}
