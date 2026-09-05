/**
 * Number Match's app context: screens, the active game session, statistics,
 * level progress, and persistence hooks. Pure local state — there is no
 * analytics and no ad orchestration here; the only ad surface is the shared
 * BannerSlot the game screen renders.
 *
 * Three games are suspended independently — one level, one daily, one free
 * board (docs §14) — so switching modes never costs the player any of them.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (docs §15); elapsed time is merged into the session
 * whenever it leaves this module (saves, finalization, navigation).
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
  countHintUse,
  createDailySession,
  createFreeSession,
  createLevelSession,
  findHint,
  localDateString,
  matchPair,
  MAX_LEVEL,
  performAddNumbers,
  restartSession,
  undo,
  type FreeTier,
  type GameMode,
  type GameSession,
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
  progressSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { applyClearToProgress, previousBestFor } from './progressLogic';
import { applyGameEnd, applyGameStart } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  isNewBest: boolean;
  bestScore: number;
  /** The board's record before this run, or null on its first clear (§12). */
  previousBestScore: number | null;
}

export interface AppContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The game currently on screen. */
  session: GameSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  /** Set when the current session cleared; used by the result overlay. */
  lastResult: LastResult | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  /** Whether that mode has a game worth resuming. */
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  /** A fresh free board at the picker's tier — or the one given (§11). */
  startFree: (tier?: FreeTier) => void;
  /** Where the Free Play picker stands; remembered across launches. */
  freeTier: FreeTier;
  setFreeTier: (tier: FreeTier) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  applyPair: (i: number, j: number) => boolean;
  applyUndo: () => boolean;
  applyAdd: () => boolean;
  takeHint: () => readonly [number, number] | null;
  goHome: () => void;
  /** Leaves Number Match for the collection home (game state is saved). */
  exitToCollection: () => void;
  completeTutorial: () => void;
  /** Which one-time explanations are still owed to the player (§16). */
  flags: Flags;
  /** Records that a one-time explanation has been shown. */
  markIntroSeen: (flag: 'wildIntroSeen' | 'stoneIntroSeen') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export interface AppProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
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
const INITIAL_MODE: GameMode = 'level';

