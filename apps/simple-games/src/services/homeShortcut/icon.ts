/**
 * The icon a pinned shortcut wears on the Android home screen (issue #110):
 * the game's tile — its glyph on its own accent — drawn with Canvas 2D, with
 * no dependency and no network, the way the share card is
 * (services/share/card.ts).
 *
 * WHY DRAWN, NOT SHIPPED
 *
 * Thirty games would be thirty sets of density-bucketed drawables to keep in
 * step with the registry and the brand palette by hand — and a glyph like `⌗`
 * or `≶` has no guaranteed shape in whatever font the native side would
 * pick. The WebView already draws every one of these marks on the collection
 * home through one font stack (`--font-display`: the bundled Nunito, then the
 * system's rounded and sans faces), so a canvas in the same WebView draws the
 * same mark the home shows.
 *
 * WHY THE ACCENT AS THE FIELD, NOT THE SOFT TILE
 *
 * On the collection home the tile is the soft tint with the glyph in the
 * accent. On a home screen the icon sits on a wallpaper nobody chose for it,
 * beside icons that are anything but soft, and a pastel square with a thin
 * glyph vanishes on a light wallpaper. So the icon inverts the tile: the
 * accent is the field and the glyph is the ink the accent is meant to carry
 * (`onLight`) — the face the share card already shows. Always the light
 * palette, for the same reason the launcher icon does not repaint per theme.
 *
 * SHAPE
 *
 * A full-bleed adaptive-icon layer: a 108dp square of which the launcher
 * shows the central 72dp through its own mask (circle, squircle, rounded
 * square — its choice, not ours). The glyph is sized to sit inside that safe
 * zone; a two-character mark (`10`, `01`) shrinks until it does. The plugin
 * hands the bitmap to `IconCompat.createWithAdaptiveBitmap`; on a pre-Oreo
 * device the compat library crops a legacy icon out of the same picture.
 *
 * Null on any failure — no `document`, no 2D context (jsdom, or a WebView
 * that lied about canvas), a `toDataURL` that throws — and the request goes
 * out without a picture, which the launcher answers with the app icon. A
 * missing icon is not a reason to withhold the door.
 */
import type { GameDefinition } from '../../app/registry';
import { titleAccentOf } from '../../app/titleAccent';

/** 108dp at xxxhdpi: the whole adaptive layer, mask included. */
const FULL_BLEED = 432;
/** The glyph's box: comfortably inside the 72dp (288px) every mask keeps. */
const GLYPH_MAX_WIDTH = 200;
const GLYPH_MAX_PX = 168;
const GLYPH_MIN_PX = 96;
const FONT_FAMILY = 'Nunito, ui-rounded, system-ui, sans-serif';

/** The PNG, base64 without the `data:` prefix — or null (see the header). */
export function renderHomeShortcutIcon(game: GameDefinition): string | null {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = FULL_BLEED;
    canvas.height = FULL_BLEED;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const accent = titleAccentOf(game.id);
    ctx.fillStyle = accent.light;
    ctx.fillRect(0, 0, FULL_BLEED, FULL_BLEED);

    // Largest size whose width still clears the mask, 4px steps, never below
    // the floor: a mark that cannot fit even there prints tight rather than
    // vanishing (the same rule card.ts's fitFont follows).
    let px = GLYPH_MAX_PX;
    ctx.font = `800 ${px}px ${FONT_FAMILY}`;
    while (px > GLYPH_MIN_PX && ctx.measureText(game.glyph).width > GLYPH_MAX_WIDTH) {
      px = Math.max(GLYPH_MIN_PX, px - 4);
      ctx.font = `800 ${px}px ${FONT_FAMILY}`;
    }
    ctx.fillStyle = accent.onLight;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(game.glyph, FULL_BLEED / 2, FULL_BLEED / 2);

    const dataUrl = canvas.toDataURL('image/png');
    const comma = dataUrl.indexOf(',');
    return comma === -1 ? null : dataUrl.slice(comma + 1);
  } catch {
    return null;
  }
}
