/**
 * Scopa's app context: screens, the match in progress, statistics and
 * persistence (docs/SCOPA_RULES.md §4.2, §8, §9). Pure local state — no
 * analytics, no ad orchestration; the only ad surfaces are the shared
 * BannerSlot and ResultAdSlot the screens render.
 *
 * One match at a time, saved as it is played: after every card, every refill
 * and every settled deal that does not decide the match. The deal that does
 * decide it is not saved — the save is removed in the same update that books
 * the result (§9.2「マッチが終わったら」).
 *
 * THE TABLE'S BEATS ARE ONE TIMER. Whenever the game screen is showing, the
 * page is visible and `beatOwed` (game/session.ts) names a beat — three cards
 * each, or the CPU's card — one timeout is armed for `CPU_DELAY_MS`. The
 * effect depends on the session itself, so every transition re-evaluates it;
 * anything that changes the session first (a new match, leaving the screen,
 * unmounting) disarms a stale one through the cleanup, and the landed timeout
 * asks `beatOwed` again before it plays. A settled deal owes nothing: the next
 * deal waits for the player's tap. Resuming a save on the CPU's turn, or in
 * front of a refill, needs nothing special — the same effect picks it up.
 *
 * In the background the beat stops (§4.2): the effect reads whether the page
 * is visible (`visibilitychange`, and Capacitor's `pause` / `resume` on
 * native), so hiding the page clears the waiting timer, and nothing moves
 * while it is hidden. Coming back re-arms the owed beat from the full
 * `CPU_DELAY_MS` — a beat is the CPU's answer to the player's own card, never
 * a backlog to catch up on, and never fired the instant the page returns.
 * (That reading of 「復帰しても勝手に再開しない」 is awaiting the owner's
 * confirmation; the alternative waits for a tap instead — §4.2.)
 *
 * **There is no undo here, and no place to add one** (§6): the session layer
 * offers none, because taking a card back after the CPU's reply and three new
 * cards would hand back what you now know.
 *
 * Battery note: the play clock lives in a mutable ref and does NOT set React
 * state, so nothing re-renders while a match is running. It is never shown
 * either (§8); elapsed time is merged into the session whenever it leaves
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
import { useOnUnmount } from '../../../ui/useOnUnmount';
import {
  applyBeat,
  beatOwed,
  canDealNextDeal as canDeal,
  CPU,
  createSession,
  doNextDeal,
  doPlay,
  YOU,
  type DealOutcome,
  type MatchStatus,
  type Move,
  type ScopaSession,
  type TurnEvent,
  type TurnOutcome,
} from '../game';
import { clearSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema, type Flags, type Stats } from '../storage/schemas';
import { applyGameStart, applyMatchEnd, applyPlayTime } from './statsLogic';

export type Screen = 'home' | 'tutorial' | 'game' | 'stats';

/** One beat of the table: three cards each, or one card from the CPU (§4.2). */
export const CPU_DELAY_MS = 450;

/** What just happened at the table, for the screen's sounds, folds and line. */
export interface LastEvent {
  readonly event: TurnEvent;
  /** Set when this beat was the thirty-sixth card and the deal scored. */
  readonly dealResult: DealOutcome | null;
  /**
   * Identity: one screen effect per beat. Not the move count — a refill is a
   * beat of its own and does not advance it.
   */
  readonly serial: number;
}

/** The match's end, told from the player's side of the table. */
export interface LastResult {
  readonly status: MatchStatus;
  readonly mine: number;
  readonly theirs: number;
}

export interface ScopaContextValue {
  screen: Screen;
  navigate: (screen: Screen) => void;
  session: ScopaSession | null;
  stats: Stats;
  tutorialCompleted: boolean;
  canResume: boolean;
  lastEvent: LastEvent | null;
  /** The settled deal waiting for the next one to be asked for, or null. */
  dealResult: DealOutcome | null;
  /** Set once the match itself is over. Null while one is being played. */
  lastResult: LastResult | null;
  startNewGame: () => void;
  resumeGame: () => void;
  /** The player's card, and what it takes. False when the rules or the turn refuse it. */
  play: (move: Move) => boolean;
  /** Deals the deal after a settled one. False when none is waiting. */
  dealNextDeal: () => boolean;
  goHome: () => void;
  exitToCollection: () => void;
  completeTutorial: () => void;
}

const ScopaContext = createContext<ScopaContextValue | null>(null);

export interface ScopaProviderProps {
  initialStats: Stats;
  initialFlags: Flags;
  initialSession: ScopaSession | null;
  /** Provided by the shell: hands control back to the collection home. */
  onExit: () => void;
  /** Provided by the shell: which door this launch came through (issue #113). */
  entry?: 'collection' | 'shortcut';
  children: ReactNode;
}

const pageVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

