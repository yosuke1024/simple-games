/**
 * A Club House challenge, opened through the Root (docs/WATER_SORT_RULES.md
 * §14, docs/architecture/club.md §6-2): the deal the challenge names, played
 * in its own slot, refused when this version deals other tubes from the same
 * seed, and kept out of every personal record when it is sorted.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordGameCompleted } from '@/services/review';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { boardDigestOf, createClubSession, TUBE_CAPACITY, type Tubes } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { WS_STORAGE_KEYS } from '../storage/schemas';
import { WaterSortRoot, type WaterSortChallengeStart } from './WaterSortRoot';

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
vi.mock('@/services/review', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/review')>()),
  recordGameCompleted: vi.fn(),
}));

const SEED = 'water-club-root-test';
const truth = createClubSession({ tier: 'easy' }, SEED);
const challenge: WaterSortChallengeStart = {
  seed: SEED,
  params: { tier: 'easy' },
  boardDigest: boardDigestOf(truth),
};

const tutorialDone = {
  [WS_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

function open(initial: Record<string, string>, start: WaterSortChallengeStart = challenge) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WaterSortRoot onExit={onExit} kv={createMemoryKV(initial)} challenge={start} />
    </SettingsProvider>,
  );
  return { onExit };
}

const tube = (n: number) => screen.getByRole('button', { name: new RegExp(`^Tube ${n},`) });
const tubesOnScreen = () => screen.queryAllByRole('button', { name: /^Tube \d+,/ });
const MISMATCH = 'This challenge was made with a different version of the game.';

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.mocked(recordGameCompleted).mockClear();
});

describe('a Club House challenge (§14)', () => {
  it('opens straight onto the challenge’s deal', async () => {
    open(tutorialDone);
    expect(await screen.findByText('Club House')).toBeInTheDocument();
    expect(tubesOnScreen()).toHaveLength(truth.tubes.length);
    expect(deviceStore.has(WS_STORAGE_KEYS.stats)).toBe(false);
  });

  it('refuses a deal this version makes differently, and goes back', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone, { ...challenge, boardDigest: 'ws1:00000000' });
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument();
    expect(tubesOnScreen()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('refuses params that are not this game’s', async () => {
    open(tutorialDone, { ...challenge, params: { tier: 'extreme' } });
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen it', async () => {
    const user = userEvent.setup();
    open({});
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    expect(screen.getByText('Club House')).toBeInTheDocument();
  });

  it('keeps a sorted challenge out of statistics, progress and the review count', async () => {
    const user = userEvent.setup();
    // The same challenge, one pour from sorted, as its slot would hold it:
    // every colour home but one unit of the first, waiting in a spare tube.
    const colors = truth.colors;
    const tubes: Tubes = truth.tubes.map((_, index) => {
      if (index === 0) return new Array<number>(TUBE_CAPACITY - 1).fill(0);
      if (index < colors) return new Array<number>(TUBE_CAPACITY).fill(index);
      return index === colors ? [0] : [];
    });
    const nearly = { ...truth, tubes, moveCount: 11, elapsedSeconds: 42 };
    const record = JSON.stringify(toPersisted(nearly, Date.now()));
    deviceStore.set(WS_STORAGE_KEYS.clubGame, record);
    open({ ...tutorialDone, [WS_STORAGE_KEYS.clubGame]: record });
    await screen.findByText('Club House');

    await user.click(tube(colors + 1));
    await user.click(tube(1));
    const dialog = await screen.findByRole('alertdialog', { name: 'Sorted!' });
    expect(within(dialog).getByText('12')).toBeInTheDocument();
    expect(within(dialog).queryByText(/best/i)).not.toBeInTheDocument();
    expect(deviceStore.has(WS_STORAGE_KEYS.stats)).toBe(false);
    expect(deviceStore.has(WS_STORAGE_KEYS.progress)).toBe(false);
    expect(deviceStore.has(WS_STORAGE_KEYS.clubGame)).toBe(false);
    expect(recordGameCompleted).not.toHaveBeenCalled();
  });

  it('goes back to where the challenge came from', async () => {
    const user = userEvent.setup();
    const { onExit } = open(tutorialDone);
    await screen.findByText('Club House');
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
