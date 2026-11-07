/**
 * The picture that rides along with a share (issue #86; results added
 * 2026-09-03, docs/plans/2026-09-03-share-results-card.md): a 1200×900 PNG
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
 * card this module draws itself uses the same layout for every title and
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
import { LANDING_BASE_URL, SERIES_NAME, SERIES_BY_LINE, seriesColors } from '@simple-games/brand';
import type { GameId } from '../../app/registry';
import { titleAccentOf } from '../../app/titleAccent';
import { shareTitleOf, usableDetails, type ShareDetail, type ShareOutcome } from './message';
import { drawShareBoard, isShareBoardPreview, type ShareBoardPreview } from './board';

/**
 * The drawn card, in the two shapes the two share paths need.
 *
 * `file` is what the Web Share API takes; `base64` is what the native share
 * plugin needs, because on a device the picture travels as a file on disk
 * rather than as an object in the page (share.ts). Drawing happens once and
 * both shapes come out of the same canvas, so they cannot disagree.
 *
 * `file` alone is nullable: a WebView old enough to lack the `File`
 * constructor still gets a perfectly good `base64`, and the native path — the
 * one that platform actually uses — keeps working.
 */
export interface ShareCard {
  file: File | null;
  /** PNG bytes, base64, with no `data:` prefix. */
  base64: string;
  /** `simple-games-<game>.png` — the name the receiver sees. */
  name: string;
}

export interface ShareCardInput {
  gameId: GameId;
  outcome: ShareOutcome;
  /** Same facts as the message — message.ts trims and cleans both alike. */
  details: readonly ShareDetail[];
  /** The translated word drawn on the pill for a real win: `t('shareCardCleared')`. */
  clearedLabel: string;
  /** Short invitation in the player's language, not a claim about their score. */
  actionLabel: string;
  /** The collection's illustration, decoded before the click. Never the run's board. */
  artwork?: CanvasImageSource | null;
  /** Only visible cells explicitly supplied by this game. */
  board?: ShareBoardPreview | null;
  /** Localized caption distinguishing a real board from an illustrative scene. */
  visualLabel?: string;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const PADDING = 84;
const CONTENT_WIDTH = CANVAS_WIDTH - PADDING * 2;

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

/** The PNG as a `File`, or null where this WebView has no `File` to build. */
function toFile(base64: string, name: string): File | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], name, { type: 'image/png' });
  } catch {
    return null;
  }
}

/**
 * Draws the card and hands it back, or `null` on any failure —
 * no `document`, `getContext('2d')` returning null (jsdom, and any WebView
 * that lied about canvas support), a `toDataURL` or `File` that throws.
 * Every ending here is a normal ending, the same rule share.ts is held to:
 * the caller falls back to a text-only share rather than seeing an error.
 *
 * The picture is the one optional part, so it is the only part a failure may
 * cost. The illustration is decoded long before the click, and at click time
 * WebKit may still refuse it: `drawImage` throws for an image it now treats as
 * broken, and `toDataURL` throws on a canvas it considers tainted by the SVG.
 * Either one would otherwise turn a card share into a text-only share, which
 * is worse than 1.8.2 — that card had no picture and always attached. So a
 * failed draw that carried a picture is drawn once more, without it, on a
 * fresh canvas (a tainted canvas stays tainted). Still one synchronous call.
 *
 * Call it synchronously, right before `shareGame` — see the header for why.
 */
export function renderShareCard(input: ShareCardInput): ShareCard | null {
  const card = drawShareCard(input);
  if (card || (!input.artwork && !input.board)) return card;
  return drawShareCard({ ...input, artwork: null, board: null });
}

