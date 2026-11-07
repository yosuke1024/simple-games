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
 * Resolve the two palette tokens before an SVG becomes an Image, where the
 * page's inherited CSS is unavailable. Call outside a React lifecycle: the
 * detached renderer commits synchronously and is immediately unmounted.
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
    for (const node of [svg, ...svg.querySelectorAll('[fill], [stroke]')]) {
      for (const name of ['fill', 'stroke']) {
        const value = node.getAttribute(name);
        if (value === 'currentColor') node.setAttribute(name, accent);
        if (value === 'var(--surface)') node.setAttribute(name, seriesColors.surface);
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
