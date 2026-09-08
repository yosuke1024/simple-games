/**
 * The platform plumbing around a backup file (issue #160): where the bytes go
 * on the way out, and how one comes back in.
 *
 * The promises being checked here are the ones the feature would be dishonest
 * without — that the app hands the file to the operating system and takes no
 * further interest in it, and that a picker the player backs out of ends the
 * attempt instead of leaving the screen stuck.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false), getPlatform: vi.fn(() => 'web') },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: vi.fn() },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share: vi.fn() } }));

import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { currentPlatform, pickBackupFile, saveBackupFile } from './file';

const FILE = 'simple-games-backup-2026-09-08.json';
const TEXT = '{"formatVersion":1}';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
  vi.mocked(Capacitor.getPlatform).mockReturnValue('web');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exporting on a device', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android');
  });

  it('writes to the app’s own cache and hands the file to the share sheet', async () => {
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/backup.json' });
    vi.mocked(Share.share).mockResolvedValue({ activityType: '' });

    expect(await saveBackupFile(FILE, TEXT)).toBe(true);

    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: FILE,
      data: TEXT,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    // The app names no destination: it passes a local file and stops there.
    expect(Share.share).toHaveBeenCalledWith({ files: ['file:///cache/backup.json'] });
  });

  it('counts a dismissed share sheet as a finished export', async () => {
    vi.mocked(Filesystem.writeFile).mockResolvedValue({ uri: 'file:///cache/backup.json' });
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));
    expect(await saveBackupFile(FILE, TEXT)).toBe(true);
  });

  it('reports failure only when the file itself could not be written', async () => {
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error('no space'));
    expect(await saveBackupFile(FILE, TEXT)).toBe(false);
    expect(Share.share).not.toHaveBeenCalled();
  });

  it('reports the platform for the file’s informational field', () => {
    expect(currentPlatform()).toBe('android');
  });
});

describe('exporting in a browser', () => {
  it('downloads the file and lets go of the blob', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const clicks: HTMLAnchorElement[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this);
    };
    try {
      expect(await saveBackupFile(FILE, TEXT)).toBe(true);
    } finally {
      HTMLAnchorElement.prototype.click = realClick;
    }

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clicks[0]?.download).toBe(FILE);
    // Held open, the object URL would keep the whole backup in memory for the
    // life of the page.
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });
});

describe('picking a file to restore', () => {
  /** The input the picker creates, once it has been appended to the page. */
  const openedInput = () => document.querySelector<HTMLInputElement>('input[type="file"]');

  it('asks for a JSON file and resolves with the one that was chosen', async () => {
    const pending = pickBackupFile();
    const input = openedInput();
    expect(input).not.toBeNull();
    expect(input?.accept).toBe('application/json,.json');

    const file = new File([TEXT], FILE, { type: 'application/json' });
    Object.defineProperty(input, 'files', { value: [file] });
    input?.dispatchEvent(new Event('change'));

    expect(await pending).toBe(file);
    // The input does not linger in the page after it has done its one job.
    expect(openedInput()).toBeNull();
  });

  it('resolves with nothing when the picker is dismissed', async () => {
    const pending = pickBackupFile();
    openedInput()?.dispatchEvent(new Event('cancel'));
    expect(await pending).toBeNull();
    expect(openedInput()).toBeNull();
  });

  /**
   * `cancel` is recent and the WebViews this app supports do not all fire it.
   * Without the focus fallback, backing out of the picker would leave the
   * Settings screen waiting on a promise that never settles.
   */
  it('gives up when the window comes back and no file arrived', async () => {
    vi.useFakeTimers();
    try {
      const pending = pickBackupFile();
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('prefers the file over the focus fallback when both happen', async () => {
    vi.useFakeTimers();
    try {
      const pending = pickBackupFile();
      const input = openedInput();
      window.dispatchEvent(new Event('focus'));

      const file = new File([TEXT], FILE, { type: 'application/json' });
      Object.defineProperty(input, 'files', { value: [file] });
      input?.dispatchEvent(new Event('change'));

      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toBe(file);
    } finally {
      vi.useRealTimers();
    }
  });
});
