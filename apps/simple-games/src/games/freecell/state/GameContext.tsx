/**
 * FreeCell's app context: screens, the active session, statistics, and
 * persistence. Pure local state — no analytics, no ad orchestration; the only
 * ad surface is the shared BannerSlot the game screen renders.
 *
 * Two deals are suspended independently — one free, one daily (§10) — so
 * switching modes never costs the player either one.
 *
 * There is no preferences record here, unlike Klondike: FreeCell has no
 * setting to carry between deals (§13).
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * during play either (§4); elapsed time is merged into the session whenever
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
  canUndo as sessionCanUndo,
  createDailySession,
  createFreeSession,
  doAutoFinish,
  doMoveCascadeRun,
  doMoveCascadeToCell,
  doMoveCascadeToFoundation,
  doMoveCellToCascade,
  doMoveCellToFoundation,
  isStuck,
  localDateString,
  restartSession,
  undo,
  type FreeCellSession,
  type GameMode,
} from '../game';
import {
  clearSavedGame,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applyWon, previousBestsFor } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBestMoves: boolean;
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
  /** The records before this run, or null where there was none yet (§9). */
  readonly previousBestMoves: number | null;
  readonly previousBestSeconds: number | null;
  readonly moves: number;
  readonly seconds: number;
}

export interface FreeCellContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: FreeCellSession | null;
  sessions: SavedGames;
  stats: Stats;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** True when the game on screen has no legal move left (§2). */
  stuck: boolean;
  canResume: (mode: GameMode) => boolean;
  startFree: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Board actions. Each returns false when the move was not legal (§3). */
  cascadeToCell: (from: number, toCell?: number) => boolean;
  cascadeToFoundation: (from: number) => boolean;
  cellToCascade: (cell: number, to: number) => boolean;
  cellToFoundation: (cell: number) => boolean;
  moveRun: (from: number, index: number, to: number) => boolean;
  finishGame: () => boolean;
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const FreeCellContext = createContext<FreeCellContextValue | null>(null);

export interface FreeCellProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
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
const INITIAL_MODE: GameMode = 'free';

export function FreeCellProvider({
  initialStats,
  initialFlags,
  initialSessions,
  onExit,
  entry,
  children,
}: FreeCellProviderProps) {
  /**
   * The suspended deal this launch opens straight onto, or null for the game's
   * home (issue #113). Decided once, from the records the provider was mounted
   * with: a launch means whatever it meant when it happened, and no save made
   * later can change that.
   *
   * Only a home-screen shortcut asks, and only once Quick Rules are behind the
   * player — a first launch teaches the game before it deals (§11), and a
   * shortcut is not an exception to that. The flag and the boards live in
   * separate keys, so a device whose flags failed to validate still gets
   * taught rather than dropped onto a table.
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
  // answers null until Quick Rules are behind the player, so the gate is in one
  // place rather than two — two would each cover for the other, and a guard
  // nothing can observe failing is not a guard.
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  // `session` is a plain index into `sessions`, so the mode has to be seeded
  // alongside the screen: opening 'game' on the default 'free' while the
  // suspended deal is the daily would render the blank board storage/schemas.ts
  // already warns about, with no home screen behind it to go back to.
  const [activeMode, setActiveMode] = useState<GameMode>(mountedMode);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
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

  const withElapsed = useCallback((s: FreeCellSession): FreeCellSession => {
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

  const putSession = useCallback((mode: GameMode, next: FreeCellSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: FreeCellSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Won: finalize once. Only the seconds not yet booked are added, so
      // leaving and returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const unbooked = Math.max(0, next.elapsedSeconds - bookedRef.current);
      bookedRef.current = next.elapsedSeconds;
      // Read before the records move: what this run is measured against.
      const previous = previousBestsFor(statsRef.current, next);
      const outcome = applyWon(applyPlayTime(statsRef.current, unbooked), next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        isNewBestMoves: outcome.isNewBestMoves,
        isNewBestTime: outcome.isNewBestTime,
        bestMoves: outcome.bestMoves,
        bestSeconds: outcome.bestSeconds,
        previousBestMoves: previous.moves,
        previousBestSeconds: previous.seconds,
        moves: next.moveCount,
        seconds: next.elapsedSeconds,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: FreeCellSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: FreeCellSession) => {
      persistStats(applyGameStart(statsRef.current));
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

  const startFree = useCallback(() => {
    beginSession(createFreeSession());
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

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: FreeCellSession) => FreeCellSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const cascadeToCell = useCallback(
    (from: number, toCell?: number) => mutate((s) => doMoveCascadeToCell(s, from, toCell)),
    [mutate],
  );
  const cascadeToFoundation = useCallback(
    (from: number) => mutate((s) => doMoveCascadeToFoundation(s, from)),
    [mutate],
  );
  const cellToCascade = useCallback(
    (cell: number, to: number) => mutate((s) => doMoveCellToCascade(s, cell, to)),
    [mutate],
  );
  const cellToFoundation = useCallback(
    (cell: number) => mutate((s) => doMoveCellToFoundation(s, cell)),
    [mutate],
  );
  const moveRun = useCallback(
    (from: number, index: number, to: number) =>
      mutate((s) => doMoveCascadeRun(s, from, index, to)),
    [mutate],
  );
  const finishGame = useCallback(() => mutate(doAutoFinish), [mutate]);

  const applyUndo = useCallback((): boolean => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing' || !sessionCanUndo(current)) return false;
    return mutate((s) => undo(s));
  }, [mutate]);

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
        persistStats(applyPlayTime(statsRef.current, unbooked));
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
  const stuck = session !== null && isStuck(session);
  const value = useMemo<FreeCellContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyMoves[today] !== undefined,
      lastResult,
      stuck,
      canResume,
      startFree,
      startDaily,
      restartCurrent,
      resumeGame,
      cascadeToCell,
      cascadeToFoundation,
      cellToCascade,
      cellToFoundation,
      moveRun,
      finishGame,
      applyUndo,
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
      flags.tutorialCompleted,
      today,
      lastResult,
      stuck,
      canResume,
      startFree,
      startDaily,
      restartCurrent,
      resumeGame,
      cascadeToCell,
      cascadeToFoundation,
      cellToCascade,
      cellToFoundation,
      moveRun,
      finishGame,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <FreeCellContext.Provider value={value}>{children}</FreeCellContext.Provider>;
}

export function useFreeCell(): FreeCellContextValue {
  const value = useContext(FreeCellContext);
  if (!value) throw new Error('useFreeCell must be used inside FreeCellProvider');
  return value;
}
