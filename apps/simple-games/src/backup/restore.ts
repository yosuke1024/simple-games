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
import { loadRaw, loadRawOrThrow, saveRaw } from '../storage/repo';
import { clubConnectionsSchema, clubOutboxSchema, STORAGE_KEYS } from '../storage/schemas';
import { preferencesKV, preferencesKVWithReadStatus, type KVStore } from '../storage/kv';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_MAX_BYTES,
  BACKUP_MAX_RECORD_BYTES,
  UNSAFE_OBJECT_KEYS,
} from './format';
import { backupKeys, RESTORED_ONLY_WHEN_PRESENT } from './keys';
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
    const owner = validators.get(key);
    // No validator means the owning chunk would not load. Unverifiable is
    // refused, never waved through.
    if (!owner) return refuse('damaged');

    const raw = (data as Record<string, unknown>)[key];
    // A record whose schemaVersion is beyond what this build writes was made
    // by a newer build (a game's save format moved on). Its validator only
    // knows versions up to its own and would say null — which reads as
    // damage and tells the player to try another file, when the honest
    // advice is to update the app. Told apart here, before the validator is
    // asked (docs/architecture/backup.md「版の互換」).
    if (
      isPlainObject(raw) &&
      typeof raw.schemaVersion === 'number' &&
      raw.schemaVersion > owner.version
    ) {
      return refuse('newer');
    }

    const value = owner.validate(raw);
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
  // A key that began travelling later is left as it is when the file predates it.
  const keys = backupKeys().filter(
    (key) => !RESTORED_ONLY_WHEN_PRESENT.has(key) || prepared.records.has(key),
  );

  const previous = await Promise.all(keys.map((key) => loadRaw(key, kv)));
  const snapshot = new Map<string, string | null>(
    keys.map((key, index) => [key, previous[index] ?? null]),
  );

  const wanted = new Map<string, string | null>(
    keys.map((key) => [key, prepared.records.get(key) ?? null]),
  );

  // The queued results of a membership this restore replaces go with it, in the same
  // write and the same rollback. A queue that cannot be read is never overwritten with
  // a default: the restore stops before writing anything.
  if (wanted.has(STORAGE_KEYS.club)) {
    const outbox = await outboxWithout(
      replacedMembers(
        snapshot.get(STORAGE_KEYS.club) ?? null,
        wanted.get(STORAGE_KEYS.club) ?? null,
      ),
      kv,
    );
    if (outbox === 'unreadable') return 'failed';
    if (outbox !== null) {
      snapshot.set(STORAGE_KEYS.clubOutbox, outbox.previous);
      wanted.set(STORAGE_KEYS.clubOutbox, outbox.next);
    }
  }

  await Promise.all([...wanted].map(([key, value]) => saveRaw(key, value, kv)));

  const touched = [...wanted.keys()];
  const written = await Promise.all(touched.map((key) => loadRaw(key, kv)));
  const landed = touched.every((key, index) => (written[index] ?? null) === wanted.get(key));
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

/** endpoint → memberId of the joined Clubs in one `sg.club` text. */
function membersIn(text: string | null): Map<string, string> {
  if (text === null) return new Map();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Map();
  }
  const record = clubConnectionsSchema.validate(parsed);
  return new Map((record?.connections ?? []).map((c) => [c.endpoint, c.memberId]));
}

/**
 * Results waiting to be sent (`sg.clubOutbox`, never in a backup) are queued per Club,
 * not per member, and go out with whatever membership the device holds for that Club.
 * Where a restore replaced or removed the membership, its queued results belonged to
 * someone this device no longer is: they are dropped, never sent as the restored
 * member (club.md §4-2). A Club whose membership is unchanged keeps its queue.
 */
function replacedMembers(before: string | null, after: string | null): Set<string> {
  const now = membersIn(after);
  return new Set(
    [...membersIn(before)]
      .filter(([endpoint, member]) => now.get(endpoint) !== member)
      .map(([endpoint]) => endpoint),
  );
}

/**
 * The queue without the replaced Clubs' items: its text before and after, or null for
 * no change. Read once, through a store that reports a failed read instead of answering
 * "nothing stored" (`preferencesKVWithReadStatus`): an unreadable or damaged queue stops
 * the restore, and the text rolled back is exactly the text that was read.
 */
async function outboxWithout(
  replaced: ReadonlySet<string>,
  kv: KVStore,
): Promise<{ previous: string; next: string } | null | 'unreadable'> {
  if (replaced.size === 0) return null;
  const reader = kv === preferencesKV ? preferencesKVWithReadStatus : kv;
  let previous: string | null;
  try {
    // In the key's queue: an outbox save still waiting lands first and is seen here.
    previous = await loadRawOrThrow(STORAGE_KEYS.clubOutbox, reader);
  } catch {
    return 'unreadable';
  }
  if (previous === null) return null;
  let outbox;
  try {
    outbox = clubOutboxSchema.validate(JSON.parse(previous));
  } catch {
    return 'unreadable';
  }
  if (outbox === null) return 'unreadable';
  const items = outbox.items.filter((item) => !replaced.has(item.endpoint));
  if (items.length === outbox.items.length) return null;
  return { previous, next: JSON.stringify({ ...outbox, items }) };
}
