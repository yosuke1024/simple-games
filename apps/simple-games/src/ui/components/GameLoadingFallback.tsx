/**
 * Shown while a game's chunk loads (app/App.tsx). Two jobs:
 *
 * 1. Stay invisible at first: loading a bundled chunk from disk normally
 *    finishes in a frame or two, and a flash of "Loading…" on every open
 *    would make the app feel slower than it is. The text appears only when
 *    the load has genuinely kept the player waiting.
 * 2. Own the hardware back button. The shell hands back-button duty to the
 *    game whenever one is on screen (App.tsx), but during a load the game is
 *    not mounted yet — without this listener, back during a load would fall
 *    through to the OS and background the app instead of returning to the
 *    collection.
 */
import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useSettings } from '@/state/SettingsContext';

/** Under this, a load is instant to the eye and deserves no indicator. */
const SHOW_AFTER_MS = 200;

export function GameLoadingFallback({ onExit }: { onExit: () => void }) {
  const { t } = useSettings();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', onExit);
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [onExit]);

  return (
    <div className="screen game-load-screen" aria-live="polite">
      {visible ? <p className="game-load-text">{t('gameLoading')}</p> : null}
    </div>
  );
}
