/**
 * Echo Pads's app context: screens, the run on screen, the playback that
 * shows it, statistics, the per-level record, the Pace, and persistence
 * (docs/ECHO_PADS_RULES.md §4–§9). Pure local state — no analytics, no ad
 * orchestration; the only ad surfaces are the shared BannerSlot and
 * ResultAdSlot the screens render.
 *
 * Two runs are suspended independently — one level run, one daily (§9, the
 * two-slot rule) — so switching modes never costs the player either one. A
 * run is saved when it starts, on ▶, on the first press of a round, when a
 * round is returned, on every way off the game screen (an unmount included),
 * and whenever the app goes to the background. A press in the middle of a
 * round writes nothing: where the presses had got to is never kept (§8,
 * decision 8 (B)). A cleared or failed run is cleared from its slot in the
 * same step and booked into the statistics; a reload cannot take it back.
 *
 * PLAYBACK — the one thing in the collection the device moves on its own
 * (§4, owner decision 2). It starts only from `playOrStop`, which a tap or a
 * key calls; it walks the timetable `game/` builds with ONE `setTimeout`
 * chain, lighting a pad and sounding its tone from the timer at the moment
 * it lights, so nothing is queued on the audio clock. It stops — and never
 * comes back by itself — on Stop, the background (visibilitychange hidden,
 * native pause), a window `blur`, Back and an unmount: all of them pass
 * through `haltPlayback`, which cancels the chain and hands the session to
 * `endPlayback`. Starting a run, resuming one, or coming back from the
 * background never starts a playback (§4 condition 1, §8).
 *
 * Every state change goes through one seam per record, and that seam moves
 * the ref before it calls setState (docs/ARCHITECTURE.md「状態と ref」,
 * src/test/refLeading.test.ts): a key press and a timer can land in one
 * task, and the second must read what the first wrote.
 *
 * The play clock lives in a mutable ref and does NOT set React state, so
 * nothing re-renders while a run sits there; it is never shown (§9).
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
import { padTone, primeSound } from '../../../services/sound';
import { saveRecord } from '../../../storage/repo';
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  addElapsed,
  addRowSeconds,
  beginDailyRun,
  beginLevelRun,
  buildTimetable,
  canChangePace,
  countRunEnd,
  countRunStart,
  createDailySession,
  createLevelSession,
  endPlayback,
  isFinished,
  isPlayingBack,
  isUnlocked,
  LEVEL_COUNT,
  localDateString,
  nextLevelInTier,
  PACE_TIMING,
  play,
  playbackEvents,
  press,
  recordDailyClear,
  recordLevelClear,
  roundSequence,
  statsRowFor,
  type EchoProgress,
  type EchoSession,
  type EchoStats,
  type GameMode,
  type Pace,
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

export type Screen = 'home' | 'tutorial' | 'game' | 'levels' | 'stats';

/** How long a pressed pad stays lit: the press confirmed, not a question (§5). */
export const PRESS_FLASH_MS = 180;
/** How long a pressed pad's tone rings. */
const PRESS_TONE_MS = 220;

/**
 * The level a fresh start leads with: the first open level not yet cleared,
 * in ladder order (the 4-pad tier first), or level 1 once all are cleared.
 */
export function suggestedLevel(progress: EchoProgress): number {
  for (let level = 1; level <= LEVEL_COUNT; level++) {
    if (isUnlocked(progress, level) && !progress.cleared[level - 1]) return level;
  }
  return 1;
}

