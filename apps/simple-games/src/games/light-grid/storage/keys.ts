// Import-free ownership leaf: registry, reset and backup may read this eagerly.
export const LG_STORAGE_KEYS = {
  game: 'lg.saveGame',
  stats: 'lg.stats',
  flags: 'lg.flags',
  prefs: 'lg.prefs',
} as const;
