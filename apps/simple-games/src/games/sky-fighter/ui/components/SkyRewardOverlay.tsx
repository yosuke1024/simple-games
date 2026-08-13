/**
 * The boss reward: up to three distinct options, name and one-line effect,
 * no timer, no ad, nothing rushing the choice (docs/SKY_FIGHTER_RULES.md §8).
 * The game is parked behind this dialog until a button is pressed.
 */
import { useSettings } from '@/state/SettingsContext';
import type { RewardKind } from '../../game/types';
import { REWARD_DESC_KEYS, REWARD_NAME_KEYS } from '../rewardText';

export interface SkyRewardOverlayProps {
  options: readonly RewardKind[];
  onChoose: (index: number) => void;
}

export function SkyRewardOverlay({ options, onChoose }: SkyRewardOverlayProps) {
  const { t } = useSettings();

  return (
    <div className="overlay">
      <div
        className="dialog sf-reward"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('sfChooseUpgrade')}
      >
        <h2 className="dialog-title">{t('sfChooseUpgrade')}</h2>
        <div className="sf-reward-options">
          {options.map((kind, index) => (
            <button
              key={kind}
              type="button"
              className="btn btn-secondary sf-reward-btn"
              onClick={() => onChoose(index)}
              autoFocus={index === 0}
            >
              <span className="sf-reward-name">{t(REWARD_NAME_KEYS[kind])}</span>
              <span className="sf-reward-desc">{t(REWARD_DESC_KEYS[kind])}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
