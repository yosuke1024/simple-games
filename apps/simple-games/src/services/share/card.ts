/**
 * The picture that rides along with a share (issue #86; results added
 * 2026-09-03, docs/plans/2026-09-03-share-results-card.md): a 1080×1080 PNG
 * drawn with Canvas 2D, no dependency, no network request.
 *
 * WHY A DRAWN CARD, AND NOT A SCREENSHOT
 *
 * The web result screen carries an ad one time in three — "every 3rd result
 * of the session, never the first" (ui/components/ResultAdSlot.tsx,
 * services/ads/web/resultCadence.ts) — so a screenshot of what the player is
 * actually looking at would sometimes carry someone else's advertisement
 * into a share. Capturing the DOM instead (html2canvas and its like) means a
 * dependency heavy enough to matter against this app's size budget, built on
 * browser features this app's 2021 WebView floor does not reliably have. A
 * card this module draws itself looks the same for all thirty titles and
 * never carries an ad.
 *
 * WHY SYNCHRONOUS
 *
 * `navigator.share` needs the user activation of the click that starts it
 * (share.ts), and that activation is gone by the time an `await`ed step
 * resolves. So nothing here may `await` — not a font load, not `toBlob` — the
 * card is drawn and encoded to a `File` in one synchronous call, using
 * `canvas.toDataURL('image/png')` and decoding the base64 by hand.
 *
 * WHY THE LIGHT PALETTE, ALWAYS
 *
 * The card is seen by whoever the message is shared to, not by the player —
 * their device's theme has no bearing on it, and a light card reads reliably
 * wherever it lands (a chat bubble, a social post preview). It never reads
 * `useSettings()` or `prefers-color-scheme`; the dark palette simply does not
 * apply here.
 */
import { LANDING_BASE_URL, SERIES_NAME, seriesColors, titleAccents } from '@simple-games/brand';
import { GAMES, type GameId } from '../../app/registry';
import { shareTitleOf, usableDetails, type ShareDetail, type ShareOutcome } from './message';

export interface ShareCardInput {
  gameId: GameId;
  outcome: ShareOutcome;
  /** Same facts as the message — message.ts trims and cleans both alike. */
  details: readonly ShareDetail[];
  /** The translated word drawn on the pill for a real win: `t('shareCardCleared')`. */
  clearedLabel: string;
}

const CANVAS_SIZE = 1080;
const PADDING = 96;
const CONTENT_WIDTH = CANVAS_SIZE - PADDING * 2; // 888

/**
 * Bundled via @fontsource and already on screen by the time a result card is
 * showing, so — unlike a cold load — there is nothing to wait for here; the
 * synchronous rule above forbids `await document.fonts` regardless. A script
 * this does not cover (Devanagari, Thai, CJK, …) falls through to the system
 * fonts in the stack, the same fallback the DOM itself would use.
 */
const FONT_FAMILY = 'Nunito, ui-rounded, system-ui, sans-serif';
const fontOf = (weight: number, px: number): string => `${weight} ${px}px ${FONT_FAMILY}`;

/**
 * The kebab-case game id to the camelCase key `titleAccents` uses
 * ('number-match' -> 'numberMatch', 'freecell' -> 'freecell'). '2048' is the
 * one id that cannot camel-case itself — not a legal identifier fragment —
 * so its accent is named 'game2048'.
 */
export function accentKeyOf(gameId: GameId): keyof typeof titleAccents {
  if (gameId === '2048') return 'game2048';
  return gameId.replace(/-([a-z0-9])/g, (_match, ch: string) =>
    ch.toUpperCase(),
  ) as keyof typeof titleAccents;
}

/**
 * A rounded-rect path, built by hand from arcs: `ctx.roundRect` is past this
 * app's 2021 WebView floor (docs/ARCHITECTURE.md). Callers `fill()` it.
 */
