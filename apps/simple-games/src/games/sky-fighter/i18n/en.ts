/**
 * Sky Fighter's own strings (issue #38): bundled into the game's chunk, not
 * the entry, and registered on chunk load by ./index.ts. Key names are
 * unchanged from the pre-split catalog — the shell's en.ts stays the source
 * of truth for shared keys, this file for sky-fighter's.
 */
export const en = {
  bestScore: 'Best score',
  skyFighterName: 'Sky Fighter',
  sfBoardLabel: 'Sky Fighter board',
  sfWave: 'Wave {n} / {m}',
  sfClearedTitle: 'Sky clear!',
  sfClearedBody: 'Every wave is down.',
  sfFailedTitle: 'Shot down',
  sfFailedBody: 'Retry is free — same skies, same waves.',
  sfNewBestScore: 'Your best score yet.',
  sfStep1Title: 'Move to aim',
  sfStep1Body:
    'Your fighter fires on its own. Slide left and right — where you fly is where you aim.',
  sfStep2Title: 'Big ones break up',
  sfStep2Body: 'A bomber splits into fighters, and fighters into scouts. Only bombers shoot back.',
  sfStep3Title: 'Catch the spare craft',
  sfStep3Body:
    'A downed scout sometimes drops a tiny craft. Catch it for an extra barrel; a hit costs one.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SkyFighterMessages = Record<keyof typeof en, string>;
