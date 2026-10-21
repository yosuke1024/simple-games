/**
 * Tangram's app context: screens, the figure on screen, statistics, the
 * per-figure record, its one preference, and persistence
 * (docs/TANGRAM_RULES.md §6–§8). Pure local state — no analytics, no ad
 * orchestration; the only ad surfaces are the shared BannerSlot and
 * ResultAdSlot the screens render.
 *
 * Two figures are suspended independently — one Free Play figure, one daily
 * (§8「2 スロット」) — so switching modes never costs the player either one.
 * A figure is saved when it starts, after every operation and every Undo, on
 * every way off the game screen (an unmount included), and whenever the app
 * goes to the background. A completed figure is cleared the moment it is
 * complete and booked into the statistics; it cannot be undone (§3).
 *
 * A piece in the hand — dragged, or lifted by the keyboard — is the screen's
 * state, never the session's (§8「手にある駒」): nothing here knows about it,
 * so every save writes the pieces where they were before they were picked
 * up, and a background, a Back press or an unmount simply abandons it.
 *
 * Every state change goes through one seam per record, and that seam moves
 * the ref before it calls setState (docs/ARCHITECTURE.md「状態と ref」,
 * src/test/refLeading.test.ts): a drop and a key press can land in one task,
 * and the second must read what the first wrote.
 *
 * Nothing here runs on its own. There is no search, no generator and no timer
 * beyond the play clock, and coming back from the background resumes nothing.
 * The clock lives in a mutable ref and does NOT set React state, so nothing
 * re-renders while a figure sits there; it is never shown during play (§7).
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
  createDailySession,
  createSession,
  figureNumber,
  flipPiece,
  localDateString,
  nextFigure,
  placePiece,
  restartSession,
  returnToTray,
  rotatePiece,
  undo,
  withElapsedSeconds,
  type Figure,
  type GameMode,
  type PieceId,
  type Placement,
  type TangramSession,
  type Tier,
} from '../game';
import {
  clearSavedGame,
  saveGame,
  soleSuspendedMode,
  type SavedGames,
} from '../storage/gamePersistence';
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
import {
  applyCompletion,
  applyGameStart,
  applyLastStarted,
  applyPlayTime,
  bucketOf,
  isSolvedIn,
} from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** What the result card shows about the figure just completed (§7). */
export interface LastResult {
  readonly mode: GameMode;
  readonly tier: Tier;
  /** The figure's place in its tier's list, 1-based (§2). */
  readonly number: number;
  readonly dailyDate: string | null;
  readonly seconds: number;
  /**
   * The record before this completion, or null on a first one: the figure's
   * fastest Free Play time, or that day's fastest daily (§7 `BestDelta`).
   */
  readonly previous: number | null;
}