export interface EchoPadsContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  /** The run on screen (the active mode's slot), or null. */
  session: EchoSession | null;
  sessions: SavedGames;
  stats: Stats;
  progress: Progress;
  pace: Pace;
  tutorialCompleted: boolean;
  dailyDoneToday: boolean;
  /** The pad lit right now — by the playback, or by the press just made. */
  litPad: number | null;
  /** Changes whenever a run comes on screen: a new one, a retry, a resume. */
  sessionEpoch: number;
  /** A new run at a level (a new attempt), replacing a suspended level run. */
  startLevel: (level: number) => void;
  /** Today's daily — resumed when it is in progress (§7). */
  startDaily: () => void;
  resumeGame: (mode: GameMode) => void;
  /** The first Quick Rules' last button: the suspended level run, or the suggested level. */
  startFromTutorial: () => void;
  /** After a clear or a failure: the same level (or today's daily) with a new sequence (§1). */
  retry: () => void;
  /** After a clear: the next level of the tier. */
  startNextLevel: () => void;
  /** The one ▶ / Stop control (§4, §6). */
  playOrStop: () => void;
  /** One pad press (§5). False when the rules refuse it and nothing changed. */
  pressPad: (pad: number) => boolean;
  /** Changes the Pace — refused while a playback runs (§4). */
  setPace: (pace: Pace) => void;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const EchoPadsContext = createContext<EchoPadsContextValue | null>(null);

export interface EchoPadsProviderProps {
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
const INITIAL_MODE: GameMode = 'level';

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export function EchoPadsProvider({
  initialStats,
  initialFlags,
  initialPrefs,
  initialProgress,
  initialSessions,
  onExit,
  entry,
  children,
}: EchoPadsProviderProps) {
  /**
   * The suspended run this launch opens straight onto, or null for the home
   * screen (issue #113). Decided once, from the records the provider was
   * mounted with. Only a home-screen shortcut asks, and only once Quick Rules
   * are behind the player. Opening onto a run never starts its playback (§8).
   */
  const [resumeMode] = useState<GameMode | null>(() =>
    entry === 'shortcut' && initialFlags.tutorialCompleted
      ? soleSuspendedMode(initialSessions)
      : null,
  );
  /** The slot this mount is pointed at, read by the active mode and the clock alike. */
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
  const [litPad, setLitPad] = useState<number | null>(null);
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
   * The seconds the run on that slot already carries — read from the slot
   * itself, not gated on the resume: a launch that stops on the game's own
   * home reaches `syncActiveGame` too (issue #109).
   */
  const mountedSeconds = initialSessions[mountedMode]?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /** Play seconds already booked into the statistics for this run. */
  const bookedRef = useRef(mountedSeconds);

  /** The one playback timer (§4: one chain, never two timers at once). */
  const playbackTimerRef = useRef<number | null>(null);
  /** Bumped on every start and stop, so a callback already queued does nothing. */
  const playbackTokenRef = useRef(0);
  /** The pressed pad's short light. */
  const flashTimerRef = useRef<number | null>(null);

  const withElapsed = useCallback(
    (s: EchoSession): EchoSession => addElapsed(s, elapsedRef.current - s.elapsedSeconds),
    [],
  );

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: EchoStats) => {
    const record: Stats = {
      schemaVersion: 1,
      rows: { ...next.rows },
      dailyDates: [...next.dailyDates],
    };
    // The ref leads the state: a run can be booked and the next one started
    // inside one tap, and the second write reads this ref.
    statsRef.current = record;
    setStats(record);
    void saveRecord(statsSchema, record);
  }, []);

  const persistProgress = useCallback((next: EchoProgress) => {
    const record: Progress = { ...next, schemaVersion: 1 };
    // Same reason as persistStats: a clear and the next run's attempt are
    // written in one tap.
    progressRef.current = record;
    setProgress(record);
    void saveRecord(progressSchema, record);
  }, []);

  const putSession = useCallback((mode: GameMode, next: EchoSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionsRef.current = { ...sessionsRef.current, [mode]: next };
    setSessions((current) => ({ ...current, [mode]: next }));
  }, []);

