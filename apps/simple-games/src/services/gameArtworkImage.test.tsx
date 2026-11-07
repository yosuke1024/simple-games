import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seriesColors } from '@simple-games/brand';
import { GAMES } from '../app/registry';
import { titleAccentOf } from '../app/titleAccent';
import { ARTWORK_CSS_TOKENS, gameArtworkSvg, prepareGameArtwork } from './gameArtworkImage';

let decode: 'load' | 'error' | 'pending' | 'throw';
let images: FakeImage[];
let sources: Blob[];
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
    if (decode === 'throw') throw new Error('Decoder unavailable');
    this.source = value;
    if (value && decode !== 'pending') {
      queueMicrotask(() => (decode === 'load' ? this.onload?.() : this.onerror?.()));
    }
  }
}

async function startTask() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function expectReleased() {
  expect(vi.getTimerCount()).toBe(0);
  expect(revoke).toHaveBeenCalledTimes(sources.length);
  for (const host of hosts) {
    expect(host.isConnected).toBe(false);
    expect(host.childElementCount).toBe(0);
  }
  for (const image of images) {
    expect(image.onload).toBeNull();
    expect(image.onerror).toBeNull();
  }
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
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  decode = 'load';
  images = [];
  sources = [];
  hosts = [];
  revoke = vi.fn();
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      sources.push(blob);
      return `blob:art-${sources.length}`;
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
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('prepareGameArtwork', () => {
  it('returns the current collection illustration, decoded and ready for a later synchronous draw', async () => {
    const result = prepareGameArtwork('crown-grid');
    expect(images).toHaveLength(0);
    await startTask();
    await expect(result).resolves.toBe(images[0]);
    const svg = await blobText(sources[0]!);
    expect(svg).toContain('class="game-artwork"');
    expect(svg).toContain('viewBox="0 0 120 90"');
    expect(svg).toContain(titleAccentOf('crown-grid').light);
    expect(svg).toContain(seriesColors.surface);
    expect(svg).not.toMatch(/var\(--|currentColor|<image|<script|href=/);
    // Success keeps the decoded source; clearing it here would break a later draw.
    expect(images[0]!.src).toBe('blob:art-1');
    expectReleased();
  });

  it('can be prepared from a React effect without a nested synchronous-commit warning', async () => {
    const error = vi.spyOn(console, 'error');
    function Result() {
      useEffect(() => {
        const controller = new AbortController();
        void prepareGameArtwork('sudoku', controller.signal);
        return () => controller.abort();
      }, []);
      return null;
    }
    render(<Result />);
    await startTask();
    expect(images).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
    cleanup();
    expectReleased();
  });

  it('does not render when already aborted, and cancels before a scheduled render', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepareGameArtwork('sudoku', controller.signal)).resolves.toBeNull();
    const second = new AbortController();
    const result = prepareGameArtwork('sudoku', second.signal);
    second.abort();
    await startTask();
    await expect(result).resolves.toBeNull();
    expect(images).toHaveLength(0);
    expect(hosts).toHaveLength(0);
    expectReleased();
  });

  it('aborts a pending decoder, stops loading, and ignores a late completion', async () => {
    decode = 'pending';
    const controller = new AbortController();
    const result = prepareGameArtwork('sudoku', controller.signal);
    await startTask();
    const lateLoad = images[0]!.onload;
    controller.abort();
    lateLoad?.();
    await expect(result).resolves.toBeNull();
    expect(images[0]!.src).toBe('');
    expectReleased();
  });

  it('bounds a stalled decoder to two seconds and releases its temporary resources', async () => {
    decode = 'pending';
    const result = prepareGameArtwork('sudoku');
    await startTask();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toBeNull();
    expect(images[0]!.src).toBe('');
    expectReleased();
  });

  it.each(['error', 'throw'] as const)('silently returns null on decoder %s', async (failure) => {
    decode = failure;
    const result = prepareGameArtwork('sudoku');
    await startTask();
    await expect(result).resolves.toBeNull();
    expectReleased();
  });

  it('returns null when the browser cannot create local object URLs', async () => {
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      throw new Error('Object URLs unsupported');
    });
    const result = prepareGameArtwork('sudoku');
    await startTask();
    await expect(result).resolves.toBeNull();
    expect(images).toHaveLength(0);
    expectReleased();
  });

  it('returns null outside a document', async () => {
    vi.stubGlobal('document', undefined);
    await expect(prepareGameArtwork('sudoku')).resolves.toBeNull();
    expectReleased();
  });
});

describe('gameArtworkSvg', () => {
  // An SVG decoded as an image sees none of the page's CSS: any var() or
  // currentColor left in it paints nothing. Both drawings are checked because
  // the share card uses the share scene and the Android shortcut the shelf one.
  it.each(['collection', 'share'] as const)(
    'leaves no unresolved paint in any game’s %s drawing',
    (variant) => {
      for (const game of GAMES) {
        const svg = gameArtworkSvg(game.id, variant);
        expect(svg, `${game.id} ${variant}`).not.toBeNull();
        expect(svg, `${game.id} ${variant}`).not.toMatch(/var\(|currentColor/);
      }
    },
  );

  it('keeps Chain Territory’s two sides visible, in their light-theme colours', () => {
    for (const variant of ['collection', 'share'] as const) {
      const svg = gameArtworkSvg('chain-territory', variant) ?? '';
      expect(svg, variant).toContain(`fill="${ARTWORK_CSS_TOKENS['--ct-you']}"`);
      expect(svg, variant).toContain(`fill="${ARTWORK_CSS_TOKENS['--ct-cpu']}"`);
    }
  });

  it('copies each token from the light theme of ui/styles.css', () => {
    // Resolved from the app root rather than import.meta.url: these tests run
    // in the jsdom environment, where import.meta.url is an http:// URL.
    const css = readFileSync(resolve('src/ui/styles.css'), 'utf8');
    for (const [name, value] of Object.entries(ARTWORK_CSS_TOKENS)) {
      // The first declaration is the light one: every dark override in the
      // stylesheet follows the rule it overrides. The selector says so too.
      const at = css.indexOf(`\n  ${name}:`);
      expect(at, `${name} is declared in styles.css`).toBeGreaterThan(-1);
      const open = css.lastIndexOf('{', at);
      const selector = css
        .slice(css.lastIndexOf('}', open) + 1, open)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      expect(selector, name).not.toMatch(/dark|prefers-color-scheme/);
      const declared = css.slice(css.indexOf(':', at + 1) + 1, css.indexOf(';', at)).trim();
      expect(value.toLowerCase(), `${name} in ${selector}`).toBe(declared.toLowerCase());
    }
  });
});
