/**
 * The upgrade axes and every random pick over them (docs/SKY_FIGHTER_RULES.md
 * §5, §8). All randomness stays in this layer, seeded per run — the UI only
 * renders what it is handed, and a test can replay any roll.
 */
import {
  MAX_LIVES_CAP,
  MISSILE_MAX_LEVEL,
  POWER_MAX_LEVEL,
  RAPID_MAX_LEVEL,
  SPREAD_MAX_LEVEL,
} from './constants';
import type { GameState, RewardKind, WeaponUpgradeKind, WeaponUpgrades } from './types';

export const WEAPON_UPGRADE_KINDS: readonly WeaponUpgradeKind[] = [
  'power',
  'rapid',
  'spread',
  'missile',
];

export const WEAPON_UPGRADE_CAPS: Readonly<Record<WeaponUpgradeKind, number>> = {
  power: POWER_MAX_LEVEL,
  rapid: RAPID_MAX_LEVEL,
  spread: SPREAD_MAX_LEVEL,
  missile: MISSILE_MAX_LEVEL,
};

export function isWeaponUpgradeCapped(upgrades: WeaponUpgrades, kind: WeaponUpgradeKind): boolean {
  return upgrades[kind] >= WEAPON_UPGRADE_CAPS[kind];
}

/** Axes still below their cap — the only ones any random pick may offer (§8). */
export function availableWeaponUpgrades(upgrades: WeaponUpgrades): WeaponUpgradeKind[] {
  return WEAPON_UPGRADE_KINDS.filter((kind) => !isWeaponUpgradeCapped(upgrades, kind));
}

/** One level onto one axis; the caller has already checked the cap. */
export function applyWeaponUpgrade(
  upgrades: WeaponUpgrades,
  kind: WeaponUpgradeKind,
): WeaponUpgrades {
  return {
    ...upgrades,
    [kind]: Math.min(WEAPON_UPGRADE_CAPS[kind], upgrades[kind] + 1),
  };
}

/**
 * The random pick behind a caught weapon crate (§5): uniform over the axes
 * that still have room. Null when everything is capped — the crate converts
 * to points instead.
 */
export function pickWeaponUpgrade(
  upgrades: WeaponUpgrades,
  roll: number,
): WeaponUpgradeKind | null {
  const available = availableWeaponUpgrades(upgrades);
  if (available.length === 0) return null;
  const index = Math.min(available.length - 1, Math.floor(roll * available.length));
  return available[index]!;
}

/**
 * The three-way offer after a boss falls (§8). Distinct by construction:
 * uncapped weapon axes and Max Life are shuffled and taken from the front,
 * then Repair and finally Bonus fill any space left — so a maxed-out ship
 * still gets a real choice, and the same option never appears twice.
 */
export function rollRewardOptions(state: GameState, rng: () => number): RewardKind[] {
  const pool: RewardKind[] = [...availableWeaponUpgrades(state.upgrades)];
  if (state.maxLives < MAX_LIVES_CAP) pool.push('maxlife');
  // Fisher–Yates over a copy; the rng is the run's, so a test can pin it.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  const options = pool.slice(0, 3);
  if (options.length < 3 && state.lives < state.maxLives) options.push('life');
  if (options.length < 3) options.push('bonus');
  return options;
}
