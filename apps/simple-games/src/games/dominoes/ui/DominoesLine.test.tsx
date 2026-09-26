/**
 * The whole set on the line, at phone width, and no sideways scroll
 * (docs/DOMINOES_RULES.md §11).
 *
 * jsdom lays nothing out, so this cannot measure a row. What it can hold the
 * line to is the two things that decide whether it wraps: the markup — every
 * tile a direct child of the one wrapping `.dm-line`, none with a width of
 * its own — and the stylesheet — `.dm-line` wraps and never scrolls, a tile
 * has one fixed size, and the column around it clips sideways overflow
 * rather than scrolling it. Either half going wrong is how a line of 28
 * tiles becomes a strip that runs off a 360px screen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { ALL_TILES, isConnected, isDouble, makeTile, tileId, type Line } from '../game';
import { DominoesLine } from './components/DominoesLine';

// Resolved from the app root rather than import.meta.url: these tests run in
// the jsdom environment, where import.meta.url is an http:// URL.
const css = readFileSync(resolve('src/games/dominoes/ui/dominoes.css'), 'utf8');

/** The declarations of one rule, by its exact selector. */
function rule(selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `no "${selector}" rule in dominoes.css`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

/**
 * All 28 tiles in one line. Every pip value meets six other values and itself
 * (a double), so each value touches the set an even number of times and an
 * Euler circuit through every tile exists; Hierholzer's walk finds it.
 */
function fullLine(): Line {
  const unused = new Set(ALL_TILES.map(tileId));
  const stack = [0];
  const pips: number[] = [];
  while (stack.length > 0) {
    const at = stack[stack.length - 1]!;
    const next = ALL_TILES.find(
      (tile) => unused.has(tileId(tile)) && (tile[0] === at || tile[1] === at),
    );
    if (next) {
      unused.delete(tileId(next));
      stack.push(next[0] === at ? next[1] : next[0]);
    } else {
      pips.push(stack.pop()!);
    }
  }
  return pips.slice(1).map((right, i) => ({
    tile: makeTile(pips[i]!, right),
    left: pips[i]!,
    right,
  }));
}

afterEach(cleanup);

describe('the line with all 28 tiles, at 360px (§11)', () => {
  const line = fullLine();

  it('is a real line of the whole set', () => {
    expect(line).toHaveLength(28);
    expect(new Set(line.map((placed) => tileId(placed.tile))).size).toBe(28);
    expect(isConnected(line)).toBe(true);
  });

  it('puts every tile straight into the one wrapping row, with no width of its own', () => {
    window.innerWidth = 360;
    const { container } = render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <DominoesLine line={line} choosing={false} onChooseEnd={() => undefined} freshIndex={27} />
      </SettingsProvider>,
    );

    const rows = container.querySelectorAll('.dm-line');
    expect(rows).toHaveLength(1);
    const row = rows[0] as HTMLElement;
    const tiles = [...container.querySelectorAll<HTMLElement>('.dm-tile')];
    expect(tiles).toHaveLength(28);
    for (const tile of tiles) {
      expect(tile.parentElement).toBe(row);
      // No inline style at all: the stylesheet's tile size is the only one.
      expect(tile.getAttribute('style')).toBeNull();
    }
    // Nothing inside the line sets a width or an overflow of its own either.
    for (const element of row.querySelectorAll<HTMLElement>('*')) {
      expect(element.style.width).toBe('');
      expect(element.style.minWidth).toBe('');
      expect(element.style.overflowX).toBe('');
    }
    expect(row.getAttribute('style')).toBeNull();
    // Doubles stand upright; the other 21 lie down.
    const upright = tiles.filter((tile) => tile.classList.contains('dm-tile-double'));
    expect(upright).toHaveLength(line.filter((placed) => isDouble(placed.tile)).length);
    expect(upright).toHaveLength(7);
  });

  it('is held to wrapping by the stylesheet, and never to scrolling', () => {
    const row = rule('.dm-line');
    expect(row).toMatch(/flex-wrap:\s*wrap;/);
    expect(row).toMatch(/width:\s*100%;/);
    expect(css).not.toMatch(/nowrap/);
    expect(css).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    expect(rule('.dm-body')).toMatch(/overflow-x:\s*hidden;/);
    // One fixed tile size, lying and standing, that seven fit in a phone row.
    expect(rule('.dm-tile')).toMatch(/width:\s*44px;[\s\S]*height:\s*22px;/);
    expect(rule('.dm-tile-double')).toMatch(/width:\s*22px;[\s\S]*height:\s*44px;/);
    // No viewport-width sizes: the line sizes against its own column.
    expect(css).not.toMatch(/\d+vw/);
  });
});
