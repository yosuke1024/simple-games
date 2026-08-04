/**
 * Where the shared PixApps header currently lives.
 *
 * The header is ONE element for the whole page load, moved between screens
 * rather than rebuilt: `global-header.js` attaches its listeners (nav
 * dropdowns, the mobile drawer, hover handlers) when it runs, and it only
 * runs once. Re-injecting the script per screen would stack those listeners
 * and orphan the previous drawer.
 *
 * So this module owns two facts — the element, and which screen is currently
 * showing it — and reconciles them whenever either changes. Both arrive
 * asynchronously and in either order: the first screen usually mounts before
 * the header script has finished loading, and later screens mount long after.
 *
 * Module state, not DOM listeners: a slot registers and unregisters, which
 * keeps the per-mount resource cost at zero (docs/GAME_LIFECYCLE.md).
 */

/** The built header, once `global-header.js` has replaced our placeholder. */
let headerElement: HTMLElement | null = null;
/** The slot currently claiming it, if a chrome-bearing screen is mounted. */
let currentHost: HTMLElement | null = null;

function reconcile(): void {
  if (!headerElement) return;
  // Parked at body level when no screen wants it. It is hidden there by CSS
  // (`header[data-global-header]` is display:none outside `.sg-web-chrome`),
  // so there is no flash between the script landing and a slot claiming it.
  const target = currentHost ?? document.body;
  if (headerElement.parentElement !== target) target.appendChild(headerElement);
}

/** Called once by the boot module, after the header script has run. */
export function setChromeElement(element: HTMLElement): void {
  headerElement = element;
  reconcile();
}

/** A chrome-bearing screen mounted: show the header inside it. */
export function claimChrome(host: HTMLElement): void {
  currentHost = host;
  reconcile();
}

/**
 * A chrome-bearing screen unmounted. Guarded by identity: during a screen
 * change React runs the old cleanup before the new effect, but a stale
 * cleanup arriving later must not steal the header from the live screen.
 */
export function releaseChrome(host: HTMLElement): void {
  if (currentHost !== host) return;
  currentHost = null;
  reconcile();
}

/** Test hook. Production never forgets the element it found. */
export function resetChromeHostForTesting(): void {
  headerElement = null;
  currentHost = null;
}
