/**
 * Overtake's app context: the screens, the race on the board, the
 * statistics, the unlock frontier, the Drag / Buttons choice, persistence,
 * and the play clock (docs/OVERTAKE_RULES.md §2, §9, §11).
 *
 * The race's world — the cars, the course, the input — lives in the board
 * component's refs (ui/components/OvertakeStage.tsx), because it changes 120
 * times a second and nothing outside the canvas draws it. What lives here is
 * the race's STATUS (`ready` → `running` ⇄ `paused` → `finished`), because
 * everything that is not the board decides on it: the board's loop runs only
 * while it is `running`, a background or a blur or hardware Back pauses it,
 * the result card raises on `finished`.
 *
 * - Every status change goes through `commit`, where the side effects of a
 *   transition live once: the race counted at ready → running, the clock
 *   started on entering `running` and stopped on leaving it.
 * - The play clock is the provider's (§9 — Snake's shape): when the race last
 *   started moving (`runningSinceRef`), what it had run before that
 *   (`elapsedRef`) and what is already booked (`bookedRef`). The board never
 *   counts seconds. `syncActiveGame` is the one booking path: the finish, the
 *   ↻, Next, ← home, the Levels button, a background, a blur, Pause and the
 *   unmount all go through it, and `bookedRef` keeps it to once.
 * - There is no saved race (§9): leaving the screen ends it. Nothing but the
 *   four records survives a relaunch, and there is no `entry` prop — a
 *   home-screen shortcut opens on this game's home
 *   (src/test/shortcutResumeWiring.test.ts).
 * - Coming back from a background or a blur never resumes: only the player
 *   does (§2).
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
import { sounds } from '../../../services/sound';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import type { Controls } from '../game/input';
import { LEVEL_COUNT } from '../game/levels';
import { isUnlocked, raceResult, type RaceResult } from '../game/progress';
import type { RaceStatus } from '../game/race';
import {
  flagsSchema,
  prefsSchema,
  progressSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Progress,
  type Stats,
} from '../storage/schemas';
import { applyFirstPlace, applyPlayTime, applyRaceStart, homeLevel } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'levels' | 'game' | 'stats';

/** The race on the board, as everything outside the canvas sees it. */
export interface RaceSession {
  readonly level: number;
  /** Changes on every new race (retry, Next, a level picked), so the board remounts fresh. */
  readonly nonce: number;
  readonly status: RaceStatus;
}

/** What the result card shows: the place and the bumps, and what follows (§11). */
export type LastResult = RaceResult;

export interface OvertakeContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The race on the game screen, or null off it. */
  session: RaceSession | null;
  stats: Stats;
  progress: Progress;
  controls: Controls;
  tutorialCompleted: boolean;
  lastResult: LastResult | null;
  /** Drag or Buttons (§3, §11). Takes effect from the next `ready`. */
  setControls: (controls: Controls) => void;
  /** A level's `ready` (an unopened level falls back to the frontier). */
  startLevel: (level: number) => void;
  /** ↻ and the card's Retry: the same course, `ready`, no question asked (§2, §8). */
  retryRace: () => void;
  /** The card's Next, after first place (§2). */
  startNextLevel: () => void;
  /** Start (`ready`) or resume (`paused`) — a press on the board, Space / Enter, ▶. */
  play: () => void;
  /** ❚❚, P / Esc: a running race stops (§2). */
  pauseRace: () => void;
  /** The top bar's one button: ❚❚ while running, ▶ otherwise. */
  togglePause: () => void;
  /** The board reports the step the player's front crossed the line, once (§2). */
  finishRace: (place: number, bumps: number) => void;
  /** The card's Levels: the race ends and the level picker opens. */
  showLevels: () => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const OvertakeContext = createContext<OvertakeContextValue | null>(null);

export interface OvertakeProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialProgress: Progress;
  initialPrefs: Prefs;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  children: ReactNode;
}

/** The clock is read here, never in game/ (§9). */
const now = (): number => Date.now();

