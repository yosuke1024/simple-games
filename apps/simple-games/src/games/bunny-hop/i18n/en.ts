/**
 * Bunny Hop's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for bunny-hop's.
 */
export const en = {
  bunnyName: 'Bunny Hop',
  bunnyBoardLabel: 'Bunny Hop meadow',
  bunnyBestScore: 'Best score',
  bunnyStartRun: 'Start Hopping',
  bunnyRunAgain: 'Hop again',
  bunnyJump: 'Hop',
  bunnyTapToStart: 'Tap the meadow to start',
  bunnyObstaclesPassed: 'Obstacles cleared',
  bunnyOverTitle: 'Bumped',
  bunnyOverBody: 'One touch ends a run. The next meadow is free.',
  bunnyNewBestScore: 'Your best score yet.',
  bunnyStep1Title: 'Tap to hop',
  bunnyStep1Body: 'The rabbit never stops. Tap the meadow, or press Hop, to clear a bush.',
  bunnyStep2Title: 'Birds fly too',
  bunnyStep2Body: 'Low ones have to be hopped like a bush; high ones only catch you mid-hop.',
  bunnyStep3Title: 'It only gets faster',
  bunnyStep3Body: 'One touch ends the run, and the next one starts straight away, free.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BunnyHopMessages = Record<keyof typeof en, string>;
