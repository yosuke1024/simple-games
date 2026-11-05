import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { recordGameCompleted } from '@/services/review';
import { preferencesKV, type KVStore } from '@/storage/kv';
import { saveRecord } from '@/storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import { useMovePlayback } from '@/ui/useMovePlayback';
import { createSession, step, chooseCpuMove, cpuView, type Session, type Action } from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
export type Screen = 'home' | 'tutorial' | 'game' | 'stats';
interface ContextValue {
  screen: Screen;
  session: Session | null;
  stats: Stats;
  canResume: boolean;
  tutorialCompleted: boolean;
  playback: { before: Session; after: Session; durationMs: number } | null;
  navigate: (screen: Screen) => void;
  setPaused: (paused: boolean) => void;
  startBoard: () => void;
  resumeGame: () => void;
  restartCurrent: () => void;
  startNewBoard: () => void;
  nextRound: () => void;
  play: (action: Action) => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}
const GameContext = createContext<ContextValue | null>(null);
export interface IndianRummyProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: Session | null;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function IndianRummyProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: IndianRummyProviderProps) {
  const [screen, setScreen] = useState<Screen>(
    entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession
      ? 'game'
      : initialFlags.tutorialCompleted
        ? 'home'
        : 'tutorial',
  );
  const [session, setSession] = useState(initialSession);
  const [stats, setStats] = useState(initialStats);
  const [flags, setFlags] = useState(initialFlags);
  const [paused, setPaused] = useState(false),
    [foreground, setForeground] = useState(() => document.visibilityState !== 'hidden');
  const {
    playback,
    busy,
    start: startPlayback,
    finish: finishPlayback,
  } = useMovePlayback<{ before: Session; after: Session }>(
    screen === 'game' && !paused && foreground,
  );
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
  const bookPlayTime = useCallback(() => {
    const seconds = Math.max(0, elapsedRef.current - bookedRef.current);
    if (!seconds) return;
    bookedRef.current = elapsedRef.current;
    persistStats({
      ...statsRef.current,
      totalPlaySeconds: statsRef.current.totalPlaySeconds + seconds,
    });
  }, [persistStats]);
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return;
    const next = { ...current, elapsedSeconds: elapsedRef.current };
    putSession(next);
    bookPlayTime();
    void saveGame(next, kv);
  }, [bookPlayTime, kv, putSession]);
  const recordResult = useCallback(
    (next: Session) => {
      void clearSavedGame(kv);
      const all = statsRef.current;
      persistStats({
        ...all,
        completed: all.completed + 1,
        wins: all.wins + (next.status === 'won' ? 1 : 0),
        draws: all.draws + (next.status === 'draw' ? 1 : 0),
      });
      recordGameCompleted();
    },
    [kv, persistStats],
  );
  const begin = useCallback(
    (seed: number) => {
      finishPlayback();
      syncActiveGame();
      persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
      elapsedRef.current = 0;
      bookedRef.current = 0;
      const next = createSession(seed);
      putSession(next);
      if (next.status === 'playing') void saveGame(next, kv);
      else recordResult(next);
      setScreen('game');
    },
    [finishPlayback, syncActiveGame, persistStats, putSession, kv, recordResult],
  );
  const startBoard = useCallback(() => {
    let seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    if (seed === sessionRef.current?.seed) seed = (seed + 1) >>> 0;
    begin(seed);
  }, [begin]);
  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (current) begin(current.seed);
  }, [begin]);
  const nextRound = startBoard;
  const resumeGame = useCallback(() => {
    if (sessionRef.current?.status === 'playing') setScreen('game');
  }, []);
  const commit = useCallback(
    (action: Action) => {
      const current = sessionRef.current;
      if (!current || busy.current || screen !== 'game' || paused || !foreground) return false;
      const next = step({ ...current, elapsedSeconds: elapsedRef.current }, action);
      if (!next) return false;
      startPlayback({ before: current, after: next }, 340);
      putSession(next);
      bookPlayTime();
      if (next.status === 'playing') void saveGame(next, kv);
      else recordResult(next);
      return true;
    },
    [busy, screen, paused, foreground, startPlayback, putSession, bookPlayTime, kv, recordResult],
  );
  const play = useCallback(
    (action: Action) => sessionRef.current?.turn === 0 && commit(action),
    [commit],
  );
  const goHome = useCallback(() => {
    finishPlayback();
    syncActiveGame();
    setScreen('home');
  }, [finishPlayback, syncActiveGame]);
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
  const playing = screen === 'game' && session?.status === 'playing' && !paused && foreground;
  useEffect(() => {
    if (!playing || playback || !session || session.turn === 0) return;
    const timer = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.turn === 0 || document.visibilityState === 'hidden') return;
      commit(chooseCpuMove(cpuView(current)));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [playing, playback, session, commit]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);
  useEffect(() => {
    const onVisibility = () => {
      setForeground(document.visibilityState !== 'hidden');
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    const onPause = () => {
      setForeground(false);
      syncActiveGame();
    };
    const onResume = () => setForeground(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', onPause)
      : null;
    const resumeHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('resume', onResume)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((h) => h.remove()).catch(() => undefined);
      void resumeHandle?.then((h) => h.remove()).catch(() => undefined);
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
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);
  return (
    <GameContext.Provider
      value={{
        screen,
        session,
        stats,
        canResume: session?.status === 'playing',
        tutorialCompleted: flags.tutorialCompleted,
        playback,
        navigate: setScreen,
        setPaused,
        startBoard,
        resumeGame,
        restartCurrent,
        startNewBoard: startBoard,
        nextRound,
        play,
        goHome,
        exitToCollection,
        completeTutorial,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useIndianRummy() {
  const value = useContext(GameContext);
  if (!value) throw new Error('Missing IndianRummyProvider');
  return value;
}
