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
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import { applyAction, createSession, remaining, undo, type Action, type Session } from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
export type Screen = 'home' | 'tutorial' | 'game' | 'stats';
interface Value {
  screen: Screen;
  session: Session | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  navigate: (screen: Screen) => void;
  startGame: () => void;
  retryGame: () => void;
  resumeGame: () => void;
  act: (action: Action) => void;
  applyUndo: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}
const Context = createContext<Value | null>(null);
export interface ThreePeaksProviderProps {
  initialSession: Session | null;
  initialStats: Stats;
  initialFlags: Flags;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function ThreePeaksProvider({
  initialSession,
  initialStats,
  initialFlags,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: ThreePeaksProviderProps) {
  const [screen, setScreen] = useState<Screen>(() =>
    !initialFlags.tutorialCompleted
      ? 'tutorial'
      : entry === 'shortcut' && initialSession?.status === 'playing'
        ? 'game'
        : 'home',
  );
  const [session, setSession] = useState<Session | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState(initialFlags);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  const elapsedRef = useRef(mountedSeconds);
  const bookedRef = useRef(mountedSeconds);
  const putSession = useCallback((next: Session | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);
  const persistStats = useCallback(
    (next: Stats) => {
      statsRef.current = next;
      setStats(next);
      void saveRecord(statsSchema, next, kv);
    },
    [kv],
  );
  const bookTime = useCallback(() => {
    const delta = Math.max(0, elapsedRef.current - bookedRef.current);
    if (!delta) return;
    bookedRef.current = elapsedRef.current;
    persistStats({
      ...statsRef.current,
      totalPlaySeconds: statsRef.current.totalPlaySeconds + delta,
    });
  }, [persistStats]);
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    const next = { ...current, elapsedSeconds: elapsedRef.current };
    putSession(next);
    bookTime();
    void saveGame(next, kv);
  }, [bookTime, kv, putSession]);
  const begin = useCallback(
    (seed: number) => {
      syncActiveGame();
      const next = createSession(seed);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      putSession(next);
      persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
      void saveGame(next, kv);
      setScreen('game');
    },
    [kv, persistStats, putSession, syncActiveGame],
  );
  const startGame = useCallback(() => {
    let seed = Math.floor(Math.random() * 4294967296);
    if (seed === sessionRef.current?.seed) seed = (seed + 1) >>> 0;
    begin(seed);
  }, [begin]);
  const retryGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) begin(current.seed);
  }, [begin]);
  const resumeGame = useCallback(() => {
    if (sessionRef.current?.status === 'playing') setScreen('game');
  }, []);
  const act = useCallback(
    (action: Action) => {
      const current = sessionRef.current;
      if (!current) return;
      const moved = applyAction({ ...current, elapsedSeconds: elapsedRef.current }, action);
      if (!moved) return;
      bookTime();
      if (moved.status === 'playing') {
        putSession(moved);
        void saveGame(moved, kv);
        return;
      }
      const won = moved.status === 'won' && !moved.countedWin;
      const count = remaining(moved);
      persistStats({
        ...statsRef.current,
        wins: statsRef.current.wins + (won ? 1 : 0),
        bestRemaining: Math.min(statsRef.current.bestRemaining ?? 28, count),
      });
      putSession({ ...moved, countedWin: moved.countedWin || won });
      void clearSavedGame(kv);
      if (won) recordGameCompleted();
    },
    [bookTime, kv, persistStats, putSession],
  );
  const applyUndo = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const previous = undo({ ...current, elapsedSeconds: elapsedRef.current });
    if (!previous) return;
    bookTime();
    putSession(previous);
    void saveGame(previous, kv);
  }, [bookTime, kv, putSession]);
  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);
  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);
  const navigate = useCallback(
    (next: Screen) => {
      syncActiveGame();
      setScreen(next);
    },
    [syncActiveGame],
  );
  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next: Flags = { schemaVersion: 1, tutorialCompleted: true };
    flagsRef.current = next;
    setFlags(next);
    void saveRecord(flagsSchema, next, kv);
  }, [kv]);
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    document.addEventListener('visibilitychange', visibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);
  useOnUnmount(syncActiveGame);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, completeTutorial, exitToCollection, syncActiveGame]);
  const value = useMemo<Value>(
    () => ({
      screen,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      navigate,
      startGame,
      retryGame,
      resumeGame,
      act,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      session,
      stats,
      flags.tutorialCompleted,
      navigate,
      startGame,
      retryGame,
      resumeGame,
      act,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useThreePeaks(): Value {
  const value = useContext(Context);
  if (!value) throw new Error('ThreePeaksProvider missing');
  return value;
}
