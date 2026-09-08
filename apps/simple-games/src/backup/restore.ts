/**
 * Reading a backup, and putting it back (issue #160).
 *
 * THE ORDER IS THE SAFETY
 *
 * Reading and writing are two exported functions, not one, because the gap
 * between them is where the player answers "yes". `readBackup` touches nothing
 * — it parses, it validates every record through its owner, and it either
 * hands back a fully prepared write or a reason it will not. Only
 * `applyBackup` writes, and it is given something already checked, so there is
 * no path where a file is half-read and half-applied. Not one byte of the
 * device's data is written before the whole file is known to be good.
 *
 * A RESTORE IS A REPLACEMENT, AND ONLY OF WHAT BACKUP OWNS
 *
 * "Restore" means "put this device back to the moment that backup was taken",
 * so a key the file does not carry is REMOVED rather than left alone —
 * otherwise a game finished after the backup would survive a restore meant to
 * undo it, and the result would be neither the old state nor the new one.
 * There is no merge, and there will not be one: two devices' progress cannot
 * be reconciled without inventing rules about whose Sudoku streak is the real
 * one, and inventing those is how a local file turns into a sync service.
 *
 * The keys it may touch are exactly `backupKeys()`. The ad-removal
 * entitlement and the other records outside that list are not read, not
 * written, and not cleared (backup/keys.ts).
 *
 * FAILURE PUTS EVERYTHING BACK
 *
 * The store swallows its own write failures — `preferencesKV` is built that
 * way so a failed save can never crash a game — so "did the write land?" can
 * only be answered by reading it back, and that is what happens here. Every
 * key's previous text is snapshotted first; if a single key does not read back
 * as what was written, the snapshot goes back and the restore reports failure.
 * The player ends where they started.
 */
import { loadRaw, saveRaw } from '../storage/repo';
import { preferencesKV, type KVStore } from '../storage/kv';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MAX_BYTES,
  BACKUP_MAX_RECORD_BYTES,
  UNSAFE_OBJECT_KEYS,
} from './format';
import { backupKeys } from './keys';
import { loadValidators } from './owners';

/**
 * Why a file was refused. Three reasons, because they ask three different
 * things of the player.
 *
 *   unreadable — this is not a Simple Games backup. Pick another file.
 *   newer      — it is one, but it was written by a build that knows more
 *                than this one does. Update the app, then restore.
 *   damaged    — it is one, from a version this build understands, and
 *                something inside it does not hold up. Nothing to do but use
 *                another copy — and better said out loud than applied
 *                halfway.
 */
export type BackupProblem = 'unreadable' | 'newer' | 'damaged';

/**
 * A restore that has been checked and not yet performed. `records` is already
 * serialised: `applyBackup` has no decisions left to make, which is what makes
 * "validated before anything is written" a property of the types rather than
 * of the order somebody remembered to call things in.
 */
export interface PreparedRestore {
  readonly createdAt: string;
  readonly appVersion: string;
  /** Storage key → the exact text to write. Keys absent from it are removed. */
  readonly records: ReadonlyMap<string, string>;
}

export type ReadBackupResult =
  | { readonly ok: true; readonly prepared: PreparedRestore }
  | { readonly ok: false; readonly problem: BackupProblem };

/** The store answered, or it did not. */
export type RestoreOutcome = 'restored' | 'failed';

const refuse = (problem: BackupProblem): ReadBackupResult => ({ ok: false, problem });

