/**
 * The screens over a real match (docs/BACKGAMMON_RULES.md §2, §5, §9): the
 * first launch teaches then starts a match, the dice are the player's button,
 * a step is two taps, the CPU answers on its beats, and leaving saves a
 * record the loader replays.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { canonicalRecordOf, restoreSession, type PersistedMatch } from '../game/persistence';
import { playRound } from '../game/selfPlay';
import { createSession } from '../game/session';
import { PLAYER } from '../game/types';
import { CPU_FIRST_STEP_MS, CPU_ROLL_DELAY_MS, CPU_STEP_MS } from '../state/GameContext';
import { BK_STORAGE_KEYS } from '../storage/schemas';
import { BackgammonRoot } from './BackgammonRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote has to stand behind both.
 */
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
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BackgammonRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { ...view, onExit };
}

const tutorialDone = {
  [BK_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A match a few rounds in, resting at the player's throw, as the loader sees it. */
function midMatchRecord(): PersistedMatch {
  let session = createSession('normal', 'backgammon-uitest');
  for (let round = 0; round < 3; round++) session = playRound(session);
  const record = canonicalRecordOf(session, 1);
  if (record === null) throw new Error('fixture match ended early');
  return record;
}

const savedGame = {
  ...tutorialDone,
  [BK_STORAGE_KEYS.game]: JSON.stringify(midMatchRecord()),
};

/** Lets the local reads, and the fire-and-forget saves they trigger, resolve. */
const settle = () => act(async () => undefined);

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

const board = () => screen.getByRole('group', { name: 'Backgammon board' });
const pickable = () =>
  within(board())
    .getAllByRole('button')
    .filter((button) => !button.hasAttribute('disabled'));

/** Winds through the CPU's beats until the throw is the player's or the match is over. */
async function settleCpu() {
  for (let beats = 0; beats < 60; beats++) {
    if (screen.queryByRole('button', { name: 'Roll' }) || screen.queryByRole('alertdialog')) return;
    if (pickable().length > 0) return;
    await tick(Math.max(CPU_ROLL_DELAY_MS, CPU_FIRST_STEP_MS, CPU_STEP_MS));
  }
}

describe('BackgammonRoot', () => {
  beforeEach(() => {
    deviceStore.clear();
    // Auto-advancing fake timers: `findBy*` keeps working, and the CPU's
    // beats can still be stepped by hand on the beats the rules give them.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('opens on Quick Rules the first time, and the last step starts a match', async () => {
    renderGame();
    await settle();
    expect(await screen.findByRole('heading', { name: 'How to Play' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    // The opening is thrown from the dice (§1).
    expect(screen.getByRole('button', { name: 'Roll for the opening' })).toBeTruthy();
    expect(JSON.parse(deviceStore.get(BK_STORAGE_KEYS.flags) ?? '{}')).toMatchObject({
      tutorialCompleted: true,
    });
  });

  it('throws, offers steps, plays one, and writes a record the loader replays', async () => {
    renderGame(tutorialDone);
    await settle();
    fireEvent.click(await screen.findByRole('button', { name: 'Normal' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Roll for the opening' }));
    await settle();
    expect(screen.getByRole('status').textContent).toMatch(/Opening roll/);
    await settleCpu();
    const roll = screen.queryByRole('button', { name: 'Roll' });
    if (roll) {
      fireEvent.click(roll);
      await settle();
    }
    // A throw with a legal step offers at least one checker to pick up (§7),
    // and picking it up lights the points it may go to.
    const candidates = pickable();
    expect(candidates.length).toBeGreaterThan(0);
    fireEvent.click(candidates[0]!);
    const targets = within(board())
      .getAllByRole('button')
      .filter((button) => /^Move to point|^Bear off$/.test(button.getAttribute('aria-label') ?? ''));
    expect(targets.length).toBeGreaterThan(0);
    fireEvent.click(targets[0]!);
    await settle();
    // 待った is offered mid-turn (§6) when a die is still to play.
    const takeBack = screen.getByRole('button', { name: 'Take back' });
    if (!takeBack.hasAttribute('disabled')) {
      fireEvent.click(takeBack);
      await settle();
      expect(pickable().length).toBeGreaterThan(0);
    }
    const raw = deviceStore.get(BK_STORAGE_KEYS.game);
    expect(raw).toBeDefined();
    const restored = restoreSession(JSON.parse(raw!) as PersistedMatch);
    expect(restored).not.toBeNull();
  });

  it('resumes a saved match from the home, on the opponent it was started against', async () => {
    renderGame(savedGame);
    await settle();
    const resume = await screen.findByRole('button', { name: /Normal/ });
    expect(resume.textContent).toContain('Resume');
    fireEvent.click(resume);
    await settle();
    expect(board()).toBeTruthy();
    // The player is about to throw: the dice are the button (§2.1).
    expect(screen.getByRole('button', { name: 'Roll' })).toBeTruthy();
    const record = midMatchRecord();
    const session = restoreSession(record)!;
    expect(session.phase).toEqual({ kind: 'awaitingRoll', side: PLAYER });
  });

  it('asks before replacing a match in progress with another opponent', async () => {
    renderGame(savedGame);
    await settle();
    fireEvent.click(await screen.findByRole('button', { name: /Easy/ }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens straight onto the saved match from a home-screen shortcut (issue #113)', async () => {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BackgammonRoot onExit={vi.fn()} entry="shortcut" kv={createMemoryKV(savedGame)} />
      </SettingsProvider>,
    );
    await settle();
    expect(await screen.findByRole('group', { name: 'Backgammon board' })).toBeTruthy();
    // The saved match rests at the player's throw: the dice are the button (§2.1).
    expect(screen.getByRole('button', { name: 'Roll' })).toBeTruthy();
  });

  it('opens on the home, not the board, when a shortcut finds nothing to resume', async () => {
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BackgammonRoot onExit={vi.fn()} entry="shortcut" kv={createMemoryKV(tutorialDone)} />
      </SettingsProvider>,
    );
    await settle();
    expect(await screen.findByRole('button', { name: /Normal/ })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Backgammon board' })).toBeNull();
  });
});
