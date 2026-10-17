/**
 * Bridges' app context: screens, the active session, statistics, its own
 * preference, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Two games are suspended independently — one difficulty game, one daily (§8,
 * §10) — so switching modes never costs the player either one.
 *
 * Which island is selected is not here: it is the game screen's, because it is
 * a gesture in progress rather than part of the game. Nothing about it is
 * saved, and a new board starts with nothing selected.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§11); elapsed time is merged into the session whenever
 * it leaves this module (saves, finalization, navigation).
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
import { recordGameCompleted } from '../../../services/review';
import { saveRecord } from '../../../storage/repo';
import {
  createDailySession,
  createDifficultySession,
  doConnect,
  doHintUse,
  doUndo,
  edgeBetween,
  hintFor,
  localDateString,
  restartSession,
  withElapsedSeconds,
  type BridgesSession,
  type Difficulty,
  type GameMode,
  type Hint,
} from '../game';
import {
  clearSavedGame,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  bucketOf,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

export interface LastResult {
  readonly seconds: number;
  readonly hints: number;
  /** True when this clear beat the time the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat after this clear. */
  readonly bestSeconds: number;
  /** The record before this run, or null on a first clear (§11). */
  readonly previousBestSeconds: number | null;
}

/** What one step (or its undo) did to one pair (§4, §9). */
export interface BridgeStep {
  /** The pair's edge (§2). */
  readonly edge: number;
  readonly before: number;
  readonly after: number;
}

export interface BridgesContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: BridgesSession | null;
  sessions: SavedGames;
  stats: Stats;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a game comes on screen (new, retried or resumed). */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startDifficulty: (difficulty: Difficulty) => void;
  startNewBoard: (difficulty: Difficulty) => void;
  startDaily: () => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /**
   * One step of the 0 → 1 → 2 → 0 cycle between two islands (§4). Returns
   * the bridges on that pair before and after the step, or null when nothing
   * changed — the two do not see each other, the way is blocked, or the
   * board is finished. Both counts are read from the session the step was
   * applied to, never from a render's copy: two steps in one task each see
   * the one before.
   */
  connect: (a: number, b: number) => BridgeStep | null;
  /**
   * Takes back the last step (§9): the pair it changed back, with the bridges
   * on it before and after, or null when there is no step to take back.
   */
  applyUndo: () => BridgeStep | null;
  takeHint: () => Hint | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const BridgesContext = createContext<BridgesContextValue | null>(null);

export interface BridgesProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/**
 * The mode a freshly mounted game is pointed at when nothing is resumed.
 * Named because the play-clock baseline has to be read from the same slot.
 */
const INITIAL_MODE: GameMode = 'difficulty';

