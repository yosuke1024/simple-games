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
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { markReviewPromptShown, shouldPromptReview } from '../services/review';
import { releaseSound } from '../services/sound';
import {
  markWebAppPromptShown,
  recordWebGameExit,
  shouldShowWebAppPrompt,
} from '../services/webAppPrompt';
import { GameErrorBoundary } from '../ui/components/GameErrorBoundary';
import { GameLoadingFallback } from '../ui/components/GameLoadingFallback';
import { ReviewPrompt } from '../ui/components/ReviewPrompt';
import { WebAppPrompt } from '../ui/components/WebAppPrompt';
import { CollectionHomeScreen } from '../ui/screens/CollectionHomeScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { getLazyRoot, resetLazyRoot } from './lazyRoots';
import { recordGameOpened } from './recentGames';
import { type GameId } from './registry';
import { currentRouteGame, popRoute, pushRoute, startRoute, webRoutingEnabled } from './webRoute';

type View = { kind: 'collection' } | { kind: 'settings' } | { kind: 'game'; gameId: GameId };

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
 * rather than flashing the collection on the way to it. The app always opens
 * on the collection.
 */
function initialView(): View {
  if (!webRoutingEnabled()) return { kind: 'collection' };
  const gameId = currentRouteGame();
  return gameId ? { kind: 'game', gameId } : { kind: 'collection' };
}

