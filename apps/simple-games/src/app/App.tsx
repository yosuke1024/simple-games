/**
 * The collection shell: which surface is on screen — the game list, the
 * shared settings, or one game. Games mount exclusively (battery: an
 * off-screen game does no work) and own their internal navigation; the shell
 * only ever hears "exit".
 *
 * In the browser the screen is also an address. The shell opens on whatever
 * `?game=` asks for, writes each move into history, and follows Back and
 * Forward back out again (app/webRoute.ts, issue #83). None of that runs in
 * the app, which has no address bar and whose hardware back button already
 * owns the same gesture.
 *
 * The app has one door of its own: a home-screen shortcut to a game — on
 * Android an icon pinned to the launcher (issue #110), on iOS a quick action
 * in the app icon's menu, mirrored from the favourites (issue #114). Either
 * carries the same `?game=` address, arrives through the App plugin instead
 * of the address bar — at boot for a cold start, as `appUrlOpen` for a warm
 * one (app/shortcutLaunch.ts) — and touches no history, because there is none.
 *
 * Which door was used is the one thing the shell tells a game about itself
 * (`entry`, app/registry.ts, issue #113). It is a fact, not an instruction:
 * a game that keeps a suspended game of its own may open straight onto it
 * for a shortcut, and the shell never learns how it decided — or that it
 * decided anything.
 *
 * The Club House (docs/architecture/club.md) reaches the shell through three
 * doors — Settings › Advanced, the home's one Club slot, and on the web an
 * invite link — and through nothing else. The layer itself is a chunk the
 * shell asks app/clubGate.ts for only on one of those doors, or at boot when
 * this device has already joined; what it hands back is put on screen as one
 * more view and, for the result screens, behind `ClubBridgeContext`. A game
 * opened from a Club challenge remembers that it was (`from: 'club'`), so
 * leaving it returns to that challenge rather than to the collection.
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { markReviewPromptShown, shouldPromptReview } from '../services/review';
import { releaseSound } from '../services/sound';
import {
  ClubBridgeContext,
  type ActiveChallenge,
  type ClubBridge,
  type ClubConnectionSummary,
  type ClubEntry,
  type ClubInvite,
  type ClubModule,
  type ClubPlayRequest,
} from '../ui/clubBridge';
import { GameErrorBoundary } from '../ui/components/GameErrorBoundary';
import { GameLoadingFallback } from '../ui/components/GameLoadingFallback';
import { ReviewPrompt } from '../ui/components/ReviewPrompt';
import { CollectionHomeScreen } from '../ui/screens/CollectionHomeScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import {
  clubConnections,
  isConnected,
  loadClubAtBoot,
  loadClubForEntry,
  loadClubForInvite,
  noteClubConnections,
  takeInviteFromLocation,
} from './clubGate';
import { getLazyRoot, resetLazyRoot } from './lazyRoots';
import { recordGameOpened } from './recentGames';
import { type ChallengeStart, type GameEntry, type GameId } from './registry';
import { gameIdFromShortcutUrl, shortcutLaunchGame } from './shortcutLaunch';
import {
  currentRouteGame,
  popRoute,
  pushRoute,
  settleStaleRoute,
  startRoute,
  webRoutingEnabled,
} from './webRoute';

type View =
  | { kind: 'collection' }
  | { kind: 'settings' }
  | {
      kind: 'game';
      gameId: GameId;
      entry: GameEntry;
      /** The Club challenge this game opens onto (club.md §6-2). */
      challenge?: ChallengeStart;
      /** Opened from a Club challenge: leaving goes back to the Club, not the collection. */
      from?: 'club';
    }
  | {
      kind: 'club';
      entry: ClubEntry;
      invite?: ClubInvite | null;
      focus?: { endpoint: string; challengeId: string } | null;
    };

// Measurement must never disturb a player, so a chunk that never arrives is
// swallowed — but not silently: an unheard failure is how the browser build
// shipped while sending nothing at all (issue #84). `import.meta.env.DEV` is
// false in every released build, so this folds away with its message.
function reportAnalyticsLoadFailure(error: unknown): void {
  if (import.meta.env.DEV) console.warn('web analytics did not load', error);
}

function trackWebGameOpened(gameId: GameId): void {
  if (import.meta.env.MODE !== 'web') return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return;

  void import('../services/analytics/web')
    .then((m) => m.trackGameOpened(gameId, measurementId))
    .catch(reportAnalyticsLoadFailure);
}

