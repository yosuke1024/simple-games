/**
 * The board's own colours (docs/TANGRAM_RULES.md §10): the plank of the board
 * and the tray, the silhouette's film over it, the groove of its edge, and
 * the pieces' two boards of one wood with their cut edge — game content, in
 * the two token blocks at the top of ui/tangram.css. The marks stay the
 * series' own: the ink (selection, fixed dots, the piece in the hand, the
 * outline where it cannot go), --surface (the focus dashes) and the accent
 * (the completion edge).
 *
 * The rules promise each of these reads at WCAG's 3:1 floor for graphical
 * objects (docs/BRAND.md「コントラスト」) on every ground it meets, in both
 * themes, so it is measured here from the stylesheets rather than trusted to
 * a comment (the same approach as chess/ui/contrast.test.ts). The film and
 * the grain are translucent: each is laid over the opaque plank first, and a
 * ground is every combination of the plank's three grain bands that can meet
 * at one point. A piece is a face inside an edge of another colour; it passes
 * on a ground when either clears 3:1 there (Chess's two-tone rule) — in the
 * light theme the dark edge carries it, in the dark theme the pale face.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const gameCss = readFileSync(resolve('src/games/tangram/ui/tangram.css'), 'utf8');
const sharedCss = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/**
 * The #rrggbb and #rrggbbaa custom properties declared in the first rule with
 * exactly this selector.
 */
function tokens(source: string, selector: string): Map<string, string> {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('}', start));
  const out = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6}(?:[0-9a-f]{2})?)\s*;/gi)) {
    out.set(match[1]!, match[2]!.toLowerCase());
  }
  return out;
}

