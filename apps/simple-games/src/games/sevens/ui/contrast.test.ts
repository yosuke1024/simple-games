import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const css = readFileSync(resolve('src/games/sevens/ui/sevens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
function block(header: string) {
  const start = css.indexOf(header);
  expect(start).toBeGreaterThan(-1);
  return css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
}
const blocks = [
  block("[data-game='sevens'] {"),
  block("[data-theme='dark'][data-game='sevens'] {"),
];
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const x = parseInt(hex.slice(i, i + 2), 16) / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}
describe('sevens paper and felt contrast', () => {
  it('keeps all pigment literals in the two theme palettes', () => {
    let rest = css;
    for (const b of blocks) rest = rest.replace(b, '');
    expect(rest.match(/#[0-9a-f]{3,8}\b/gi) ?? []).toEqual([]);
    expect(rest.match(/\b(?:rgba?|hsla?|color-mix)\(/gi) ?? []).toEqual([]);
  });
  it.each([0, 1])('keeps ranks, suits and table labels legible in theme %s', (index) => {
    const colors = new Map(
      [...blocks[index]!.matchAll(/--sv-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((m) => [
        m[1]!,
        m[2]!,
      ]),
    );
    const get = (s: string) => colors.get(s)!;
    for (const ink of ['card-black', 'card-red', 'joker'])
      for (const paper of ['card-paper', 'selection'])
        expect(contrast(get(ink), get(paper)), `${ink} on ${paper}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(get('felt-ink'), get('felt'))).toBeGreaterThanOrEqual(4.5);
    expect(luminance(get('card-paper'))).toBeGreaterThan(luminance(get('felt')));
  });
});
