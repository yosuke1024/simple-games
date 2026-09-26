/**
 * Hit & Blow's app context: screens, the game in progress, statistics, the
 * difficulty last picked, and persistence. Pure local state — no analytics,
 * no ad orchestration; the only ad surfaces are the shared BannerSlot and
 * ResultAdSlot the screens render.
 *
 * One game at a time, saved as it is played (docs/HIT_AND_BLOW_RULES.md §8):
 * on start, on every checked guess, and whenever the game leaves the screen.
 * The row being composed changes the session in memory only — it is not part
 * of the save.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a game is running. It is never shown
 * either (§10); elapsed time is merged into the session whenever it leaves
 * this module (saves, finalization, navigation).
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
  clearDraftSlot,
  createSession,
  guessCount,
  popSymbol as popDraftSymbol,
  pushSymbol as pushDraftSymbol,
  submitGuess,
  type Difficulty,
  type HitAndBlowSession,
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
import { applyGameStart, applyPlayTime, applySolved } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What the result card says about the game just solved (§7). */
export interface LastResult {
  readonly guesses: number;
  /** The fewest guesses before this game, or null on a first solve. */
  readonly previousBest: number | null;
  readonly isNewBest: boolean;
  /** The fewest guesses after this game. */
  readonly best: number;
}

export interface HitAndBlowContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: HitAndBlowSession | null;
  stats: Stats;
  /** The difficulty last picked (§1): it leads the home screen. */
  lastDifficulty: Difficulty;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastResult: LastResult | null;
  startNewGame: (difficulty: Difficulty) => void;
  resumeGame: () => void;
  /** Puts a symbol in the first empty slot. False when refused (§3). */
  pushSymbol: (symbol: number) => boolean;
  /** Empties the last filled slot. False when the row is empty (§3). */
  popSymbol: () => boolean;
  /** Empties one slot. False when it was already empty (§3). */
  clearSlot: (slot: number) => boolean;
  /** Checks the composed row. False unless it is full and valid (§3, §5). */
  checkGuess: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const HitAndBlowContext = createContext<HitAndBlowContextValue | null>(null);

export interface HitAndBlowProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialSession: HitAndBlowSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

