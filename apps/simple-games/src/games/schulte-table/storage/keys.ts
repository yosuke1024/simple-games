/**
 * The keys Schulte Table persists — and nothing else. A zero-import leaf: the
 * registry (app/registry.ts) lists these for "Reset Local Data" without
 * touching any game code, which is what keeps the game out of the home's
 * initial chunk (docs/ARCHITECTURE.md). Do not add imports here.
 *
 * There is no saved-game key. A round is tens of seconds of held attention and
 * attention cannot be suspended and restored, so nothing is written mid-round
 * (docs/SCHULTE_TABLE_RULES.md §11).
 */
export const ST_STORAGE_KEYS = {
  stats: 'st.stats',
  progress: 'st.progress',
  flags: 'st.flags',
} as const;
