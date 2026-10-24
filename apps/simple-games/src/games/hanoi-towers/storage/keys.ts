// Import-free ownership leaf: registry, reset and backup may read this eagerly.
export const HT_STORAGE_KEYS = {
  game: 'hn.saveGame',
  stats: 'hn.stats',
  flags: 'hn.flags',
  prefs: 'hn.prefs',
} as const;
