import { Capacitor } from '@capacitor/core';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type Root = ComponentType<{ onExit: () => void }>;
let root: LazyExoticComponent<Root> | null = null;
export function nearbyAvailable(): boolean {
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
