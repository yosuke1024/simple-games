/**
 * The cards are paper in both themes (docs/THREE_PEAKS_RULES.md §6; owner's
 * decision, 2026-10-29): `--tp-face` / `--tp-ink` / `--tp-face-line` / `--tp-red`
 * in the two blocks at the top of ui/three-peaks.css. A dark face would turn the
 * black suits near-white and put the cards below the table in brightness, so
 * the dark theme dims the paper instead and the table around it stays dark.
 * What the stylesheet promises is measured here from the stylesheets rather
 * than trusted to a comment (docs/BRAND.md「コントラスト」):
 *
 * - the rank and suit marks read on the paper as text (4.5:1) — the ink and the
 *   red, both themes;
 * - a playable card's 2px accent edge and the accent panel of a back clear 3:1,
 *   the WCAG floor for graphical objects;
 * - the keyboard focus ring is two-tone: a 3px --tp-ink band that shows on the
 *   paper of the neighbouring cards and a 3px --ink outline that shows on the
 *   table, each at 3:1 on its own ground (in the dark theme --ink IS paper, so
 *   the outline alone vanished on a neighbour — the review finding this pins);
 * - the paper is lighter than the table in both themes (the physical rule the
 *   dark theme used to break), and the card edge is darker than the paper;
 * - the status label is --ink in both themes, because --ink-soft is under
 *   4.5:1 on the table in the dark theme and unproven in the light one.
 *
 * The shadows, the lamp and the gloss carry no meaning, so they have no ratio
 * to clear. What is pinned instead is where the colour may be written: only in
 * the two blocks, so nothing below them is a colour this file does not measure.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');
const gameCss = readFileSync(resolve('src/games/three-peaks/ui/three-peaks.css'), 'utf8');

/** `source` without its comments, so a value quoted in a comment is not a colour. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The text of the first rule whose selector list starts with `header` (after a newline). */
function block(source: string, header: string): string {
  const start = source.indexOf(`\n${header}`);
  expect(start, `${header} is missing`).toBeGreaterThan(-1);
  return source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
}

/** The #rrggbb custom properties declared in that rule. */
function tokens(source: string, header: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of block(source, header).matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) {
    out.set(match[1]!, match[2]!.toLowerCase());
  }
  return out;
}

