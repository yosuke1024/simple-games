/**
 * Dino Run's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for dino-run's.
 */
export const en = {
  dinoName: 'Dino Run',
  dinoBoardLabel: 'Dino Run track',
  dinoBestScore: 'Best score',
  dinoStartRun: 'Start Running',
  dinoRunAgain: 'Run again',
  dinoJump: 'Jump',
  dinoTapToStart: 'Tap the track to start',
  dinoObstaclesPassed: 'Obstacles passed',
  dinoOverTitle: 'Crashed',
  dinoOverBody: 'One touch ends a run. The next track is free.',
  dinoNewBestScore: 'Your best score yet.',
  dinoStep1Title: 'Tap to jump',
  dinoStep1Body: 'The runner never stops. Tap the track, or press Jump, to clear a cactus.',
  dinoStep2Title: 'Birds fly too',
  dinoStep2Body: 'Low ones have to be jumped like a cactus; high ones only catch you mid-jump.',
  dinoStep3Title: 'It only gets faster',
  dinoStep3Body: 'One touch ends the run, and the next one starts straight away, free.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type DinoRunMessages = Record<keyof typeof en, string>;
