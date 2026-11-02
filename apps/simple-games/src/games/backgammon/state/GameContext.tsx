/**
 * Backgammon's app context (docs/BACKGAMMON_RULES.md §2, §5, §6, §8, §9): the
 * one session on screen, the records around it, the CPU's beats, and the
 * single owner of the hardware Back button. The shape is Checkers' — one
 * armed timeout for the CPU, a play clock that mutates a ref, a sync seam
 * every exit passes through — with the dice game's two differences: a throw
 * is a tap of the player's (§2.1), and the CPU's turn is a throw and then
 * one step a beat (§5.4).
 *
 * Every context in this collection advances its ref immediately before the
 * matching setState call, because React batches one task's updates and a
 * second mutation in that task would otherwise read what the first one just
 * replaced (docs/ARCHITECTURE.md「状態と ref」, src/test/refLeading.test.ts).
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
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  applyCpuRoll,
  applyCpuStep,
  applyPlayerStep,
  cpuBeatOwed,
  createSession,
  doOpening,
  doRoll,
  matchSeed,
  newSeedToken,
  undoStep,
  type BackgammonSession,
} from '../game/session';
import { CPU, opponentOf, PLAYER, sideIndex, type Difficulty, type Side, type Step } from '../game/types';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import {
  flagsSchema,
  prefsSchema,
  statsSchema,
  type Flags,
  type Prefs,
  type Stats,
} from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** The CPU's pause before it throws (§5.4) — the collection's shared beat. */
export const CPU_ROLL_DELAY_MS = 450;
/** Before the first step of its turn: time to read the dice (§5.4). */
export const CPU_FIRST_STEP_MS = 450;
/** Between the steps of one turn: one move still being made (§5.4). */
export const CPU_STEP_MS = 280;

/** What just moved on the board, for the screen's sounds and marks (§11). */
export interface LastStep {
  readonly by: Side;
  readonly step: Step;
  /** Where it landed, as the mover's distance; 0 when it was borne off. */
  readonly to: number;
  readonly hit: boolean;
  readonly borneOff: boolean;
  /** Identity: one screen effect per step, replays excluded. */
  readonly stepId: number;
}

export interface BackgammonContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: BackgammonSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastStep: LastStep | null;
  /** The strength the next match starts at (§1). Never changes one in play. */
  difficulty: Difficulty;
  setDifficulty: (value: Difficulty) => void;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Throws for the player — the opening, or the player's turn (§2.1). False when not their throw. */
  roll: () => boolean;
  /** Plays one step. False when it was not allowed or not the player's move (§2.5). */
  playStep: (step: Step) => boolean;
  /** 待った: the last step of the current turn (§6). False when there is none. */
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const BackgammonContext = createContext<BackgammonContextValue | null>(null);

