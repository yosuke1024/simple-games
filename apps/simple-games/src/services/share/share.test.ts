/**
 * Every way a share can end, and the rule that governs all of them: none of
 * them throws, and none of them is an error (issue #86).
 *
 * A game keeps running whatever the platform does with the request — that is
 * the same contract every other service in this app is held to
 * (docs/OFFLINE_POLICY.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Controllable per test; defaults to false so every browser-path test below
// keeps exercising exactly the ladder it did before the native plugin existed.
// `getPlatform` only matters to the "on a device" tests below (it is read
// only inside the plugin rung); `vi.resetAllMocks()` in the top-level
// `beforeEach` strips this default anyway, which is why every "on a device"
// test sets it again explicitly rather than leaning on one here.
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false), getPlatform: vi.fn(() => 'android') },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Cache: 'CACHE' },
}));
vi.mock('@capacitor/share', () => ({
  Share: { share: vi.fn() },
}));

import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { shareGame } from './share';
import type { ShareCard } from './card';
import { shareMessageAsText, type ShareMessage } from './message';

const message: ShareMessage = {
  text: 'I played Sudoku on Simple Games.\nYou can play it right in your browser.',
  url: 'https://pixapps.ai/simple-games/play/?game=sudoku',
};

function stubNavigator(navigatorLike: Record<string, unknown>): void {
  vi.stubGlobal('navigator', navigatorLike);
}

const writeText = () => vi.fn().mockResolvedValue(undefined);

/**
 * jsdom has no `document.execCommand`, which is exactly the shape of the old
 * WebViews this fallback exists for — so the tests that want it put it there
 * themselves, and every test takes it away again.
 */
type WithExecCommand = { execCommand?: (command: string) => boolean };

function stubExecCommand(result: boolean): ReturnType<typeof vi.fn> {
  const execCommand = vi.fn().mockReturnValue(result);
  (document as WithExecCommand).execCommand = execCommand;
  return execCommand;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as WithExecCommand).execCommand;
});

describe('with a share sheet', () => {
  it('opens it with the sentences and the link kept apart', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const copy = writeText();
    stubNavigator({ share, clipboard: { writeText: copy } });

    await expect(shareGame(message)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: message.text, url: message.url });
    expect(copy).not.toHaveBeenCalled();
  });

  it('treats a dismissal as an answer, not a failure to work around', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    const copy = writeText();
    stubNavigator({ share: vi.fn().mockRejectedValue(abort), clipboard: { writeText: copy } });

    await expect(shareGame(message)).resolves.toBe('dismissed');
    // Copying the link after "no" would be acting against what was decided.
    expect(copy).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the sheet fails for any other reason', async () => {
    // A WebView that advertises the API without a sheet behind it.
    const copy = writeText();
    stubNavigator({
      share: vi.fn().mockRejectedValue(new Error('not supported')),
      clipboard: { writeText: copy },
    });

    await expect(shareGame(message)).resolves.toBe('copied');
    expect(copy).toHaveBeenCalledWith(`${message.text}\n${message.url}`);
  });

  it('skips it when the platform says it cannot take this payload', async () => {
    const share = vi.fn();
    const copy = writeText();
    stubNavigator({ share, canShare: () => false, clipboard: { writeText: copy } });

    await expect(shareGame(message)).resolves.toBe('copied');
    expect(share).not.toHaveBeenCalled();
  });
});

