import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { answerDigits, questionsForLevel } from '../game';
import { QM_STORAGE_KEYS } from '../storage/schemas';
import { QuickMathRoot } from './QuickMathRoot';

const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <QuickMathRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

const tutorialDone = {
  [QM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const keypad = () => screen.getByRole('group', { name: 'Number keypad' });
const key = (digit: number) => within(keypad()).getByRole('button', { name: String(digit) });

/** The equation as it reads on screen, spaces stripped. */
const equation = (): string =>
  (document.querySelector('.qmath-question')?.textContent ?? '').replace(/\s+/g, '');

/** Types a whole number on the keypad. */
async function type(user: ReturnType<typeof userEvent.setup>, value: number) {
  for (const digit of String(value)) await user.click(key(Number(digit)));
}

/** The ten answers of level 1, in order — the test's own copy of the truth. */
const levelOneAnswers = questionsForLevel(1).map((question) => question.answer);

/** The first level whose opening question needs more than one keypress. */
function twoDigitLevel(): number {
  for (let level = 1; level <= 100; level++) {
    if (String(questionsForLevel(level)[0]!.answer).length > 1) return level;
  }
  throw new Error('no level opens with a multi-digit answer');
}

/** A progress record with the ladder opened as far as `level`. */
const unlockedTo = (level: number) => ({
  [QM_STORAGE_KEYS.progress]: JSON.stringify({
    schemaVersion: 1,
    highestUnlocked: level,
    bestSeconds: {},
    dailySeconds: {},
  }),
});

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Answer with the keypad')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('It checks itself')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Ten questions to a level')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(keypad()).toBeInTheDocument();
  });
});

describe('answering (docs/QUICK_MATH_RULES.md §3)', () => {
  it('moves on once the answer is typed in full', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const first = equation();
    await type(user, levelOneAnswers[0]!);

    expect(screen.getByText('1 / 10')).toBeInTheDocument();
    expect(equation()).not.toBe(first);
  });

  it('keeps the same question after a wrong answer, and takes nothing away', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const before = equation();
    const answer = levelOneAnswers[0]!;
    // A different number of the same length, so it is judged on the same tap.
    await type(user, answer === 9 ? 8 : answer + 1);

    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(equation()).toBe(before);
    // No count of mistakes on screen, and nothing shouting (§4).
    expect(screen.queryByText('Wrong answers')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('takes back a typed digit before the answer is judged, and no further', async () => {
    // The backspace is a correction, not an undo (§8): once an answer has been
    // judged it is gone, and there is nothing left to take back.
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const back = screen.getByRole('button', { name: 'Delete last digit' });
    expect(back).toBeDisabled();

    await user.click(key(1));
    // Only a two-or-more digit answer leaves anything in the box to delete.
    if (!back.hasAttribute('disabled')) {
      await user.click(back);
      expect(back).toBeDisabled();
    }
  });

  it('finishes the set and reports time and wrong answers', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    for (const answer of levelOneAnswers) await type(user, answer);

    expect(await screen.findByText('Set complete')).toBeInTheDocument();
    expect(screen.getByText('Wrong answers')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });
});

describe('the keypad (docs/QUICK_MATH_RULES.md §3, §12)', () => {
  it('offers ten digits, a backspace, and no minus sign or point', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    for (let digit = 0; digit <= 9; digit++) expect(key(digit)).toBeInTheDocument();
    expect(within(keypad()).getByRole('button', { name: 'Delete last digit' })).toBeInTheDocument();
    // Eleven controls: nothing here can enter a negative or a fraction, which
    // is the same decision as the generator's invariants (§5).
    expect(within(keypad()).getAllByRole('button')).toHaveLength(11);
    expect(within(keypad()).queryByText('−')).not.toBeInTheDocument();
    expect(within(keypad()).queryByText('.')).not.toBeInTheDocument();
  });

  it('never asks for an answer the keypad cannot type', () => {
    // The screen-level twin of the generator's property test: whatever the
    // level, the answer is a non-negative whole number of at most three digits.
    for (let level = 1; level <= 100; level++) {
      for (const question of questionsForLevel(level)) {
        expect(Number.isInteger(question.answer)).toBe(true);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(answerDigits(question)).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no hint and no undo, at any point (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^undo$/i })).not.toBeInTheDocument();

    await type(user, levelOneAnswers[0]!);
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^undo$/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no countdown while playing (§4)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });

  it('claims nothing about the brain, anywhere in the game (§14)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    // Naming the claim is how its absence is checked for.
    const banned = /brain|IQ|cognitive|mental age|improve your/i; // [check-principles: allow]

    expect(document.body.textContent).not.toMatch(banned);
    await user.click(await screen.findByRole('button', { name: 'How to Play' }));
    expect(document.body.textContent).not.toMatch(banned);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(document.body.textContent).not.toMatch(banned);
  });

  it('reports a section per band plus the daily, and no streak (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Adding and subtracting')).toBeInTheDocument();
    expect(screen.getByText('Times tables')).toBeInTheDocument();
    expect(screen.getByText('Dividing')).toBeInTheDocument();
    expect(screen.getByText('Missing number')).toBeInTheDocument();
    expect(screen.getByText('Mixed')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getAllByText('Wrong answers in total')).toHaveLength(6);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('resuming (docs/QUICK_MATH_RULES.md §9)', () => {
  it('comes back to the question it was left on', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await type(user, levelOneAnswers[0]!);
    await type(user, levelOneAnswers[1]!);
    const third = equation();

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(await screen.findByRole('button', { name: /Level 1/ }));

    expect(screen.getByText('2 / 10')).toBeInTheDocument();
    expect(equation()).toBe(third);
  });

  it('empties the box on the way out, rather than saving half an answer', async () => {
    // §9: the digits are interface state and are never persisted. Only a
    // multi-digit answer leaves anything in the box to lose, so this runs on
    // the first level that opens with one.
    const level = twoDigitLevel();
    const user = userEvent.setup();
    renderGame({ ...tutorialDone, ...unlockedTo(level) });
    await user.click(await screen.findByRole('button', { name: new RegExp(`Level ${level}`) }));

    await user.click(key(1));
    expect(document.querySelector('.qmath-blank')?.textContent).toBe('1');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(await screen.findByRole('button', { name: new RegExp(`Level ${level}`) }));

    expect(screen.getByText('0 / 10')).toBeInTheDocument();
    expect(document.querySelector('.qmath-blank')?.textContent).toBe('');
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
