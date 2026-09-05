/**
 * Sudoku's app context: screens, the active session, statistics, progress, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surface is the shared BannerSlot the game screen renders.
 *
 * Three games are suspended independently — one level, one daily, one free
 * board (§11) — so switching modes never costs the player any of them.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§12); elapsed time is merged into the session whenever it
 * leaves this module (saves, finalization, navigation).
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
  eraseCell,
  findHint,
  localDateString,
  MAX_LEVEL,
  placeDigit,
  restartSession,
  toggleCellNote,
  undo,
  type Difficulty,
  type Digit,
  type GameMode,
  type Hint,
  type SudokuSession,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
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
import {
  applyGameStart,
  applyPlayTime,
  applySolved,
  applySolveToProgress,
  previousBestFor,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBest: boolean;
  readonly bestSeconds: number;
  /** The board's record before this run, or null on its first clear (§12). */
  readonly previousBestSeconds: number | null;
  readonly seconds: number;
  readonly mistakes: number;
  readonly hints: number;
}

export interface SudokuContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: SudokuSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startLevel: (level: number) => void;
  startNextLevel: () => void;
  startDaily: (date?: string) => void;
  /** A fresh free board at the picker's tier — or the one given (§9). */
  startFree: (difficulty?: Difficulty) => void;
  /** Where the Free Play picker stands; remembered across launches. */
  freeDifficulty: Difficulty;
  setFreeDifficulty: (difficulty: Difficulty) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  place: (index: number, digit: Digit) => boolean;
  erase: (index: number) => boolean;
  toggleNote: (index: number, digit: Digit) => boolean;
  applyUndo: () => boolean;
  takeHint: () => Hint | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SudokuContext = createContext<SudokuContextValue | null>(null);

export interface SudokuProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialSessions: SavedGames;
  prefs: Prefs;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

/**
 * The mode a freshly mounted game is pointed at, before anything is resumed.
 * Named because the play-clock baseline has to be read from the same slot.
 */
const INITIAL_MODE: GameMode = 'level';

