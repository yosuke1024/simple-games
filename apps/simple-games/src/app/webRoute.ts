/**
 * The browser version's address bar: which game a URL asks for, and how the
 * shell writes the screen it is showing back into history (issue #83).
 *
 * The contract is one query parameter on the single static page the browser
 * version is served from:
 *
 *   https://pixapps.ai/simple-games/play/?game=sudoku
 *
 * A query parameter and not a path segment, because delivery is a copy of
 * static files with no rewrite rule that could send `/play/sudoku/` back to
 * `index.html` (docs/WEB_VERSION.md「配信構成」), and because the relative
 * `base: './'` the Capacitor WebView needs would resolve `./assets/…` one
 * directory too deep under a path route. Not a hash either: the whole point
 * is that a per-game guide can link at a game, and a hash is not a distinct
 * address to anything that reads links.
 *
 * Only ids the registry still carries are accepted. An unknown, empty or
 * retired id is not an error screen — the visitor asked for this collection
 * and gets it, with the parameter dropped so the address and the screen agree
 * again.
 *
 * **None of the history handling runs in the app.** `webRoutingEnabled()` is
 * a runtime guard, the way every other web/app difference in this product is
 * expressed (docs/WEB_VERSION.md「実装上の約束」 keeps the build-time gate
 * list closed at three: ads, analytics, site chrome). The app has no address
 * bar to arrive from and its hardware back button already owns this gesture
 * (docs/ARCHITECTURE.md「ハードウェア戻るボタン」), so on native every function
 * that touches `window.history` or `window.location` is simply never called.
 *
 * The one thing the app does share is the address itself. An Android
 * home-screen shortcut carries this same `?game=` URL inside its Intent and
 * reads it back through `gameIdFromHref` (app/shortcutLaunch.ts, issue #110)
 * — a pure function of a string, which is why it can be shared without the
 * guard: one contract for "this address means that game", parsed in one place.
 */
import { Capacitor } from '@capacitor/core';
import { GAMES, type GameId } from './registry';

/** The one parameter the browser version reads. Also the one it writes. */
export const GAME_PARAM = 'game';

/**
 * How many entries of this history stack the shell itself pushed. Kept in
 * `history.state` rather than in a module variable so it survives a reload:
 * refreshing `?game=sudoku` must still know whether the collection is a real
 * entry behind it, and a module variable would have forgotten.
 *
 * Only 0 and 1 occur today — a game is only ever opened from the collection,
 * and a game only ever leads back to it — but counting costs nothing and does
 * not have to be revisited if the shell ever grows a third routed screen.
 */
const DEPTH_KEY = 'sgRouteDepth';

const isGameId = (value: string | null): value is GameId =>
  value !== null && GAMES.some((game) => game.id === value);

function parse(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

function depthOf(state: unknown): number {
  const depth = (state as Record<string, unknown> | null)?.[DEPTH_KEY];
  return typeof depth === 'number' && Number.isFinite(depth) && depth > 0 ? depth : 0;
}

/** The game a URL asks for, or null for the collection. */
export function gameIdFromHref(href: string): GameId | null {
  const value = parse(href)?.searchParams.get(GAME_PARAM) ?? null;
  return isGameId(value) ? value : null;
}

/**
 * The same address with `?game=` set, or removed when the argument is null.
 * Everything else the URL carries is left alone — a campaign parameter on the
 * link a visitor followed is theirs, not ours to drop.
 */
export function hrefWithGame(href: string, gameId: GameId | null): string {
  const url = parse(href);
  if (!url) return href;
  if (gameId) url.searchParams.set(GAME_PARAM, gameId);
  else url.searchParams.delete(GAME_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Whether this run mirrors the shell's screen in the address bar: the browser,
 * yes; the app, never. See the note at the top of this file.
 */
export function webRoutingEnabled(): boolean {
  return !Capacitor.isNativePlatform();
}

/** What the entry the visitor is standing on asks for. */
export function currentRouteGame(): GameId | null {
  return gameIdFromHref(window.location.href);
}

/**
 * Boot: settle the address on the screen the shell actually opened, without
 * adding an entry. This is what turns `?game=not-a-game` into the plain
 * collection address, and it re-stamps the depth so a reload of `?game=sudoku`
 * still remembers that the collection is one step back.
 */
export function startRoute(gameId: GameId | null): void {
  const { history, location } = window;
  history.replaceState(
    { ...history.state, [DEPTH_KEY]: depthOf(history.state) },
    '',
    hrefWithGame(location.href, gameId),
  );
}

/** A game opened from inside the collection: a step forward, so Back returns. */
export function pushRoute(gameId: GameId): void {
  const { history, location } = window;
  history.pushState(
    { ...history.state, [DEPTH_KEY]: depthOf(history.state) + 1 },
    '',
    hrefWithGame(location.href, gameId),
  );
}

/**
 * Leaving a game.
 *
 * If the collection is an entry this shell pushed, walk back to it rather than
 * pushing a third entry: the visitor gets the history they expect (Forward
 * re-opens the game) instead of a stack that grows by two every time somebody
 * looks at a game and changes their mind. A `popstate` follows, and the shell
 * treats it as the step it asked for.
 *
 * If it is not — the visitor arrived here from a guide page, and the entry
 * behind belongs to that page — rewrite the address in place. Their way back
 * out of the site stays exactly one Back press away, which is the difference
 * between arriving from outside and walking in from the collection.
 */
export function popRoute(): void {
  const { history, location } = window;
  if (depthOf(history.state) > 0) {
    history.back();
    return;
  }
  history.replaceState({ ...history.state, [DEPTH_KEY]: 0 }, '', hrefWithGame(location.href, null));
}
