/**
 * Per-game message catalogs (issue #38). The entry ships only the shell's
 * strings; each game's 14 locales ride in the game's own lazy chunk and
 * announce themselves here when that chunk loads.
 *
 * Two registries in one file, and they must stay in step:
 *
 *   Types — a game widens `GameMessages` via `declare module` from its own
 *   `i18n/index.ts`, so `MessageKey` keeps naming every string in the app
 *   without the shell importing anything from `src/games/` (the boundary in
 *   docs/ARCHITECTURE.md survives; types are erased, strings are not).
 *
 *   Runtime — the same `i18n/index.ts` calls `registerGameMessages` at module
 *   scope. Module evaluation completes before `React.lazy` can resolve the
 *   game's root, so by the time a game component renders, its strings are
 *   here. The shell never sees a game key before then; if it somehow asks for
 *   one, `translate` falls back to the key itself rather than crashing.
 *
 * Language switching needs no loading: a registered game brought all 14
 * locales with it, so a switch is only a re-render (docs/OFFLINE_POLICY.md).
 */
import type { Locale } from './index';

/**
 * Augmented by every game's `i18n/index.ts`; the shell contributes nothing.
 * `keyof GameMessages` is therefore the union of all game-owned keys.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- empty is the point: games merge their key maps into it
export interface GameMessages {}

export type GameMessageKey = keyof GameMessages;

/** Keyed by the game's folder name; re-registering replaces (dev HMR). */
const registered = new Map<string, Record<Locale, Record<string, string>>>();

export function registerGameMessages(
  id: string,
  catalogs: Record<Locale, Record<string, string>>,
): void {
  registered.set(id, catalogs);
}

/**
 * The string for `key` from whichever loaded game owns it, or undefined while
 * no loaded game does. Key sets are disjoint across games and the shell
 * (i18n.test.ts enforces that), so the walk has exactly one possible owner.
 * A game's own English is the data-safety fallback, mirroring `translate`.
 */
export function lookupGameMessage(locale: Locale, key: string): string | undefined {
  for (const catalogs of registered.values()) {
    const hit = catalogs[locale]?.[key] ?? catalogs.en?.[key];
    if (hit !== undefined) return hit;
  }
  return undefined;
}