function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/**
 * Sets `ctx.font` to the largest size in `[minPx, maxPx]` (2px steps) whose
 * `measureText` width still fits `maxWidth`, and returns that size. Never
 * shrinks past `minPx` — a string that cannot fit even there prints tight
 * rather than vanishing or overflowing the card silently.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  maxPx: number,
  minPx: number,
  maxWidth: number,
): number {
  let px = maxPx;
  ctx.font = fontOf(weight, px);
  while (px > minPx && ctx.measureText(text).width > maxWidth) {
    px = Math.max(minPx, px - 2);
    ctx.font = fontOf(weight, px);
  }
  return px;
}

/**
 * Draws the card and hands it back as a `File`, or `null` on any failure —
 * no `document`, `getContext('2d')` returning null (jsdom, and any WebView
 * that lied about canvas support), a `toDataURL` or `File` that throws.
 * Every ending here is a normal ending, the same rule share.ts is held to:
 * the caller falls back to a text-only share rather than seeing an error.
 *
 * Call it synchronously, right before `shareGame` — see the header for why.
 */
export function renderShareCard(input: ShareCardInput): File | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { gameId, outcome, clearedLabel } = input;
    const accent = titleAccents[accentKeyOf(gameId)];
    const glyph = GAMES.find((game) => game.id === gameId)?.glyph ?? '';
    const title = shareTitleOf(gameId);

    // Background: the title's own accent, always the light palette (header).
    ctx.fillStyle = accent.light;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // The series tile: the collection home's own mark for this game.
    const tileSize = 120;
    ctx.save();
    ctx.fillStyle = seriesColors.surface;
    roundedRectPath(ctx, PADDING, PADDING, tileSize, tileSize, 28);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = accent.light;
    ctx.font = fontOf(700, 64);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, PADDING + tileSize / 2, PADDING + tileSize / 2);
    ctx.restore();

    // "Simple Games", right of the tile and centred on it.
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = accent.onLight;
    ctx.font = fontOf(700, 40);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(SERIES_NAME, PADDING + tileSize + 24, PADDING + tileSize / 2);
    ctx.restore();

    // The title, shrunk to fit the content width rather than wrapping.
    ctx.save();
    ctx.fillStyle = accent.onLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    fitFont(ctx, title, 800, 128, 64, CONTENT_WIDTH);
    ctx.fillText(title, PADDING, 430);
    ctx.restore();

    // The cleared pill — only where the run actually was a win (ShareOutcome).
    if (outcome === 'completed') {
      const pillPaddingX = 28;
      const pillHeight = 72;
      const pillY = 480;
      ctx.font = fontOf(700, 44);
      const pillWidth = ctx.measureText(clearedLabel).width + pillPaddingX * 2;

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = accent.onLight;
      roundedRectPath(ctx, PADDING, pillY, pillWidth, pillHeight, 36);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = accent.onLight;
      ctx.font = fontOf(700, 44);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(clearedLabel, PADDING + pillPaddingX, pillY + pillHeight / 2);
      ctx.restore();
    }

    // The facts of the run, headline first — the same strings the result
    // screen showed (message.ts usableDetails already trims to three and
    // drops anything blank). Nothing is drawn here when there are none.
    const facts = usableDetails(input.details);
    const columnWidth = facts.length > 0 ? CONTENT_WIDTH / facts.length : 0;
    facts.forEach((detail, index) => {
      const columnX = PADDING + index * columnWidth;
      const maxWidth = columnWidth - 24;

      if (detail.label) {
        ctx.save();
        ctx.globalAlpha = 0.72;
        ctx.fillStyle = accent.onLight;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        fitFont(ctx, detail.label, 700, 34, 22, maxWidth);
        ctx.fillText(detail.label, columnX, 720);
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = accent.onLight;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      fitFont(ctx, detail.value, 800, 88, 40, maxWidth);
      ctx.fillText(detail.value, columnX, 820);
      ctx.restore();
    });

    // Footer: the address a stranger could type in by hand, derived from the
    // landing URL rather than hard-coded so it moves if that address ever
    // does (expect "pixapps.ai/simple-games").
    const landing = new URL(LANDING_BASE_URL);
    const address = `${landing.host}${landing.pathname}`.replace(/\/$/, '');
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = accent.onLight;
    ctx.font = fontOf(700, 36);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(address, PADDING, 984);
    ctx.restore();

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], `simple-games-${gameId}.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}
