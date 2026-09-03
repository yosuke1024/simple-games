/**
 * Minesweeper's app context: screens, the active session, statistics, its own
 * preferences, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Two games are suspended independently — one difficulty game, one daily (§8,
 * §10) — so switching modes never costs the player either one.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§6); elapsed time is merged into the session whenever it
 * leaves this module (saves, finalization, navigation). It also does not start
 * until the first tap, because until then there is no board to be timed on.
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
  chordCell,
  countHintUse,
  createDailySession,
  createDifficultySession,
  flagCell,
  hintFor,
  localDateString,
  restartSession,
  tapCell,
  type Difficulty,
  type GameMode,
  type MinesweeperSession,
  type SafeCell,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { applyGameStart, applyPlayTime, applyWin, previousBestFor } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly won: boolean;
  readonly seconds: number;
  readonly hints: number;
  /** True when a win beat the time the player had before. */
  readonly isNewBest: boolean;
  /** The time to beat for this difficulty or this day, if there is one. */
  readonly bestSeconds: number | null;
  /** The record before a won run (§9); null on a first win — and on a loss, which sets no time. */
  readonly previousBestSeconds: number | null;
}

export interface MinesweeperContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: MinesweeperSession | null;
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
  tap: (index: number) => boolean;
  flag: (index: number) => boolean;
  chord: (index: number) => boolean;
  takeHint: () => SafeCell | null;
  setFlagMode: (value: boolean) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const MinesweeperContext = createContext<MinesweeperContextValue | null>(null);

export interface MinesweeperProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function MinesweeperProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  children,
}: MinesweeperProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('difficulty');
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

  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(0);
  /** Play seconds already booked into the statistics for this session. */
  const bookedRef = useRef(0);

  const withElapsed = useCallback((s: MinesweeperSession): MinesweeperSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: MinesweeperSession | null) => {
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: MinesweeperSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }

      // Finished, one way or the other. Only the seconds not yet booked are
      // added, so leaving and coming back cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      const played = applyPlayTime(statsRef.current, next.difficulty, unbooked);
      // Read before the record moves: what a win is measured against.
      const previousBestSeconds = previousBestFor(played, next);

      if (next.status === 'won') {
        recordGameCompleted();
        const outcome = applyWin(played, next);
        persistStats(outcome.stats);
        setLastResult({
          won: true,
          seconds: next.elapsedSeconds,
          hints: next.hintCount,
          isNewBest: outcome.isNewBest,
          bestSeconds: outcome.bestSeconds,
          previousBestSeconds,
        });
        return;
      }

      // A loss is the end of the game, not a penalty (§2): the counts stand as
      // they are and the same board is offered straight back. The record is
      // still stated, but an unfinished run has no time to set against it.
      persistStats(played);
      setLastResult({
        won: false,
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
        isNewBest: false,
        bestSeconds: previousBestSeconds,
        previousBestSeconds: null,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: MinesweeperSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: MinesweeperSession) => {
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
   * Starts (or resumes) a difficulty game. Choosing the difficulty already in
   * progress picks it back up; choosing another one replaces that slot, which
   * is why the home screen asks first (§8).
   */
  const startDifficulty = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionsRef.current.difficulty;
      if (current && current.difficulty === difficulty && current.status === 'playing') {
        resumeGame('difficulty');
        return;
      }
      beginSession(createDifficultySession(difficulty));
    },
    [beginSession, resumeGame],
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

  /** The same board again, free and immediate (§2, §7 — this is instead of undo). */
  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: MinesweeperSession) => MinesweeperSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const tap = useCallback((index: number) => mutate((s) => tapCell(s, index)), [mutate]);
  const flag = useCallback((index: number) => mutate((s) => flagCell(s, index)), [mutate]);
  const chord = useCallback((index: number) => mutate((s) => chordCell(s, index)), [mutate]);

  const takeHint = useCallback((): SafeCell | null => {
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

  const setFlagMode = useCallback((value: boolean) => {
    const next = { ...prefsRef.current, flagMode: value };
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

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

  // Play clock: one second at a time while a started game is on screen.
  // Mutates the ref only — zero React work per tick (battery). Nothing is
  // timed before the first tap, when there is not yet a board to solve.
  const playing = screen === 'game' && session?.status === 'playing' && session.firstIndex !== null;
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
  const value = useMemo<MinesweeperContextValue>(
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
      tap,
      flag,
      chord,
      takeHint,
      setFlagMode,
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
      tap,
      flag,
      chord,
      takeHint,
      setFlagMode,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <MinesweeperContext.Provider value={value}>{children}</MinesweeperContext.Provider>;
}

export function useMinesweeper(): MinesweeperContextValue {
  const value = useContext(MinesweeperContext);
  if (!value) throw new Error('useMinesweeper must be used inside MinesweeperProvider');
  return value;
}