export function SudokuProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialSessions,
  prefs,
  onExit,
  children,
}: SudokuProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>(INITIAL_MODE);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [freeDifficulty, setFreeDifficultyState] = useState<Difficulty>(prefs.freeDifficulty);
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
  const freeDifficultyRef = useRef(freeDifficulty);
  freeDifficultyRef.current = freeDifficulty;

  const session = sessions[activeMode];

  /**
   * The live play clock (seconds). Mutated by the interval, never state.
   *
   * Seeded from the restored game rather than from zero, because every save
   * merges this ref into the session and `syncActiveGame` runs on any
   * background, not only from the game screen. Open the game, stay on its own
   * home without pressing Resume, then background the app: from a zero
   * baseline that writes `elapsedSeconds: 0` over a suspended board, and the
   * minutes already on its clock are gone. `activate` re-establishes the
   * baseline whenever a game comes on screen; this line covers the mount
   * before that.
   */
  const elapsedRef = useRef(initialSessions[INITIAL_MODE]?.elapsedSeconds ?? 0);
  /**
   * Play seconds already booked into the statistics for this session.
   *
   * Seeded from the restored game rather than from zero, because a suspended
   * game arrives with its seconds already in `totalPlaySeconds` — they were
   * booked by the sync that saved it. `activate` re-establishes this baseline
   * whenever a game comes on screen, but the mount before that is reachable:
   * opening the game and leaving from its home without resuming runs
   * `syncActiveGame` against the restored session, and from a zero baseline
   * that books its whole elapsed time a second time. Open and leave twice and
   * it lands twice. The comment on the visibility effect below already states
   * this invariant — this is the line that makes it true.
   */
  const bookedRef = useRef(initialSessions[INITIAL_MODE]?.elapsedSeconds ?? 0);

  const withElapsed = useCallback((s: SudokuSession): SudokuSession => {
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

  const putSession = useCallback((mode: GameMode, next: SudokuSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: SudokuSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Solved: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      // Read before any record moves: what this run is measured against. A
      // level or a daily has its own board's record; a free board has no
      // board to keep one for, so it stands against the tier's fastest
      // clear — the number the statistics screen shows (§12).
      const previousBestSeconds =
        next.mode === 'free'
          ? statsRef.current[next.difficulty].bestSeconds
          : previousBestFor(progressRef.current, next);
      persistStats(
        applySolved(
          applyPlayTime(statsRef.current, next.difficulty, unbooked),
          next.difficulty,
          next.elapsedSeconds,
        ),
      );
      recordGameCompleted();
      const outcome = applySolveToProgress(progressRef.current, next);
      persistProgress(outcome.progress);
      const freeIsBest = previousBestSeconds === null || next.elapsedSeconds < previousBestSeconds;
      setLastResult({
        isNewBest: next.mode === 'free' ? freeIsBest : outcome.isNewBest,
        bestSeconds:
          next.mode === 'free'
            ? Math.min(next.elapsedSeconds, previousBestSeconds ?? Infinity)
            : outcome.bestSeconds,
        previousBestSeconds,
        seconds: next.elapsedSeconds,
        mistakes: next.mistakeCount,
        hints: next.hintCount,
      });
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: SudokuSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: SudokuSession) => {
      persistStats(applyGameStart(statsRef.current, next.difficulty));
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

  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current.level;
    const next = Math.min(MAX_LEVEL, (current?.level ?? 0) + 1);
    beginSession(createLevelSession(Math.min(next, progressRef.current.highestUnlocked)));
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
    (difficulty: Difficulty = freeDifficultyRef.current) => {
      beginSession(createFreeSession(difficulty));
    },
    [beginSession],
  );

  const setFreeDifficulty = useCallback(
    (difficulty: Difficulty) => {
      setFreeDifficultyState(difficulty);
      // The rest of the record is the settings screen's, which cannot be
      // open while a game is mounted — so the prop is current.
      void saveRecord(prefsSchema, { ...prefs, freeDifficulty: difficulty });
    },
    [prefs],
  );

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: SudokuSession) => SudokuSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const place = useCallback(
    (index: number, digit: Digit) => mutate((s) => placeDigit(s, index, digit)),
    [mutate],
  );

  const erase = useCallback((index: number) => mutate((s) => eraseCell(s, index)), [mutate]);

  const toggleNote = useCallback(
    (index: number, digit: Digit) => mutate((s) => toggleCellNote(s, index, digit)),
    [mutate],
  );

  const applyUndo = useCallback((): boolean => {
    if (sessionsRef.current[activeModeRef.current]?.status !== 'playing') return false;
    return mutate((s) => undo(s));
  }, [mutate]);

  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const hint = findHint(current.board);
    if (!hint) return null;
    const next = countHintUse(withElapsed(current));
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
        persistStats(applyPlayTime(statsRef.current, synced.difficulty, unbooked));
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

  // Save when the app goes to background / gets hidden (§11). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*. Saving the board
  // alone here would drop every play second since the last sync for good.
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
  // control back to the collection.
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
  const value = useMemo<SudokuContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      prefs,
      freeDifficulty,
      setFreeDifficulty,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: progress.dailyTimes[today] !== undefined,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      restartCurrent,
      resumeGame,
      place,
      erase,
      toggleNote,
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
      progress,
      prefs,
      freeDifficulty,
      setFreeDifficulty,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startLevel,
      startNextLevel,
      startDaily,
      startFree,
      restartCurrent,
      resumeGame,
      place,
      erase,
      toggleNote,
      applyUndo,
      takeHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SudokuContext.Provider value={value}>{children}</SudokuContext.Provider>;
}

export function useSudoku(): SudokuContextValue {
  const value = useContext(SudokuContext);
  if (!value) throw new Error('useSudoku must be used inside SudokuProvider');
  return value;
}
