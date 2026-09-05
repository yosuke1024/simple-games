/**
 * One React.lazy wrapper per game, created on first open and reused after —
 * a fresh lazy() on every render would remount the game each time the shell
 * re-renders, and re-run its load.
 *
 * `resetLazyRoot` exists for the error path only: React caches a rejected
 * load inside the lazy component, so retrying means making a new wrapper.
 * Even then the retry is best-effort — Chromium also caches a *failed* module
 * fetch in the module map, so a re-import of the same URL can reject
 * immediately without hitting the network. On the native build chunks are
 * local files and a failure is next to impossible; on the web build the
 * error UI treats "back to the collection" as the dependable way out and
 * retry as a bonus (ui/components/GameErrorBoundary.tsx).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { GAMES, type GameId, type GameRootProps } from './registry';

type LazyRoot = LazyExoticComponent<ComponentType<GameRootProps>>;

const cache = new Map<GameId, LazyRoot>();

export function getLazyRoot(id: GameId): LazyRoot | null {
  const cached = cache.get(id);
  if (cached) return cached;
  const game = GAMES.find((entry) => entry.id === id);
  if (!game) return null;
  const created = lazy(game.loadRoot);
  cache.set(id, created);
  return created;
}

/** Drops the cached wrapper so the next open attempts a fresh import(). */
export function resetLazyRoot(id: GameId): void {
  cache.delete(id);
}