  /**
   * Handles a session transition: saves a run in progress when `save` asks,
   * and books a run that has just ended — once, on the step that ended it.
   * The review playbacks after a failure move between two finished states and
   * book nothing.
   */
  const commitSession = useCallback(
    (previous: EchoSession, next: EchoSession, save: boolean) => {
      putSession(next.mode, next);
      if (!isFinished(next)) {
        if (save) void saveGame(next);
        return;
      }
      if (isFinished(previous)) return;
      // Ended: the slot goes in the same step (§8 — a reload cannot undo a
      // failure), and only the seconds not yet booked are added.
      void clearSavedGame(next.mode);
      const seconds = Math.floor(next.elapsedSeconds);
      const unbooked = Math.max(0, seconds - bookedRef.current);
      bookedRef.current = Math.max(bookedRef.current, seconds);
      const row = statsRowFor(next.mode, next.padCount);
      const cleared = next.status === 'cleared';
      let nextStats = countRunEnd(
        addRowSeconds(statsRef.current, row, unbooked),
        row,
        cleared ? 'cleared' : 'failed',
      );
      if (cleared) {
        if (next.mode === 'level' && next.level !== null) {
          persistProgress(recordLevelClear(progressRef.current, next.level));
        }
        if (next.mode === 'daily' && next.dailyDate !== null) {
          nextStats = recordDailyClear(nextStats, next.dailyDate);
        }
        // Counted on every platform; only the app ever asks (services/review).
        recordGameCompleted();
      }
      persistStats(nextStats);
    },
    [persistProgress, persistStats, putSession],
  );

  const clearFlash = useCallback(() => {
    if (flashTimerRef.current !== null) {
      window.clearTimeout(flashTimerRef.current);
      flashTimerRef.current = null;
    }
  }, []);

  const cancelPlaybackTimer = useCallback(() => {
    playbackTokenRef.current += 1;
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }, []);