export function AppProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: AppProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened, and no
   * save made later can change that.
   *
   * Only a home-screen shortcut asks, and only once the tutorial is behind
   * the player — a first launch teaches the three steps before it shows a
   * board (spec §17), and a shortcut is not a way past them.
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
  // Resume, or exactly what this line has always said. `resumeMode` already
  // answers null until the tutorial is behind the player, so the gate is in
  // one place rather than two — two would each cover for the other, and a
  // guard nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  // The slot the board reads through (`sessions[activeMode]` below). A resume
  // that left this on 'level' while the suspended game is the daily or a free
  // board would render nothing at all — GameScreen has no session to draw.
  const [activeMode, setActiveMode] = useState<GameMode>(mountedMode);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [freeTier, setFreeTierState] = useState<FreeTier>(initialPrefs.freeTier);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const freeTierRef = useRef(freeTier);
  freeTierRef.current = freeTier;

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

  /** Session with the live clock merged in — used whenever it leaves React. */
  const withElapsed = useCallback((s: GameSession): GameSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state, for the reason putSession's does below: a run
    // can be booked and the next one started inside one tap, and the second
    // write reads this ref — a stale read would undo the first one's booking.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    // The ref leads the state, for the same reason persistStats' does.
    progressRef.current = next;
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: GameSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: GameSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Terminal: finalize once, at the natural break.
      void clearSavedGame(next.mode);
      persistStats(applyGameEnd(statsRef.current, next));
      if (next.status === 'cleared') {
        recordGameCompleted();
        // A free board has no level to unlock and no board to keep a record
        // for (§11「フリープレイ」): the climb and the calendar stay as they
        // are, and the card shows the score alone — nothing to compare with.
        if (next.mode === 'free') return;
        // Read before the record moves: what this run is measured against.
        const previousBestScore = previousBestFor(progressRef.current, next);
        const outcome = applyClearToProgress(progressRef.current, next, Date.now());
        persistProgress(outcome.progress);
        setLastResult({
          isNewBest: outcome.isNewBest,
          bestScore: outcome.bestScore,
          previousBestScore,
        });
      }
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: GameSession) => {
    elapsedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: GameSession) => {
      persistStats(applyGameStart(statsRef.current, next.mode));
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
      if (!current) return;
      activate(current);
    },
    [activate],
  );

  const startLevel = useCallback(
    (level: number) => {
      const target = Math.min(Math.max(1, Math.floor(level)), progressRef.current.highestUnlocked);
      const current = sessionsRef.current.level;
      if (current && current.level === target && current.status === 'playing') {
        resumeGame('level');
        return;
      }
      beginSession(createLevelSession(target));
    },
    [beginSession, resumeGame],
  );

  /** From the clear overlay. */
  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current.level;
    const nextLevel = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(nextLevel, progressRef.current.highestUnlocked)));
  }, [beginSession]);

  const startDaily = useCallback(
    (date?: string) => {
      const target = date ?? localDateString(new Date());
      const current = sessionsRef.current.daily;
      if (current && current.dailyDate === target && current.status === 'playing') {
        resumeGame('daily');
        return;
      }
      beginSession(createDailySession(target));
    },
    [beginSession, resumeGame],
  );

  const startFree = useCallback(
    (tier: FreeTier = freeTierRef.current) => {
      beginSession(createFreeSession(tier));
    },
    [beginSession],
  );

  const setFreeTier = useCallback((tier: FreeTier) => {
    setFreeTierState(tier);
    // The tier is the whole preferences record, so there is nothing else to
    // carry over into the write.
    void saveRecord(prefsSchema, { schemaVersion: 1, freeTier: tier });
  }, []);

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to whichever game is on screen. */
  const mutate = useCallback(
    (apply: (s: GameSession) => GameSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const applyPair = useCallback(
    (i: number, j: number) => mutate((s) => matchPair(s, i, j)),
    [mutate],
  );

  const applyUndo = useCallback((): boolean => {
    // Terminal games were already finalized (stats/progress); undoing past
    // that point would double-count. The UI disables Undo then too.
    if (sessionsRef.current[activeModeRef.current]?.status !== 'playing') return false;
    return mutate((s) => undo(s));
  }, [mutate]);

  const applyAdd = useCallback((): boolean => {
    return mutate((s) => performAddNumbers(s));
  }, [mutate]);

  const takeHint = useCallback((): readonly [number, number] | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const pair = findHint(current.board);
    if (!pair) return null;
    const next = countHintUse(withElapsed(current));
    putSession(mode, next);
    void saveGame(next);
    return pair;
  }, [putSession, withElapsed]);

  /** Saves the on-screen game (if any) so leaving never costs progress. */
  const syncActiveGame = useCallback(() => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
    }
  }, [putSession, withElapsed]);

  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const completeTutorial = useCallback(() => {
    // Side effects stay outside the setState updater (StrictMode calls
    // updaters twice in dev).
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  const markIntroSeen = useCallback((flag: 'wildIntroSeen' | 'stoneIntroSeen') => {
    if (flagsRef.current[flag]) return;
    const next = { ...flagsRef.current, [flag]: true };
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

  // Save when the app goes to background / gets hidden (spec §15.1).
  useEffect(() => {
    const saveNow = () => {
      const current = sessionsRef.current[activeModeRef.current];
      if (current && current.status === 'playing') void saveGame(withElapsed(current));
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') saveNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    // Keep the listener-handle promise so cleanup works even when it runs
    // before the plugin call resolves (no leaked listeners).
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', saveNow)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [withElapsed]);

  // Android hardware back button: leave sub-screens; from the game's home,
  // hand control back to the collection (the shell decides what "back" means
  // from there).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame]);

  const today = localDateString(new Date());
  const value = useMemo<AppContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.bestDaily[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      freeTier,
      setFreeTier,
      restartCurrent,
      resumeGame,
      applyPair,
      applyUndo,
      applyAdd,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
      flags,
      markIntroSeen,
    }),
    [
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      flags,
      markIntroSeen,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      freeTier,
      setFreeTier,
      restartCurrent,
      resumeGame,
      applyPair,
      applyUndo,
      applyAdd,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
