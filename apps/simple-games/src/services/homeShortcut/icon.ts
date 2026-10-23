/**
 * Android's pinned shortcut uses the same original drawing as the collection
 * tile. Render that existing React SVG once into a detached element, resolve
 * its two palette tokens, then rasterize it locally. No game engine, network,
 * additional font, bundled PNG, or persistent image cache is involved.
 *
 * React's client renderer is already part of the app. The temporary root is
 * unmounted before decoding the image; the object URL, image callbacks and
 * timeout are released on success and failure alike. A failed/slow decoder
 * returns null so Android can use the collection's launcher icon instead.
 */
import { seriesColors } from '@simple-games/brand';
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { GameDefinition } from '../../app/registry';
import { titleAccentOf } from '../../app/titleAccent';
import { GameArtwork } from '../../ui/components/GameArtwork';

/** 108dp at xxxhdpi: the launcher owns the mask over this full-bleed layer. */
const FULL_BLEED = 432;
/**
 * The drawing's occupied area fits inside the central 66dp safe circle, even
 * with a circular launcher mask. Its 120×90 viewBox includes its own margins.
 */
const ART_WIDTH = 288;
const ART_HEIGHT = 216;
const DECODE_TIMEOUT_MS = 2000;

function artworkSvg(game: GameDefinition): string | null {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(GameArtwork, { id: game.id })));
    const svg = host.querySelector('svg');
    if (!svg) return null;
    const accent = titleAccentOf(game.id).light;
    // An SVG decoded as an Image has no access to the page's inherited CSS.
    // Resolve both tokens explicitly rather than depending on its current theme.
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

function decodeImage(image: HTMLImageElement, source: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (loaded: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    const timer = setTimeout(() => finish(false), DECODE_TIMEOUT_MS);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    try {
      image.src = source;
    } catch {
      finish(false);
    }
  });
}

/** The PNG, base64 without the data: prefix, or null for the app-icon fallback. */
export async function renderHomeShortcutIcon(game: GameDefinition): Promise<string | null> {
  let objectUrl: string | undefined;
  let image: HTMLImageElement | undefined;
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = FULL_BLEED;
    canvas.height = FULL_BLEED;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const source = artworkSvg(game);
    if (!source) return null;
    objectUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
    image = new Image();
    if (!(await decodeImage(image, objectUrl))) return null;

    // Fixed light paper and title accent match the illustration on the shelf.
    // A solid field reaches every possible launcher mask; no transparent corners.
    ctx.fillStyle = seriesColors.paper;
    ctx.fillRect(0, 0, FULL_BLEED, FULL_BLEED);
    ctx.drawImage(
      image,
      (FULL_BLEED - ART_WIDTH) / 2,
      (FULL_BLEED - ART_HEIGHT) / 2,
      ART_WIDTH,
      ART_HEIGHT,
    );
    const dataUrl = canvas.toDataURL('image/png');
    const prefix = 'data:image/png;base64,';
    return dataUrl.startsWith(prefix) && dataUrl.length > prefix.length
      ? dataUrl.slice(prefix.length)
      : null;
  } catch {
    return null;
  } finally {
    // Stop a timed-out image load as well as releasing a successfully drawn one.
    try {
      if (image) image.src = '';
    } catch {
      // Decoder teardown cannot prevent the app-icon fallback.
    }
    try {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    } catch {
      // A WebView without working object URLs must still offer the shortcut.
    }
  }
}
