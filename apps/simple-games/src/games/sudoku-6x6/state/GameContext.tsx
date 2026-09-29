/**
 * Sudoku 6×6's app context: screens, the active session, statistics, its own
 * preferences, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Two games are suspended independently — one difficulty game, one daily
 * (docs/SUDOKU_6X6_RULES.md §9, §11) — so switching modes never costs the
 * player either one.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§10); elapsed time is merged into the session whenever
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
  countHintUse,
  createDailySession,
  createDifficultySession,
  eraseCell,
  hintFor,
  localDateString,
  placeDigit,
  restartSession,
  toggleCellNote,
  undo,
  withElapsedSeconds,
  type Difficulty,
  type Digit,
  type GameMode,
  type Hint,
  type Sudoku6x6Session,
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
import { applyGameStart, applyPlayTime, applySolved, previousBestFor } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly seconds: number;
  readonly mistakes: number;
  readonly hints: number;
  /** True when this solve beat the time the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat after this run. */
  readonly bestSeconds: number;
  /** The record before this run, or null on a first solve (§10). */
  readonly previousBestSeconds: number | null;
}

export interface Sudoku6x6ContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: Sudoku6x6Session | null;
  sessions: SavedGames;
  stats: Stats;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a new game begins. */
  sessionEpoch: number;
  canResume: (mode: GameMode) => boolean;
  startDifficulty: (difficulty: Difficulty) => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Writes a digit (§3). False when the move changed nothing. */
  place: (index: number, digit: Digit) => boolean;
  /** Clears a player cell (§3). False when there was nothing to clear. */
  erase: (index: number) => boolean;
  /** Adds or removes a note (§3). False when notes are not allowed there. */
  toggleNote: (index: number, digit: Digit) => boolean;
  /** Takes back the last board change (§4). False when there is none. */
  applyUndo: () => boolean;
  takeHint: () => Hint | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const Sudoku6x6Context = createContext<Sudoku6x6ContextValue | null>(null);

export interface Sudoku6x6ProviderProps {
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

export function Sudoku6x6Provider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  entry,
  children,
}: Sudoku6x6ProviderProps) {
  /**
   * The suspended game this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks, and only once Quick Rules
   * are behind the player (§12).
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /**
   * The slot this mount is pointed at, read by both the active mode and the
   * clock seed below: a mode taken from one slot and a clock from another is
   * the whole trap.
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
   * itself rather than gated on the resume: a launch that stops on the game's
   * own home reaches `syncActiveGame` too, and from a zero baseline that
   * saves `elapsedSeconds: 0` over the suspended board (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this session. The
   * same baseline: a suspended game arrives with its seconds already booked.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: Sudoku6x6Session): Sudoku6x6Session => withElapsedSeconds(s, elapsedRef.current),
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

  const persistPrefs = useCallback((next: Prefs) => {
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: Sudoku6x6Session | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: Sudoku6x6Session) => {
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
      const played = applyPlayTime(statsRef.current, next.difficulty, unbooked);
      // Read before the record moves: what this solve is measured against.
      const previousBestSeconds = previousBestFor(played, next);
      const outcome = applySolved(played, next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        seconds: next.elapsedSeconds,
        mistakes: next.mistakeCount,
        hints: next.hintCount,
        isNewBest: outcome.isNewBest,
        bestSeconds: outcome.bestSeconds,
        previousBestSeconds,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: Sudoku6x6Session) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: Sudoku6x6Session) => {
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

  /**
   * Starts (or resumes) a difficulty game, and remembers the pick (§9).
   * Choosing the difficulty already in progress picks it back up; choosing
   * another one replaces that slot, which is why the home screen asks first.
   */
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      if (prefsRef.current.difficulty !== difficulty) {
        persistPrefs({ ...prefsRef.current, difficulty });
      }
      const current = sessionsRef.current.difficulty;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('difficulty');
        return;
      }
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, persistPrefs, resumeGame],
  );

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

  /** The same board again, from a clean slate (Retry). */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: Sudoku6x6Session) => Sudoku6x6Session | null): boolean => {
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
  const applyUndo = useCallback(() => mutate((s) => undo(s)), [mutate]);

  const takeHint = useCallback((): Hint | null => {
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (!current || current.status !== 'playing') return null;
    const hint = hintFor(current);
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
  // backgrounded app without sending another event.
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
  // control back to the collection. One owner, removed with its effect
  // (docs/ARCHITECTURE.md「ハードウェア戻るボタン」).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142).
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
  const value = useMemo<Sudoku6x6ContextValue>(
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
      startDaily,
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
      prefs,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      canResume,
      startDifficulty,
      startDaily,
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

  return <Sudoku6x6Context.Provider value={value}>{children}</Sudoku6x6Context.Provider>;
}

export function useSudoku6x6(): Sudoku6x6ContextValue {
  const value = useContext(Sudoku6x6Context);
  if (!value) throw new Error('useSudoku6x6 must be used inside Sudoku6x6Provider');
  return value;
}
