import '../../i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { Dice, type DiceProps } from './Dice';

afterEach(cleanup);

const props: DiceProps = {
  roll: [4, 3],
  remaining: [4, 3],
  canRoll: false,
  opening: false,
  rollKey: 1,
  onRoll: vi.fn(),
};
function picture(value: Partial<DiceProps> = {}) {
  return (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Dice {...props} {...value} />
    </SettingsProvider>
  );
}

describe('dice available to play', () => {
  it('marks the consumed face and restores it when a step is taken back', () => {
    const { container, rerender } = render(picture());
    expect(container.querySelectorAll('.bk-die-spent')).toHaveLength(0);
    rerender(picture({ remaining: [3] }));
    expect(screen.getByRole('img')).toHaveAccessibleName('Dice: 4 and 3 · 1 to play');
    expect(container.querySelectorAll('.bk-die-spent')).toHaveLength(1);
    // The four, not the remaining three, carries the non-colour used mark.
    expect(container.querySelector('.bk-die-spent')?.querySelectorAll('circle')).toHaveLength(4);
    expect(container.querySelectorAll('.bk-die-used-mark')).toHaveLength(1);
    rerender(picture());
    expect(container.querySelectorAll('.bk-die-spent')).toHaveLength(0);
  });

  it('shows all four uses of doubles and consumes exactly one per step', () => {
    const { container, rerender } = render(picture({ roll: [5, 5], remaining: [5, 5, 5, 5] }));
    expect(container.querySelectorAll('.bk-die')).toHaveLength(4);
    for (const count of [3, 2, 1, 0]) {
      rerender(picture({ roll: [5, 5], remaining: Array<number>(count).fill(5) }));
      expect(container.querySelectorAll('.bk-die-spent')).toHaveLength(4 - count);
      expect(screen.getByRole('img')).toHaveAccessibleName(`Dice: 5 and 5 · ${count} to play`);
    }
  });

  it('shows unrolled faces on the roll button instead of the previous CPU roll', () => {
    const { container } = render(picture({ canRoll: true, remaining: [] }));
    expect(screen.getByRole('button', { name: 'Roll' })).toBeEnabled();
    expect(container.querySelectorAll('.bk-die-unknown')).toHaveLength(2);
    expect(container.querySelectorAll('.bk-die-spent')).toHaveLength(0);
  });
});
