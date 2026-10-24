/**
 * How long one move's replay takes (docs/GEM_SWAP_RULES.md §10). Pure, so the
 * numbers in the rules are pinned by a test rather than by a component.
 *
 * The swap and every stage take one beat each. A beat is 160 ms, squeezed
 * evenly so a whole move stays within about one second; a move that would
 * need beats shorter than 60 ms is not animated at all — the final board is
 * drawn at once, as under Reduced Motion. This is a deliberate departure from
 * the plan's "150–180 ms per stage": on a long cascade the two numbers cannot
 * both hold, and the one-second ceiling wins.
 */
export const PLAYBACK_BEAT_MS = 160;
export const PLAYBACK_MOVE_MS = 1000;
export const PLAYBACK_MIN_BEAT_MS = 60;

/** The beat for a move with `stages` cascade stages, or null to skip the replay. */
export function playbackIntervalMs(stages: number): number | null {
  const beats = Math.max(1, Math.floor(stages)) + 1;
  const beat = Math.min(PLAYBACK_BEAT_MS, Math.floor(PLAYBACK_MOVE_MS / beats));
  return beat < PLAYBACK_MIN_BEAT_MS ? null : beat;
}
