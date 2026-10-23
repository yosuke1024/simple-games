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
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { saveRecord } from '../../../storage/repo';
import { sounds } from '../../../services/sound';
import { recordGameCompleted } from '../../../services/review';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  act,
  createSession,
  gravityMs,
  pause,
  start,
  tick,
  type Action,
  type Session,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
export type Screen = 'home' | 'tutorial' | 'game' | 'stats';
interface ContextValue {
  screen: Screen;
  session: Session | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  navigate: (screen: Screen) => void;
  newGame: () => void;
  retry: () => void;
  resumeGame: () => void;
  togglePause: () => void;
  pauseGame: () => void;
  play: (action: Action) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}
const Context = createContext<ContextValue | null>(null);
interface Props {
  initialSession: Session | null;
  initialStats: Stats;
  initialFlags: Flags;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function FallingBlocksProvider({
  initialSession,
  initialStats,
  initialFlags,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: Props) {
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<Session | null>(initialSession);
  const [stats, setStats] = useState(initialStats);
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
  const bookedLinesRef = useRef(initialSession?.lines ?? 0);
  const runningSinceRef = useRef<number | null>(null);
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
  const stopClock = useCallback(() => {
    if (runningSinceRef.current === null) return;
    elapsedRef.current += Math.max(0, performance.now() - runningSinceRef.current) / 1000;
    runningSinceRef.current = null;
  }, []);
  const withElapsed = useCallback(
    (current: Session): Session => ({
      ...current,
      elapsedSeconds: Math.floor(
        elapsedRef.current +
          (runningSinceRef.current === null
            ? 0
            : Math.max(0, performance.now() - runningSinceRef.current) / 1000),
      ),
    }),
    [],
  );
  const bookProgress = useCallback(
    (current: Session) => {
      const seconds = Math.max(0, current.elapsedSeconds - bookedRef.current);
      const lines = Math.max(0, current.lines - bookedLinesRef.current);
      bookedRef.current = current.elapsedSeconds;
      bookedLinesRef.current = current.lines;
      const previous = statsRef.current;
      if (seconds || lines || current.score > previous.bestScore)
        persistStats({
          ...previous,
          totalPlaySeconds: previous.totalPlaySeconds + seconds,
          linesCleared: previous.linesCleared + lines,
          bestScore: Math.max(previous.bestScore, current.score),
        });
    },
    [persistStats],
  );
  const commit = useCallback(
    (next: Session) => {
      const previous = sessionRef.current;
      if (next === previous) return;
      if (previous?.status !== 'running' && next.status === 'running')
        runningSinceRef.current = performance.now();
      if (previous?.status === 'running' && next.status !== 'running') stopClock();
      if (previous?.status === 'ready' && next.status === 'running')
        persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
      const timed = withElapsed(next);
      putSession(timed);
      if (timed.status === 'over') {
        bookProgress(timed);
        void clearSavedGame(kv);
        sounds.gameOver();
        if (timed.lines >= 4) recordGameCompleted();
      } else if (previous && timed.pieceIndex !== previous.pieceIndex) {
        bookProgress(timed);
        void saveGame(timed, kv);
        if (timed.lines > previous.lines) sounds.clear();
        else sounds.select();
      }
    },
    [bookProgress, kv, persistStats, putSession, stopClock, withElapsed],
  );
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status === 'over') return;
    stopClock();
    const next = withElapsed(pause(current));
    putSession(next);
    bookProgress(next);
    void saveGame(next, kv);
  }, [bookProgress, kv, putSession, stopClock, withElapsed]);
  const begin = useCallback(
    (seed: number) => {
      syncActiveGame();
      elapsedRef.current = 0;
      bookedRef.current = 0;
      bookedLinesRef.current = 0;
      runningSinceRef.current = null;
      const next = createSession(seed);
      putSession(next);
      void saveGame(next, kv);
      setScreen('game');
    },
    [kv, putSession, syncActiveGame],
  );
  const newGame = useCallback(() => {
    let seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
    if (seed === sessionRef.current?.seed) seed = (seed + 1) >>> 0;
    begin(seed);
  }, [begin]);
  const retry = useCallback(() => {
    if (sessionRef.current) begin(sessionRef.current.seed);
  }, [begin]);
  const resumeGame = useCallback(() => {
    if (sessionRef.current && sessionRef.current.status !== 'over') setScreen('game');
  }, []);
  const togglePause = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    if (current.status === 'running') syncActiveGame();
    else if (document.visibilityState !== 'hidden') commit(start(current));
  }, [commit, syncActiveGame]);
  const play = useCallback(
    (action: Action) => {
      if (sessionRef.current) commit(act(sessionRef.current, action));
    },
    [commit],
  );
  const goHome = useCallback(() => {
    syncActiveGame();
    setScreen('home');
  }, [syncActiveGame]);
  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);
  const completeTutorial = useCallback(() => {
    const next: Flags = { schemaVersion: 1, tutorialCompleted: true };
    flagsRef.current = next;
    setFlags(next);
    void saveRecord(flagsSchema, next, kv);
  }, [kv]);
  const running = screen === 'game' && session?.status === 'running';
  // One gravity timer. Movement does not postpone gravity; each drop reads fresh state.
  useEffect(() => {
    if (!running) return;
    let id = 0;
    const step = () => {
      const current = sessionRef.current;
      if (!current || current.status !== 'running') return;
      if (document.visibilityState === 'hidden') {
        syncActiveGame();
        return;
      }
      const next = tick(current);
      commit(next);
      if (next.status === 'running') id = window.setTimeout(step, gravityMs(next.lines));
    };
    id = window.setTimeout(step, gravityMs(sessionRef.current?.lines ?? 0));
    return () => window.clearTimeout(id);
  }, [commit, running, syncActiveGame]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    const blur = () => {
      if (sessionRef.current?.status === 'running') syncActiveGame();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', blur);
    const handle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', blur);
      void handle?.then((value) => value.remove()).catch(() => undefined);
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
        session,
        stats,
        tutorialCompleted: flags.tutorialCompleted,
        canResume: session !== null && session.status !== 'over',
        navigate: setScreen,
        newGame,
        retry,
        resumeGame,
        togglePause,
        pauseGame: syncActiveGame,
        play,
        goHome,
        exitToCollection,
        completeTutorial,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useFallingBlocks(): ContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useFallingBlocks requires FallingBlocksProvider');
  return value;
}
