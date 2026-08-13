/**
 * The message keys behind every reward and pickup kind (§5, §8) — one map for
 * the boss offer and the HUD toast, so a new axis cannot ship with a missing
 * label.
 */
import type { MessageKey } from '@/i18n';
import type { RewardKind } from '../game/types';

export const REWARD_NAME_KEYS: Readonly<Record<RewardKind, MessageKey>> = {
  power: 'sfUpPower',
  rapid: 'sfUpRapid',
  spread: 'sfUpSpread',
  missile: 'sfUpMissile',
  maxlife: 'sfUpMaxLife',
  life: 'sfUpLife',
  bonus: 'sfUpBonus',
};

export const REWARD_DESC_KEYS: Readonly<Record<RewardKind, MessageKey>> = {
  power: 'sfUpPowerDesc',
  rapid: 'sfUpRapidDesc',
  spread: 'sfUpSpreadDesc',
  missile: 'sfUpMissileDesc',
  maxlife: 'sfUpMaxLifeDesc',
  life: 'sfUpLifeDesc',
  bonus: 'sfUpBonusDesc',
};
