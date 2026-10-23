// Import-free ownership leaf: registry, reset and backup may read this eagerly.
export const ME_STORAGE_KEYS = {
  game: 'me.saveGame',
  stats: 'me.stats',
  flags: 'me.flags',
  prefs: 'me.prefs',
} as const;
