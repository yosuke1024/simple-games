/**
 * Owns the Android hardware back button for a shell screen shown while
 * `view.kind === 'game'` but no game is mounted — the loading fallback and
 * the load-error screen. The shell unregisters its own listener whenever a
 * game view is active (App.tsx keeps exactly one owner), and the game's
 * listener does not exist yet in these states; without this hook, back
 * would fall through to the OS and background the app instead of returning
 * to the collection.
 */
import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useHardwareBackExit(onExit: () => void): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', onExit);
    return () => {
      void handle.then((h) => h.remove()).catch(() => undefined);
    };
  }, [onExit]);
}
