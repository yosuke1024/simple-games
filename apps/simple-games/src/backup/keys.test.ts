/**
 * The structural gate on backup ownership (issue #160).
 *
 * A backup that silently misses a record is worse than no backup: the player
 * is told their progress moved, and one game's did not. Nothing here checks
 * behaviour — these tests exist so that adding a record, or a whole game,
 * cannot happen without somebody deciding whether it travels.
 *
 * Editing an expectation to make one of these pass is the same mistake
 * `app/gameKeys.test.ts` warns about: the thing being asserted is what a real
 * player's file will contain.
 */
import { describe, expect, it } from 'vitest';
import { GAMES } from '../app/registry';
import { STORAGE_KEYS } from '../storage/schemas';
import { backupKeys, SHELL_BACKUP_KEYS, SHELL_KEYS_LEFT_BEHIND } from './keys';
import { loadValidators } from './owners';

describe('backup key ownership', () => {
  it('accounts for every shared record, either carried or left behind', () => {
    const decided = [...SHELL_BACKUP_KEYS, ...Object.keys(SHELL_KEYS_LEFT_BEHIND)].sort();
    expect(decided).toEqual([...Object.values(STORAGE_KEYS)].sort());
  });

  it('never carries a record twice', () => {
    const keys = backupKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries every key every registered game declares', () => {
    const carried = new Set(backupKeys());
    const missing = GAMES.flatMap((game) =>
      game.storageKeys.filter((key) => !carried.has(key)).map((key) => `${game.id}: ${key}`),
    );
    expect(missing, missing.join('\n')).toEqual([]);
  });

  /**
   * The IAP entitlement is the one exclusion that is a rule rather than a
   * judgement call (docs/ADS_POLICY.md): a backup file can be copied, so an
   * entitlement inside one would be a purchase that copies. Asserted by name
   * and from the other direction — whatever else changes about the lists
   * above, this key does not appear in a backup.
   */
  it('never carries the ad-removal entitlement', () => {
    expect(SHELL_KEYS_LEFT_BEHIND).toHaveProperty(STORAGE_KEYS.iap);
    expect(backupKeys()).not.toContain(STORAGE_KEYS.iap);
  });

  it('gives a reason for every record it leaves behind', () => {
    for (const [key, reason] of Object.entries(SHELL_KEYS_LEFT_BEHIND)) {
      expect(reason.length, `${key} has no reason`).toBeGreaterThan(0);
    }
  });
});

describe('backup record owners', () => {
  /**
   * The other half of the gate. A key can be listed and still be unrestorable
   * if nothing can validate it — restore refuses records it cannot check, so
   * an unowned key would mean "this game's data can be exported and then
   * always rejected on the way back".
   */
  it('resolves every carried key to its owner’s schema', async () => {
    const keys = backupKeys();
    const validators = await loadValidators(keys);
    const unowned = keys.filter((key) => !validators.has(key));
    expect(unowned, unowned.join('\n')).toEqual([]);
  });

  it('loads no owner for a key nothing declares', async () => {
    const validators = await loadValidators(['zz.notAKey']);
    expect(validators.has('zz.notAKey')).toBe(false);
  });
});
