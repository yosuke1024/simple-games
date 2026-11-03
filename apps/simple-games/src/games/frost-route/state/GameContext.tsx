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
import { type KVStore, preferencesKV } from '../../../storage/kv';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import { useMovePlayback } from '../../../ui/useMovePlayback';
import {
  createSession,
  act,
  resultValue,
  undo,
  type Action,
  type Session,
  type Mode,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
export type Screen = 'home' | 'tutorial' | 'game' | 'stats';
interface MovePlayback {
  before: Session;
  to: number;
  durationMs: number;
}
interface ContextValue {
  playback: MovePlayback | null;
  screen: Screen;
  setPaused: (paused: boolean) => void;
  session: Session | null;
  stats: Stats;
  preferredMode: Mode;
  tutorialCompleted: boolean;
  canResume: boolean;
  navigate: (screen: Screen) => void;
  startBoard: (mode: Mode) => void;
  resumeGame: () => void;
  restartCurrent: () => void;
  startNewBoard: () => void;
  play: (action: Action) => boolean;
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}
const GameContext = createContext<ContextValue | null>(null);
export interface FrostRouteProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: Session | null;
  onExit: () => void;
  entry?: 'collection' | 'shortcut';
  kv?: KVStore;
  children: ReactNode;
}
export function FrostRouteProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  kv = preferencesKV,
  children,
}: FrostRouteProviderProps) {
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [paused, setPaused] = useState(false);
  const [foreground, setForeground] = useState(() => document.visibilityState !== 'hidden');
  const {
    playback,
    busy,
    start: startPlayback,
    finish: finishPlayback,
  } = useMovePlayback<Omit<MovePlayback, 'durationMs'>>(screen === 'game' && !paused && foreground);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [stats, setStats] = useState(initialStats);
  const [flags, setFlags] = useState(initialFlags);
  const [prefs, setPrefs] = useState(initialPrefs);
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
  const withElapsed = useCallback(
    (current: Session): Session => ({ ...current, elapsedSeconds: elapsedRef.current }),
    [],
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
    const next = withElapsed(current);
    putSession(next);
    bookPlayTime();
    void saveGame(next, kv);
  }, [bookPlayTime, kv, putSession, withElapsed]);
  const begin = useCallback(
    (mode: Mode, seed: number) => {
      finishPlayback();
      syncActiveGame();
      const currentStats = statsRef.current;
      const record = currentStats.boards[mode];
      persistStats({
        ...currentStats,
        boards: { ...currentStats.boards, [mode]: { ...record, played: record.played + 1 } },
      });
      const next = createSession(mode, seed);
      elapsedRef.current = 0;
      bookedRef.current = 0;
      putSession(next);
      const nextPrefs: Prefs = { schemaVersion: 1, mode };
      setPrefs(nextPrefs);
      void saveRecord(prefsSchema, nextPrefs, kv);
      void saveGame(next, kv);
      setScreen('game');
    },
    [finishPlayback, kv, persistStats, putSession, syncActiveGame],
  );
  const startBoard = useCallback(
    (mode: Mode) => {
      let seed = (Date.now() ^ Math.floor(Math.random() * 0x100000000)) >>> 0;
      if (seed === sessionRef.current?.seed) seed = (seed + 1) >>> 0;
      begin(mode, seed);
    },
    [begin],
  );
  const restartCurrent = useCallback(() => {
    const current = sessionRef.current;
    if (current) begin(current.mode, current.seed);
  }, [begin]);
  const startNewBoard = useCallback(() => {
    const current = sessionRef.current;
    if (current) startBoard(current.mode);
  }, [startBoard]);
  const resumeGame = useCallback(() => {
    if (sessionRef.current?.status === 'playing') setScreen('game');
  }, []);
  const play = useCallback(
    (action: Action) => {
      const current = sessionRef.current;
      if (!current || busy.current) return false;
      const next = act(withElapsed(current), action);
      if (!next) return false;
      const distance =
        Math.abs((next.position % next.board.size) - (current.position % current.board.size)) +
        Math.abs(
          Math.floor(next.position / next.board.size) -
            Math.floor(current.position / current.board.size),
        );
      startPlayback({ before: current, to: next.position }, Math.min(650, 180 + distance * 65));
      putSession(next);
      // Every save carries only seconds already booked to avoid a crash losing time.
      bookPlayTime();
      if (next.status === 'playing') void saveGame(next, kv);
      else {
        void clearSavedGame(kv);
        const all = statsRef.current;
        const record = all.boards[next.mode];
        const completed = record.completed + (next.status === 'won' ? 1 : 0);
        persistStats({
          ...all,
          boards: {
            ...all.boards,
            [next.mode]: {
              ...record,
              completed,
              best:
                next.status === 'won'
                  ? Math.min(record.best ?? Infinity, resultValue(next))
                  : record.best,
            },
          },
        });
        recordGameCompleted();
      }
      return true;
    },
    [bookPlayTime, busy, kv, persistStats, putSession, startPlayback, withElapsed],
  );
  const applyUndo = useCallback(() => {
    const current = sessionRef.current;
    if (!current || busy.current) return false;
    const next = undo(withElapsed(current));
    if (!next) return false;
    putSession(next);
    bookPlayTime();
    void saveGame(next, kv);
    return true;
  }, [bookPlayTime, busy, kv, putSession, withElapsed]);
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
    const next: Flags = { schemaVersion: 1, tutorialCompleted: true };
    flagsRef.current = next;
    setFlags(next);
    void saveRecord(flagsSchema, next, kv);
  }, [kv]);
  const playing = screen === 'game' && session?.status === 'playing' && !paused && foreground;
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
      void resumeHandle?.then((handle) => handle.remove()).catch(() => undefined);
      document.removeEventListener('visibilitychange', onVisibility);
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
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);
  return (
    <GameContext.Provider
      value={{
        screen,
        playback,
        setPaused,
        session,
        stats,
        preferredMode: prefs.mode,
        tutorialCompleted: flags.tutorialCompleted,
        canResume: session?.status === 'playing',
        navigate: setScreen,
        startBoard,
        resumeGame,
        restartCurrent,
        startNewBoard,
        play,
        applyUndo,
        goHome,
        exitToCollection,
        completeTutorial,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useFrostRoute(): ContextValue {
  const value = useContext(GameContext);
  if (!value) throw new Error('useFrostRoute requires FrostRouteProvider');
  return value;
}
