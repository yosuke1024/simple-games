/**
 * The picture card, drawn without a real 2D context: jsdom's canvas has none
 * (`getContext` returns `null` and logs a "Not implemented" error), so every
 * test here stands one up itself — either `null`, to exercise the "no canvas"
 * path every WebView on the floor must survive, or a small recorder that logs
 * what would have been drawn (issue #86).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { titleAccents } from '@simple-games/brand';
import { GAMES } from '../../app/registry';
import { accentKeyOf, renderShareCard, type ShareCard, type ShareCardInput } from './card';
import type { ShareDetail } from './message';

interface FillTextCall {
  text: string;
  x: number;
  y: number;
  font: string;
}

/**
 * A fake `CanvasRenderingContext2D`: records every `fillText` with the font
 * in force at the time, and answers `measureText` from the pixel size in
 * `ctx.font` (`text.length * px * 0.55`, close enough to check shrinking and
 * fitting without a real font renderer). Everything else — paths, fills,
 * save/restore, the property setters — is a no-op, the same shape a headless
 * canvas would have if jsdom carried one.
 */
function createFakeContext(): CanvasRenderingContext2D & { calls: FillTextCall[] } {
  const calls: FillTextCall[] = [];
  const ctx = {
    font: '10px sans-serif',
    fillStyle: '#000',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    calls,
    fillRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arcTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    fillText(text: string, x: number, y: number) {
      calls.push({ text, x, y, font: ctx.font });
    },
    measureText(text: string) {
      const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
      const px = match ? Number(match[1]) : 10;
      return { width: text.length * px * 0.55 } as TextMetrics;
    },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: FillTextCall[] };
}

/** The px a `fitFont`-produced font string carries, e.g. "800 96px Nunito, …" -> 96. */
function pxOf(font: string): number {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 0);
}

function stubGetContext(ctx: CanvasRenderingContext2D | null): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
}

/** A tiny, syntactically valid data URL — `atob` only needs valid base64. */
const TINY_PNG_DATA_URL = 'data:image/png;base64,AAAA';

function stubToDataURL(result: () => string): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(result);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const details: ShareDetail[] = [
  { label: 'Time', value: '4:32' },
  { label: 'Mistakes', value: '0' },
];

const baseInput: ShareCardInput = {
  gameId: 'sudoku',
  outcome: 'completed',
  details,
  clearedLabel: 'Cleared!',
};

