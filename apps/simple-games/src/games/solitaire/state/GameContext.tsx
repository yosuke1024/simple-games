/**
 * Solitaire's app context: screens, the active session, statistics, the draw
 * preference, and persistence. Pure local state — no analytics, no ad
 * orchestration; the only ad surface is the shared BannerSlot the game screen
 * renders.
 *
 * Two deals are suspended independently — one free, one daily (§10) — so
 * switching modes never costs the player either one.
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
  doDraw,
  doMoveFoundationToTableau,
  doMoveTableauRun,
  doMoveTableauToFoundation,
  doMoveWasteToFoundation,
  doMoveWasteToTableau,
  findHint,
  localDateString,
  recordHint,
  restartSession,
  undo,
  type GameMode,
  type HintMove,
  type SolitaireSession,
} from '../game';
import { clearSavedGame, saveGame, type SavedGames } from '../storage/gamePersistence';
import { flagsSchema, prefsSchema, statsSchema, type Flags, type Prefs, type Stats } from '../storage/schemas';
import { applyGameStart, applyPlayTime, applyWon } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'daily' | 'game' | 'stats';

export interface LastResult {
  readonly isNewBestMoves: boolean;
  readonly isNewBestTime: boolean;
  readonly bestMoves: number;
  readonly bestSeconds: number;
  readonly moves: number;
  readonly seconds: number;
  readonly hints: number;
}

export interface SolitaireContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: SolitaireSession | null;
  sessions: SavedGames;
  stats: Stats;
  drawThree: boolean;
  setDrawThree: (value: boolean) => void;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  canResume: (mode: GameMode) => boolean;
  startFree: () => void;
  startDaily: (date?: string) => void;
  restartCurrent: () => void;
  resumeGame: (mode: GameMode) => void;
  /** Board actions. Each returns false when the move was not legal (§3). */
  drawCard: () => boolean;
  moveRun: (from: number, index: number, to: number) => boolean;
  runToFoundation: (from: number) => boolean;
  wasteToTableau: (to: number) => boolean;
  wasteToFoundation: () => boolean;
  foundationToTableau: (suit: number, to: number) => boolean;
  finishGame: () => boolean;
  applyUndo: () => boolean;
  /** One sound legal move by the §8 priorities, or null. Not a solver. */
  requestHint: () => HintMove | null;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const SolitaireContext = createContext<SolitaireContextValue | null>(null);

export interface SolitaireProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

export function SolitaireProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSessions,
  onExit,
  children,
}: SolitaireProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>('free');
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

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

  const withElapsed = useCallback((s: SolitaireSession): SolitaireSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const setDrawThree = useCallback((value: boolean) => {
    const next: Prefs = { schemaVersion: 1, drawThree: value };
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: SolitaireSession | null) => {
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: SolitaireSession) => {
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
      const outcome = applyWon(applyPlayTime(statsRef.current, unbooked), next);
      persistStats(outcome.stats);
      recordGameCompleted();
      setLastResult({
        isNewBestMoves: outcome.isNewBestMoves,
        isNewBestTime: outcome.isNewBestTime,
        bestMoves: outcome.bestMoves,
        bestSeconds: outcome.bestSeconds,
        moves: next.moveCount,
        seconds: next.elapsedSeconds,
        hints: next.hintCount,
      });
    },
    [persistStats, putSession],
  );

  /** Brings a mode's game on screen and hands the clock over to it. */
  const activate = useCallback((next: SolitaireSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setScreen('game');
  }, []);

  const beginSession = useCallback(
    (next: SolitaireSession) => {
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
    beginSession(createFreeSession(prefsRef.current.drawThree));
  }, [beginSession]);

  const startDaily = useCallback(
    (date?: string) => {
      const target = date ?? localDateString(new Date());
      const current = sessionsRef.current.daily;
      if (current && current.dailyDate === target && current.status === 'playing') {
        resumeGame('daily');
        return;
      }
      beginSession(createDailySession(target, prefsRef.current.drawThree));
    },
    [beginSession, resumeGame],
  );

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  /** Applies a pure session transition to the game on screen. */
  const mutate = useCallback(
    (apply: (s: SolitaireSession) => SolitaireSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current) return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const drawCard = useCallback(() => mutate(doDraw), [mutate]);
  const moveRun = useCallback(
    (from: number, index: number, to: number) =>
      mutate((s) => doMoveTableauRun(s, from, index, to)),
    [mutate],
  );
  const runToFoundation = useCallback(
    (from: number) => mutate((s) => doMoveTableauToFoundation(s, from)),
    [mutate],
  );
  const wasteToTableau = useCallback(
    (to: number) => mutate((s) => doMoveWasteToTableau(s, to)),
    [mutate],
  );
  const wasteToFoundation = useCallback(() => mutate(doMoveWasteToFoundation), [mutate]);
  const foundationToTableau = useCallback(
    (suit: number, to: number) => mutate((s) => doMoveFoundationToTableau(s, suit, to)),
    [mutate],
  );
  const finishGame = useCallback(() => mutate(doAutoFinish), [mutate]);

  const applyUndo = useCallback((): boolean => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing' || !sessionCanUndo(current)) return false;
    return mutate((s) => undo(s));
  }, [mutate]);

  const requestHint = useCallback((): HintMove | null => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing') return null;
    const move = findHint(current.board);
    if (move) mutate((s) => recordHint(s));
    return move;
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
  const value = useMemo<SolitaireContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      drawThree: prefs.drawThree,
      setDrawThree,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyMoves[today] !== undefined,
      lastResult,
      canResume,
      startFree,
      startDaily,
      restartCurrent,
      resumeGame,
      drawCard,
      moveRun,
      runToFoundation,
      wasteToTableau,
      wasteToFoundation,
      foundationToTableau,
      finishGame,
      applyUndo,
      requestHint,
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
      prefs.drawThree,
      setDrawThree,
      flags.tutorialCompleted,
      today,
      lastResult,
      canResume,
      startFree,
      startDaily,
      restartCurrent,
      resumeGame,
      drawCard,
      moveRun,
      runToFoundation,
      wasteToTableau,
      wasteToFoundation,
      foundationToTableau,
      finishGame,
      applyUndo,
      requestHint,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <SolitaireContext.Provider value={value}>{children}</SolitaireContext.Provider>;
}

export function useSolitaire(): SolitaireContextValue {
  const value = useContext(SolitaireContext);
  if (!value) throw new Error('useSolitaire must be used inside SolitaireProvider');
  return value;
}
