/**
 * The backup file itself (issue #160) — a long-lived contract, not an
 * implementation detail.
 *
 * A file written by this app today has to be readable by this app on another
 * phone, on another operating system, years from now. That is the whole
 * feature: Simple Games keeps no account and no server, so the file IS the
 * migration path (docs/PRODUCT_PRINCIPLES.md). Everything below is therefore
 * written to be boring and to stay put — see docs/architecture/backup.md for
 * the decisions and what may change without breaking a file already on
 * somebody's phone.
 *
 * ```json
 * {
 *   "formatVersion": 1,
 *   "createdAt": "2026-09-08T09:30:00.000Z",
 *   "appVersion": "1.2.2",
 *   "platform": "android",
 *   "data": { "sg.settings": { … }, "sd.stats": { … } }
 * }
 * ```
 *
 * `data` holds each record as parsed JSON rather than as the string the store
 * keeps, so a backup can be read by a human and diffed by a machine, and a
 * record is never double-encoded. The keys are the storage keys themselves:
 * ownership is already declared once (`app/registry.ts`), and inventing a
 * second naming scheme for the file would be a second thing to keep true.
 *
 * `appVersion` and `platform` are INFORMATIONAL. Neither gates a restore: an
 * Android backup restores on iPhone and on the web, which is the point of
 * having one format. What gates a restore is `formatVersion` and whether every
 * record inside it validates (backup/restore.ts).
 */

/**
 * The version of the container, not of the app and not of any game's save.
 *
 * It goes up only when the SHAPE AROUND the records changes — a new required
 * field, a different meaning for `data`. Games change their own save formats
 * behind their own schemaVersions, and those never reach this number: a
 * backup does not know what a Sudoku save looks like, so it cannot go stale
 * when one changes.
 */
export const BACKUP_FORMAT_VERSION = 1;

/**
 * The most a backup file may be, in bytes. Thirty games of finished puzzles,
 * statistics and suspended boards measure in the tens of kilobytes; four
 * megabytes is far past any real save and still small enough that a phone can
 * read it into memory without thinking. Its job is to stop a file that is not
 * a backup at all — a video, a database — from being parsed before it is
 * refused (docs/PRODUCT_PRINCIPLES.md: ローエンド端末を設計制約として扱う).
 */
export const BACKUP_MAX_BYTES = 4 * 1024 * 1024;

/**
 * The most any single record may be. A guard against one absurd value inside
 * an otherwise plausible file; every real record is orders of magnitude below
 * it.
 */
export const BACKUP_MAX_RECORD_BYTES = 256 * 1024;

/**
 * Object keys that are never storage keys and are dangerous to carry around a
 * prototype chain. Strict known-key validation already refuses them — none is
 * a key any game or the shell owns — but they are named here so the refusal is
 * deliberate rather than incidental, and so it stays true if the known-key
 * rule is ever loosened.
 */
export const UNSAFE_OBJECT_KEYS: readonly string[] = ['__proto__', 'prototype', 'constructor'];

export interface BackupFile {
  readonly formatVersion: number;
  /** When the backup was written, ISO 8601. Shown before a restore. */
  readonly createdAt: string;
  /** The app version that wrote it. Never checked — see the module note. */
  readonly appVersion: string;
  /** Where it was written: `android` / `ios` / `web`. Never checked either. */
  readonly platform: string;
  /** Storage key → the record's parsed JSON. */
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * `simple-games-backup-2026-09-08.json`.
 *
 * A plain `.json` extension rather than a private one, deliberately: every
 * file picker, mail client and cloud drive already knows what to do with it,
 * and a custom extension is the kind of small cleverness that ends with a
 * player unable to select their own backup on a phone they just bought. The
 * date is the local date, because it is there for the person reading the file
 * list, not for the parser (`createdAt` inside the file is the exact instant).
 */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `simple-games-backup-${date}.json`;
}

/** The file's bytes. Pretty-printed: a backup a person can open and read. */
export function serializeBackup(backup: BackupFile): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}
