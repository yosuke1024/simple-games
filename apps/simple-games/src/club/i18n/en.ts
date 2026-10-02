/**
 * The Club House's own words (docs/architecture/club.md §11): shipped in the
 * `club` chunk, registered like a game's catalog, never parsed by a device
 * that has not joined. Keys are prefixed `club` so no shell or game key can
 * collide (src/i18n/i18n.test.ts). TODO(work package B): the full catalog.
 */
export const en = {
  clubBack: 'Back',
} as const;

export type ClubMessages = Record<keyof typeof en, string>;