/** WCAG 2 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const THEMES = [
  {
    name: 'light',
    base: ':root {',
    accent: ":root[data-game='three-peaks'],",
    game: ':root {',
  },
  {
    name: 'dark',
    base: ":root[data-theme='dark'] {",
    accent: ":root[data-theme='dark'][data-game='three-peaks'],",
    game: ":root[data-theme='dark'] {",
  },
] as const;

const css = stripComments(gameCss);

describe('the paper cards and their table (docs/THREE_PEAKS_RULES.md §6)', () => {
  it('measures black on white at 21:1', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('keeps every colour literal inside the two blocks at the top', () => {
    // The lift, the lamp, the gloss and the recess are tokens too, so nothing
    // below the blocks names a colour. Comments are stripped first: a hex
    // quoted in prose is not a declaration.
    let outside = css;
    for (const theme of THEMES) outside = outside.replace(block(css, theme.game), '');
    expect(outside.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(outside.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual(
      [],
    );
  });

  it('declares the four paper tokens in both blocks, with one red', () => {
    const [light, dark] = THEMES.map((theme) => tokens(css, theme.game));
    for (const name of ['--tp-face', '--tp-ink', '--tp-face-line', '--tp-red']) {
      expect(light!.get(name), `${name} (light)`).toBeDefined();
      expect(dark!.get(name), `${name} (dark)`).toBeDefined();
    }
    // The red sits on paper in both themes, so it has no reason to change.
    expect(dark!.get('--tp-red')).toBe(light!.get('--tp-red'));
  });

  for (const theme of THEMES) {
    describe(theme.name, () => {
      const base = tokens(sharedCss, theme.base);
      const colours = tokens(css, theme.game);
      const accent = tokens(sharedCss, theme.accent);
      const get = (map: Map<string, string>, name: string) => {
        const value = map.get(name);
        expect(value, `${name} under ${theme.name}`).toBeDefined();
        return value!;
      };
      const face = get(colours, '--tp-face');
      const table = get(accent, '--accent-soft');

      it('reads the rank and the suit as text on the paper (4.5:1)', () => {
        const ink = contrast(get(colours, '--tp-ink'), face);
        const red = contrast(get(colours, '--tp-red'), face);
        // Printed for docs/THREE_PEAKS_RULES.md §6; the gate is the 4.5:1 below.
        console.info(
          `[three-peaks contrast] ${theme.name} ink ${ink.toFixed(2)}, red ${red.toFixed(2)} on ${face}`,
        );
        expect(ink).toBeGreaterThanOrEqual(4.5);
        expect(red).toBeGreaterThanOrEqual(4.5);
      });

      it('keeps the playable edge and the back panel above 3:1 on the paper', () => {
        const edge = contrast(get(accent, '--accent'), face);
        console.info(
          `[three-peaks contrast] ${theme.name} accent edge/panel ${edge.toFixed(2)} on ${face}`,
        );
        expect(edge).toBeGreaterThanOrEqual(3);
      });

      it('keeps the two-tone focus ring above 3:1 on the paper and on the table', () => {
        const band = get(colours, '--tp-ink');
        const outline = get(base, '--ink');
        const bandOnPaper = contrast(band, face);
        const outlineOnPaper = contrast(outline, face);
        const outlineOnTable = contrast(outline, table);
        console.info(
          `[three-peaks contrast] ${theme.name} focus ring: band on paper ${bandOnPaper.toFixed(2)}, outline on paper ${outlineOnPaper.toFixed(2)}, outline on table ${outlineOnTable.toFixed(2)}, band vs outline ${contrast(band, outline).toFixed(2)}`,
        );
        // Most of a card's ring falls on the paper of its neighbours, the rest
        // on the table: each ground needs a part of the ring that shows on it.
        expect(bandOnPaper).toBeGreaterThanOrEqual(3);
        expect(outlineOnTable).toBeGreaterThanOrEqual(3);
        // Where the outline is lost on paper (the dark theme, 1.00:1) the band
        // must part from it, or the ring has no edge there. Where it is not (the
        // light theme: both are the same dark ink) the two read as one thick ring.
        if (outlineOnPaper < 3) expect(contrast(band, outline)).toBeGreaterThanOrEqual(3);
      });

      it('keeps the paper lighter than the table and the card edge darker than the paper', () => {
        // The physical rule: a card is paper lying on a table. The dark theme
        // used to put the card below the table (1.26:1), which read as a hole.
        const lift = contrast(face, table);
        console.info(
          `[three-peaks contrast] ${theme.name} paper on table ${lift.toFixed(2)}, edge on paper ${contrast(get(colours, '--tp-face-line'), face).toFixed(2)}`,
        );
        expect(luminance(face)).toBeGreaterThan(luminance(table));
        expect(luminance(get(colours, '--tp-face-line'))).toBeLessThan(luminance(face));
      });
    });
  }

  it('sets the status label in --ink so it reads at 4.5:1 on the table in both themes', () => {
    for (const theme of THEMES) {
      const base = tokens(sharedCss, theme.base);
      const table = tokens(sharedCss, theme.accent).get('--accent-soft')!;
      const soft = contrast(base.get('--ink-soft')!, table);
      const ink = contrast(base.get('--ink')!, table);
      // --ink-soft is printed to show why it is not used, not gated.
      console.info(
        `[three-peaks contrast] ${theme.name} status label: ink ${ink.toFixed(2)}, (ink-soft ${soft.toFixed(2)}) on ${table}`,
      );
      expect(ink).toBeGreaterThanOrEqual(4.5);
    }
    // The label and the "/ 28" inside it take --ink; nothing makes either paler.
    expect(block(css, '.tp-status {')).toMatch(/color: var\(--ink\);/);
    expect(block(css, '.tp-status strong span {')).not.toMatch(/color:/);
    expect(css).not.toMatch(/\.tp-status[^{]*\{[^}]*color: var\(--ink-soft\)/);
  });

  it('writes the focus band into every rule that sets a card shadow while focused', () => {
    // .tp-playable:hover and :active set box-shadow at the same specificity as
    // .tp-card:focus-visible, so a focused card that is hovered or pressed
    // would lose the band unless each rule repeats it. Only the source tells.
    const band = String.raw`box-shadow:\s*0 0 0 3px var\(--tp-ink\),\s*var\(--tp-`;
    for (const selector of [
      String.raw`\.tp-card:focus-visible`,
      String.raw`\.tp-playable:hover:focus-visible`,
      String.raw`\.tp-playable:active:focus-visible`,
    ]) {
      expect(css, selector).toMatch(new RegExp(`${selector} \\{[^}]*${band}`));
    }
  });

  it('turns the lift and the settle off by both Reduced Motion routes', () => {
    // vite.config.ts's test setup turns css off, so nothing rendered can notice
    // a route that is missing; only the source can.
    const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(media).toMatch(/\.tp-waste-settle \{\s*animation: none;/);
    expect(media).toMatch(/\.tp-card,\s*\.tp-stock \{\s*transition: none;/);
    expect(css).toMatch(
      /:root\[data-reduced-motion='true'\] \.tp-waste-settle \{\s*animation: none;/,
    );
    expect(css).toMatch(
      /:root\[data-reduced-motion='true'\] \.tp-card,\s*:root\[data-reduced-motion='true'\] \.tp-stock \{\s*transition: none;/,
    );
  });
});
