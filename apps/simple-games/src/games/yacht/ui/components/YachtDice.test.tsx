/**
 * The dice row on its own (docs/YACHT_RULES.md §2, §9): what a press asks
 * for, what each die announces, and when the tumble plays.
 *
 * The toggle arrives as a spy, so a press is judged by what it asked the game
 * to do. Keyboard holds go through the game screen's `useGameKeys` adapter,
 * which calls the same handler — YachtRoot.test.tsx drives that path.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { LastRoll } from '../../state/GameContext';
import { YachtDice } from './YachtDice';

const DICE = [2, 5, 5, 1, 6];

function renderDice({
  held = [false, false, false, false, false],
  rolled = true,
  canHold = true,
  lastRoll = null,
}: {
  held?: readonly boolean[];
  rolled?: boolean;
  canHold?: boolean;
  lastRoll?: LastRoll | null;
} = {}) {
  const onToggle = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <YachtDice
        dice={DICE}
        held={held}
        rolled={rolled}
        canHold={canHold}
        lastRoll={lastRoll}
        onToggle={onToggle}
      />
    </SettingsProvider>,
  );
  const dice = within(screen.getByRole('group', { name: 'Dice' })).getAllByRole('button');
  return { dice, onToggle, view };
}

/** jsdom has no matchMedia, which the dice read as "skip animations". */
function stubMotionAllowed() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('holding a die (§2)', () => {
  it('asks to toggle the die that was pressed', () => {
    const { dice, onToggle } = renderDice();
    fireEvent.click(dice[3]!);
    expect(onToggle).toHaveBeenCalledWith(3);
  });

  it('announces position, face and hold, and marks the hold as pressed (§9)', () => {
    const { dice } = renderDice({ held: [false, true, false, false, false] });
    expect(dice[0]).toHaveAccessibleName('Die 1: 2');
    expect(dice[0]).toHaveAttribute('aria-pressed', 'false');
    expect(dice[1]).toHaveAccessibleName('Die 2: 5, held');
    expect(dice[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('draws no faces and takes no presses before the first throw', () => {
    const { dice, onToggle } = renderDice({ rolled: false, canHold: false });
    expect(dice[4]).toHaveAccessibleName('Die 5: not rolled yet');
    expect(dice[4]).toBeDisabled();
    expect(dice[4]!.querySelectorAll('.yt-pip-on')).toHaveLength(0);
    fireEvent.click(dice[4]!);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('draws the face as pips, not as a digit', () => {
    const { dice } = renderDice();
    expect(dice[4]!.querySelectorAll('.yt-pip-on')).toHaveLength(6);
    expect(dice[4]).not.toHaveTextContent('6');
  });
});

describe('the tumble (§9)', () => {
  const tumbling = () => document.querySelectorAll('.yt-die-tumble').length;

  it('plays on the dice the throw changed, and not on the kept ones', () => {
    stubMotionAllowed();
    renderDice({
      held: [true, false, false, true, false],
      lastRoll: { rollIndex: 2, rolled: [false, true, true, false, true] },
    });
    expect(tumbling()).toBe(3);
  });

  it('does not replay when a die is kept after the throw', () => {
    stubMotionAllowed();
    const lastRoll: LastRoll = { rollIndex: 1, rolled: [true, true, true, true, true] };
    const { view } = renderDice({ lastRoll });
    const faceBefore = document.querySelector('.yt-die-face');
    view.rerender(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <YachtDice
          dice={DICE}
          held={[true, false, false, false, false]}
          rolled
          canHold
          lastRoll={lastRoll}
          onToggle={vi.fn()}
        />
      </SettingsProvider>,
    );
    // The same element, so its animation does not start over.
    expect(document.querySelector('.yt-die-face')).toBe(faceBefore);
  });

  it('is skipped under Reduced Motion', () => {
    // No matchMedia stub: jsdom's own state, read as "skip animations".
    renderDice({ lastRoll: { rollIndex: 1, rolled: [true, true, true, true, true] } });
    expect(tumbling()).toBe(0);
  });
});
