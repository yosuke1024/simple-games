/**
 * The collection shell: which surface is on screen — the game list, the
 * shared settings, or one game. Games mount exclusively (battery: an
 * off-screen game does no work) and own their internal navigation; the shell
 * only ever hears "exit".
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { markReviewPromptShown, shouldPromptReview } from '../services/review';
import { releaseSound } from '../services/sound';
import { GameErrorBoundary } from '../ui/components/GameErrorBoundary';
import { GameLoadingFallback } from '../ui/components/GameLoadingFallback';
import { ReviewPrompt } from '../ui/components/ReviewPrompt';
import { CollectionHomeScreen } from '../ui/screens/CollectionHomeScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { getLazyRoot, resetLazyRoot } from './lazyRoots';
import { recordGameOpened } from './recentGames';
import { type GameId } from './registry';

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

export function App() {
  const [view, setView] = useState<View>({ kind: 'collection' });
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  // Bumped by the error screen's retry so the game subtree remounts and the
  // recreated lazy wrapper (lazyRoots.ts) gets a fresh chance to load.
  const [gameNonce, setGameNonce] = useState(0);

  const goCollection = useCallback(() => setView({ kind: 'collection' }), []);
  const openSettings = useCallback(() => setView({ kind: 'settings' }), []);
  // Opening a game is also what feeds the home's shortcut row: the shell
  // records what it mounted, so no game has to report anything (recentGames.ts).
  // Recorded at the tap, not after the chunk resolves: the row reflects what
  // the player chose, and a load failure is rare enough not to complicate it.
  const openGame = useCallback((gameId: GameId) => {
    recordGameOpened(gameId);
    trackWebGameOpened(gameId);
    setView({ kind: 'game', gameId });
  }, []);

  // The review question's only doorway (docs/REVIEW_PROMPT_POLICY.md):
  // leaving a game for the collection — a natural pause, never at launch and
  // never mid-game. The showing is booked immediately so a killed app cannot
  // turn one ask into several.
  const exitGame = useCallback(() => {
    if (view.kind === 'game') trackWebGameClosed(view.gameId);
    setView({ kind: 'collection' });
    // The game's audio must not outlive it: suspend the shared context now
    // instead of waiting out its idle timer (docs/GAME_LIFECYCLE.md).
    releaseSound();
    if (shouldPromptReview()) {
      markReviewPromptShown();
      setReviewPromptOpen(true);
    }
  }, [view]);

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
        setView({ kind: 'collection' });
      } else {
        void CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
      }
    });
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [view.kind]);

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
      <CollectionHomeScreen onOpenGame={openGame} onOpenSettings={openSettings} />
      <ReviewPrompt open={reviewPromptOpen} onClose={() => setReviewPromptOpen(false)} />
    </>
  );
}