  /**
   * Stops whatever is playing and lights nothing (§4): Stop, the background,
   * `blur`, Back, a new run and an unmount all come through here. A stopped
   * round playback still counted as heard, and leaves the round waiting for
   * input; a stopped review leaves the failed run as it was. Nothing resumes.
   */
  const haltPlayback = useCallback(() => {
    cancelPlaybackTimer();
    clearFlash();
    setLitPad(null);
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || !isPlayingBack(current)) return;
    const base = isFinished(current) ? current : withElapsed(current);
    const ended = endPlayback(base);
    if (ended) commitSession(current, ended, true);
  }, [cancelPlaybackTimer, clearFlash, commitSession, withElapsed]);

  /** Walks the timetable of a playback that has just begun, one timer at a time. */
  const runPlayback = useCallback(
    (playing: EchoSession, pace: Pace) => {
      cancelPlaybackTimer();
      clearFlash();
      setLitPad(null);
      const events = playbackEvents(buildTimetable(roundSequence(playing), pace));
      const { litMs } = PACE_TIMING[pace];
      const token = playbackTokenRef.current;
      const startedAt = now();
      const schedule = (index: number) => {
        const event = events[index];
        if (!event) return;
        // Measured from ▶, not from the previous event, so a late timer does
        // not push every later light back with it.
        const delay = Math.max(0, startedAt + event.at - now());
        playbackTimerRef.current = window.setTimeout(() => step(index), delay);
      };
      const step = (index: number) => {
        playbackTimerRef.current = null;
        if (token !== playbackTokenRef.current) return;
        const event = events[index];
        if (!event) return;
        if (event.kind === 'on') {
          setLitPad(event.pad);
          padTone(event.pad, litMs);
        } else if (event.kind === 'off') {
          setLitPad(null);
        } else {
          const current = sessionsRef.current[playing.mode];
          if (!current) return;
          const base = isFinished(current) ? current : withElapsed(current);
          const ended = endPlayback(base);
          if (ended) commitSession(current, ended, true);
          return;
        }
        schedule(index + 1);
      };
      schedule(0);
    },
    [cancelPlaybackTimer, clearFlash, commitSession, withElapsed],
  );

  /** Brings a mode's run on screen and hands the clock over to it. */
  const activate = useCallback((next: EchoSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    setActiveMode(next.mode);
    activeModeRef.current = next.mode;
    setSessionEpoch((epoch) => epoch + 1);
    setScreen('game');
  }, []);

  /** Books the seconds the run on screen has played and not yet booked. */
  const bookActivePlayTime = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || isFinished(current)) return;
    const unbooked = Math.max(0, Math.floor(elapsedRef.current) - bookedRef.current);
    if (unbooked === 0) return;
    bookedRef.current += unbooked;
    persistStats(
      addRowSeconds(statsRef.current, statsRowFor(current.mode, current.padCount), unbooked),
    );
  }, [persistStats]);

  /** Starts a run: counted as played, saved at once (§9). Playback waits for ▶. */
  const beginSession = useCallback(
    (next: EchoSession) => {
      haltPlayback();
      bookActivePlayTime();
      persistStats(countRunStart(statsRef.current, statsRowFor(next.mode, next.padCount)));
      putSession(next.mode, next);
      activate(next);
      void saveGame(next);
    },
    [activate, bookActivePlayTime, haltPlayback, persistStats, putSession],
  );

  const resumeGame = useCallback(
    (mode: GameMode) => {
      const current = sessionsRef.current[mode];
      if (current && !isFinished(current)) {
        haltPlayback();
        bookActivePlayTime();
        activate(current);
      }
    },
    [activate, bookActivePlayTime, haltPlayback],
  );

  const startLevel = useCallback(
    (level: number) => {
      // The attempt is used up as the run starts (§9): a failure, a clear and
      // a replaced run all move on to a seed never handed out before.
      const begun = beginLevelRun(progressRef.current, level);
      if (!begun) return;
      const next = createLevelSession(level, begun.attempt);
      if (!next) return;
      persistProgress(begun.progress);
      beginSession(next);
    },
    [beginSession, persistProgress],
  );

  const startDaily = useCallback(() => {
    const today = localDateString(new Date());
    const current = sessionsRef.current.daily;
    if (current && current.dailyDate === today && !isFinished(current)) {
      resumeGame('daily');
      return;
    }
    const begun = beginDailyRun(progressRef.current, today);
    const next = createDailySession(today, begun.attempt);
    // A device date that is not a calendar date deals nothing: stay put.
    if (!next) return;
    persistProgress(begun.progress);
    beginSession(next);
  }, [beginSession, persistProgress, resumeGame]);

  const startFromTutorial = useCallback(() => {
    const suspended = sessionsRef.current.level;
    if (suspended && !isFinished(suspended)) {
      resumeGame('level');
      return;
    }
    startLevel(suggestedLevel(progressRef.current));
  }, [resumeGame, startLevel]);

  const retry = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    if (current.mode === 'level' && current.level !== null) startLevel(current.level);
    else startDaily();
  }, [startDaily, startLevel]);

  const startNextLevel = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current || current.mode !== 'level' || current.level === null) return;
    const next = nextLevelInTier(current.level);
    if (next !== null) startLevel(next);
  }, [startLevel]);

  const playOrStop = useCallback(() => {
    const current = sessionsRef.current[activeModeRef.current];
    if (!current) return;
    if (isPlayingBack(current)) {
      haltPlayback();
      return;
    }
    const pace = prefsRef.current.pace;
    const base = isFinished(current) ? current : withElapsed(current);
    const next = play(base, pace);
    if (!next) return;
    // Inside the tap: a browser that unlocks audio only from a gesture has
    // the context running before the first tone, 600 ms from now (§12).
    primeSound();
    commitSession(current, next, true);
    runPlayback(next, pace);
  }, [commitSession, haltPlayback, runPlayback, withElapsed]);

  const pressPad = useCallback(
    (pad: number): boolean => {
      const current = sessionsRef.current[activeModeRef.current];
      if (!current || isFinished(current)) return false;
      const next = press(withElapsed(current), pad);
      if (!next) return false;
      padTone(pad, PRESS_TONE_MS);
      clearFlash();
      setLitPad(pad);
      flashTimerRef.current = window.setTimeout(() => {
        flashTimerRef.current = null;
        setLitPad(null);
      }, PRESS_FLASH_MS);
      // Written on the round's first press and when a round is returned —
      // never in the middle of a round (§9).
      const save = next.round !== current.round || next.inputStarted !== current.inputStarted;
      commitSession(current, next, save);
      return true;
    },
    [clearFlash, commitSession, withElapsed],
  );

  const setPace = useCallback((pace: Pace) => {
    const current = sessionsRef.current[activeModeRef.current];
    if (current && !canChangePace(current)) return;
    if (prefsRef.current.pace === pace) return;
    const next: Prefs = { ...prefsRef.current, pace };
    prefsRef.current = next;
    setPrefs(next);
    void saveRecord(prefsSchema, next);
  }, []);

  /** Stops the playback, saves the run on screen and books its play time so far. */
  const syncActiveGame = useCallback(() => {
    haltPlayback();
    const mode = activeModeRef.current;
    const current = sessionsRef.current[mode];
    if (current && !isFinished(current)) {
      const synced = withElapsed(current);
      putSession(mode, synced);
      void saveGame(synced);
      const unbooked = Math.max(0, Math.floor(synced.elapsedSeconds) - bookedRef.current);
      if (unbooked > 0) {
        bookedRef.current += unbooked;
        persistStats(
          addRowSeconds(statsRef.current, statsRowFor(synced.mode, synced.padCount), unbooked),
        );
      }
    }
  }, [haltPlayback, persistStats, putSession, withElapsed]);

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

  // Play clock: one second at a time while a run is on screen and not over.
  // Mutates the ref only. A hidden page does not count.
  const playing = screen === 'game' && session !== null && !isFinished(session);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing]);

  // The background stops the playback and saves (§4, §8): the same sync as
  // leaving the screen, in one synchronous pass — the OS can kill a
  // backgrounded app without sending another event.
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

  // Losing the window's focus stops the playback too (§4, as Snake §6 does):
  // another window on top, a system dialog, the notification shade.
  useEffect(() => {
    window.addEventListener('blur', haltPlayback);
    return () => window.removeEventListener('blur', haltPlayback);
  }, [haltPlayback]);

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a shortcut to another game take this provider off
  // screen without goHome. The same sync runs then — it stops the playback
  // chain and the press light, and books only what `bookedRef` has not.
  useOnUnmount(syncActiveGame);

  // Android hardware back: leave sub-screens (the run saved, its playback
  // stopped); from the game's home, hand control back to the collection.
  // Registered once, on native only, and the handle goes with the effect
  // (docs/ARCHITECTURE.md「ハードウェア戻るボタン」, src/test/gameBackButtonWiring.test.ts).
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
  const value = useMemo<EchoPadsContextValue>(
    () => ({
      screen,
      navigate,
      session,
      sessions,
      stats,
      progress,
      pace: prefs.pace,
      tutorialCompleted: flags.tutorialCompleted,
      dailyDoneToday: stats.dailyDates.includes(today),
      litPad,
      sessionEpoch,
      startLevel,
      startDaily,
      resumeGame,
      startFromTutorial,
      retry,
      startNextLevel,
      playOrStop,
      pressPad,
      setPace,
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
      prefs.pace,
      flags.tutorialCompleted,
      today,
      litPad,
      sessionEpoch,
      startLevel,
      startDaily,
      resumeGame,
      startFromTutorial,
      retry,
      startNextLevel,
      playOrStop,
      pressPad,
      setPace,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <EchoPadsContext.Provider value={value}>{children}</EchoPadsContext.Provider>;
}

export function useEchoPads(): EchoPadsContextValue {
  const value = useContext(EchoPadsContext);
  if (!value) throw new Error('useEchoPads must be used inside EchoPadsProvider');
  return value;
}
