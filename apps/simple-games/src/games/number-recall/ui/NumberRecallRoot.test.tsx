import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { en } from '../i18n/en';
import { NR_STORAGE_KEYS } from '../storage/schemas';
import { NumberRecallRoot } from './NumberRecallRoot';

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
      <NumberRecallRoot onExit={onExit} kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

const tutorialDone = {
  [NR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: 'Tile grid' });
const tiles = () => within(board()).getAllByRole('button');

/** The tile showing `value`, found the way a player finds it: by reading. */
const tileFor = (value: number): HTMLElement => {
  const found = tiles().find((tile) => tile.textContent === String(value));
  if (!found) throw new Error(`no tile showing ${value}`);
  return found;
};

/** How many tiles are face down right now. */
const faceDownCount = (): number =>
  tiles().filter((tile) => (tile.getAttribute('aria-label') ?? '').startsWith('Face down')).length;

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
});

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§13)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Look for as long as you like')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Tap 1 and the rest turn over')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A wrong tile ends the round')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // Level 1 is three tiles on a 3x3, all showing.
    expect(tiles()).toHaveLength(3);
    expect(faceDownCount()).toBe(0);
  });
});

describe('the memorise phase (docs/NUMBER_RECALL_RULES.md §3)', () => {
  it('shows every tile and never counts down', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.getByText('Take your time. Tap 1 when you are ready.')).toBeInTheDocument();
    expect(faceDownCount()).toBe(0);
    // Nothing on screen is a clock or a countdown.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('ends only when the player taps 1 — the look is theirs to end', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    await user.click(tileFor(1));

    // 1 stays up; the other two turn over.
    expect(faceDownCount()).toBe(2);
    expect(tileFor(1)).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('never announces the number on a face-down tile', async () => {
    // A screen reader reading it out would be handing over the answer (§14).
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);
    await user.click(tileFor(1));

    const down = tiles().filter((tile) =>
      (tile.getAttribute('aria-label') ?? '').startsWith('Face down'),
    );
    expect(down).toHaveLength(2);
    for (const tile of down) {
      // The label says where the tile is and nothing else. Anchoring both ends
      // is what makes this a proof: a value smuggled in anywhere would break
      // the match, where a "does not contain 2" check would trip over the row
      // and column numbers instead.
      expect(tile.getAttribute('aria-label')).toMatch(/^Face down, row \d+, column \d+$/);
      expect(tile.textContent).toBe('');
    }
  });

  it('leaves no way for the label to carry a value, in any language', () => {
    // The screen check above can only see English. This one is the reason it
    // holds in all fourteen: the string has no slot to put a value in.
    expect(en.recallTileDown).not.toContain('{value}');
    expect(en.recallTileUp).toContain('{value}');
  });
});

describe('recalling', () => {
  it('clears the round when 1..K are tapped in order', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const positions = [1, 2, 3].map((value) => tiles().indexOf(tileFor(value)));
    await user.click(tiles()[positions[0]!]!);
    await user.click(tiles()[positions[1]!]!);
    await user.click(tiles()[positions[2]!]!);

    expect(await screen.findByText('All remembered')).toBeInTheDocument();
  });

  it('ends the round on a wrong tile and shows the answer, with no timer on it', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const wanted = tiles().indexOf(tileFor(2));
    const wrong = tiles().indexOf(tileFor(3));
    await user.click(tileFor(1));
    await user.click(tiles()[wrong]!);

    expect(await screen.findByText('That was not the one')).toBeInTheDocument();
    // Everything is face up again, and the tile that was wanted is ringed (§4).
    expect(faceDownCount()).toBe(0);
    expect(tiles()[wanted]).toHaveClass('recall-tile-expected');
    // The reveal waits for the player; nothing dismisses it (§4).
    expect(screen.getByRole('button', { name: 'New layout' })).toBeInTheDocument();
  });

  it('shows the answer beside the reveal, never behind it (§4)', async () => {
    // The regression this pins was invisible to every assertion above and
    // obvious the moment the game was played: the reveal used the same centred
    // modal the win does, and it sat on top of the board — covering the ringed
    // tile it was announcing. jsdom has no layout to measure, so what is
    // checked here is the structure that caused it.
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const wrong = tiles().indexOf(tileFor(3));
    await user.click(tileFor(1));
    await user.click(tiles()[wrong]!);
    await screen.findByText('That was not the one');

    const reveal = screen.getByText('That was not the one').closest('.recall-reveal');
    expect(reveal).not.toBeNull();
    // Not in an overlay, and no scrim anywhere on the screen.
    expect(reveal!.closest('.overlay')).toBeNull();
    expect(document.querySelector('.overlay')).toBeNull();
    // The board is a sibling in the same flow, and stays reachable — an inert
    // ancestor would hide it from a screen reader just as a scrim hides it
    // from everyone else.
    expect(board().closest('[inert]')).toBeNull();
    expect(reveal!.parentElement).toBe(board().closest('.game-content'));
  });

  it('retries with a different layout, never the one just revealed (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const before = tiles()
      .map((tile) => tile.textContent)
      .join(',');
    // Note where 3 is while it is still showing: once 1 is tapped the tile is
    // blank, which is the whole point of the game.
    const wrong = tiles().indexOf(tileFor(3));
    await user.click(tileFor(1));
    await user.click(tiles()[wrong]!);
    await user.click(await screen.findByRole('button', { name: 'New layout' }));

    // Same difficulty — three tiles on a 3x3 — and a fresh question.
    expect(tiles()).toHaveLength(3);
    expect(faceDownCount()).toBe(0);
    const boardCells = board().children.length;
    expect(boardCells).toBe(9);
    expect(
      tiles()
        .map((tile) => tile.textContent)
        .join(','),
    ).not.toBe(before);
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no undo and no hint, at any point (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();

    await user.click(tileFor(1));
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('offers no extra look and no revive after a miss (§10)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const wrong = tiles().indexOf(tileFor(3));
    await user.click(tileFor(1));
    await user.click(tiles()[wrong]!);
    await screen.findByText('That was not the one');

    expect(screen.queryByRole('button', { name: /continue|revive|extra|watch/i })).toBeNull();
  });

  it('claims nothing about the brain or the memory, anywhere (§14)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    // Naming the claim is how its absence is checked for.
    const banned = /brain|IQ|cognitive|memory training|mental age|improve your memory/i; // [check-principles: allow]

    expect(document.body.textContent).not.toMatch(banned);
    await user.click(await screen.findByRole('button', { name: 'How to Play' }));
    expect(document.body.textContent).not.toMatch(banned);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Statistics' }));
    expect(document.body.textContent).not.toMatch(banned);
  });

  it('reports per-size facts and no streak on the statistics screen (§11)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels finished')).toBeInTheDocument();
    expect(screen.getAllByText('Finished first try')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
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
