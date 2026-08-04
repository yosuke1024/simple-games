/**
 * Brick Breaker's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for brick-breaker's.
 */
export const en = {
  brickBreakerName: 'Brick Breaker',
  bbBoardLabel: 'Brick Breaker board',
  bbBricksLeft: 'Bricks {n}',
  bbClearedTitle: 'Wall cleared!',
  bbClearedBody: 'Every brick is down.',
  bbFailedTitle: 'Not this time',
  bbFailedBody: 'Retry is free — same wall, same bricks.',
  bbStep1Title: 'Aim with the paddle',
  bbStep1Body: 'The middle of the paddle sends the ball straight up; the edge sends it out steep.',
  bbStep2Title: 'Hollow bricks hold a ball',
  bbStep2Body: 'Break one and a second ball joins in. Only losing the last ball costs a life.',
  bbStep3Title: 'The wall creeps down',
  bbStep3Body: 'Clear every brick before the wall reaches the dotted line.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type BrickBreakerMessages = Record<keyof typeof en, string>;
