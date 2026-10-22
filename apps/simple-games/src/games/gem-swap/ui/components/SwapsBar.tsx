/**
 * The swaps left in a round, as thirty quiet segments rather than a number
 * (docs/GEM_SWAP_RULES.md §9): a count running down is a "how many left"
 * pressure, the same reasoning as Bubble Pop's row of dots. Each valid swap
 * empties one segment, Undo fills it again, and nothing else ever changes —
 * no colour shift, no blinking, no warning as the end comes near. The number
 * is there for a screen reader only.
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ROUND_SWAPS } from '../../game';

export interface SwapsBarProps {
  left: number;
  className?: string;
}

export const SwapsBar = memo(function SwapsBar({ left, className }: SwapsBarProps) {
  const { t } = useSettings();
  return (
    <div className={`gs-bar${className ? ` ${className}` : ''}`}>
      <span className="visually-hidden">{t('gemSwapSwapsLeft', { count: left })}</span>
      <span className="gs-bar-track" aria-hidden="true">
        {Array.from({ length: ROUND_SWAPS }, (_, i) => (
          <span key={i} className={`gs-bar-seg${i < left ? ' gs-bar-seg-left' : ''}`} />
        ))}
      </span>
    </div>
  );
});