export function BridgesProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: BridgesProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * save made later can change that.
   *
   * Only a home-screen shortcut asks, and only once Quick Rules are behind the
   * player — a first launch teaches the game before it shows a board (§12),
   * and that order does not have an exception.
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /**
   * The slot this mount is pointed at: the one a shortcut opened straight
   * onto (issue #113), or the one the home screen starts on. Named once and
   * read by both the active mode and the clock seed below, because a mode
   * taken from one slot and a clock taken from another is the whole trap.
   */
  const mountedMode = resumeMode ?? INITIAL_MODE;
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>(mountedMode);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const session = sessions[activeMode];

  /**
   * The seconds the game on that slot already carries. Read from the slot
   * itself rather than gated on the resume: a launch that stops on the
   * game's own home reaches `syncActiveGame` too, and from a zero baseline
   * that saves `elapsedSeconds: 0` over the suspended board (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   *
   * Starts on the mounted game rather than at zero, because every save merges
   * this ref into the session and `syncActiveGame` runs on any background,
   * not only from the game screen. `activate` re-establishes the baseline
   * whenever a game comes on screen; this line covers the mount before that.
   */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this session.
   *
   * The same baseline, and it has to be: a suspended game arrives with its
   * seconds already in `totalPlaySeconds` — they were booked by the sync
   * that saved it. Seeding the clock alone would book its whole elapsed
   * time a second time. The two are one invariant; neither moves without
   * the other.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: BridgesSession): BridgesSession => withElapsedSeconds(s, elapsedRef.current),
    [],
  );

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state, for the reason putSession's does below: a run
    // can be booked and the next one started inside one tap, and the second
    // write reads this ref — a stale read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: BridgesSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    // A drag's release and a tap can land in one task, and the second must
    // read the first.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: BridgesSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice. The session
      // refuses every move once solved (§3), so this branch runs once a board.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const played = applyPlayTime(statsRef.current, bucketOf(next), unbooked);
      // Read before the record moves: what this clear is measured against.
      const previousBestSeconds = previousBestFor(played, next);
      recordGameCompleted();
      const outcome = applySolved(played, next);
      persistStats(outcome.stats);
      setLastResult({
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
        isNewBest: outcome.isNewBest,
        bestSeconds: outcome.bestSeconds,
        previousBestSeconds,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: BridgesSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: BridgesSession) => {
      persistStats(applyGameStart(statsRef.current, bucketOf(next)));
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, persistStats, putSession],
  );

  const canResume = useCallback(
    (mode: GameMode) => sessionsRef.current[mode]?.status === 'playing',
    [],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current) activate(current);
    },
    [activate],
  );

  /** Remembers the difficulty the home screen should lead with (§8). */
  const rememberDifficulty = useCallback((difficulty: Difficulty) => {
    if (prefsRef.current.difficulty === difficulty) return;
    const next: Prefs = { ...prefsRef.current, difficulty };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * Starts (or resumes) a difficulty game. Choosing the difficulty already in
   * progress picks it back up; choosing another one replaces that slot, which
   * is why the home screen asks first (§10).
   */
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      const current = sessionsRef.current.difficulty;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('difficulty');
        return;
      }
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, rememberDifficulty, resumeGame],
  );

  /**
   * A fresh board at this difficulty even while one is in progress — the
   * second answer of the ↻ dialog and of the result card
   * (ui/components/RestartDialog.tsx). `startDifficulty` above resumes a
   * board in progress, which is right for the home; here replacing it is the
   * point.
   */
  const startNewBoard = useCallback(
    (difficulty: Difficulty) => {
      rememberDifficulty(difficulty);
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, rememberDifficulty],
  );

  const startDaily = useCallback(() => {
    const target = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === target && current.status === 'playing') {
      resumeGame('daily');
      return;
    }
    beginSession(createDailySession(target));
  }, [beginSession, resumeGame]);

  /**
   * The same board again, free and immediate — no bridges, no hints, the
   * clock at zero (§8). Rebuilt from the board on screen, not the seed.
   */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /**
   * Applies a pure session transition to the game on screen. Hands back the
   * session it started from (read from the ref, so the latest) with the one
   * it made.
   */
  const mutate = useCallback(
    (
      apply: (s: BridgesSession) => BridgesSession | null,
    ): { readonly from: BridgesSession; readonly to: BridgesSession } | null => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return null;
      const next = apply(withElapsed(current));
      if (!next) return null;
      commitSession(next);
      return { from: current, to: next };
    },
    [commitSession, withElapsed],
  );

  const connect = useCallback(
    (a: number, b: number): BridgeStep | null => {
      const change = mutate((s) => doConnect(s, a, b));
      if (change === null) return null;
      const edge = edgeBetween(change.to.graph, a, b);
      return {
        edge,
        before: change.from.bridges[edge] ?? 0,
        after: change.to.bridges[edge] ?? 0,
      };
    },
    [mutate],
  );

  const applyUndo = useCallback((): BridgeStep | null => {
    const change = mutate((s) => doUndo(s));
    if (change === null) return null;
    // One step changes one pair (a tap that changes nothing is never
    // recorded), so its undo changes that pair back. -1 would mean a history
    // entry equal to the board, which no step leaves.
    const { bridges: before } = change.from;
    const { bridges: after } = change.to;
    const edge = after.findIndex((count, id) => count !== before[id]);
    return { edge, before: before[edge] ?? 0, after: after[edge] ?? 0 };
  }, [mutate]);

  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const hint = hintFor(current);
    if (!hint) return null;
    const next = doHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return hint;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      const unbooked = Math.max(0, synced.elapsedSeconds - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current = synced.elapsedSeconds;
        persistStats(applyPlayTime(statsRef.current, bucketOf(synced), unbooked));
      }
    }
  }, [persistStats, putSession, withElapsed]);

  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);

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

  // Play clock: one second at a time while the game screen is visible.
  // Mutates the ref only — zero React work per tick (battery).
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // Save when the app goes to background / gets hidden (§10). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Saving the board
  // alone here would drop every play second since the last sync for good.
  // Coming back changes nothing by itself: the clock only counts while the
  // page is visible, and no move is made until the player makes one.
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
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const today = localDateString(new Date());
  const value = useMemo<BridgesContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      prefs,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyTimes[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startDifficulty,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      connect,
      applyUndo,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      prefs,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startDifficulty,
      startNewBoard,
      startDaily,
      restartCurrent,
      resumeGame,
      connect,
      applyUndo,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <BridgesContext.Provider value={value}>{children}</BridgesContext.Provider>;
}

export function useBridges(): BridgesContextValue {
  const value = useContext(BridgesContext);
  if (!value) throw new Error('useBridges must be used inside BridgesProvider');
  return value;
}
