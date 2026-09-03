/**
 * Every way a share can end, and the rule that governs all of them: none of
 * them throws, and none of them is an error (issue #86).
 *
 * A game keeps running whatever the platform does with the request — that is
 * the same contract every other service in this app is held to
 * (docs/OFFLINE_POLICY.md).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareGame } from './share';
import type { ShareMessage } from './message';

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
