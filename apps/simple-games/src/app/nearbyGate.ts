import { Capacitor } from '@capacitor/core';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { isNearbyGameId } from './nearbyGameIds';
import type { NearbyGameId } from '../nearby/gameTypes';

export type { NearbyGameId } from '../nearby/gameTypes';
type Root = ComponentType<{
  gameId: NearbyGameId | null;
  onGameSelected?: (gameId: NearbyGameId | null) => void;
  visible?: boolean;
  onExit: () => void;
  onActiveChange?: (active: boolean) => void;
  onRegisterStop?: (stop: (() => Promise<void>) | null) => void;
}>;
let root: LazyExoticComponent<Root> | null = null;
export function nearbyAvailable(gameId: string): gameId is NearbyGameId {
  return isNearbyGameId(gameId) && nearbyDiscoveryAvailable();
}
export function nearbyDiscoveryAvailable(): boolean {
  return import.meta.env.MODE !== 'web' && Capacitor.isNativePlatform();
}
export function getNearbyRoot(): LazyExoticComponent<Root> | null {
  if (import.meta.env.MODE === 'web' || !Capacitor.isNativePlatform()) return null;
  root ??= lazy(() =>
    import('../nearby/NearbyRoot').then((module) => ({ default: module.NearbyRoot })),
  );
  return root;
}
export function resetNearbyRoot() {
  root = null;
}
export async function clearNearbyLocalData(): Promise<void> {
  if (import.meta.env.MODE === 'web' || !Capacitor.isNativePlatform()) return;
  const { clearHistory } = await import('../nearby/history');
  await clearHistory();
}
