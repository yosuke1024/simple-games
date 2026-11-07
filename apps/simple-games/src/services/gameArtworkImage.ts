/**
 * A local image of the collection's current illustration. Shortcuts and result
 * shares use the same SVG; neither keeps a second set of game icons.
 */
import { seriesColors } from '@simple-games/brand';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { GameId } from '../app/registry';
import { titleAccentOf } from '../app/titleAccent';
import { GameArtwork } from '../ui/components/GameArtwork';
import { ShareGameArtwork } from '../ui/components/ShareGameArtwork';

const DECODE_TIMEOUT_MS = 2000;

/**
 * Every CSS custom property the artwork components paint with, at its value in
 * the light theme. An SVG decoded as an image sees none of the page's
 * stylesheet, so a `var()` left in it resolves to nothing: the shape falls back
 * to the root's `fill="none"` and simply disappears from the share card and the
 * Android shortcut icon. Both of those images use the fixed light palette (the
 * card's paper, the shortcut's light field), so the light values are the ones
 * that belong here, the same choice as `--surface` → `seriesColors.surface`.
 *
 * The colours are copied from ui/styles.css (`:root` for `--surface`,
 * `.accent-chain-territory` for Chain Territory's two sides).
 * gameArtworkImage.test.tsx checks each copy against the stylesheet, and checks
 * that no game's serialised drawing keeps a `var(` — a new token in
 * GameArtwork.tsx fails there until it is listed here.
 */
export const ARTWORK_CSS_TOKENS: Readonly<Record<string, string>> = {
  '--surface': seriesColors.surface,
  '--ct-you': '#245cc1',
  '--ct-cpu': '#aa3829',
};

/** `var(--name)` → its light value, `currentColor` → the title accent; else unchanged. */
function resolvePaint(value: string, accent: string): string {
  if (value === 'currentColor') return accent;
  if (value.startsWith('var(') && value.endsWith(')')) {
    const name = value.slice(4, -1).trim();
    const token = Object.prototype.hasOwnProperty.call(ARTWORK_CSS_TOKENS, name)
      ? ARTWORK_CSS_TOKENS[name]
      : undefined;
    if (token !== undefined) return token;
  }
  return value;
}

/**
 * Resolve the palette (currentColor and the tokens above) before an SVG
 * becomes an Image, where the page's inherited CSS is unavailable. Call
 * outside a React lifecycle: the detached renderer commits synchronously and
 * is immediately unmounted.
 */
export function gameArtworkSvg(
  gameId: GameId,
  variant: 'collection' | 'share' = 'collection',
): string | null {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() =>
      root.render(
        createElement(variant === 'share' ? ShareGameArtwork : GameArtwork, { id: gameId }),
      ),
    );
    const svg = host.querySelector('svg');
    if (!svg) return null;
    const accent = titleAccentOf(gameId).light;
    // Every attribute, not only fill and stroke: a paint in `color` or
    // `stop-color` would vanish from the image just the same.
    for (const node of [svg, ...svg.querySelectorAll('*')]) {
      for (const attribute of Array.from(node.attributes)) {
        const resolved = resolvePaint(attribute.value, accent);
        if (resolved !== attribute.value) attribute.value = resolved;
      }
    }
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('font-family', 'Nunito, ui-rounded, system-ui, sans-serif');
    return new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
  }
}

/**
 * Prepare while a result is visible, before its share button is pressed. The
 * click can then draw synchronously without losing Web Share's user gesture.
 * One task separates the detached render from the calling React effect. A
 * fast click may use a card without artwork; it never has to wait for this.
 *
 * Cancellation, an unavailable decoder, and a stalled decoder all resolve to
 * null. Blob URLs, listeners and timers are released on every ending. A ready
 * image stays decoded after its URL is revoked and is owned only by the caller.
 */
export function prepareGameArtwork(
  gameId: GameId,
  signal?: AbortSignal,
  variant: 'collection' | 'share' = 'collection',
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || signal?.aborted) {
      resolve(null);
      return;
    }

    let settled = false;
    let image: HTMLImageElement | undefined;
    let objectUrl: string | undefined;
    let decodeTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(renderTimer);
      clearTimeout(decodeTimer);
      signal?.removeEventListener('abort', abort);
      if (image) {
        image.onload = null;
        image.onerror = null;
        if (!ready) {
          try {
            image.src = '';
          } catch {
            // Cleanup cannot prevent the card's artwork-free fallback.
          }
        }
      }
      if (objectUrl) {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // A broken decoder/URL implementation is still a normal ending.
        }
      }
      resolve(ready ? (image ?? null) : null);
    };
    const abort = () => finish(false);
    signal?.addEventListener('abort', abort, { once: true });

    const renderTimer = setTimeout(() => {
      try {
        const source = gameArtworkSvg(gameId, variant);
        if (!source) {
          finish(false);
          return;
        }
        objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
        image = new Image();
        image.onload = () => finish(true);
        image.onerror = () => finish(false);
        decodeTimer = setTimeout(() => finish(false), DECODE_TIMEOUT_MS);
        image.src = objectUrl;
      } catch {
        finish(false);
      }
    }, 0);
  });
}
