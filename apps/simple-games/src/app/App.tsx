/**
 * The collection shell: which surface is on screen — the game list, the
 * shared settings, or one game. Games mount exclusively (battery: an
 * off-screen game does no work) and own their internal navigation; the shell
 * only ever hears "exit".
 */
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useCallback, useEffect, useState } from 'react';
import { CollectionHomeScreen } from '../ui/screens/CollectionHomeScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { GAMES, type GameId } from './registry';

type View = { kind: 'collection' } | { kind: 'settings' } | { kind: 'game'; gameId: GameId };

export function App() {
  const [view, setView] = useState<View>({ kind: 'collection' });

  const goCollection = useCallback(() => setView({ kind: 'collection' }), []);
  const openSettings = useCallback(() => setView({ kind: 'settings' }), []);
  const openGame = useCallback((gameId: GameId) => setView({ kind: 'game', gameId }), []);

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
    if (game) return <game.Root onExit={goCollection} />;
  }
  if (view.kind === 'settings') {
    return <SettingsScreen onBack={goCollection} />;
  }
  return <CollectionHomeScreen onOpenGame={openGame} onOpenSettings={openSettings} />;
}
