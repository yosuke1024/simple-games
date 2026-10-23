/**
 * The real collection SVG is rendered; only the browser's image decoder and
 * Canvas are stood in for. This checks the boundary that matters on Android:
 * a self-contained light-palette image, bounded decoding, local cleanup, and
 * a usable app-icon fallback whenever drawing cannot finish.
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seriesColors } from '@simple-games/brand';
import { GAMES, type GameDefinition } from '../../app/registry';
import { titleAccentOf } from '../../app/titleAccent';
import { renderHomeShortcutIcon } from './icon';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const byId = (id: GameDefinition['id']) => GAMES.find((game) => game.id === id)!;
let decode: 'load' | 'error' | 'pending' | 'throw';
let images: FakeImage[];
let blobs: Blob[];
let hosts: HTMLElement[];
let revoke: ReturnType<typeof vi.fn>;

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private source = '';
  constructor() {
    images.push(this);
  }
  get src() {
    return this.source;
  }
  set src(value: string) {
    if (decode === 'throw') throw new Error('Image source failed');
    this.source = value;
    if (value && decode !== 'pending') {
      queueMicrotask(() => (decode === 'load' ? this.onload?.() : this.onerror?.()));
    }
  }
}

function stubCanvas() {
  const ctx = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  const canvases: HTMLCanvasElement[] = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    canvases.push(this);
    return ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>;
  });
  const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(PNG);
  return { ctx, canvases, encode };
}

function render(game = byId('sudoku')) {
  let result!: Promise<string | null>;
  act(() => {
    result = renderHomeShortcutIcon(game);
  });
  return result;
}

function expectReleased() {
  expect(hosts.length).toBeGreaterThan(0);
  for (const host of hosts) {
    expect(host.isConnected).toBe(false);
    expect(host.childElementCount).toBe(0);
  }
  for (const image of images) {
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
    expect(image.src).toBe('');
  }
  expect(revoke).toHaveBeenCalledTimes(blobs.length);
}

async function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  decode = 'load';
  images = [];
  blobs = [];
  hosts = [];
  revoke = vi.fn();
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:art-${blobs.length}`;
    }),
    revokeObjectURL: revoke,
  });
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const element = create(tag, options);
    if (tag === 'div') hosts.push(element);
    return element;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('renderHomeShortcutIcon', () => {
  it('uses the collection drawing on an opaque 432px light field with its own safe-zone margins', async () => {
    const { ctx, canvases, encode } = stubCanvas();
    await expect(render()).resolves.toBe('iVBORw0KGgo=');
    expect(canvases[0]?.width).toBe(432);
    expect(canvases[0]?.height).toBe(432);
    expect(ctx.fillStyle).toBe(seriesColors.paper);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 432, 432);
    expect(ctx.drawImage).toHaveBeenCalledWith(images[0], 72, 108, 288, 216);
    expect(encode).toHaveBeenCalledWith('image/png');
    const source = await blobText(blobs[0]!);
    expect(source).toContain('class="game-artwork"');
    expect(source).toContain('viewBox="0 0 120 90"');
    expect(source).toContain(titleAccentOf('sudoku').light);
    expect(source).toContain(seriesColors.surface);
    expect(source).toContain('font-family="Nunito, ui-rounded, system-ui, sans-serif"');
    expect(source).not.toMatch(/var\(--|currentColor|<image|<script|href=/);
    expectReleased();
  });

  it('has a local illustration for every registered game and releases each temporary render', async () => {
    stubCanvas();
    for (const game of GAMES) await expect(render(game), game.id).resolves.toBe('iVBORw0KGgo=');
    expect(blobs).toHaveLength(GAMES.length);
    expectReleased();
  });

  it('returns null without mounting artwork where Canvas is unavailable', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await expect(render()).resolves.toBeNull();
    expect(hosts).toHaveLength(0);
    expect(blobs).toHaveLength(0);
  });

  it('returns null and cleans up when the SVG image cannot be decoded', async () => {
    decode = 'error';
    const { ctx } = stubCanvas();
    await expect(render()).resolves.toBeNull();
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expectReleased();
  });

  it('times out a stalled decoder, removes its handlers, and ignores a late load', async () => {
    vi.useFakeTimers();
    decode = 'pending';
    const { ctx } = stubCanvas();
    const result = render();
    const lateLoad = images[0]!.onload;
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBeNull();
    lateLoad?.();
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expectReleased();
  });

  it('cancels the timeout after successful decoding', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stubCanvas();
    await expect(render()).resolves.toBe('iVBORw0KGgo=');
    expect(vi.getTimerCount()).toBe(0);
    expectReleased();
  });

  it('preserves the fallback if setting or clearing the image source throws', async () => {
    decode = 'throw';
    stubCanvas();
    await expect(render()).resolves.toBeNull();
    expectReleased();
  });

  it.each(['draw', 'encode'])(
    'returns null and releases the image when %s fails',
    async (failure) => {
      const { ctx, encode } = stubCanvas();
      const fail = () => {
        throw new Error('Canvas failed');
      };
      if (failure === 'draw') ctx.drawImage.mockImplementation(fail);
      else encode.mockImplementation(fail);
      await expect(render()).resolves.toBeNull();
      expectReleased();
    },
  );

  it.each(['data:,', 'data:image/png;base64,', 'data:image/jpeg;base64,AAAA'])(
    'rejects an unusable Canvas result: %s',
    async (dataUrl) => {
      const { encode } = stubCanvas();
      encode.mockReturnValue(dataUrl);
      await expect(render()).resolves.toBeNull();
      expectReleased();
    },
  );
});
