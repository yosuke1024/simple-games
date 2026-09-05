/**
 * The shortcut icon, drawn without a real 2D context — jsdom has none, so
 * each test stands one up itself: `null`, to walk the path a WebView without
 * canvas takes, or a small recorder that logs the fills and the font in force
 * (the same device services/share/card.test.ts uses, issue #86).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAMES, type GameDefinition } from '../../app/registry';
import { titleAccentOf } from '../../app/titleAccent';
import { renderHomeShortcutIcon } from './icon';

interface Recorded {
  fills: { style: string; kind: 'rect' | 'text'; text?: string; font?: string }[];
}

/**
 * Records `fillRect` and `fillText` with the style and font in force, and
 * answers `measureText` from the pixel size in `ctx.font` at 0.7 px per
 * character — wide on purpose, so a two-character mark has to shrink to fit
 * and the test can see it do so.
 */
function createFakeContext(): CanvasRenderingContext2D & Recorded {
  const fills: Recorded['fills'] = [];
  const ctx = {
    fills,
    font: '10px sans-serif',
    fillStyle: '#000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    fillRect() {
      fills.push({ style: String(ctx.fillStyle), kind: 'rect' });
    },
    fillText(text: string) {
      fills.push({ style: String(ctx.fillStyle), kind: 'text', text, font: ctx.font });
    },
    measureText(text: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const px = match ? Number(match[1]) : 10;
      return { width: text.length * px * 0.7 } as TextMetrics;
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & Recorded;
}

const pxOf = (font: string | undefined): number => Number(/(\d+)px/.exec(font ?? '')?.[1]);

function stubCanvas(ctx: CanvasRenderingContext2D | null, dataUrl: () => string) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(dataUrl);
}

const byId = (id: GameDefinition['id']) => GAMES.find((game) => game.id === id)!;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('renderHomeShortcutIcon', () => {
  it('is null where this WebView has no 2D context, and does not throw', () => {
    stubCanvas(null, () => PNG);
    expect(renderHomeShortcutIcon(byId('sudoku'))).toBeNull();
  });

  it('is null when encoding fails', () => {
    stubCanvas(createFakeContext(), () => {
      throw new Error('toDataURL is not implemented');
    });
    expect(renderHomeShortcutIcon(byId('sudoku'))).toBeNull();
  });

  it('hands back the PNG bytes without the data: prefix', () => {
    stubCanvas(createFakeContext(), () => PNG);
    expect(renderHomeShortcutIcon(byId('sudoku'))).toBe('iVBORw0KGgo=');
  });

  it('paints the accent as the field and the glyph in the accent’s ink, light palette', () => {
    const ctx = createFakeContext();
    stubCanvas(ctx, () => PNG);
    const game = byId('sudoku');
    const accent = titleAccentOf(game.id);

    renderHomeShortcutIcon(game);

    expect(ctx.fills).toEqual([
      { style: accent.light, kind: 'rect' },
      {
        style: accent.onLight,
        kind: 'text',
        text: game.glyph,
        font: expect.stringMatching(/^800 \d+px Nunito/) as string,
      },
    ]);
  });

  it('shrinks a two-character mark until it clears the launcher mask', () => {
    const single = createFakeContext();
    stubCanvas(single, () => PNG);
    renderHomeShortcutIcon(byId('sudoku'));
    vi.restoreAllMocks();

    const double = createFakeContext();
    stubCanvas(double, () => PNG);
    renderHomeShortcutIcon(byId('number-match'));

    const singlePx = pxOf(single.fills[1]?.font);
    const doublePx = pxOf(double.fills[1]?.font);
    expect(singlePx).toBe(168);
    expect(doublePx).toBeLessThan(singlePx);
    expect(doublePx * 2 * 0.7).toBeLessThanOrEqual(200);
  });

  it('never shrinks past the floor, so a mark that cannot fit still prints', () => {
    const ctx = createFakeContext();
    stubCanvas(ctx, () => PNG);
    renderHomeShortcutIcon({ ...byId('sudoku'), glyph: 'ABCDEFGH' });
    expect(pxOf(ctx.fills[1]?.font)).toBe(96);
  });

  it('draws every game in the collection', () => {
    for (const game of GAMES) {
      const ctx = createFakeContext();
      stubCanvas(ctx, () => PNG);
      expect(renderHomeShortcutIcon(game), game.id).toBe('iVBORw0KGgo=');
      expect(ctx.fills[1]?.text, game.id).toBe(game.glyph);
      vi.restoreAllMocks();
    }
  });
});