/** The accent block for this game: `:root[data-game='tangram'],` opens it. */
function accent(selector: string): string {
  const start = sharedCss.indexOf(`\n${selector},`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const body = sharedCss.slice(sharedCss.indexOf('{', start) + 1, sharedCss.indexOf('}', start));
  const value = /--accent:\s*(#[0-9a-f]{6})\s*;/i.exec(body)?.[1];
  expect(value, `--accent under ${selector}`).toBeDefined();
  return value!.toLowerCase();
}

/** A #rrggbb or #rrggbbaa colour as 0–255 channels and a 0–1 alpha. */
function channels(hex: string): [number, number, number, number] {
  const at = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return [at(1), at(3), at(5), hex.length === 9 ? at(7) / 255 : 1];
}

/**
 * `top` painted over the opaque `ground` at `opacity` (a fill-opacity, or the
 * group's), composited in sRGB as a browser does, as an opaque #rrggbb.
 */
function over(top: string, ground: string, opacity = 1): string {
  const [r, g, b, alpha] = channels(top);
  const under = channels(ground);
  expect(under[3], `${ground} is a ground, so it must be opaque`).toBe(1);
  const a = alpha * opacity;
  return `#${[r, g, b]
    .map((c, i) => Math.round(c * a + under[i]! * (1 - a)))
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** WCAG 2 relative luminance of an opaque #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b, alpha] = channels(hex);
  expect(alpha, `${hex} must be composited before it is measured`).toBe(1);
  const [lr, lg, lb] = [r, g, b].map((c) => {
    const channel = c / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/** Every subset of `items` (2ⁿ of them, the empty one first). */
function subsets<T>(items: readonly T[]): T[][] {
  return Array.from({ length: 1 << items.length }, (_, mask) =>
    items.filter((_, i) => (mask >> i) & 1),
  );
}

const range = (values: readonly number[]) =>
  `${Math.min(...values).toFixed(2)}–${Math.max(...values).toFixed(2)}`;

const THEMES = [
  { name: 'light', game: ':root', accent: ":root[data-game='tangram']" },
  {
    name: 'dark',
    game: ":root[data-theme='dark']",
    accent: ":root[data-theme='dark'][data-game='tangram']",
  },
] as const;

const WOOD_TOKENS = [
  '--tn-plank-hi',
  '--tn-plank-lo',
  '--tn-plank-edge',
  '--tn-plank-lit',
  '--tn-plank-shade',
  '--tn-grain-a',
  '--tn-grain-b',
  '--tn-grain-c',
  '--tn-hollow',
  '--tn-groove',
  '--tn-wood-a',
  '--tn-wood-b',
  '--tn-edge',
  '--tn-wood-grain',
] as const;

describe('the board’s wood and marks (docs/TANGRAM_RULES.md §10)', () => {
  it('measures black on white at 21:1, and composites a film', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(over('#00000080', '#ffffff')).toBe('#7f7f7f');
    expect(over('#000000', '#ffffff', 0.38)).toBe('#9e9e9e');
  });

  it('declares the same wood tokens in both themes, and no other', () => {
    for (const theme of THEMES) {
      expect([...tokens(gameCss, theme.game).keys()].sort(), theme.name).toEqual(
        [...WOOD_TOKENS].sort(),
      );
    }
  });

  for (const theme of THEMES) {
    const wood = tokens(gameCss, theme.game);
    const series = tokens(sharedCss, theme.game);
    const get = (from: Map<string, string>, name: string) => {
      const value = from.get(name);
      expect(value, `${name} under ${theme.game}`).toBeDefined();
      return value!;
    };
    const ink = get(series, '--ink');
    const surface = get(series, '--surface');
    const paper = get(series, '--paper');
    const hollow = get(wood, '--tn-hollow');
    const groove = get(wood, '--tn-groove');
    const edge = get(wood, '--tn-edge');
    const planks = [get(wood, '--tn-plank-hi'), get(wood, '--tn-plank-lo')];
    const bands = [get(wood, '--tn-grain-a'), get(wood, '--tn-grain-b'), get(wood, '--tn-grain-c')];
    // The board: either end of the plank's gradient under any mix of its bands.
    const boards = planks.flatMap((plank) =>
      subsets(bands).map((mix) => mix.reduce((ground, band) => over(band, ground), plank)),
    );
    // The silhouette and the tray: the film over each of those.
    const recesses = boards.map((board) => over(hollow, board));
    const plainRecesses = planks.map((plank) => over(hollow, plank));
    const faces = { a: get(wood, '--tn-wood-a'), b: get(wood, '--tn-wood-b') };
    const grain = get(wood, '--tn-wood-grain');

    for (const [board, face] of Object.entries(faces)) {
      it(`board ${board}'s face parts from the silhouette and the tray by itself (${theme.name})`, () => {
        // Without the grain: the plain recess, so a piece and the shadow it
        // has not yet covered differ by more than an edge.
        const ratios = plainRecesses.map((ground) => contrast(face, ground));
        console.info(`[tangram contrast] ${theme.name} face ${board} × recess: ${range(ratios)}`);
        for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
      });

      it(`board ${board} reads on every recess by its face or its cut edge (${theme.name})`, () => {
        // The face as drawn: plain, or under one of its own grain lines.
        const drawn = [face, over(grain, face)];
        const worst = Math.min(
          ...recesses.flatMap((ground) =>
            drawn.map((inner) => Math.max(contrast(inner, ground), contrast(edge, ground))),
          ),
        );
        console.info(
          `[tangram contrast] ${theme.name} board ${board}: face ${range(recesses.map((g) => contrast(face, g)))}, grained face ${range(recesses.map((g) => contrast(drawn[1]!, g)))}, edge ${range(recesses.map((g) => contrast(edge, g)))}; worst of the two ${worst.toFixed(2)}`,
        );
        expect(worst).toBeGreaterThanOrEqual(3);
      });

      it(`a fixed piece's dotted ink edge reads on its sunken face of board ${board} (${theme.name})`, () => {
        // Medium only, never with Easy's lines (§3): the face at 38 % over the recess.
        const sunken = recesses.map((ground) => over(face, ground, 0.38));
        const ratios = sunken.map((ground) => contrast(ink, ground));
        console.info(
          `[tangram contrast] ${theme.name} fixed ${board}: ink × sunken face ${range(ratios)} (sunken face × recess ${range(sunken.map((s, i) => contrast(s, recesses[i]!)))}, shape and dots carry it)`,
        );
        for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
      });

      it(`keeps the grain on board ${board} faint — decoration, never a mark (${theme.name})`, () => {
        // Printed, not gated: inner halves and seams, which the shape and the
        // line's width carry, as they did before the wood (§10's table).
        console.info(
          `[tangram contrast] ${theme.name} board ${board} (not gated): edge × face ${contrast(edge, face).toFixed(2)}, ink × face ${contrast(ink, face).toFixed(2)}, ink × carried face ${range(boards.map((g) => contrast(ink, over(face, g, 0.88))))}, grain line × face ${contrast(over(grain, face), face).toFixed(2)}`,
        );
        expect(contrast(over(grain, face), face)).toBeLessThan(1.5);
      });
    }

    it(`the ink marks read on the plank and in the recess (${theme.name})`, () => {
      // The selection's outer half, the piece in the hand, the outline where
      // it cannot go — on the board or over the silhouette and the tray.
      const ratios = [...boards, ...recesses].map((ground) => contrast(ink, ground));
      console.info(`[tangram contrast] ${theme.name} ink × plank and recess: ${range(ratios)}`);
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(3);
      // The focus ring's dashes on the selection's ink edge (focus selects, §4).
      console.info(
        `[tangram contrast] ${theme.name} focus × ink: ${contrast(surface, ink).toFixed(2)}`,
      );
      expect(contrast(surface, ink)).toBeGreaterThanOrEqual(3);
    });

    it(`the groove reads on the plank and in the recess (${theme.name})`, () => {
      // The silhouette's edge sits on both; Easy's inner lines in the recess.
      const onBoard = boards.map((ground) => contrast(groove, ground));
      const inRecess = recesses.map((ground) => contrast(groove, ground));
      console.info(
        `[tangram contrast] ${theme.name} groove × plank ${range(onBoard)}, × recess ${range(inRecess)}`,
      );
      for (const ratio of [...onBoard, ...inRecess]) expect(ratio).toBeGreaterThanOrEqual(3);
      // Printed, not gated: the film itself (the groove carries the
      // silhouette's border) and the board's wood edge on the page (the
      // collection's frame round it carries the board's).
      console.info(
        `[tangram contrast] ${theme.name} (not gated) recess × plank ${range(recesses.map((r, i) => contrast(r, boards[i]!)))}, plank edge × page ${contrast(get(wood, '--tn-plank-edge'), paper).toFixed(2)}`,
      );
    });

    it(`the completion edge (the accent) reads on the plank and in the recess (${theme.name})`, () => {
      const value = accent(theme.accent);
      const onBoard = boards.map((ground) => contrast(value, ground));
      const inRecess = recesses.map((ground) => contrast(value, ground));
      console.info(
        `[tangram contrast] ${theme.name} accent × plank ${range(onBoard)}, × recess ${range(inRecess)}`,
      );
      for (const ratio of [...onBoard, ...inRecess]) expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it(`the Quick Rules pictures read on the page (${theme.name})`, () => {
      // Flat wood and the film on --paper, no plank and no grain (§9).
      const film = over(hollow, paper);
      expect(contrast(groove, paper)).toBeGreaterThanOrEqual(3);
      expect(contrast(groove, film)).toBeGreaterThanOrEqual(3);
      expect(contrast(ink, paper)).toBeGreaterThanOrEqual(3);
      for (const [board, face] of Object.entries(faces)) {
        console.info(
          `[tangram contrast] ${theme.name} picture ${board}: face × film ${contrast(face, film).toFixed(2)}, edge × film ${contrast(edge, film).toFixed(2)}`,
        );
        expect(
          Math.max(contrast(face, film), contrast(edge, film)),
          `board ${board} on the page`,
        ).toBeGreaterThanOrEqual(3);
      }
      console.info(
        `[tangram contrast] ${theme.name} picture: groove × page ${contrast(groove, paper).toFixed(2)}, × film ${contrast(groove, film).toFixed(2)}; ink × page ${contrast(ink, paper).toFixed(2)}`,
      );
    });

    it(`cuts the large triangles and the square from the deeper board (${theme.name})`, () => {
      // Not a 3:1 promise — the shapes tell the pieces apart (§12) — but the
      // two boards must stay in this order, or §10's description is backwards.
      console.info(
        `[tangram contrast] ${theme.name} luminance a ${luminance(faces.a).toFixed(3)} < b ${luminance(faces.b).toFixed(3)}, a × b ${contrast(faces.a, faces.b).toFixed(2)}`,
      );
      expect(luminance(faces.a)).toBeLessThan(luminance(faces.b));
    });
  }

  it('puts no colour literal anywhere but the two token blocks', () => {
    // Everything after the two blocks reads tokens; a literal there would be
    // a colour the tests above do not measure.
    const darkBlock = gameCss.indexOf("\n:root[data-theme='dark'] {");
    expect(darkBlock).toBeGreaterThan(-1);
    const rest = gameCss.slice(gameCss.indexOf('}', darkBlock) + 1);
    expect(rest.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(rest.match(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix)\(/gi) ?? []).toEqual([]);
    // And the two blocks come first: nothing but the header comment above them.
    const first = gameCss.indexOf('\n:root {');
    expect(
      gameCss
        .slice(0, first)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim(),
    ).toBe('');
  });

  it('keeps every filter off the board, and nothing Chromium 88 lacks (§10)', () => {
    // §10 promises the piece in the hand is redrawn without a filter, and the
    // grain is a pattern, not a filter either. Comments are dropped first:
    // the stylesheet says "no filter" in prose.
    const code = gameCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/\bfilter\s*:/);
    expect(code).not.toMatch(/:has\(|color-mix\(|container-type/);
  });
});
