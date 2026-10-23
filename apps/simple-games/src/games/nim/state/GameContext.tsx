import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { recordGameCompleted } from '../../../services/review';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  createSession,
  move,
  undo,
  type Mode,
  type Session,
  type Move,
  isCpuTurn,
  cpuMove,
} from '../game';
import { saveGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
export type Screen = 'home' | 'tutorial' | 'game' | 'stats';
export const CPU_DELAY_MS = 450;
interface ContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: Session | null;
  stats: Stats;
  preferredMode: Mode;
  tutorialCompleted: boolean;
  paused: boolean;
  startNewGame: (mode: Mode, seed?: number) => void;
  resumeGame: () => void;
  playMove: (action: Move) => boolean;
  applyUndo: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
  pauseGame: () => void;
}
const Context = createContext<ContextValue | null>(null);
interface ProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: Session | null;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function NimProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: ProviderProps) {
  const [screen, setScreen] = useState<Screen>(() =>
    !initialFlags.tutorialCompleted
      ? 'tutorial'
      : entry === 'shortcut' && initialSession
        ? 'game'
        : 'home',
  );
  const [session, setSession] = useState<Session | null>(initialSession);
  const [stats, setStats] = useState(initialStats);
  const [flags, setFlags] = useState(initialFlags);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  const elapsedRef = useRef(mountedSeconds);
  const bookedRef = useRef(mountedSeconds);
  const putSession = useCallback((next: Session) => {
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
    const seconds = Math.max(0, elapsedRef.current - bookedRef.current);
    bookedRef.current = elapsedRef.current;
    if (seconds)
      persistStats({
        ...statsRef.current,
        totalPlaySeconds: Math.min(1e12, statsRef.current.totalPlaySeconds + seconds),
      });
  }, [persistStats]);
  const commitSession = useCallback(
    (next: Session) => {
      next = { ...next, elapsedSeconds: elapsedRef.current };
      bookTime();
      if (next.status !== 'playing') {
        if (!next.resultRecorded) {
          const row = statsRef.current[next.mode];
          persistStats({
            ...statsRef.current,
            [next.mode]: {
              ...row,
              wins: Math.min(1e9, row.wins + (next.status === 'won' ? 1 : 0)),
              losses: Math.min(1e9, row.losses + (next.status === 'won' ? 0 : 1)),
            },
          });
          recordGameCompleted();
          next = { ...next, resultRecorded: true };
        }
      }
      putSession(next);
      void saveGame(next, kv);
    },
    [bookTime, persistStats, putSession, kv],
  );
  const syncActiveGame = useCallback(() => {
    bookTime();
    const current = sessionRef.current;
    if (current) {
      const synced = { ...current, elapsedSeconds: elapsedRef.current };
      putSession(synced);
      void saveGame(synced, kv);
    }
  }, [bookTime, putSession, kv]);
  const pauseGame = useCallback(() => {
    pausedRef.current = true;
    setPaused(true);
    syncActiveGame();
  }, [syncActiveGame]);
  const resumeGame = useCallback(() => {
    pausedRef.current = false;
    setPaused(false);
    setScreen('game');
  }, []);
  const startNewGame = useCallback(
    (mode: Mode, seed?: number) => {
      syncActiveGame();
      const next = createSession(mode, seed);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      const row = statsRef.current[mode];
      persistStats({
        ...statsRef.current,
        [mode]: { ...row, played: Math.min(1e9, row.played + 1) },
      });
      const nextPrefs: Prefs = { schemaVersion: 1, mode };
      setPrefs(nextPrefs);
      void saveRecord(prefsSchema, nextPrefs, kv);
      putSession(next);
      void saveGame(next, kv);
      resumeGame();
    },
    [syncActiveGame, persistStats, putSession, resumeGame, kv],
  );
  const playMove = useCallback(
    (action: Move): boolean => {
      const current = sessionRef.current;
      if (!current || pausedRef.current || isCpuTurn(current)) return false;
      const next = move(current, action);
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession],
  );
  const applyUndo = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const next = undo(current);
    if (next) commitSession(next);
  }, [commitSession]);
  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);
  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [syncActiveGame, onExit]);
  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next: Flags = { schemaVersion: 1, tutorialCompleted: true };
    flagsRef.current = next;
    setFlags(next);
    void saveRecord(flagsSchema, next, kv);
  }, [kv]);
  const navigate = useCallback(
    (next: Screen) => {
      syncActiveGame();
      setScreen(next);
    },
    [syncActiveGame],
  );
  useEffect(() => {
    if (screen !== 'game' || paused || session?.status !== 'playing') return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'hidden' && !pausedRef.current) elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen, paused, session?.status]);
  useEffect(() => {
    if (
      screen !== 'game' ||
      paused ||
      document.visibilityState === 'hidden' ||
      !session ||
      !isCpuTurn(session)
    )
      return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (
        !current ||
        current !== session ||
        pausedRef.current ||
        document.visibilityState === 'hidden' ||
        !isCpuTurn(current)
      )
        return;
      const action = cpuMove(current);
      if (!action) return;
      const next = move(current, action);
      if (next) commitSession(next);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, paused, session, commitSession]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === 'hidden') pauseGame();
    };
    document.addEventListener('visibilitychange', hide);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', pauseGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', hide);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [pauseGame]);
  useOnUnmount(syncActiveGame);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        if (screen === 'tutorial') completeTutorial();
        goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, completeTutorial, goHome]);
  return (
    <Context.Provider
      value={{
        screen,
        navigate,
        session,
        stats,
        preferredMode: prefs.mode,
        tutorialCompleted: flags.tutorialCompleted,
        paused,
        startNewGame,
        resumeGame,
        playMove,
        applyUndo,
        goHome,
        exitToCollection,
        completeTutorial,
        pauseGame,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useNim(): ContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('NimProvider is required');
  return value;
}
