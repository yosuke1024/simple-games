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
  sfStage: 'Stage {n}',
  sfWave: 'Wave {n} / {m}',
  sfBoss: 'BOSS',
  sfStageReached: 'Stage reached',
  sfClearedTitle: 'Sky clear!',
  sfClearedBody: 'All one hundred stages are down.',
  sfFailedTitle: 'Shot down',
  sfFailedBody: 'Retry is free — same skies, a fresh run.',
  sfNewBestScore: 'Your best score yet.',
  sfChooseUpgrade: 'Choose an upgrade',
  sfUpPower: 'Power',
  sfUpPowerDesc: 'Heavier shots',
  sfUpRapid: 'Rapid',
  sfUpRapidDesc: 'Faster firing',
  sfUpSpread: 'Spread',
  sfUpSpreadDesc: 'More barrels at once',
  sfUpMissile: 'Missile',
  sfUpMissileDesc: 'A homing missile',
  sfUpMaxLife: 'Max Life',
  sfUpMaxLifeDesc: 'One more heart, filled',
  sfUpLife: 'Repair',
  sfUpLifeDesc: 'Restore one heart',
  sfUpBonus: 'Bonus',
  sfUpBonusDesc: 'Points, on the house',
  sfPickupPlus: '{name} +1',
  sfPickupLife: 'Life +1',
  sfStep1Title: 'Move to aim',
  sfStep1Body:
    'Your fighter fires on its own. Drag in any direction — where you fly is where you aim.',
  sfStep2Title: 'Big ones break up',
  sfStep2Body: 'A bomber splits into fighters, and fighters into scouts. Only bombers shoot back.',
  sfStep3Title: 'Catch what falls',
  sfStep3Body:
    'Downed scouts drop weapon crates and hearts. Every tenth stage, a boss guards a choice of upgrades.',
} as const;

/** Every locale of this game must provide exactly these keys. */
export type SkyFighterMessages = Record<keyof typeof en, string>;
