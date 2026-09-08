/**
 * What a backup file carries, and what it deliberately does not (issue #160).
 *
 * There is no separate "backup manifest" to keep in step with the app. The
 * games already declare the keys they own (`app/registry.ts`), and that
 * declaration is what "Reset Local Data" walks; backup walks the same list, so
 * a new game is inside the backup the moment it is inside the collection.
 * Nothing here understands a game's save format — that stays the game's, and
 * `owners.ts` reaches for the game's own validator when the shape matters.
 *
 * The shell's own records have no registry to be listed in, so they are listed
 * here — **every one of them, on one side or the other**. `SHELL_BACKUP_KEYS`
 * is what travels; `SHELL_KEYS_LEFT_BEHIND` is what stays, with the reason it
 * stays written next to it. A new shared record has to be put in one of the
 * two lists or `keys.test.ts` fails, which is the only reason the second list
 * exists: silence about a key would otherwise read exactly like a decision.
 */
import { GAMES } from '../app/registry';
import { STORAGE_KEYS } from '../storage/schemas';

/**
 * Shell records a backup carries: what the player chose, and what the shell
 * remembers about how they move around the collection.
 */
export const SHELL_BACKUP_KEYS: readonly string[] = [
  // Language, theme, sound, vibration, reduced motion — the settings a player
  // set once and would have to find again on a new phone.
  STORAGE_KEYS.settings,
  // The pinned shelf. A choice, so it moves with the person who made it.
  STORAGE_KEYS.favorites,
  // The recently-played shortcuts. A history rather than a choice, and it
  // travels for the same reason the shelf does: arriving on a new device to a
  // home that looks like the old one is the whole point of the feature.
  STORAGE_KEYS.recent,
];

/**
 * Shell records a backup leaves where they are, and why. These are not
 * exported, and a restore does not clear them either: they are outside the
 * file's world entirely, so restoring somebody else's backup — or their own,
 * from a year ago — cannot reach them.
 */
export const SHELL_KEYS_LEFT_BEHIND: Readonly<Record<string, string>> = {
  /**
   * THE ONE THAT IS A RULE, NOT A JUDGEMENT CALL.
   *
   * The ad-removal entitlement is Google Play's and the App Store's to grant,
   * and the record here is only a local cache of their answer
   * (docs/ADS_POLICY.md). A backup file is a file: it can be copied, mailed,
   * posted. If the entitlement travelled inside one, removing ads would be a
   * copy-and-paste away, and the one-time purchase would have
   * quietly become something else. Somebody moving to a new phone restores the purchase from the store
   * — that path exists, costs nothing, and is the one the stores support.
   *
   * Any future platform-owned entitlement belongs on this side too.
   */
  [STORAGE_KEYS.iap]: 'platform entitlement — restored from the store, never from a file',
  /**
   * The store-review question's pacing (docs/REVIEW_PROMPT_POLICY.md). It
   * counts what happened on THIS install and retires for good once answered;
   * carrying it to a new device would either re-arm a question somebody has
   * already answered or silence one they have never been asked. Neither is
   * progress the player built, so neither is theirs to move.
   */
  [STORAGE_KEYS.review]: 'per-install prompt pacing — not progress',
  /**
   * The browser build's one-time app card (docs/WEB_VERSION.md). Per-browser
   * by construction, and never written by the app build at all.
   */
  [STORAGE_KEYS.webAppPrompt]: 'per-browser, web-only — meaningless on another device',
};

/**
 * Every key a backup may contain, in a stable order: the shell's, then each
 * game's in registry order. Restore treats this list as the whole world it is
 * allowed to touch — a key outside it is neither read, written, nor cleared.
 */
export function backupKeys(): readonly string[] {
  return [...SHELL_BACKUP_KEYS, ...GAMES.flatMap((game) => game.storageKeys)];
}
