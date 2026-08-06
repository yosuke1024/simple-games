/**
 * Snake's own strings (issue #38): bundled into the game's chunk, not the
 * entry, and registered on chunk load by ./index.ts. The shell's en.ts stays
 * the source of truth for shared keys, this file for Snake's.
 *
 * `snakeName` is the same in every locale: a title is a proper noun, and the
 * player looking for it on the collection home is looking for one word.
 */
export const en = {
  snakeName: 'Snake',
  snakeBoardLabel: 'Snake board, length {n}',
  snakeLength: 'Length',
  snakeBestScore: 'Best score',
  snakeBestLength: 'Longest snake',
  snakeOverTitle: 'The run is over',
  snakeOverBody: 'Retry is free — a new board starts right away.',
  snakeFullTitle: 'The whole board!',
  snakeFullBody: 'There is nowhere left to grow.',
  snakeNewBestScore: 'Your best score yet.',
  snakeStep1Title: 'Swipe to turn',
  snakeStep1Body: 'The snake never stops; a swipe only changes which way it goes.',
  snakeStep2Title: 'Eat to grow',
  snakeStep2Body: 'Every piece of food adds a segment and makes the snake a little faster.',
  snakeStep3Title: 'Mind the walls',
  snakeStep3Body: 'Touching a wall or your own body ends the run, and retrying is always free.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SnakeMessages = Record<keyof typeof en, string>;
