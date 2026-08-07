/**
 * A token that makes one run's track its own. There are no levels and no
 * dates to seed from — the game is endless and the record is the score
 * (docs/BUNNY_HOP_RULES.md §6) — so every run gets a new track, while the seed
 * still pins that track down completely, which is what makes the golden test
 * mean anything.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const bunnySeed = (token: string): string => `bunny-${token}`;