export interface BackgammonProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: BackgammonSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function BackgammonProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: BackgammonProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match rather than on
   * the home screen (issue #113). Decided once, from the record the provider
   * was mounted with. Only a home-screen shortcut asks; the loader has
   * already thrown away everything that is not a match to come back to, and
   * a first launch is taught the game before it is shown one (§10).
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<BackgammonSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastStep, setLastStep] = useState<LastStep | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /** Rises with every step shown, so each one animates exactly once. */
  const stepIdRef = useRef(0);

  /**
   * The seconds the match this mount holds already carries, and the live play
   * clock and the booked clock seeded from it — one invariant, as in Checkers:
   * a suspended match arrives with its seconds already in `totalPlaySeconds`.
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  const elapsedRef = useRef(mountedSeconds);
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: BackgammonSession): BackgammonSession => {
    return s.elapsedSeconds === elapsedRef.current ? s : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a match's unbooked play time, and — only when it actually ended —
   * its result, once (§8). A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started.
   */
  const finalizeMatch = useCallback(
    (match: BackgammonSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, match.elapsedSeconds - bookedRef.current);
      bookedRef.current = match.elapsedSeconds;
      persistStats(
        applyMatchEnd(applyPlayTime(statsRef.current, unbooked), match.difficulty, match.status),
      );
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: BackgammonSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: BackgammonSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      void clearSavedGame();
      finalizeMatch(next);
      // The review prompt counts wins only (§8).
      if (next.status === 'won') recordGameCompleted();
    },
    [finalizeMatch, putSession],
  );

  /** Records the step that took `before` to `after`, for the screen (§11). */
  const noteStep = useCallback(
    (by: Side, before: BackgammonSession, after: BackgammonSession, step: Step) => {
      const them = sideIndex(opponentOf(by));
      const me = sideIndex(by);
      stepIdRef.current += 1;
      setLastStep({
        by,
        step,
        to: Math.max(0, step.from - step.die),
        hit: after.board.bar[them] > before.board.bar[them],
        borneOff: after.board.off[me] > before.board.off[me],
        stepId: stepIdRef.current,
      });
    },
    [],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: BackgammonSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setLastStep(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const setDifficulty = useCallback((value: Difficulty) => {
    if (prefsRef.current.difficulty === value) return;
    const next = { ...prefsRef.current, difficulty: value };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeMatch(withElapsed(current));
      setDifficulty(difficulty);
      const next = createSession(difficulty, matchSeed(newSeedToken()));
      finalizedRef.current = false;
      persistStats(applyGameStart(statsRef.current, difficulty));
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeMatch, persistStats, putSession, setDifficulty, withElapsed],
  );

  const roll = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current || current.status !== 'playing') return false;
    const timed = withElapsed(current);
    const next = timed.phase.kind === 'opening' ? doOpening(timed) : doRoll(timed);
    if (next === null) return false;
    setLastStep(null);
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  const playStep = useCallback(
    (step: Step): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const before = withElapsed(current);
      const next = applyPlayerStep(before, step);
      if (next === null) return false;
      noteStep(PLAYER, before, next, step);
      commitSession(next);
      return true;
    },
    [commitSession, noteStep, withElapsed],
  );

  const applyUndo = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = undoStep(withElapsed(current));
    if (next === null) return false;
    // An undone board is placed, not replayed: nothing slides.
    setLastStep(null);
    putSession(next);
    void saveGame(next);
    return true;
  }, [putSession, withElapsed]);

  // The CPU's turn: one armed timeout whenever the game screen shows a live
  // session with a beat owed to the CPU (§5.4). Depends on the session
  // itself, so any change (undo, new match, unmount) disarms a stale one via
  // the cleanup. The throw and each step re-arm the same effect, on the pause
  // each deserves: thinking before the throw, reading time before the first
  // step, a short beat between steps.
  useEffect(() => {
    if (screen !== 'game' || !session || session.status !== 'playing') return;
    const beat = cpuBeatOwed(session);
    if (beat === null) return;
    const firstStep = session.phase.kind === 'moving' && session.phase.steps.length === 0;
    const delay = beat === 'roll' ? CPU_ROLL_DELAY_MS : firstStep ? CPU_FIRST_STEP_MS : CPU_STEP_MS;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current || current.status !== 'playing') return;
      const owed = cpuBeatOwed(current);
      if (owed === null) return;
      const before = withElapsed(current);
      const next = owed === 'roll' ? applyCpuRoll(before) : applyCpuStep(before);
      // A beat the rules refuse means the plan and the board have drifted
      // apart; the next pass decides again from the position on screen.
      if (next === null) return;
      if (owed === 'step') {
        const played =
          next.phase.kind === 'moving' && next.phase.side === CPU
            ? next.phase.steps[next.phase.steps.length - 1]
            : next.lastTurn?.steps[next.lastTurn.steps.length - 1];
        if (played) noteStep(CPU, before, next, played);
      }
      commitSession(next);
    }, delay);
    return () => window.clearTimeout(id);
  }, [screen, session, commitSession, noteStep, withElapsed]);

  /** Saves the on-screen match and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') {
      const synced = withElapsed(current);
      putSession(synced);
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

  // Save when the app goes to background / gets hidden (§9): the same sync as
  // leaving the screen, statistics included.
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

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」,
  // src/test/unmountBookingWiring.test.ts).
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens; from the game's home, hand
  // control back to the collection (src/test/gameBackButtonWiring.test.ts).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const backHandle = CapacitorApp.addListener('backButton', () => {
      if (screen === 'home') {
        exitToCollection();
      } else {
        // Leaving Quick Rules by Back counts as having seen them (issue #142).
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const value = useMemo<BackgammonContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastStep,
      difficulty: prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      roll,
      playStep,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      flags.tutorialCompleted,
      lastStep,
      prefs.difficulty,
      setDifficulty,
      startNewGame,
      resumeGame,
      roll,
      playStep,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <BackgammonContext.Provider value={value}>{children}</BackgammonContext.Provider>;
}

export function useBackgammon(): BackgammonContextValue {
  const value = useContext(BackgammonContext);
  if (!value) throw new Error('useBackgammon must be used inside BackgammonProvider');
  return value;
}
