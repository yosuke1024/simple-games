import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve('src/games/knight-tour/ui/knight-tour.css'), 'utf8');

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

describe('Knight’s Tour visit-number contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`keeps small visit numbers readable on both squares in ${theme} mode`, () => {
      const selector = theme === 'light' ? '.kt-screen,' : ":root[data-theme='dark'] .kt-screen,";
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThanOrEqual(0);
      const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
      const colour = (name: string) => {
        const value = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`).exec(block)?.[1];
        expect(value, name).toBeDefined();
        return value!;
      };
      const ink = colour('--kt-board-ink');
      for (const square of ['--kt-square-light', '--kt-square-dark']) {
        const [light, dark] = [luminance(ink), luminance(colour(square))].sort((a, b) => b - a);
        expect((light! + 0.05) / (dark! + 0.05), square).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