describe('with a picture', () => {
  const card = (): ShareCard => ({
    file: new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }),
    base64: 'AAEC',
    name: 'simple-games-sudoku.png',
  });

  it('shares the file alongside the text when the target can take it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    const copy = writeText();
    stubNavigator({ share, canShare, clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      text: message.text,
      url: message.url,
    });
    expect(copy).not.toHaveBeenCalled();
  });

  it('falls back to text when the target refuses the file payload', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    // Accepts the text-only payload but not one carrying a file.
    const canShare = vi.fn((data: ShareData) => !('files' in data));
    const copy = writeText();
    stubNavigator({ share, canShare, clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ text: message.text, url: message.url });
  });

  it('treats a dismissal of the picture sheet as an answer, with no second attempt', async () => {
    // As the browser reports it: a DOMException, which is not reliably an
    // `Error` instance on every WebView — the name is what identifies it.
    const abort = new DOMException('cancelled', 'AbortError');
    const share = vi.fn().mockRejectedValue(abort);
    const canShare = vi.fn().mockReturnValue(true);
    const copy = writeText();
    stubNavigator({ share, canShare, clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('dismissed');
    expect(share).toHaveBeenCalledTimes(1);
    expect(copy).not.toHaveBeenCalled();
  });

  it('retries as text when the picture sheet fails for any other reason', async () => {
    const share = vi
      .fn()
      .mockRejectedValueOnce(new Error('the target choked on the file'))
      .mockResolvedValueOnce(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    stubNavigator({ share, canShare, clipboard: { writeText: writeText() } });

    await expect(shareGame(message, card())).resolves.toBe('shared');
    expect(share).toHaveBeenCalledTimes(2);
    expect(share).toHaveBeenNthCalledWith(1, {
      files: [expect.any(File)],
      text: message.text,
      url: message.url,
    });
    expect(share).toHaveBeenNthCalledWith(2, { text: message.text, url: message.url });
  });

  it('ignores the card and copies the text when there is no share sheet at all', async () => {
    const copy = writeText();
    stubNavigator({ clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('copied');
    expect(copy).toHaveBeenCalledWith(`${message.text}\n${message.url}`);
  });
});

describe('without a share sheet', () => {
  it('copies the whole message, link included', async () => {
    const copy = writeText();
    stubNavigator({ clipboard: { writeText: copy } });

    await expect(shareGame(message)).resolves.toBe('copied');
    expect(copy).toHaveBeenCalledWith(`${message.text}\n${message.url}`);
  });

  it('falls back to a selection on a WebView with no clipboard API', async () => {
    // An origin the WebView does not consider trustworthy: `navigator.clipboard`
    // is not there at all, and this is the only copy left.
    const execCommand = stubExecCommand(true);
    stubNavigator({});

    await expect(shareGame(message)).resolves.toBe('copied');
    expect(execCommand).toHaveBeenCalledWith('copy');
    // Whatever it used to hold the text, it did not leave it on the page.
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('gives up quietly when even that is refused', async () => {
    stubExecCommand(false);
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } });
    await expect(shareGame(message)).resolves.toBe('unavailable');
  });

  it('gives up quietly when there is no way to copy at all', async () => {
    // An old WebView with neither API. Nothing throws; nothing happens.
    stubNavigator({});
    await expect(shareGame(message)).resolves.toBe('unavailable');
  });
});

describe('on a device', () => {
  const card = (): ShareCard => ({
    file: new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' }),
    base64: 'AAEC',
    name: 'simple-games-sudoku.png',
  });

  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  });

  it('writes the picture to the cache and hands the sheet its uri', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Filesystem.writeFile).mockResolvedValue({
      uri: 'file:///cache/simple-games-sudoku.png',
    });
    vi.mocked(Share.share).mockResolvedValue({});

    await expect(shareGame(message, card())).resolves.toBe('shared');

    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: 'simple-games-sudoku.png',
      data: 'AAEC',
      directory: Directory.Cache,
    });
    expect(Share.share).toHaveBeenCalledWith({
      text: shareMessageAsText(message),
      files: ['file:///cache/simple-games-sudoku.png'],
    });
  });

  it('shares the words and the link alone, with no files key, when there is no card', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Share.share).mockResolvedValue({});

    await expect(shareGame(message)).resolves.toBe('shared');

    expect(Filesystem.writeFile).not.toHaveBeenCalled();
    expect(Share.share).toHaveBeenCalledWith({ text: shareMessageAsText(message) });
    expect(vi.mocked(Share.share).mock.calls[0]?.[0]).not.toHaveProperty('files');
  });

  it('still shares the words when the picture cannot be written', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error('disk full'));
    vi.mocked(Share.share).mockResolvedValue({});

    await expect(shareGame(message, card())).resolves.toBe('shared');

    expect(Share.share).toHaveBeenCalledWith({ text: shareMessageAsText(message) });
  });

  it('treats a cancelled sheet as an answer, never opening the browser ladder', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(Filesystem.writeFile).mockResolvedValue({
      uri: 'file:///cache/simple-games-sudoku.png',
    });
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));
    const share = vi.fn();
    const copy = writeText();
    stubNavigator({ share, clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('dismissed');

    expect(share).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  it('falls through to the browser ladder on any other plugin failure', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
    vi.mocked(Filesystem.writeFile).mockResolvedValue({
      uri: 'file:///cache/simple-games-sudoku.png',
    });
    vi.mocked(Share.share).mockRejectedValue(new Error('boom'));
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, clipboard: { writeText: writeText() } });

    await expect(shareGame(message, card())).resolves.toBe('shared');

    expect(share).toHaveBeenCalled();
  });

  it('never touches the browser ladder when the plugin succeeds', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
    vi.mocked(Filesystem.writeFile).mockResolvedValue({
      uri: 'file:///cache/simple-games-sudoku.png',
    });
    vi.mocked(Share.share).mockResolvedValue({});
    const share = vi.fn();
    const copy = writeText();
    stubNavigator({ share, clipboard: { writeText: copy } });

    await expect(shareGame(message, card())).resolves.toBe('shared');

    expect(share).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
  });

  /**
   * The reason for the platform branch (`share.ts`'s "ANDROID GETS THE LINK
   * INSIDE THE TEXT" note): `@capacitor/share`'s Android code joins `text` and
   * `url` with a space when both are given, and X's Android receiver then
   * drops that trailing link once a picture is attached. The same message
   * posted fine when the link sat on its own line inside `text` instead — so
   * Android gets the whole message, link included, in `text`, and no `url` at
   * all; iOS is unaffected and keeps the two apart.
   */
  describe('where the link goes', () => {
    // The link is the point of the share, and a receiver is free to decline a
    // separate `url` field — X does, on a post carrying a picture, and that is
    // what shipped a message with no address in it. So it travels as part of
    // the text, on both platforms, and exactly once.
    for (const platform of ['android', 'ios'] as const) {
      it(`sends the link inside the text, exactly once, on ${platform}`, async () => {
        vi.mocked(Capacitor.getPlatform).mockReturnValue(platform);
        vi.mocked(Filesystem.writeFile).mockResolvedValue({
          uri: 'file:///cache/simple-games-sudoku.png',
        });
        vi.mocked(Share.share).mockResolvedValue({});

        await expect(shareGame(message, card())).resolves.toBe('shared');

        const payload = vi.mocked(Share.share).mock.calls[0]?.[0];
        expect(payload).toHaveProperty('text', shareMessageAsText(message));
        expect(payload).toHaveProperty('files', ['file:///cache/simple-games-sudoku.png']);
        // Never as its own field: passing both would send the address twice on
        // Android, where the plugin appends `url` to the text as well.
        expect(payload).not.toHaveProperty('url');
        expect(String(payload?.text).split(message.url)).toHaveLength(2);
      });
    }

    it('still carries the link when there is no picture to attach', async () => {
      vi.mocked(Capacitor.getPlatform).mockReturnValue('ios');
      vi.mocked(Share.share).mockResolvedValue({});

      await expect(shareGame(message)).resolves.toBe('shared');

      expect(Share.share).toHaveBeenCalledWith({ text: shareMessageAsText(message) });
    });
  });
});