function drawShareCard(input: ShareCardInput): ShareCard | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const { gameId, outcome, clearedLabel, actionLabel, artwork } = input;
    const accent = titleAccentOf(gameId);
    const title = shareTitleOf(gameId);
    const facts = usableDetails(input.details);
    const board = isShareBoardPreview(input.board, gameId) ? input.board : null;
    const hasVisual = board !== null || Boolean(artwork);

    // Paper, title ink and the same original illustration as the collection.
    // No legacy glyph, invented medal, percentile or best-score claim.
    ctx.fillStyle = seriesColors.surface;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = accent.light;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 12);

    ctx.fillStyle = seriesColors.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = fontOf(800, 40);
    ctx.fillText(SERIES_NAME, PADDING, 93);
    ctx.fillStyle = seriesColors.inkSoft;
    ctx.font = fontOf(600, 26);
    ctx.fillText(SERIES_BY_LINE, PADDING + 280, 93);

    ctx.fillStyle = accent.light;
    fitFont(ctx, title, 800, 112, 40, CONTENT_WIDTH);
    ctx.fillText(title, PADDING, 230, CONTENT_WIDTH);

    // A quiet badge reports only a real clear. Other outcomes stay unlabelled.
    if (outcome === 'completed') {
      fitFont(ctx, clearedLabel, 800, 26, 20, CONTENT_WIDTH - 40);
      const pillWidth = Math.min(CONTENT_WIDTH, ctx.measureText(clearedLabel).width + 40);
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = accent.light;
      roundedRectPath(ctx, PADDING, 258, pillWidth, 46, 23);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = accent.light;
      ctx.textBaseline = 'middle';
      ctx.fillText(clearedLabel, PADDING + 20, 281, pillWidth - 40);
      ctx.textBaseline = 'alphabetic';
    }

    // The headline result is large enough to read in a feed. The two supporting
    // facts stay subordinate, with bounded text widths for every locale.
    const resultWidth = hasVisual ? 500 : CONTENT_WIDTH;
    if (facts[0]) {
      const headline = facts[0];
      ctx.fillStyle = seriesColors.inkSoft;
      fitFont(ctx, headline.label ?? '', 700, 32, 22, resultWidth);
      ctx.fillText(headline.label ?? '', PADDING, 374, resultWidth);
      ctx.fillStyle = seriesColors.ink;
      fitFont(ctx, headline.value, 800, 164, 44, resultWidth);
      ctx.fillText(headline.value, PADDING - 4, 540, resultWidth);

      const supporting = facts.slice(1);
      const columnWidth = resultWidth / Math.max(1, supporting.length);
      supporting.forEach((detail, index) => {
        const x = PADDING + index * columnWidth;
        const width = columnWidth - 28;
        ctx.fillStyle = seriesColors.inkSoft;
        fitFont(ctx, detail.label ?? '', 700, 26, 18, width);
        ctx.fillText(detail.label ?? '', x, 615, width);
        ctx.fillStyle = seriesColors.ink;
        fitFont(ctx, detail.value, 800, 52, 26, width);
        ctx.fillText(detail.value, x, 681, width);
      });
    }

    // Games may hand over their visible board cells. Other games use an
    // illustrative scene; the localized caption makes that distinction clear.
    // No screen capture, hidden solution or ad can enter either picture.
    if (hasVisual) {
      const x = facts.length ? 636 : 360;
      const y = 328;
      const width = 480;
      const height = 360;
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = accent.light;
      roundedRectPath(ctx, x, y, width, height, 40);
      ctx.fill();
      ctx.restore();
      if (board) {
        drawShareBoard(ctx, board, { x, y, width, height }, accent.light);
      } else if (artwork) {
        ctx.drawImage(artwork, x, y, width, height);
      }
      if (input.visualLabel) {
        ctx.save();
        ctx.fillStyle = seriesColors.inkSoft;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        fitFont(ctx, input.visualLabel, 700, 24, 18, width);
        ctx.fillText(input.visualLabel, x + width / 2, 727, width);
        ctx.restore();
      }
    }

    // A clear invitation and a human-readable address survive even when the
    // image is forwarded without its accompanying text. The actual share URL
    // still opens this game directly (message.ts).
    ctx.fillStyle = accent.light;
    ctx.fillRect(0, 760, CANVAS_WIDTH, 140);
    ctx.fillStyle = accent.onLight;
    fitFont(ctx, actionLabel, 800, 42, 24, CONTENT_WIDTH - 100);
    ctx.fillText(actionLabel, PADDING, 820, CONTENT_WIDTH - 100);
    const landing = new URL(LANDING_BASE_URL);
    const address = `${landing.host}${landing.pathname}`.replace(/\/$/, '');
    ctx.font = fontOf(600, 26);
    ctx.fillText(address, PADDING, 865);
    ctx.strokeStyle = accent.onLight;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(1060, 818);
    ctx.lineTo(1104, 818);
    ctx.moveTo(1088, 802);
    ctx.lineTo(1104, 818);
    ctx.lineTo(1088, 834);
    ctx.stroke();

    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const name = `simple-games-${gameId}.png`;
    return { file: toFile(base64, name), base64, name };
  } catch {
    return null;
  }
}