export function HitAndBlowProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialSession,
  onExit,
  entry,
  children,
}: HitAndBlowProviderProps) {
  /**
   * Whether this launch opens straight onto the saved game rather than the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with: a launch means whatever it meant when it happened.
   *
   * Only a home-screen shortcut asks — a tile on the collection, and the
   * browser, open this game's home as they always did. There is one slot
   * (§8), and `loadSavedGame` has already discarded everything that is not a
   * live game, so a session at all IS the one suspended game. Quick Rules
   * still come first: a first launch teaches the game before it shows a
   * board (§9).
   */
  const [resumeDirectly] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeDirectly ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<HitAndBlowSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const statsRef = useRef(stats);
  statsRef.current = stats;

  /**
   * The seconds the game this mount holds already carries. There is one
   * slot, so it is the same session whichever door the launch came through
   * — which is why this is not gated on the resume: a launch that stops on
   * the game's own home reaches `syncActiveGame` too, and from a zero
   * baseline that saves `elapsedSeconds: 0` over the suspended game
   * (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this game. The same
   * baseline, and it has to be: a suspended game arrives with its seconds
   * already in `totalPlaySeconds` — they were booked by the sync that saved
   * it. The two are one invariant; neither moves without the other.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this game's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: HitAndBlowSession): HitAndBlowSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref is what the callbacks below read, and two of them can fire in
    // one tick — a game is booked and the next one started from the same
    // tap. React has not re-rendered in between, so the ref is advanced here.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistPrefs = useCallback((next: Prefs) => {
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /**
   * Books a game's unbooked play time, and — only when it was actually
   * solved — the solve, once (§7). A game abandoned for a new one books its
   * time and nothing else: it counted as played when it started.
   */
  const finalizeGame = useCallback(
    (game: HitAndBlowSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, game.elapsedSeconds - bookedRef.current);
      bookedRef.current = game.elapsedSeconds;
      const timed = applyPlayTime(statsRef.current, unbooked);
      if (game.status !== 'won') {
        persistStats(timed);
        return;
      }
      const guesses = guessCount(game);
      const outcome = applySolved(timed, game.difficulty, guesses);
      persistStats(outcome.stats);
      setLastResult({
        guesses,
        previousBest: outcome.previousBest,
        isNewBest: outcome.isNewBest,
        best: outcome.best,
      });
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: HitAndBlowSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Brings a game on screen and hands the clock over to it. */
  const activate = useCallback((next: HitAndBlowSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const startNewGame = useCallback(
    (difficulty: Difficulty) => {
      const current = sessionRef.current;
      if (current && current.status === 'playing') finalizeGame(withElapsed(current));

      // Remembered for the next visit to the home screen (§1). Picking and
      // starting are one tap, so the ref is advanced by persistPrefs itself.
      if (prefsRef.current.difficulty !== difficulty) {
        persistPrefs({ ...prefsRef.current, difficulty });
      }

      const next = createSession(difficulty);
      finalizedRef.current = false;
      setLastResult(null);
      persistStats(applyGameStart(statsRef.current, difficulty));
      putSession(next);
      activate(next);
      void saveGame(next);
    },
    [activate, finalizeGame, persistPrefs, persistStats, putSession, withElapsed],
  );

  /** Edits the row being composed — memory only; the draft is not saved (§8). */
  const editDraft = useCallback(
    (edit: (current: HitAndBlowSession) => HitAndBlowSession | null): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const next = edit(current);
      if (!next) return false;
      putSession(next);
      return true;
    },
    [putSession],
  );

  const pushSymbol = useCallback(
    (symbol: number) => editDraft((current) => pushDraftSymbol(current, symbol)),
    [editDraft],
  );

  const popSymbol = useCallback(() => editDraft(popDraftSymbol), [editDraft]);

  const clearSlot = useCallback(
    (slot: number) => editDraft((current) => clearDraftSlot(current, slot)),
    [editDraft],
  );

  const checkGuess = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = submitGuess(withElapsed(current));
    if (!next) return false;
    putSession(next);
    if (next.status === 'playing') {
      void saveGame(next);
      return true;
    }
    void clearSavedGame();
    finalizeGame(next);
    recordGameCompleted();
    return true;
  }, [finalizeGame, putSession, withElapsed]);

  /** Saves the on-screen game and books its play time so far. */
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
    flagsRef.current = next;
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

  // Save when the app goes to background / gets hidden (§8). This is the same
  // sync as leaving the screen, statistics included: the OS can kill a
  // backgrounded app without sending another event, and the next launch hands
  // the restored elapsedSeconds back as *already booked*.
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
        // Leaving Quick Rules by Back counts as having seen them (issue #142):
        // otherwise this game opens on the tutorial on every launch.
        if (screen === 'tutorial') completeTutorial();
        syncActiveGame();
        setScreen('home');
      }
    });
    return () => {
      void backHandle.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [screen, exitToCollection, syncActiveGame, completeTutorial]);

  const value = useMemo<HitAndBlowContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      lastDifficulty: prefs.difficulty,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastResult,
      startNewGame,
      resumeGame,
      pushSymbol,
      popSymbol,
      clearSlot,
      checkGuess,
      goHome,
      exitToCollection,
      completeTutorial,
    }),
    [
      screen,
      navigate,
      session,
      stats,
      prefs.difficulty,
      flags.tutorialCompleted,
      lastResult,
      startNewGame,
      resumeGame,
      pushSymbol,
      popSymbol,
      clearSlot,
      checkGuess,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <HitAndBlowContext.Provider value={value}>{children}</HitAndBlowContext.Provider>;
}

export function useHitAndBlow(): HitAndBlowContextValue {
  const value = useContext(HitAndBlowContext);
  if (!value) throw new Error('useHitAndBlow must be used inside HitAndBlowProvider');
  return value;
}
