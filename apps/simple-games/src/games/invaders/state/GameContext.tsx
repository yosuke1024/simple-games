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
import { sounds } from '../../../services/sound';
import { preferencesKV, type KVStore } from '../../../storage/kv';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  createSession,
  finished,
  movePlayer,
  nextStage,
  pause,
  start,
  step,
  STEP_MS,
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
  startNewRun: () => void;
  resumeRun: () => void;
  togglePause: () => void;
  pauseRun: () => void;
  advanceStage: () => void;
  aim: (x: number) => void;
  steer: (direction: -1 | 0 | 1) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}
const Context = createContext<ContextValue | null>(null);
export interface InvadersProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: Session | null;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function InvadersProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: InvadersProviderProps) {
  const [screen, setScreen] = useState<Screen>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession
      ? 'game'
      : initialFlags.tutorialCompleted
        ? 'home'
        : 'tutorial',
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
  const directionRef = useRef<-1 | 0 | 1>(0);
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
  const book = useCallback(
    (current: Session, cleared = false) => {
      elapsedRef.current = current.elapsedSeconds;
      const unbooked = Math.max(0, elapsedRef.current - bookedRef.current);
      bookedRef.current = elapsedRef.current;
      const previous = statsRef.current;
      if (
        !unbooked &&
        !cleared &&
        previous.bestScore >= current.score &&
        previous.bestStage >= (current.started ? current.stage : 0)
      )
        return;
      persistStats({
        ...previous,
        totalPlaySeconds: previous.totalPlaySeconds + unbooked,
        bestScore: Math.max(previous.bestScore, current.score),
        bestStage: Math.max(previous.bestStage, current.started ? current.stage : 0),
        cleared: previous.cleared + (cleared ? 1 : 0),
      });
    },
    [persistStats],
  );
  const commit = useCallback(
    (next: Session) => {
      const previous = sessionRef.current;
      if (next === previous) return;
      if (!previous?.started && next.started)
        persistStats({ ...statsRef.current, played: statsRef.current.played + 1 });
      putSession(next);
      if (next.status !== 'running') directionRef.current = 0;
      if (finished(next) && previous && !finished(previous)) {
        book(next, next.status === 'won');
        void clearSavedGame(kv);
        if (next.status === 'won') {
          sounds.clear();
          recordGameCompleted();
        } else sounds.gameOver();
      } else if (next.status === 'between' && previous?.status !== 'between') {
        book(next);
        void saveGame(next, kv);
        sounds.clear();
      }
    },
    [book, kv, persistStats, putSession],
  );
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (!current || finished(current)) return;
    directionRef.current = 0;
    const next = pause(current);
    putSession(next);
    book(next);
    void saveGame(next, kv);
  }, [book, kv, putSession]);
  const startNewRun = useCallback(() => {
    syncActiveGame();
    const next = createSession();
    elapsedRef.current = 0;
    bookedRef.current = 0;
    directionRef.current = 0;
    putSession(next);
    void saveGame(next, kv);
    setScreen('game');
  }, [kv, putSession, syncActiveGame]);
  const resumeRun = useCallback(() => {
    if (sessionRef.current && !finished(sessionRef.current)) setScreen('game');
  }, []);
  const pauseRun = useCallback(() => {
    if (sessionRef.current?.status === 'running') syncActiveGame();
  }, [syncActiveGame]);
  const togglePause = useCallback(() => {
    const current = sessionRef.current;
    if (!current || document.visibilityState === 'hidden') return;
    if (current.status === 'running') syncActiveGame();
    else {
      directionRef.current = 0;
      commit(start(current));
    }
  }, [commit, syncActiveGame]);
  const advanceStage = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    const next = nextStage(current);
    putSession(next);
    void saveGame(next, kv);
  }, [kv, putSession]);
  const aim = useCallback(
    (x: number) => {
      const current = sessionRef.current;
      if (current) putSession(movePlayer(current, x));
    },
    [putSession],
  );
  const steer = useCallback((direction: -1 | 0 | 1) => {
    directionRef.current = direction;
  }, []);
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
  const running = screen === 'game' && session?.status === 'running';
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last: number | null = null;
    let pending = 0;
    const animate = (time: number) => {
      const current = sessionRef.current;
      if (!current || current.status !== 'running' || document.visibilityState === 'hidden') return;
      if (last !== null) pending += Math.min(STEP_MS * 4, Math.max(0, time - last));
      last = time;
      let next = current;
      let count = 0;
      while (pending >= STEP_MS && count < 4 && next.status === 'running') {
        next = step(movePlayer(next, next.playerX + directionRef.current * 8));
        pending -= STEP_MS;
        count += 1;
      }
      commit(next);
      if (next.status === 'running') frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [running, commit]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    const onBlur = () => {
      if (sessionRef.current?.status === 'running') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    const handle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      void handle?.then((listener) => listener.remove()).catch(() => undefined);
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
  }, [screen, exitToCollection, goHome, completeTutorial]);
  return (
    <Context.Provider
      value={{
        screen,
        session,
        stats,
        tutorialCompleted: flags.tutorialCompleted,
        canResume: session !== null && !finished(session),
        navigate,
        startNewRun,
        resumeRun,
        togglePause,
        pauseRun,
        advanceStage,
        aim,
        steer,
        goHome,
        exitToCollection,
        completeTutorial,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useInvaders(): ContextValue {
  const value = useContext(Context);
  if (!value) throw new Error('useInvaders requires InvadersProvider');
  return value;
}
