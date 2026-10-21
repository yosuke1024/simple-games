/**
 * What jsdom cannot see: the stylesheet itself (docs/SCOPA_RULES.md §2.5,
 * §11.1, §11.2). jsdom loads no CSS, so the screen tests can say a card is
 * disabled but not how it looks. These read `ui/scopa.css` (and the shell's
 * tokens) as text and hold the rules the screen depends on:
 *
 * - a card that is not pressable right now is drawn at full strength — the
 *   shell's `button:disabled` would dim it to 40% (§2.5: not the time, not
 *   wrong);
 * - keyboard focus is a mark of its own, not the outline the takeable mark
 *   used to take over;
 * - the shape marks sit in the top band, which a third row never covers, and
 *   the part of an overlapped card left showing is at least the tap floor —
 *   the §11.1 numbers are computed here from the CSS, not copied;
 * - the line wraps rather than cutting words off;
 * - the band's ♦ and the closed slot read on the dark theme.
 *
 * Contrast here is arithmetic on the declared colours (WCAG relative
 * luminance), not a measurement of a rendered page.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Resolved from the workspace root (src/ui/styles.test.ts explains why).
const css = readFileSync(resolve('src/games/scopa/ui/scopa.css'), 'utf8');
const shell = readFileSync(resolve('src/ui/styles.css'), 'utf8');

/** The declarations of one rule, found by its exact selector line. */
function ruleBody(selector: string, source = css): string {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is missing`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  return source.slice(open + 1, source.indexOf('}', open));
}

const ruleAt = (selector: string): number => css.indexOf(`\n${selector} {`);

/** A custom property's value inside one block, e.g. `--sc-band-red` under the dark theme. */
function token(block: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block);
  expect(match, `${name} is missing`).not.toBeNull();
  return match![1]!.trim();
}

const percent = (body: string, property: string): number => {
  const match = new RegExp(`${property}:\\s*(-?[\\d.]+)%`).exec(body);
  expect(match, `${property} is not a percentage`).not.toBeNull();
  return Number(match![1]);
};

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('a card that cannot be pressed now (§2.5)', () => {
  it('is drawn at full strength, against the shell dimming disabled buttons', () => {
    expect(ruleBody('button:disabled', shell)).toMatch(/opacity:\s*0\.4/);
    expect(ruleBody('.sc-card:disabled')).toMatch(/opacity:\s*1;/);
  });

  it('leaves only the cannot-take mark, on the player’s own turn, to step back', () => {
    expect(ruleBody('.sc-cannot')).toMatch(/filter:\s*saturate/);
    expect(ruleBody('.sc-cannot')).not.toMatch(/opacity/);
  });
});

describe('keyboard focus (§2.5)', () => {
  it('keeps the outline for focus: no mark on a card draws one', () => {
    for (const mark of ['.sc-takeable', '.sc-picked', '.sc-lifted', '.sc-can-take::after']) {
      expect(ruleBody(mark), mark).not.toMatch(/outline/);
    }
  });

  it('draws focus outside every ring, declared after the marks', () => {
    const focus = ruleBody('.sc-card:focus-visible');
    expect(focus).toMatch(/outline:\s*3px solid/);
    // The takeable ring reaches 4px out; focus starts beyond it.
    const offset = /outline-offset:\s*(\d+)px/.exec(focus);
    expect(Number(offset?.[1])).toBeGreaterThan(4);
    for (const mark of ['.sc-takeable', '.sc-picked', '.sc-lifted']) {
      expect(ruleAt('.sc-card:focus-visible'), mark).toBeGreaterThan(ruleAt(mark));
    }
  });
});

describe('the marks, and a third row (§11.1, §11.2)', () => {
  it('puts the takeable notch and the in-group dot in the top band, with the index', () => {
    for (const mark of ['.sc-takeable::after', '.sc-picked::after']) {
      const body = ruleBody(mark);
      expect(body, mark).toMatch(/top:\s*\d+px/);
      expect(body, mark).not.toMatch(/bottom:/);
    }
    expect(ruleBody('.sc-card-index')).toMatch(/top:\s*\d+px/);
  });

  // A card is `width` × 1.4 tall; a percentage margin resolves against the
  // table's width A, so what shows of an overlapped card is A × (w × 1.4 − m).
  const builds = [
    {
      name: 'the app',
      card: percent(ruleBody('.sc-table-card,\n.sc-slot,\n.sc-fold-card'), 'width'),
      overlap: -percent(ruleBody('.sc-table-tight .sc-table-row + .sc-table-row'), 'margin-top'),
    },
    {
      name: 'the web ad build',
      card: percent(
        ruleBody(
          ':root[data-sg-web-ads] .sc-table-card,\n:root[data-sg-web-ads] .sc-slot,\n:root[data-sg-web-ads] .sc-fold-card',
        ),
        'width',
      ),
      overlap: -percent(
        ruleBody(':root[data-sg-web-ads] .sc-table-tight .sc-table-row + .sc-table-row'),
        'margin-top',
      ),
    },
  ];

  it.each(builds)('leaves at least 48px of an overlapped card showing in $name', (build) => {
    expect(build.card).toBeGreaterThan(0);
    expect(build.overlap).toBeGreaterThan(0);
    for (const width of [308, 348, 408]) {
      const shown = (width * (build.card * 1.4 - build.overlap)) / 100;
      expect(shown, `A = ${width}`).toBeGreaterThanOrEqual(48);
    }
  });

  it('records the arithmetic §11.1 quotes', () => {
    const [app, web] = builds;
    expect(app).toMatchObject({ card: 16, overlap: 6.5 });
    expect(web).toMatchObject({ card: 15, overlap: 5 });
  });
});

describe('the line (docs/I18N_POLICY.md: no fixed-width truncation)', () => {
  it('wraps, and holds two lines of height so the table does not jump', () => {
    const line = ruleBody('.sc-line');
    expect(line).toMatch(/flex-wrap:\s*wrap/);
    expect(line).not.toMatch(/nowrap/);
    expect(line).toMatch(/min-height:\s*36px/);
    expect(css).not.toMatch(/text-overflow:\s*ellipsis/);
  });
});

describe('colours on the dark theme', () => {
  const darkShell = ruleBody(":root[data-theme='dark']", shell);
  const darkGame = ruleBody(":root[data-theme='dark']");
  const lightShell = ruleBody(':root', shell);
  const lightGame = ruleBody(':root');

  it('draws the band’s ♦ in a red that reads on the page, in both themes', () => {
    expect(ruleBody('.sc-tally-diamonds .sc-suit')).toMatch(/color:\s*var\(--sc-band-red\)/);
    expect(
      contrast(token(darkGame, '--sc-band-red'), token(darkShell, '--paper')),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(token(lightGame, '--sc-band-red'), token(lightShell, '--paper')),
    ).toBeGreaterThanOrEqual(4.5);
    // The card red stays a card-face colour: on the dark page it would not read.
    expect(contrast(token(darkGame, '--sc-red'), token(darkShell, '--paper'))).toBeLessThan(3);
  });

  it('frames the closed slot in a light line on the dark felt', () => {
    expect(ruleBody('.sc-slot')).toMatch(/border:\s*1\.5px dashed var\(--sc-slot-line\)/);
    expect(token(darkGame, '--sc-slot-line')).toMatch(/^rgba\(2\d\d, 2\d\d, 2\d\d,/);
  });
});
