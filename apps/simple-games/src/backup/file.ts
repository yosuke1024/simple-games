/**
 * Getting the backup out of the app, and another one back in (issue #160).
 *
 * SIMPLE GAMES DOES NOT MOVE THE FILE
 *
 * Export hands the file to the operating system and stops there. Where it goes
 * — AirDrop, Quick Share, a drive, a mail to yourself, a cable — is the
 * player's choice and is invisible to the app: there is no transfer service
 * here, no upload, and nothing that knows a destination
 * (docs/OFFLINE_POLICY.md). Both directions work with the device in airplane
 * mode, because neither touches the network at any point.
 *
 * NO NEW PERMISSIONS
 *
 * The native export writes into the app's own cache and passes the URI to the
 * share sheet, exactly as sharing a result card already does
 * (services/share/share.ts) — `@capacitor/filesystem` and `@capacitor/share`
 * both declare an empty Android manifest, so nothing is added to the four
 * permissions the app asks for. Import is an `<input type="file">` on every
 * platform, which is the OS document picker in both WebViews and needs no
 * storage permission at all: the player hands one file over, and the app never
 * gets to look around their device.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** `android` / `ios` / `web`, for the file's informational `platform`. */
export function currentPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Writes the backup and hands it to the platform's save/share flow.
 *
 * False means the file could not be produced — the only outcome worth telling
 * the player about. A share sheet the player dismisses is true: they made the
 * file and then changed their mind about where to put it, which is an answer,
 * not a failure (the same reading `shareGame` gives a cancelled sheet).
 */
export async function saveBackupFile(fileName: string, text: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return saveViaShareSheet(fileName, text);
  return saveViaDownload(fileName, text);
}

async function saveViaShareSheet(fileName: string, text: string): Promise<boolean> {
  let uri: string;
  try {
    // Cache, not Documents: the OS may reclaim it whenever it likes, nothing
    // reads it back, and it needs no permission. What the player keeps is
    // whatever the share sheet put somewhere they chose.
    const written = await Filesystem.writeFile({
      path: fileName,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    uri = written.uri;
  } catch {
    return false;
  }
  try {
    await Share.share({ files: [uri] });
  } catch {
    // Dismissed, or a sheet that would not open. The file exists either way;
    // saying "export failed" here would be untrue for the common case.
  }
  return true;
}

function saveViaDownload(fileName: string, text: string): boolean {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  if (typeof URL.createObjectURL !== 'function') return false;
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch {
    return false;
  } finally {
    // The browser has taken what it needs by the time click() returns; holding
    // the object URL open would keep the whole backup in memory for the life
    // of the page.
    if (url !== null) URL.revokeObjectURL(url);
  }
}

/**
 * Opens the document picker and resolves with the chosen file, or null when
 * the player backed out.
 *
 * Must be called straight from the click handler with nothing awaited first:
 * `input.click()` spends the gesture's user activation, and a picker asked for
 * after an await is a picker some browsers refuse to open.
 *
 * A dismissed picker is not reported the same way everywhere — `cancel` is
 * recent, and the WebViews this app supports do not all fire it — so the
 * window regaining focus is watched as well. Without that second path a
 * player who opened the picker and changed their mind would leave this promise
 * pending and the Settings screen busy forever.
 */
export function pickBackupFile(): Promise<File | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // A plain `.json` (backup/format.ts), named both ways because Android's
    // picker filters by MIME type and desktop browsers by extension.
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };

    // `change` can arrive after the window is focused again, so give it a
    // moment before concluding that nothing was picked.
    const onFocus = () => window.setTimeout(() => finish(null), 1000);

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);

    input.click();
  });
}