export function OvertakeProvider({
  initialStats,
  initialFlags,
  initialProgress,
  initialPrefs,
  onExit,
  children,
}: OvertakeProviderProps) {
  // Quick Rules first, and only until they have been completed: the
  // tutorial's own last button — or hardware Back, below — sets the flag.
  const [screen, setScreen] = useState<Screen>(
    initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<RaceSession | null>(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /** Seconds the race had run before `runningSinceRef`. Fractional; floored when booked. */
  const elapsedRef = useRef(0);
  /** Whole seconds of this race already in the statistics. */
  const bookedRef = useRef(0);
  /** When the race last started moving (`Date.now()`), or null while it is not moving. */
  const runningSinceRef = useRef<number | null>(null);
  /** The last race's nonce: every new race gets the next one. */
  const nonceRef = useRef(0);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  // The refs lead the state (docs/ARCHITECTURE.md「状態と ref」): a race can be
  // booked and the next one started inside one tap, and the second write
  // reads the ref — a stale read would undo the first one's booking.
  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    progressRef.current = next;
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  const persistPrefs = useCallback((next: Prefs) => {
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: RaceSession | null) => {
    // A key and a frame can land in one task; the second must see the first.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** The running seconds so far, the moving stretch included. */
  const readClock = useCallback((): number => {
    const since = runningSinceRef.current;
    return elapsedRef.current + (since === null ? 0 : Math.max(0, now() - since) / 1000);
  }, []);

  const stopClock = useCallback(() => {
    const since = runningSinceRef.current;
    if (since === null) return;
    elapsedRef.current += Math.max(0, now() - since) / 1000;
    runningSinceRef.current = null;
  }, []);

  /** Every status change, with the side effects that belong to the transition (§2, §9). */
  const commit = useCallback(
    (next: RaceSession) => {
      const previous = sessionRef.current;
      const wasRunning = previous?.status === 'running';
      const isRunning = next.status === 'running';
      if (!wasRunning && isRunning) runningSinceRef.current = now();
      if (wasRunning && !isRunning) stopClock();
      // Counted once, when the race first moves: opening a level that is
      // never started costs nothing, and a resume is not a new race (§9).
      if (previous?.status === 'ready' && isRunning) {
        persistStats(applyRaceStart(statsRef.current));
      }
      putSession(next);
    },
    [persistStats, putSession, stopClock],
  );

  /**
   * Stops a moving race and books the seconds not yet booked — the one path
   * every Pause, background, blur, exit, retry, finish and the unmount take
   * (§9, docs/GAME_LIFECYCLE.md「計上の経路を増やさない」). Idempotent: a
   * second call books nothing.
   */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status === 'running') commit({ ...current, status: 'paused' });
    const whole = Math.floor(readClock());
    const unbooked = whole - bookedRef.current;
    if (unbooked > 0) {
      bookedRef.current = whole;
      persistStats(applyPlayTime(statsRef.current, unbooked));
    }
  }, [commit, persistStats, readClock]);

  /** Books the race on the board (if any) and puts a fresh `ready` one there. */
  const begin = useCallback(
    (level: number) => {
      syncActiveGame();
      elapsedRef.current = 0;
      bookedRef.current = 0;
      runningSinceRef.current = null;
      nonceRef.current += 1;
      setLastResult(null);
      putSession({ level, nonce: nonceRef.current, status: 'ready' });
      setScreen('game');
    },
    [putSession, syncActiveGame],
  );

  const startLevel = useCallback(
    (level: number) => {
      const frontier = progressRef.current.highestUnlocked;
      begin(isUnlocked(frontier, level) ? level : homeLevel(progressRef.current));
    },
    [begin],
  );

  const retryRace = useCallback(() => {
    const current = sessionRef.current;
    if (current) begin(current.level);
  }, [begin]);

  const startNextLevel = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    startLevel(Math.min(LEVEL_COUNT, current.level + 1));
  }, [startLevel]);

  const play = useCallback(() => {
    const current = sessionRef.current;
    if (current?.status === 'ready' || current?.status === 'paused') {
      commit({ ...current, status: 'running' });
    }
  }, [commit]);

  const pauseRace = useCallback(() => {
    if (sessionRef.current?.status === 'running') syncActiveGame();
  }, [syncActiveGame]);

  const togglePause = useCallback(() => {
    if (sessionRef.current?.status === 'running') pauseRace();
    else play();
  }, [pauseRace, play]);

  const finishRace = useCallback(
    (place: number, bumps: number) => {
      const current = sessionRef.current;
      if (current?.status !== 'running') return;
      commit({ ...current, status: 'finished' });
      syncActiveGame();
      const result = raceResult(current.level, place, bumps);
      if (result.cleared) {
        // Written on the finishing step, before the card shows (§9).
        const next = applyFirstPlace(progressRef.current, current.level);
        if (next !== progressRef.current) persistProgress(next);
        recordGameCompleted();
        sounds.clear();
      }
      // Second to fourth place is an ending, not a failure: no sound (§11).
      setLastResult(result);
    },
    [commit, persistProgress, syncActiveGame],
  );

  /** Leaving the game screen ends the race (§2): booked, then gone. */
  const leaveRace = useCallback(
    (to: Screen) => {
      syncActiveGame();
      putSession(null);
      setLastResult(null);
      setScreen(to);
    },
    [putSession, syncActiveGame],
  );

  const goHome = useCallback(() => leaveRace('home'), [leaveRace]);
  const showLevels = useCallback(() => leaveRace('levels'), [leaveRace]);

  const exitToCollection = useCallback(() => {
    syncActiveGame();
    onExit();
  }, [onExit, syncActiveGame]);

  const setControls = useCallback(
    (controls: Controls) => {
      if (prefsRef.current.controls !== controls) persistPrefs({ ...prefsRef.current, controls });
    },
    [persistPrefs],
  );

  const completeTutorial = useCallback(() => {
    if (flagsRef.current.tutorialCompleted) return;
    const next = { ...flagsRef.current, tutorialCompleted: true };
    setFlags(next);
    void saveRecord(flagsSchema, next);
  }, []);

  // Background (§2): a moving race stops and its seconds are booked — the OS
  // can kill a backgrounded app without another event. The window losing
  // focus while it stays visible (a PC player moving to another window, a
  // tap on an ad's frame) stops a moving race the same way: nobody is
  // steering any more. Coming back, or focus returning, does nothing at all.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') syncActiveGame();
    };
    const onBlur = () => {
      if (sessionRef.current?.status === 'running') syncActiveGame();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    const pauseHandle = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('pause', syncActiveGame)
      : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back takes the whole Root off screen without goHome, so the
  // same sync runs then, and books only what `bookedRef` has not.
  useOnUnmount(syncActiveGame);

  // Android hardware back (§2): from the game's home, hand control back to
  // the collection. On a running race the first press only pauses — a swipe
  // from the screen edge can be a steering finger, and one press must not
  // cost the race; from anything else, this game's home. Registered once, on
  // native only, and the handle goes with the effect
  // (docs/ARCHITECTURE.md「ハードウェア戻るボタン」).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142).
        if (screen === 'tutorial') completeTutorial();
        if (screen === 'game' && sessionRef.current?.status === 'running') pauseRace();
        else goHome();
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, goHome, completeTutorial, pauseRace]);

  const value = useMemo<OvertakeContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      progress,
      controls: prefs.controls,
      tutorialCompleted: flags.tutorialCompleted,
      lastResult,
      setControls,
      startLevel,
      retryRace,
      startNextLevel,
      play,
      pauseRace,
      togglePause,
      finishRace,
      showLevels,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      progress,
      prefs.controls,
      flags.tutorialCompleted,
      lastResult,
      setControls,
      startLevel,
      retryRace,
      startNextLevel,
      play,
      pauseRace,
      togglePause,
      finishRace,
      showLevels,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <OvertakeContext.Provider value={value}>{children}</OvertakeContext.Provider>;
}

export function useOvertake(): OvertakeContextValue {
  const value = useContext(OvertakeContext);
  if (!value) throw new Error('useOvertake must be used inside OvertakeProvider');
  return value;
}