function trackWebGameClosed(gameId: GameId): void {
  if (import.meta.env.MODE !== 'web') return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return;

  void import('../services/analytics/web')
    .then((m) => m.trackGameClosed(gameId, measurementId))
    .catch(reportAnalyticsLoadFailure);
}

/**
 * The screen the shell opens on. In the browser that is whatever the address
 * asks for, decided before the first render so a direct link paints the game
 * rather than flashing the collection on the way to it. The app opens on the
 * collection — unless a home-screen shortcut asked for a game, which boot has
 * already read (app/shortcutLaunch.ts) so the same rule holds: the game
 * paints first, and the collection never flashes on the way.
 *
 * A `?game=` address is not a shortcut, however much the two share. The
 * browser has no home screen to pin to, and a link somebody followed is an
 * introduction to the game, not a way back into one already begun
 * (docs/WEB_VERSION.md「URL(ゲーム別の入口)」) — so it enters by the
 * ordinary door.
 */
function initialView(): View {
  // An invite link (club.md §7-1), browser only: the Join screen is the page
  // that was asked for. The token leaves the address here, before anything
  // else runs (app/clubGate.ts). Under StrictMode React calls this twice and
  // keeps the first answer, so the second call finding the fragment already
  // gone changes nothing.
  if (webRoutingEnabled()) {
    const invite = takeInviteFromLocation();
    if (invite) return { kind: 'club', entry: 'invite', invite };
  }
  if (!webRoutingEnabled()) {
    const shortcutGame = shortcutLaunchGame();
    return shortcutGame
      ? { kind: 'game', gameId: shortcutGame, entry: 'shortcut' }
      : { kind: 'collection' };
  }
  const gameId = currentRouteGame();
  if (!gameId) return { kind: 'collection' };
  return { kind: 'game', gameId, entry: 'collection' };
}