describe('renderShareCard', () => {
  it('returns null and does not throw when there is no 2D context', () => {
    stubGetContext(null);
    let result: ShareCard | null = null;
    expect(() => {
      result = renderShareCard(baseInput);
    }).not.toThrow();
    expect(result).toBeNull();
  });

  it('returns null when the canvas cannot be encoded', () => {
    stubGetContext(createFakeContext());
    stubToDataURL(() => {
      throw new Error('toDataURL is not implemented');
    });
    expect(renderShareCard(baseInput)).toBeNull();
  });

  it('builds a card and draws the title, the facts and the footer', () => {
    const ctx = createFakeContext();
    stubGetContext(ctx);
    stubToDataURL(() => TINY_PNG_DATA_URL);

    const card = renderShareCard(baseInput);

    expect(card).not.toBeNull();
    expect(card?.name).toBe('simple-games-sudoku.png');
    expect(card?.base64.length).toBeGreaterThan(0);
    expect(card?.file).not.toBeNull();
    expect(card?.file?.name).toBe('simple-games-sudoku.png');
    expect(card?.file?.type).toBe('image/png');
    expect(card?.file?.size).toBeGreaterThan(0);

    const texts = ctx.calls.map((call) => call.text);
    expect(texts).toContain('Sudoku');
    expect(texts).toContain('Time');
    expect(texts).toContain('4:32');
    expect(texts).toContain('Mistakes');
    expect(texts).toContain('0');
    expect(texts).toContain('Simple Games');
    expect(texts).toContain('pixapps.ai/simple-games');
    expect(texts).toContain('Cleared!');
  });

  it('draws the cleared label only where the run was a real win', () => {
    stubToDataURL(() => TINY_PNG_DATA_URL);

    const completedCtx = createFakeContext();
    stubGetContext(completedCtx);
    renderShareCard({ ...baseInput, outcome: 'completed' });
    expect(completedCtx.calls.map((call) => call.text)).toContain('Cleared!');

    const playedCtx = createFakeContext();
    stubGetContext(playedCtx);
    renderShareCard({ ...baseInput, outcome: 'played' });
    expect(playedCtx.calls.map((call) => call.text)).not.toContain('Cleared!');
  });

  it('shrinks a long title further than a short one, and keeps it inside the card', () => {
    stubToDataURL(() => TINY_PNG_DATA_URL);

    const sudokuCtx = createFakeContext();
    stubGetContext(sudokuCtx);
    renderShareCard({ ...baseInput, gameId: 'sudoku', details: [] });
    const sudokuFont = sudokuCtx.calls.find((call) => call.text === 'Sudoku')?.font;

    const mahjongCtx = createFakeContext();
    stubGetContext(mahjongCtx);
    renderShareCard({ ...baseInput, gameId: 'mahjong-solitaire', details: [] });
    const mahjongCall = mahjongCtx.calls.find((call) => call.text === 'Mahjong Solitaire');

    expect(sudokuFont).toBeDefined();
    expect(mahjongCall).toBeDefined();
    const sudokuPx = pxOf(sudokuFont ?? '');
    const mahjongPx = pxOf(mahjongCall?.font ?? '');

    expect(mahjongPx).toBeLessThan(sudokuPx);
    // The fake measureText mirrors fitFont's own arithmetic, so a title that
    // "fits" here is one fitFont actually shrank to the 888px content width.
    expect('Mahjong Solitaire'.length * mahjongPx * 0.55).toBeLessThanOrEqual(888);
  });

  it('draws at most three details, dropping a fourth', () => {
    const ctx = createFakeContext();
    stubGetContext(ctx);
    stubToDataURL(() => TINY_PNG_DATA_URL);

    const fourDetails: ShareDetail[] = [
      { label: 'Time', value: '4:32' },
      { label: 'Mistakes', value: '0' },
      { label: 'Hints', value: '1' },
      { label: 'Streak', value: '9' },
    ];
    renderShareCard({ ...baseInput, details: fourDetails });

    const texts = ctx.calls.map((call) => call.text);
    expect(texts).toContain('Time');
    expect(texts).toContain('Mistakes');
    expect(texts).toContain('Hints');
    expect(texts).not.toContain('Streak');
    expect(texts).not.toContain('9');
  });

  it('resolves every game in the collection to a real accent with usable colours', () => {
    // Present is not enough: the renderer paints `light` and `onLight`, and a
    // present-but-empty accent would fail inside its catch-all, silently.
    const hex = /^#[0-9a-f]{6}$/i;
    for (const game of GAMES) {
      expect(titleAccents, game.id).toHaveProperty(accentKeyOf(game.id));
      const accent = titleAccents[accentKeyOf(game.id)];
      expect(accent.light, `${game.id} light`).toMatch(hex);
      expect(accent.onLight, `${game.id} onLight`).toMatch(hex);
    }
  });

  it('still hands back the base64 when this WebView has no File constructor', () => {
    stubGetContext(createFakeContext());
    stubToDataURL(() => TINY_PNG_DATA_URL);

    const OriginalFile = globalThis.File;
    class ThrowingFile {
      constructor() {
        throw new Error('File is not implemented');
      }
    }
    globalThis.File = ThrowingFile as unknown as typeof File;

    try {
      const card = renderShareCard(baseInput);
      expect(card).not.toBeNull();
      expect(card?.file).toBeNull();
      expect(card?.base64.length).toBeGreaterThan(0);
    } finally {
      globalThis.File = OriginalFile;
    }
  });
});