/** Own properties only, so nothing inherited can pose as a stored record. */
function ownKeys(value: object): string[] {
  return Object.keys(value).filter((key) => Object.prototype.hasOwnProperty.call(value, key));
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Reads and fully validates a backup's text. Never throws, never writes.
 *
 * `text` is the whole file. It is measured before it is parsed, so a file that
 * is not ours is refused without being turned into objects first.
 */
export async function readBackup(text: string): Promise<ReadBackupResult> {
  if (byteLength(text) > BACKUP_MAX_BYTES) return refuse('unreadable');

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return refuse('unreadable');
  }
  if (!isPlainObject(root)) return refuse('unreadable');

  const { formatVersion, createdAt, appVersion, platform, data } = root;

  if (typeof formatVersion !== 'number' || !Number.isInteger(formatVersion) || formatVersion < 1) {
    return refuse('unreadable');
  }
  // A container this build has never seen. Refusing is the point: an older app
  // that quietly dropped the parts it did not understand would report a
  // successful restore for data it had thrown away.
  if (formatVersion > BACKUP_FORMAT_VERSION) return refuse('newer');

  if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) {
    return refuse('unreadable');
  }
  if (typeof appVersion !== 'string' || appVersion.length > 64) return refuse('unreadable');
  if (typeof platform !== 'string' || platform.length > 64) return refuse('unreadable');
  if (!isPlainObject(data)) return refuse('unreadable');

  const present = ownKeys(data);
  // Keys that are not storage keys and never could be. Refused as damage, not
  // as "a newer version": no build of this app has ever written one.
  if (present.some((key) => UNSAFE_OBJECT_KEYS.includes(key))) return refuse('damaged');

  // STRICT KNOWN-KEY VALIDATION (docs/architecture/backup.md). A key this
  // build does not own is a record it cannot check, and the most likely
  // explanation is a game it does not have yet — so the file is treated as
  // being from a newer build, and refused rather than partly applied.
  const owned = new Set(backupKeys());
  if (present.some((key) => !owned.has(key))) return refuse('newer');

  const validators = await loadValidators(present);

  const records = new Map<string, string>();
  for (const key of present) {
    const validate = validators.get(key);
    // No validator means the owning chunk would not load. Unverifiable is
    // refused, never waved through.
    if (!validate) return refuse('damaged');

    const value = validate((data as Record<string, unknown>)[key]);
    if (value === null || value === undefined) return refuse('damaged');

    let serialised: string | undefined;
    try {
      // `undefined` rather than a string is possible in principle (a value
      // JSON cannot represent); a circular one throws. Both are damage.
      serialised = JSON.stringify(value) as string | undefined;
    } catch {
      return refuse('damaged');
    }
    if (serialised === undefined) return refuse('damaged');
    if (byteLength(serialised) > BACKUP_MAX_RECORD_BYTES) return refuse('damaged');
    records.set(key, serialised);
  }

  return { ok: true, prepared: { createdAt, appVersion, records } };
}

/**
 * The same check, starting from the file the player picked. The parameter is
 * structural rather than `File` so the rule "size is checked before the bytes
 * are read" can be tested without a browser.
 */
export async function readBackupFile(file: {
  readonly size: number;
  text: () => Promise<string>;
}): Promise<ReadBackupResult> {
  if (file.size > BACKUP_MAX_BYTES) return refuse('unreadable');
  let text: string;
  try {
    text = await file.text();
  } catch {
    return refuse('unreadable');
  }
  return readBackup(text);
}

/**
 * Writes a prepared restore, and undoes itself if any part of it does not
 * land.
 *
 *   1. snapshot every key backup owns, as it is now
 *   2. write: the record from the file, or a removal where the file has none
 *   3. read every one of them back
 *   4. anything that does not match → put the snapshot back, report failure
 */
export async function applyBackup(
  prepared: PreparedRestore,
  kv: KVStore = preferencesKV,
): Promise<RestoreOutcome> {
  const keys = backupKeys();

  const previous = await Promise.all(keys.map((key) => loadRaw(key, kv)));
  const snapshot = new Map<string, string | null>(
    keys.map((key, index) => [key, previous[index] ?? null]),
  );

  const wanted = new Map<string, string | null>(
    keys.map((key) => [key, prepared.records.get(key) ?? null]),
  );

  await Promise.all([...wanted].map(([key, value]) => saveRaw(key, value, kv)));

  const written = await Promise.all(keys.map((key) => loadRaw(key, kv)));
  const landed = keys.every((key, index) => (written[index] ?? null) === wanted.get(key));
  if (landed) return 'restored';

  // Roll back to exactly what was there. This can fail too — a store that
  // could not be written a moment ago may still refuse — and there is nothing
  // further to try; the report is 'failed' either way, which is the honest
  // thing to tell somebody whose device is not accepting writes.
  await Promise.all([...snapshot].map(([key, value]) => saveRaw(key, value, kv)));
  return 'failed';
}

/**
 * UTF-8 bytes, which is what a file on disk is measured in. `TextEncoder` is
 * present in every WebView this app supports and in Node, so the code-unit
 * fallback is for an environment that has neither; it under-counts non-ASCII,
 * which makes the guard looser there but never absent.
 */
function byteLength(text: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return text.length;
}
