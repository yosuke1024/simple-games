/**
 * The random picks over the upgrade axes (docs/SKY_FIGHTER_RULES.md §5, §8):
 * caps are respected, options never repeat, and a maxed ship still gets a
 * real choice.
 */
import { describe, expect, it } from 'vitest';
import { MAX_LIVES_CAP } from './constants';
import { createInitialState } from './engine';
import { createRng } from './rng';
import type { GameState, WeaponUpgrades } from './types';
import {
  WEAPON_UPGRADE_CAPS,
  WEAPON_UPGRADE_KINDS,
  applyWeaponUpgrade,
  availableWeaponUpgrades,
  pickWeaponUpgrade,
  rollRewardOptions,
} from './upgrades';

const NONE: WeaponUpgrades = { power: 0, rapid: 0, spread: 0, missile: 0 };

function stateWith(partial: Partial<GameState>): GameState {
  return { ...createInitialState('test'), ...partial };
}

function maxedWeapons(): WeaponUpgrades {
  return {
    power: WEAPON_UPGRADE_CAPS.power,
    rapid: WEAPON_UPGRADE_CAPS.rapid,
    spread: WEAPON_UPGRADE_CAPS.spread,
    missile: WEAPON_UPGRADE_CAPS.missile,
  };
}

describe('weapon upgrade picks (§5)', () => {
  it('raises exactly the picked axis by one and respects its cap', () => {
    for (const kind of WEAPON_UPGRADE_KINDS) {
      const upgraded = applyWeaponUpgrade(NONE, kind);
      expect(upgraded[kind]).toBe(1);
      const untouched = WEAPON_UPGRADE_KINDS.filter((other) => other !== kind);
      for (const other of untouched) expect(upgraded[other]).toBe(0);

      let capped = NONE;
      for (let i = 0; i < WEAPON_UPGRADE_CAPS[kind] + 5; i++) {
        capped = applyWeaponUpgrade(capped, kind);
      }
      expect(capped[kind]).toBe(WEAPON_UPGRADE_CAPS[kind]);
    }
  });

  it('excludes capped axes from the pool', () => {
    expect(availableWeaponUpgrades(NONE)).toEqual([...WEAPON_UPGRADE_KINDS]);
    const nearlyMaxed = { ...maxedWeapons(), spread: 0 };
    expect(availableWeaponUpgrades(nearlyMaxed)).toEqual(['spread']);
    expect(availableWeaponUpgrades(maxedWeapons())).toEqual([]);
  });

  it('the random pick lands on every open axis and never a capped one', () => {
    const seen = new Set<string>();
    const rng = createRng('pick');
    for (let i = 0; i < 200; i++) {
      const kind = pickWeaponUpgrade(NONE, rng());
      expect(kind).not.toBeNull();
      seen.add(kind!);
    }
    expect(seen.size).toBe(WEAPON_UPGRADE_KINDS.length);
    expect(pickWeaponUpgrade(maxedWeapons(), 0.5)).toBeNull();
  });
});

describe('boss reward offers (§8)', () => {
  it('offers three distinct options from a fresh ship', () => {
    const options = rollRewardOptions(stateWith({}), createRng('offer'));
    expect(options).toHaveLength(3);
    expect(new Set(options).size).toBe(3);
  });

  it('never offers a capped axis, and never Max Life at the cap', () => {
    for (let i = 0; i < 50; i++) {
      const options = rollRewardOptions(
        stateWith({
          upgrades: { ...NONE, power: WEAPON_UPGRADE_CAPS.power },
          maxLives: MAX_LIVES_CAP,
          lives: MAX_LIVES_CAP,
        }),
        createRng(`cap-${i}`),
      );
      expect(options).not.toContain('power');
      expect(options).not.toContain('maxlife');
      expect(new Set(options).size).toBe(options.length);
    }
  });

  it('a fully built ship still gets something to choose (§8)', () => {
    const hurt = rollRewardOptions(
      stateWith({ upgrades: maxedWeapons(), maxLives: MAX_LIVES_CAP, lives: 2 }),
      createRng('full'),
    );
    expect(hurt).toEqual(['life', 'bonus']);

    const untouched = rollRewardOptions(
      stateWith({ upgrades: maxedWeapons(), maxLives: MAX_LIVES_CAP, lives: MAX_LIVES_CAP }),
      createRng('full'),
    );
    expect(untouched).toEqual(['bonus']);
  });

  it('different runs shuffle different offers', () => {
    const offers = new Set<string>();
    for (let i = 0; i < 12; i++) {
      offers.add(rollRewardOptions(stateWith({}), createRng(`shuffle-${i}`)).join(','));
    }
    expect(offers.size).toBeGreaterThan(1);
  });
});