export function ScopaProvider({
  initialStats,
  initialFlags,
  initialSession,
  onExit,
  entry,
  children,
}: ScopaProviderProps) {
  /**
   * Whether this launch opens straight onto the saved match instead of the
   * home screen (issue #113). Decided once, from the records the provider was
   * mounted with. There is one slot (§9), and the loader has already answered
   * the whole question — a record the decoder refuses, a finished match: both
   * come back null — so a session here IS the one match there is to come back
   * to. Quick Rules still come first (§10): a save can outlive a lost flag.
   */
  const [resumeAtMount] = useState(
    () => entry === 'shortcut' && initialFlags.tutorialCompleted && initialSession !== null,
  );
  const [screen, setScreen] = useState<Screen>(
    resumeAtMount ? 'game' : initialFlags.tutorialCompleted ? 'home' : 'tutorial',
  );
  const [session, setSession] = useState<ScopaSession | null>(initialSession);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [flags, setFlags] = useState<Flags>(initialFlags);
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  /** Whether the page is on screen: the table's beats run only while it is (§4.2). */
  const [visible, setVisible] = useState(pageVisible);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const serialRef = useRef(0);

  /**
   * The seconds the match this mount holds already carries. There is one
   * slot, so it is the same match whichever door the launch came through —
   * which is why this is not gated on the resume: a launch that stops on the
   * game's own home reaches `syncActiveGame` too, and from a zero baseline
   * that saves `elapsedSeconds: 0` over the suspended match (issue #109).
   */
  const mountedSeconds = initialSession?.elapsedSeconds ?? 0;
  /** The live play clock (seconds). Mutated by the interval, never state. */
  const elapsedRef = useRef(mountedSeconds);
  /**
   * Play seconds already booked into the statistics for this match. The same
   * baseline: a suspended match arrives with its seconds already booked by
   * the sync that saved it, so the two refs move together or not at all.
   */
  const bookedRef = useRef(mountedSeconds);
  /** Whether this match's result has been booked; it happens exactly once. */
  const finalizedRef = useRef(false);

  const withElapsed = useCallback((s: ScopaSession): ScopaSession => {
    return s.elapsedSeconds === elapsedRef.current
      ? s
      : { ...s, elapsedSeconds: elapsedRef.current };
  }, []);

  const navigate = useCallback((next: Screen) => setScreen(next), []);

  const persistStats = useCallback((next: Stats) => {
    // The ref leads the state: a match can be booked and the next one started
    // inside one tap, and the second write reads this ref.
    statsRef.current = next;
    setStats(next);
    void saveRecord(statsSchema, next);
  }, []);

  /**
   * Books a match's unbooked play time, and — only when it actually ended —
   * its result, once. A match abandoned for a new one books its time and
   * nothing else: it counted as played when it started (§8).
   */
  const finalizeMatch = useCallback(
    (match: ScopaSession) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      const unbooked = Math.max(0, match.elapsedSeconds - bookedRef.current);
      bookedRef.current = match.elapsedSeconds;
      persistStats(applyMatchEnd(applyPlayTime(statsRef.current, unbooked), match.status));
    },
    [persistStats],
  );

  /** The one door the session goes through, so the ref cannot be forgotten. */
  const putSession = useCallback((next: ScopaSession | null) => {
    // The ref leads the state deliberately (docs/ARCHITECTURE.md「状態と ref」):
    // React batches what one task raises, so a second mutation in that task
    // would otherwise start from the session the first one already replaced.
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Handles a session transition, persisting or finalizing as needed. */
  const commitSession = useCallback(
    (next: ScopaSession) => {
      putSession(next);
      if (next.status === 'playing') {
        void saveGame(next);
        return;
      }
      // The deciding deal is not saved: the save goes in the same update that
      // books the result (§9.2).
      void clearSavedGame();
      finalizeMatch(next);
      // The review question counts games *won* (docs/REVIEW_PROMPT_POLICY.md),
      // and the win here is the match — never a deal (§8).
      if (next.status === 'won') recordGameCompleted();
      setLastResult({ status: next.status, mine: next.scores[YOU], theirs: next.scores[CPU] });
    },
    [finalizeMatch, putSession],
  );

  /** Records one beat for the screen and commits what it left. */
  const land = useCallback(
    (outcome: TurnOutcome) => {
      serialRef.current += 1;
      setLastEvent({
        event: outcome.event,
        dealResult: outcome.dealResult,
        serial: serialRef.current,
      });
      commitSession(outcome.session);
    },
    [commitSession],
  );

  /** Brings a match on screen and hands the clock over to it. */
  const activate = useCallback((next: ScopaSession) => {
    elapsedRef.current = next.elapsedSeconds;
    bookedRef.current = next.elapsedSeconds;
    // A table that arrives rather than plays out has nothing to animate.
    setLastEvent(null);
    setScreen('game');
  }, []);

  const resumeGame = useCallback(() => {
    const current = sessionRef.current;
    if (current) activate(current);
  }, [activate]);

  const startNewGame = useCallback(() => {
    const current = sessionRef.current;
    if (current && current.status === 'playing') finalizeMatch(withElapsed(current));

    const next = createSession();
    finalizedRef.current = false;
    persistStats(applyGameStart(statsRef.current));
    setLastResult(null);
    putSession(next);
    activate(next);
    void saveGame(next);
  }, [activate, finalizeMatch, persistStats, putSession, withElapsed]);

  /**
   * The player's card. The session answers null when the rules or the turn
   * order refuse it, and the screen only offers what is legal — so a stray tap
   * is nothing, silently (§2.5).
   */
  const play = useCallback(
    (move: Move): boolean => {
      const current = sessionRef.current;
      if (!current) return false;
      const outcome = doPlay(withElapsed(current), move);
      if (!outcome) return false;
      land(outcome);
      return true;
    },
    [land, withElapsed],
  );

  /**
   * The next deal, after the settled one has been read. A tap rather than a
   * timer: the settlement is the one thing in this game worth reading, and
   * nothing takes it off the screen on its own (§4.2, §11.2).
   */
  const dealNextDeal = useCallback((): boolean => {
    const current = sessionRef.current;
    if (!current) return false;
    const next = doNextDeal(withElapsed(current));
    if (!next) return false;
    // A fresh deal arrives rather than plays out: nothing to animate.
    setLastEvent(null);
    commitSession(next);
    return true;
  }, [commitSession, withElapsed]);

  // The table's beat: one armed timeout whenever the game screen shows a live
  // session that owes one and the page is visible. See the file comment.
  useEffect(() => {
    if (screen !== 'game' || !visible || !session || beatOwed(session) === null) return;
    const id = window.setTimeout(() => {
      const current = sessionRef.current;
      if (!current) return;
      const beat = beatOwed(current);
      if (beat === null) return;
      const outcome = applyBeat(withElapsed(current), beat);
      if (!outcome) return;
      land(outcome);
    }, CPU_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [screen, visible, session, land, withElapsed]);

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
  // Mutates the ref only — zero React work per tick (battery). It reads the
  // same `visible` flag as the beat, so a native `pause` that arrives without a
  // `visibilitychange` stops both (§4.2, §8); the document check stays for a
  // tick that lands between the page hiding and the flag's re-render.
  const playing = screen === 'game' && session?.status === 'playing';
  useEffect(() => {
    if (!playing || !visible) return;
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      elapsedRef.current += 1;
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, visible]);

  // Background / foreground. Going away saves the table and books the play
  // time in the same sync (the OS can kill a backgrounded app without another
  // event, and the next launch treats the restored seconds as already booked),
  // and stops the beat; coming back lets the beat effect re-arm from the full
  // delay (§4.2, §9.3).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        syncActiveGame();
        setVisible(false);
      } else {
        setVisible(true);
      }
    };
    const onPause = () => {
      syncActiveGame();
      setVisible(false);
    };
    const onResume = () => setVisible(true);
    document.addEventListener('visibilitychange', onVisibility);
    const native = Capacitor.isNativePlatform();
    const pauseHandle = native ? CapacitorApp.addListener('pause', onPause) : null;
    const resumeHandle = native ? CapacitorApp.addListener('resume', onResume) : null;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      void pauseHandle?.then((handle) => handle.remove()).catch(() => undefined);
      void resumeHandle?.then((handle) => handle.remove()).catch(() => undefined);
    };
  }, [syncActiveGame]);

  // Unmounting is a way out too (docs/GAME_LIFECYCLE.md「アンマウントで計上する」):
  // the browser's Back and a home-screen shortcut to another game take this
  // provider off screen without goHome, exitToCollection or a
  // visibilitychange. The same sync runs then, and it books only what
  // `bookedRef` has not — after either exit, or a background, it adds nothing.
  useOnUnmount(syncActiveGame);

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

  const value = useMemo<ScopaContextValue>(
    () => ({
      screen,
      navigate,
      session,
      stats,
      tutorialCompleted: flags.tutorialCompleted,
      canResume: session?.status === 'playing',
      lastEvent,
      dealResult: session !== null && canDeal(session) ? session.lastDeal : null,
      lastResult,
      startNewGame,
      resumeGame,
      play,
      dealNextDeal,
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
      lastEvent,
      lastResult,
      startNewGame,
      resumeGame,
      play,
      dealNextDeal,
      goHome,
      exitToCollection,
      completeTutorial,
    ],
  );

  return <ScopaContext.Provider value={value}>{children}</ScopaContext.Provider>;
}

export function useScopa(): ScopaContextValue {
  const value = useContext(ScopaContext);
  if (!value) throw new Error('useScopa must be used inside ScopaProvider');
  return value;
}