export interface TangramContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The figure on screen (the active mode's slot), or null. */
  session: TangramSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  prefs: Prefs;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  lastResult: LastResult | null;
  /** Changes whenever a figure comes on screen: a new one, a retry, a resume. */
  sessionEpoch: number;
  /** The figure a tier's home button would start (§6 `next(tier, last)`). */
  nextFigureOf: (tier: Tier) => Figure;
  /** Starts the tier's next figure from the home, replacing a suspended one (§6). */
  startTier: (tier: Tier) => void;
  /** The result card's "Next figure": `next(tier, the figure just completed)` (§6). */
  startNextFigure: () => void;
  /** The same figure from the start: every non-fixed piece back in the tray (§6). */
  restartCurrent: () => void;
  /** Today's figure — resumed when it is in progress (§6「デイリーチャレンジ」). */
  startDaily: () => void;
  resumeGame: (mode: GameMode) => void;
  /** The first Quick Rules' last button: the suspended figure, or the next of the last tier (§8). */
  startFromTutorial: () => void;
  /** One operation each (§3). False when the rules refuse it and nothing changed. */
  place: (id: PieceId, placement: Placement) => boolean;
  toTray: (id: PieceId) => boolean;
  rotate: (id: PieceId) => boolean;
  flip: (id: PieceId) => boolean;
  applyUndo: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const TangramContext = createContext<TangramContextValue | null>(null);

export interface TangramProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialPrefs: Prefs;
  initialProgress: Progress;
  initialSessions: SavedGames;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

/**
 * The mode a freshly mounted game is pointed at when nothing is resumed.
 * Named because the play-clock baseline has to be read from the same slot.
 */
const INITIAL_MODE: GameMode = 'free';

export function TangramProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialProgress,
  initialSessions,
  onExit,
  entry,
  children,
}: TangramProviderProps) {
  /**
   * The suspended figure this launch opens straight onto, or null for the
   * home screen (issue #113, §8). Decided once, from the records the provider
   * was mounted with. Only a home-screen shortcut asks, and only once Quick
   * Rules are behind the player — a first launch teaches the game first.
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /**
   * The slot this mount is pointed at. Read by both the active mode and the
   * clock seed below, because a mode taken from one slot and a clock taken
   * from another is the whole trap (src/test/playClockSeed.test.ts).
   */
  const mountedMode = resumeMode ?? INITIAL_MODE;
  const [screen, setScreen] = useState<Screen>(
    resumeMode ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [sessions, setSessions] = useState<SavedGames>(initialSessions);
  const [activeMode, setActiveMode] = useState<GameMode>(mountedMode);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [progress, setProgress] = useState<Progress>(initialProgress);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [sessionEpoch, setSessionEpoch] = useState(0);

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
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const session = sessions[activeMode];

  /**
   * The seconds the figure on that slot already carries. Read from the slot
   * itself rather than gated on the resume: a launch that stops on the game's
   * own home reaches `syncActiveGame` too, and from a zero baseline that
   * would save `elapsedSeconds: 0` over the suspended figure (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this figure. The
   * same baseline: a suspended figure arrives with its seconds already in
   * `totalPlaySeconds` — the sync that saved it booked them.
   */
  const bookedRef = useRef(mountedSeconds);

  const withElapsed = useCallback(
    (s: TangramSession): TangramSession => withElapsedSeconds(s, elapsedRef.current),
    [],
  );

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a figure can be booked and the next one
    // started inside one tap, and the second write reads this ref.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  const persistProgress = useCallback((next: Progress) => {
    if (next === progressRef.current) return;
    // Same reason as persistStats: a completion and the next figure's `last`
    // are written in one tap.
    progressRef.current = next;
    setProgress(next);
    void saveRecord(progressSchema, next);
  }, []);

  const putSession = useCallback((mode: GameMode, next: TangramSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /** Handles a session transition: saves a figure in play, books a completed one once. */
  const commitSession = useCallback(
    (next: TangramSession) => {
      putSession(next.mode, next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // Complete: finalised once (the session refuses every operation after
      // this). Only the seconds not yet booked are added, so leaving and
      // returning cannot count the same time twice.
      void clearSavedGame(next.mode);
      const seconds = next.elapsedSeconds;
      const unbooked = Math.max(0, seconds - bookedRef.current);
      bookedRef.current = seconds;
      const bucket = bucketOf(next.mode, next.figure.tier);
      const outcome = applyCompletion(
        applyPlayTime(statsRef.current, bucket, unbooked),
        progressRef.current,
        {
          mode: next.mode,
          tier: next.figure.tier,
          figure: next.figure.id,
          dailyDate: next.dailyDate,
          seconds,
        },
      );
      persistStats(outcome.stats);
      persistProgress(outcome.progress);
      // Counted on every platform, every completion (§7); only the app asks.
      recordGameCompleted();
      setLastResult({
        mode: next.mode,
        tier: next.figure.tier,
        number: figureNumber(next.figure),
        dailyDate: next.dailyDate,
        seconds,
        previous: outcome.previous,
      });
    },
    [persistProgress, persistStats, putSession],
  );

  /** Brings a mode's figure on screen and hands the clock over to it. */
  const activate = useCallback((next: TangramSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /**
   * Books the seconds the figure on screen has played and not yet booked
   * (§7). `activate` hands the clock to the next figure, so a figure given up
   * through ↻ or the home would otherwise take its unbooked seconds with it.
   */
  const bookActivePlayTime = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.status !== 'playing') return;
    const unbooked = Math.max(0, Math.floor(elapsedRef.current) - bookedRef.current);
    if (unbooked === 0) return;
    bookedRef.current += unbooked;
    persistStats(
      applyPlayTime(statsRef.current, bucketOf(current.mode, current.figure.tier), unbooked),
    );
  }, [persistStats]);

  /** Starts a figure: counted as played, saved at once (an empty board is a figure too, §8). */
  const beginSession = useCallback(
    (next: TangramSession) => {
      bookActivePlayTime();
      persistStats(applyGameStart(statsRef.current, bucketOf(next.mode, next.figure.tier)));
      // Only a Free Play start moves the tier's place in its list (§6, §7).
      if (next.mode === 'free') {
        persistProgress(applyLastStarted(progressRef.current, next.figure.tier, next.figure.id));
      }
      setLastResult(null);
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, bookActivePlayTime, persistProgress, persistStats, putSession],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current && current.status === 'playing') {
        setLastResult(null);
        activate(current);
      }
    },
    [activate],
  );

  const nextFigureOf = useCallback(
    (tier: Tier): Figure =>
      nextFigure(tier, progressRef.current.last[tier], isSolvedIn(progressRef.current)),
    [],
  );

  /** Remembers the tier the home should lead with (§6) — written by the home's buttons only. */
  const rememberTier = useCallback((tier: Tier) => {
    if (prefsRef.current.tier === tier) return;
    const next: Prefs = { ...prefsRef.current, tier };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  const startTier = useCallback(
    (tier: Tier) => {
      rememberTier(tier);
      beginSession(createSession(nextFigureOf(tier)));
    },
    [beginSession, nextFigureOf, rememberTier],
  );

  const startNextFigure = useCallback(() => {
    const current = sessionsRef.current.free;
    if (!current) return;
    const tier = current.figure.tier;
    beginSession(
      createSession(nextFigure(tier, current.figure.id, isSolvedIn(progressRef.current))),
    );
  }, [beginSession]);

  const restartCurrent = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current) beginSession(restartSession(current));
  }, [beginSession]);

  const startDaily = useCallback(() => {
    const today = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === today && current.status === 'playing') {
      resumeGame('daily');
      return;
    }
    const next = createDailySession(today);
    // A device date that is not a calendar date deals nothing (§6): home.
    if (next) beginSession(next);
  }, [beginSession, resumeGame]);

  const startFromTutorial = useCallback(() => {
    const suspended = sessionsRef.current.free;
    if (suspended && suspended.status === 'playing') {
      resumeGame('free');
      return;
    }
    beginSession(createSession(nextFigureOf(prefsRef.current.tier)));
  }, [beginSession, nextFigureOf, resumeGame]);

  /** Applies a pure session transition to the figure on screen. */
  const mutate = useCallback(
    (apply: (s: TangramSession) => TangramSession | null): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current || current.status !== 'playing') return false;
      const next = apply(withElapsed(current));
      if (!next) return false;
      commitSession(next);
      return true;
    },
    [commitSession, withElapsed],
  );

  const place = useCallback(
    (id: PieceId, placement: Placement) => mutate((s) => placePiece(s, id, placement)),
    [mutate],
  );
  const toTray = useCallback((id: PieceId) => mutate((s) => returnToTray(s, id)), [mutate]);
  const rotate = useCallback((id: PieceId) => mutate((s) => rotatePiece(s, id)), [mutate]);
  const flip = useCallback((id: PieceId) => mutate((s) => flipPiece(s, id)), [mutate]);
  const applyUndo = useCallback(() => mutate((s) => undo(s)), [mutate]);

  /** Saves the on-screen figure and books its play time so far. */
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
        persistStats(
          applyPlayTime(statsRef.current, bucketOf(synced.mode, synced.figure.tier), unbooked),
        );
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
  // Mutates the ref only — zero React work per tick (battery). A hidden page
  // does not count: the interval skips its ticks, so a figure left in the
  // background is not charged for the time it sat there (§7).
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
  // sync as leaving the screen, statistics included, in one synchronous pass:
  // the OS can kill a backgrounded app without sending another event.
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

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange. The same sync runs then, and it books only what
  // `bookedRef` has not.
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens (the figure saved, a piece in the
  // hand abandoned with the screen); from the game's home, hand control back
  // to the collection. Registered once, on native only, and the handle goes
  // with the effect (docs/ARCHITECTURE.md「ハードウェア戻るボタン」,
  // src/test/gameBackButtonWiring.test.ts).
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

  const today = localDateString(new Date());
  const value = useMemo<TangramContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      prefs,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyTimes[today] !== undefined,
      lastResult,
      sessionEpoch,
      nextFigureOf,
      startTier,
      startNextFigure,
      restartCurrent,
      startDaily,
      resumeGame,
      startFromTutorial,
      place,
      toTray,
      rotate,
      flip,
      applyUndo,
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
      progress,
      prefs,
      flags.tutorialCompleted,
      today,
      lastResult,
      sessionEpoch,
      nextFigureOf,
      startTier,
      startNextFigure,
      restartCurrent,
      startDaily,
      resumeGame,
      startFromTutorial,
      place,
      toTray,
      rotate,
      flip,
      applyUndo,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <TangramContext.Provider value={value}>{children}</TangramContext.Provider>;
}

export function useTangram(): TangramContextValue {
  const value = useContext(TangramContext);
  if (!value) throw new Error('useTangram must be used inside TangramProvider');
  return value;
}
