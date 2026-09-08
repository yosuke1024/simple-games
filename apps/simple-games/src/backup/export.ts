/**
 * Writing a backup (issue #160).
 *
 * EXPORT ONLY WRITES WHAT RESTORE WILL ACCEPT
 *
 * Every record is read, parsed, and put through its owner's validator before
 * it goes into the file — the same validator restore will run on the way back
 * in (backup/owners.ts). A record that fails is left out rather than copied:
 * it is already unreadable to the game that owns it, which is showing the
 * player defaults for it right now, so carrying it would preserve nothing and
 * would hand them a file that their own app then refuses whole. What comes out
 * of here restores.
 *
 * The value written is the validator's, not the raw text. For an up-to-date
 * record those are the same thing; for an older one the validator is also the
 * migration, so the backup carries the record in the shape this build would
 * next have saved it in anyway.
 *
 * A key with nothing stored is simply absent. A fresh install exports a file
 * with an empty `data`, and that is a valid backup — restoring it is how a
 * player deliberately returns a device to nothing.
 */
import { loadRaw } from '../storage/repo';
import { preferencesKV, type KVStore } from '../storage/kv';
import { BACKUP_FORMAT_VERSION, type BackupFile } from './format';
import { backupKeys } from './keys';
import { loadValidators } from './owners';

export interface BackupMeta {
  /** The running build's version — informational inside the file. */
  readonly appVersion: string;
  /** `android` / `ios` / `web` — informational inside the file. */
  readonly platform: string;
  /** The instant recorded as `createdAt`. Injected so tests can pin it. */
  readonly now?: Date;
}

export async function createBackup(
  meta: BackupMeta,
  kv: KVStore = preferencesKV,
): Promise<BackupFile> {
  const keys = backupKeys();
  const raws = await Promise.all(keys.map((key) => loadRaw(key, kv)));

  // Only the keys that actually hold something need an owner, so only those
  // games' chunks are loaded (backup/owners.ts).
  const stored = keys.filter((_, index) => raws[index] !== null);
  const validators = await loadValidators(stored);

  const data: Record<string, unknown> = {};
  for (const [index, key] of keys.entries()) {
    const raw = raws[index];
    if (raw === null || raw === undefined) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Not JSON at all. Nothing in the app wrote this; skip it.
      continue;
    }
    const validate = validators.get(key);
    if (!validate) continue;
    const value = validate(parsed);
    if (value === null || value === undefined) continue;
    data[key] = value;
  }

  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt: (meta.now ?? new Date()).toISOString(),
    appVersion: meta.appVersion,
    platform: meta.platform,
    data,
  };
}
