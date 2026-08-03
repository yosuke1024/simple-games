/**
 * The collection shell: which surface is on screen — the game list, the
 * shared settings, or one game. Games mount exclusively (battery: an
 * off-screen game does no work) and own their internal navigation; the shell
 * only ever hears "exit".
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useState } from 'react';
import { markReviewPromptShown, shouldPromptReview } from '../services/review';
import { releaseSound } from '../services/sound';
import { ReviewPrompt } from '../ui/components/ReviewPrompt';
import { CollectionHomeScreen } from '../ui/screens/CollectionHomeScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { recordGameOpened } from './recentGames';
import { GAMES, type GameId } from './registry';

type View = { kind: 'collection' } | { kind: 'settings' } | { kind: 'game'; gameId: GameId };

function trackWebGameOpened(gameId: GameId): void {
  if (import.meta.env.MODE !== 'web') return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return;

  void import('../services/analytics/web')
    .then((m) => m.trackGameOpened(gameId, measurementId))
    .catch(() => undefined);
}

function trackWebGameClosed(gameId: GameId): void {
  if (import.meta.env.MODE !== 'web') return;
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  if (!measurementId) return;

  void import('../services/analytics/web')
    .then((m) => m.trackGameClosed(gameId, measurementId))
    .catch(() => undefined);
}

export function App() {
  const [view, setView] = useState<View>({ kind: 'collection' });
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);

  const goCollection = useCallback(() => setView({ kind: 'collection' }), []);
  const openSettings = useCallback(() => setView({ kind: 'settings' }), []);
  // Opening a game is also what feeds the home's shortcut row: the shell
  // records what it mounted, so no game has to report anything (recentGames.ts).
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
    const game = GAMES.find((entry) => entry.id === view.gameId);
    if (game) return <game.Root onExit={exitGame} />;
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
