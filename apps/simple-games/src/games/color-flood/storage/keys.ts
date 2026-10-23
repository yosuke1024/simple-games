// Import-free ownership leaf: registry, reset and backup may read this eagerly.
export const CF_STORAGE_KEYS = {
  game: 'cf.saveGame',
  stats: 'cf.stats',
  flags: 'cf.flags',
  prefs: 'cf.prefs',
} as const;