export function App() {
  const [view, setView] = useState<View>(initialView);
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const [appPromptOpen, setAppPromptOpen] = useState(false);
  // Bumped by the error screen's retry so the game subtree remounts and the
  // recreated lazy wrapper (lazyRoots.ts) gets a fresh chance to load.
  const [gameNonce, setGameNonce] = useState(0);

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
   * request came from — the game's own back control, or the browser's.
   *
   * The review question's only doorway (docs/REVIEW_PROMPT_POLICY.md):
   * leaving a game for the collection — a natural pause, never at launch and
   * never mid-game. The showing is booked immediately so a killed app cannot
   * turn one ask into several. It never fires in the browser, which has no
   * installed app to rate.
   */
  const leaveGame = useCallback((gameId: GameId) => {
    trackWebGameClosed(gameId);
    // Browser only, and counting is all it does — whether the count is worth
    // a card is asked at the collection, below (services/webAppPrompt.ts).
    recordWebGameExit();
    // The game's audio must not outlive it: suspend the shared context now
    // instead of waiting out its idle timer (docs/GAME_LIFECYCLE.md).
    releaseSound();
    if (shouldPromptReview()) {
      markReviewPromptShown();
      setReviewPromptOpen(true);
    }
  }, []);

  /**
   * The browser version's one-time app card (docs/WEB_VERSION.md
   * 「アプリへの送客」). Asked at the two moments the collection home is the
   * screen somebody has arrived at with games already behind them: back from
   * a game, and a launch that opens here.
   *
   * The showing is booked before it renders, so a reload — or a tab killed
   * with the card on screen — cannot turn one card into a second. Offline the
   * question simply answers no and books nothing: the store link would open
   * nothing, and there is no retry to arrange because the next arrival asks
   * again by itself.
   *
   * On the app build every call here is `false` at the first condition, so
   * nothing is shown, counted, or stored (services/webAppPrompt.ts).
   */
  const showAppPromptIfDue = useCallback(() => {
    if (!shouldShowWebAppPrompt()) return;
    markWebAppPromptShown();
    setAppPromptOpen(true);
  }, []);

  // Opening a game is also what feeds the home's shortcut row: the shell
  // records what it mounted, so no game has to report anything (recentGames.ts).
  // Recorded at the tap, not after the chunk resolves: the row reflects what
  // the player chose, and a load failure is rare enough not to complicate it.
  const enterGame = useCallback(
    (gameId: GameId) => {
      recordGameOpened(gameId);
      trackWebGameOpened(gameId);
      show({ kind: 'game', gameId });
    },
    [show],
  );

  const openGame = useCallback(
    (gameId: GameId) => {
      enterGame(gameId);
      if (webRoutingEnabled()) pushRoute(gameId);
    },
    [enterGame],
  );

  // Only a game can be left, and only once: a second call from a subtree that
  // has not unmounted yet would otherwise close the same session twice and
  // take a second step back through the browser's history.
  const exitGame = useCallback(() => {
    const current = viewRef.current;
    if (current.kind !== 'game') return;
    leaveGame(current.gameId);
    show({ kind: 'collection' });
    showAppPromptIfDue();
    if (webRoutingEnabled()) popRoute();
  }, [leaveGame, show, showAppPromptIfDue]);

  /**
   * Boot, browser only: settle the address on the screen that was just opened
   * — dropping an id the registry no longer carries — and count a direct
   * arrival as an open, so the shortcut row and the shell's own measurement
   * see it exactly the way they see a tap on a tile.
   *
   * Guarded rather than left to an empty dependency list because React's
   * StrictMode runs mount effects twice in development, and `game_open` is
   * not an event to send twice for one arrival.
   */
  const booted = useRef(false);
  useEffect(() => {
    if (!webRoutingEnabled() || booted.current) return;
    booted.current = true;
    const arrived = viewRef.current;
    const gameId = arrived.kind === 'game' ? arrived.gameId : null;
    startRoute(gameId);
    if (gameId) {
      recordGameOpened(gameId);
      trackWebGameOpened(gameId);
    }
  }, []);

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
   */
  useEffect(() => {
    if (!webRoutingEnabled()) return;
    const onPopState = () => {
      const showing = viewRef.current.kind === 'game' ? viewRef.current.gameId : null;
      const target = currentRouteGame();
      if (showing === target) return;
      if (showing !== null) leaveGame(showing);
      if (target !== null) {
        enterGame(target);
      } else {
        show({ kind: 'collection' });
        showAppPromptIfDue();
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enterGame, leaveGame, show, showAppPromptIfDue]);

  /**
   * A launch that opens on the collection, browser only: somebody who became
   * eligible in an earlier visit — or while offline — gets the card here
   * rather than having to play a third game for it. It cannot fire on a first
   * visit or after one game, because the count it reads comes from exits
   * already stored.
   *
   * Guarded by a ref rather than an empty dependency list because React's
   * StrictMode runs mount effects twice in development; the booking inside
   * would make the second run a no-op anyway, but a card is not a thing to
   * decide twice for one arrival.
   */
  const appPromptChecked = useRef(false);
  useEffect(() => {
    if (appPromptChecked.current) return;
    appPromptChecked.current = true;
    if (viewRef.current.kind !== 'collection') return;
    showAppPromptIfDue();
  }, [showAppPromptIfDue]);

  // One accent per title (packages/brand titleAccents): the shell stamps which
  // game is on screen and styles.css swaps just the accent tokens. The series
  // base never changes, which is what keeps two games looking like one app.
  useEffect(() => {
    const root = document.documentElement;
    if (view.kind === 'game') root.dataset.game = view.gameId;
    else delete root.dataset.game;
  }, [view]);

  // Hardware back at the shell level. While a game is mounted the game's own
  // handler runs instead (this effect unregisters to keep exactly one owner).
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || view.kind === 'game') return;
    const handle = CapacitorApp.addListener('backButton', () => {
      if (view.kind === 'settings') {
        show({ kind: 'collection' });
      } else {
        void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
      }
    });
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [show, view.kind]);

  if (view.kind === 'game') {
    const gameId = view.gameId;
    const LazyRoot = getLazyRoot(gameId);
    if (LazyRoot) {
      return (
        <GameErrorBoundary
          key={gameNonce}
          onExit={exitGame}
          onRetry={() => {
            resetLazyRoot(gameId);
            setGameNonce((n) => n + 1);
          }}
        >
          <Suspense fallback={<GameLoadingFallback onExit={exitGame} />}>
            <LazyRoot onExit={exitGame} />
          </Suspense>
        </GameErrorBoundary>
      );
    }
  }
  if (view.kind === 'settings') {
    return <SettingsScreen onBack={goCollection} />;
  }
  return (
    <>
      <CollectionHomeScreen
        onOpenGame={openGame}
        onOpenSettings={openSettings}
        appPrompt={appPromptOpen ? <WebAppPrompt onClose={() => setAppPromptOpen(false)} /> : null}
      />
      <ReviewPrompt open={reviewPromptOpen} onClose={() => setReviewPromptOpen(false)} />
    </>
  );
}