export function App() {
  const [view, setView] = useState<View>(initialView);
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  // Bumped by the error screen's retry so the game subtree remounts and the
  // recreated lazy wrapper (lazyRoots.ts) gets a fresh chance to load.
  const [gameNonce, setGameNonce] = useState(0);

  /**
   * The Club House layer, once something asked for it (app/clubGate.ts) —
   * null on every device that has not joined and has not pressed a Club
   * door. `connections` starts from what boot read out of `sg.club`, so the
   * home's slot is right before the layer has loaded at all.
   */
  const [clubModule, setClubModule] = useState<ClubModule | null>(null);
  const [connections, setConnections] = useState<readonly ClubConnectionSummary[]>(clubConnections);
  /**
   * The challenge whose board is on screen, if any (club.md §6-2). The ref is
   * what the bridge reads at call time, so a result screen that sends late
   * still sends to the challenge it was played for.
   */
  const [activeChallenge, setActiveChallengeState] = useState<ActiveChallenge | null>(null);
  const activeChallengeRef = useRef<ActiveChallenge | null>(null);
  const setActiveChallenge = useCallback((next: ActiveChallenge | null) => {
    activeChallengeRef.current = next;
    setActiveChallengeState(next);
  }, []);

  /**
   * The screen the shell has decided on, readable from a listener that
   * outlives a render — and updated at the decision rather than at the commit
   * that follows it. Every transition goes through `show`, so two of them in
   * one tick see each other: leaving a game twice in a row must not walk back
   * twice, which in the browser would be a step out of the site.
   *
   * It also lets the callbacks below close over nothing, so `exitGame` — the
   * `onExit` every game is handed — keeps one identity for the shell's life.
   */
  const viewRef = useRef(view);
  const show = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const goCollection = useCallback(() => show({ kind: 'collection' }), [show]);
  const openSettings = useCallback(() => show({ kind: 'settings' }), [show]);

  /**
   * Everything that happens when a game leaves the screen, wherever the
   * request came from — the game's own back control, the browser's, or a
   * home-screen shortcut to a different game. Teardown only: what the player
   * is shown next is the caller's decision, and so is whether this is a
   * moment to ask them anything (`offerReviewIfDue`).
   */
  const leaveGame = useCallback(
    (gameId: GameId) => {
      trackWebGameClosed(gameId);
      // The game's audio must not outlive it: suspend the shared context now
      // instead of waiting out its idle timer (docs/GAME_LIFECYCLE.md).
      releaseSound();
      // A challenge belongs to the board it was opened onto; whichever way
      // that board left the screen, no later result is owed to it.
      setActiveChallenge(null);
    },
    [setActiveChallenge],
  );

  /**
   * The review question's only doorway (docs/REVIEW_PROMPT_POLICY.md):
   * leaving a game for the collection by the game's own back control — a
   * natural pause, never at launch and never mid-game. The showing is booked
   * immediately so a killed app cannot turn one ask into several. It never
   * fires in the browser, which has no installed app to rate.
   *
   * Not a doorway: a home-screen shortcut that swaps one game for another, or
   * a retired shortcut that lands on the collection (issue #110). The player
   * was on their way somewhere; a question in the doorway is not a pause.
   */
  const offerReviewIfDue = useCallback(() => {
    if (!shouldPromptReview()) return;
    markReviewPromptShown();
    setReviewPromptOpen(true);
  }, []);

  /**
   * Closing the question, by every route there is: the dialog's own "not
   * now", a tap outside it, and Android's hardware back — which reaches it
   * through the collection's listener rather than one of the shell's, because
   * back has exactly one owner per screen (see the effect below, issue #173).
   * None of them is an answer (docs/REVIEW_PROMPT_POLICY.md「あとで」): the
   * showing was booked when it opened, and the question retires only when the
   * player picks one of the two answers.
   */
  const closeReviewPrompt = useCallback(() => setReviewPromptOpen(false), []);

  // Opening a game is also what feeds the home's shortcut row: the shell
  // records what it mounted, so no game has to report anything (recentGames.ts).
  // Recorded at the tap, not after the chunk resolves: the row reflects what
  // the player chose, and a load failure is rare enough not to complicate it.
  const enterGame = useCallback(
    (gameId: GameId, entry: GameEntry, club?: { challenge: ChallengeStart; from: 'club' }) => {
      recordGameOpened(gameId);
      trackWebGameOpened(gameId);
      show({ kind: 'game', gameId, entry, ...club });
    },
    [show],
  );

  const openGame = useCallback(
    (gameId: GameId) => {
      enterGame(gameId, 'collection');
      if (webRoutingEnabled()) pushRoute(gameId);
    },
    [enterGame],
  );

  // Only a game can be left, and only once: a second call from a subtree that
  // has not unmounted yet would otherwise close the same session twice and
  // take a second step back through the browser's history.
  //
  // A challenge game goes back where it came from — the Club, showing that
  // challenge again — and is not a doorway for the review question: the
  // player is in the middle of something with other people, not pausing. Nor
  // is there a route to pop, because playChallenge never pushed one.
  const exitGame = useCallback(() => {
    const current = viewRef.current;
    if (current.kind !== 'game') return;
    const active = activeChallengeRef.current;
    leaveGame(current.gameId);
    if (current.from === 'club') {
      show({
        kind: 'club',
        entry: 'home',
        focus: active ? { endpoint: active.endpoint, challengeId: active.challengeId } : null,
      });
      return;
    }
    show({ kind: 'collection' });
    offerReviewIfDue();
    if (webRoutingEnabled()) popRoute();
  }, [leaveGame, offerReviewIfDue, show]);

  /**
   * A Club door was pressed (club.md §2-1, §2-3). The layer is loaded on the
   * press and on nothing else; a load that fails changes nothing on screen
   * (club.md §12-2 (e)) — the player is still where they pressed. So is a
   * player who moved on while it loaded: the Club opens only over the screen
   * the press came from.
   */
  const openClub = useCallback(
    (entry: 'settings' | 'home' | 'discover') => {
      const pressedOn = viewRef.current;
      void loadClubForEntry().then((module) => {
        if (!module || viewRef.current !== pressedOn) return;
        setClubModule(module);
        show({ kind: 'club', entry });
      });
    },
    [show],
  );
  const openClubFromSettings = useCallback(() => openClub('settings'), [openClub]);

  /**
   * `Play` on a Club challenge. The game opens by the ordinary door, recorded
   * as opened like any other, with the challenge in hand and a note to come
   * back to the Club.
   *
   * No `?game=` is pushed in the browser. Back from a challenge returns to
   * the Club, not the collection, so a history entry for the game would be a
   * step that leads somewhere the shell does not go — and the address bar
   * never pointed at the game in the first place: it stays the Club's page.
   */
  const playChallenge = useCallback(
    ({ gameId, challenge, active }: ClubPlayRequest) => {
      setActiveChallenge(active);
      enterGame(gameId, 'collection', { challenge, from: 'club' });
    },
    [enterGame, setActiveChallenge],
  );

  const onClubConnectionsChanged = useCallback((next: readonly ClubConnectionSummary[]) => {
    noteClubConnections(next);
    setConnections(next);
  }, []);

  // The two functions are the layer's; they read the active challenge at
  // call time, so they are made once per module rather than per challenge.
  const clubFunctions = useMemo(
    () => (clubModule ? clubModule.createBridge(() => activeChallengeRef.current) : null),
    [clubModule],
  );
  const bridge = useMemo<ClubBridge | null>(
    () => (clubFunctions ? { connections, activeChallenge, ...clubFunctions } : null),
    [clubFunctions, connections, activeChallenge],
  );

  /**
   * Boot: count a direct arrival on a game as an open, so the shortcut row
   * and the shell's own measurement see it exactly the way they see a tap on
   * a tile. A direct arrival is the browser's `?game=` or, in the Android app,
   * a home-screen shortcut (app/shortcutLaunch.ts). The browser also settles
   * the address on the screen that was just opened — dropping an id the
   * registry no longer carries; the app has no address to settle.
   *
   * Guarded rather than left to an empty dependency list because React's
   * StrictMode runs mount effects twice in development, and `game_open` is
   * not an event to send twice for one arrival.
   */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const arrived = viewRef.current;
    const gameId = arrived.kind === 'game' ? arrived.gameId : null;
    if (webRoutingEnabled()) startRoute(gameId);
    if (gameId) {
      recordGameOpened(gameId);
      trackWebGameOpened(gameId);
    }
    // The Club layer at boot, in exactly the two cases app/clubGate.ts allows:
    // the page is an invite link (initialView already chose the Join screen),
    // or this device has joined a Club, whose home slot and result-screen
    // action need the layer. An invite that cannot load its layer falls back
    // to the collection rather than leaving a loading screen up for good.
    if (arrived.kind === 'club') {
      void loadClubForInvite().then((module) => {
        if (module) setClubModule(module);
        else if (viewRef.current === arrived) show({ kind: 'collection' });
      });
    } else if (isConnected()) {
      void loadClubAtBoot()?.then((module) => {
        if (module) setClubModule(module);
      });
    }
  }, [show]);

  /**
   * A home-screen shortcut tapped while the app is already running. On
   * Android the activity is `singleTask`, so the launcher's Intent arrives as
   * `onNewIntent` and the App plugin raises it here with the URI the shortcut
   * carries — the same `?game=` address the browser reads (issue #110). On
   * iOS AppDelegate.swift hands a tapped quick action to the same plugin as a
   * URL open, so it arrives here the same way (issue #114).
   *
   * The same comparison the browser's `popstate` makes: what the URI asks for
   * against what is showing. The same game already on screen — wherever
   * inside it the player is — is left exactly alone; a shortcut is a door,
   * not a reset. A different game closes this one and opens that one, without
   * the review question in between (`offerReviewIfDue`). An id this build no
   * longer carries lands on the collection: the fail-safe for a shortcut that
   * outlived its game.
   *
   * On a cold start the plugin may raise this once more for the launch
   * itself, retained until a listener exists (Android always does; iOS only
   * when its App plugin was already loaded when the item was handed over).
   * By then boot has already opened that game (`initialView`), so the
   * comparison finds nothing to do.
   */
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      const showing = viewRef.current.kind === 'game' ? viewRef.current.gameId : null;
      const target = gameIdFromShortcutUrl(url);
      if (showing === target) return;
      if (showing !== null) leaveGame(showing);
      if (target !== null) enterGame(target, 'shortcut');
      else show({ kind: 'collection' });
    });
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [enterGame, leaveGame, show]);

  /**
   * Back and Forward, browser only. The address is the truth here: whatever
   * entry the browser lands on decides the screen, and the difference between
   * that and what is showing decides what has to be closed and opened.
   *
   * A step this shell asked for itself (exitGame's `history.back()`) arrives
   * here too — by then the screen already agrees with the address, so the
   * comparison finds nothing to do and the close is not counted twice.
   *
   * Only games are in the address. The settings screen is not, so Back does
   * not close it — it leaves the site, which is what Back did on every screen
   * before any of this existed (docs/WEB_VERSION.md「URL(ゲーム別の入口)」).
   *
   * The one thing this handler writes back is a `?game=` this build cannot
   * open: `settleStaleRoute` drops it exactly as boot does, before the
   * comparison, so an entry made by a newer build — or by a typo somebody
   * opened once — leaves the collection on screen *and* an address that says
   * so, rather than one that is still bookmarkable as nothing (issue #172).
   * It fires ahead of the early return below because the address can be wrong
   * while the screen is already right.
   */
  useEffect(() => {
    if (!webRoutingEnabled()) return;
    const onPopState = () => {
      settleStaleRoute();
      const showing = viewRef.current.kind === 'game' ? viewRef.current.gameId : null;
      const target = currentRouteGame();
      if (showing === target) return;
      if (showing !== null) leaveGame(showing);
      if (target !== null) {
        enterGame(target, 'collection');
      } else {
        show({ kind: 'collection' });
        // The browser's Back out of a game is the same pause as the game's
        // own back control — though in the browser the question is never
        // actually asked (services/review.ts is native-only).
        offerReviewIfDue();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enterGame, leaveGame, offerReviewIfDue, show]);

  // One accent per title (packages/brand titleAccents): the shell stamps which
  // game is on screen and styles.css swaps just the accent tokens. The series
  // base never changes, which is what keeps two games looking like one app.
  useEffect(() => {
    const root = document.documentElement;
    if (view.kind === 'game') root.dataset.game = view.gameId;
    else delete root.dataset.game;
  }, [view]);

  // Hardware back for the settings screen. Every other screen owns its own,
  // and exactly one owner is registered at a time: a game's while it is
  // mounted, and the collection's otherwise — the collection answers back
  // with state only it has (whether its search is open, issue #122), so the
  // branch lives there rather than here (CollectionHomeScreen.tsx). Every
  // Capacitor `backButton` listener fires, so a second one here would
  // minimize the app underneath whatever that one just closed. That is why
  // the review question below is handed to the collection as a way to close
  // it instead of being given a listener of its own (issue #173).
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || view.kind !== 'settings') return;
    const handle = CapacitorApp.addListener('backButton', goCollection);
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [goCollection, view.kind]);

  return <ClubBridgeContext.Provider value={bridge}>{renderView()}</ClubBridgeContext.Provider>;

  function renderView() {
    if (view.kind === 'game') {
      const gameId = view.gameId;
      const from = view.from;
      const LazyRoot = getLazyRoot(gameId);
      if (LazyRoot) {
        return (
          <GameErrorBoundary
            key={gameNonce}
            onExit={exitGame}
            onRetry={() => {
              resetLazyRoot(gameId);
              // A second attempt goes in by the ordinary door. Whatever threw
              // is unknown from here, and one of the things it could have been
              // is the game opening straight onto a suspended board it could
              // not draw (issue #113) — a retry that repeats that lands on the
              // same screen twice. A Club challenge is dropped for the same
              // reason (its board is just as much a suspect), but not the way
              // back: a game opened from the Club still returns to the Club.
              show({ kind: 'game', gameId, entry: 'collection', from });
              setGameNonce((n) => n + 1);
            }}
          >
            <Suspense fallback={<GameLoadingFallback onExit={exitGame} />}>
              <LazyRoot onExit={exitGame} entry={view.entry} challenge={view.challenge} />
            </Suspense>
          </GameErrorBoundary>
        );
      }
    }
    if (view.kind === 'settings') {
      return <SettingsScreen onBack={goCollection} onOpenClub={openClubFromSettings} />;
    }
    // The Club view. Its hardware back is the Club screen's own (it registers
    // the listener while mounted), so the shell adds none here — compare the
    // settings effect above. Until the layer arrives, the same quiet waiting
    // screen a game chunk gets, which owns back for that moment itself.
    if (view.kind === 'club') {
      if (!clubModule) return <GameLoadingFallback onExit={goCollection} />;
      return (
        <clubModule.ClubRoot
          entry={view.entry}
          invite={view.invite}
          focus={view.focus}
          onBack={goCollection}
          onPlayChallenge={playChallenge}
          onConnectionsChanged={onClubConnectionsChanged}
        />
      );
    }
    return (
      <>
        <CollectionHomeScreen
          onOpenGame={openGame}
          onOpenSettings={openSettings}
          dismissReviewPrompt={reviewPromptOpen ? closeReviewPrompt : null}
          onOpenClub={openClub}
          clubConnections={connections}
        />
        {reviewPromptOpen && <ReviewPrompt onClose={closeReviewPrompt} />}
      </>
    );
  }
}
