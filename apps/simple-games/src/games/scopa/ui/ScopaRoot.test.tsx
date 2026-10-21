/**
 * The playable game, end to end through its root (docs/SCOPA_RULES.md §2.5,
 * §4.2, §7, §9, §10, §11): Quick Rules, the lift-and-take machine by touch and
 * by keyboard, the CPU's beat as a session effect, the settlement that waits
 * for a tap, the result card, the ↻ dialog, the home and the statistics, the
 * shortcut door, and the play clock booked once whichever way the game is left.
 *
 * Positions are reached by play, never crafted: a saved match is replayed from
 * its seed and refused if any card of it could not have been played
 * (game/serialize.ts), so ui/testScenarios.ts drives real matches forward to
 * the positions these tests need and hands them to the root as a save.
 *
 * jsdom has no `matchMedia`, which the shell reads as Reduced Motion
 * (ui/useReducedMotion.ts): the settlement and the result card appear at once
 * and no fold is drawn, unless a test stubs `matchMedia` to say otherwise.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sounds } from '@/services/sound';
import { SettingsProvider, useSettings, type SettingsContextValue } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { stubMatchMedia, trackResources } from '@/test/lifecycle';
import { RESULT_REVEAL_MS } from '@/ui/useResultReveal';
import {
  beatOwed,
  canDealNextDeal,
  captureOptions,
  CPU,
  doPlay,
  isCpuTurn,
  isPlayersTurn,
  opponentOf,
  YOU,
  type Card,
  type Move,
  type ScopaSession,
} from '../game';
import { CPU_DELAY_MS } from '../state/GameContext';
import { toPersisted } from '../storage/gamePersistence';
import { SC_STORAGE_KEYS, type SavedMatch, type Stats } from '../storage/schemas';
import { ScopaRoot } from './ScopaRoot';
import { driverMove, findPosition, playerCardWith } from './testScenarios';

/**
 * A stand-in for the device store. The `kv` prop is a load-side seam only —
 * saves always go to Capacitor Preferences — so a test that reads back what a
 * save wrote has to stand behind both.
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

// ---------- positions ----------

/** The player's turn, with a card that takes exactly one way, and the CPU to answer it. */
const ONE_WAY = findPosition(
  (s) =>
    playerCardWith((o) => o.length === 1 && o[0]!.length === 1)(s) &&
    s.deal.hands[YOU].length >= 2 &&
    s.deal.plays.length % 6 !== 5,
);
/** A card with two or more same-value cards to choose from. */
const TWO_SAME = findPosition(playerCardWith((o) => o.length >= 2 && o[0]!.length === 1));
/** A card with two or more sums to choose from. */
const TWO_SUMS = findPosition(playerCardWith((o) => o.length >= 2 && o[0]!.length >= 2));
/** A card that takes nothing, and another that takes something. */
const PLACE = findPosition(
  (s) => playerCardWith((o) => o.length === 0)(s) && playerCardWith((o) => o.length > 0)(s),
);
/** The CPU's card is owed. */
const CPU_TO_PLAY = findPosition((s) => isCpuTurn(s) && s.deal.plays.length > 0);
/** Both hands are empty and three cards each are owed. */
const REFILL = findPosition((s) => beatOwed(s) === 'refill');
/** The player's card is the deal's thirty-sixth, and the match goes on after it. */
const LAST_CARD = findPosition(
  (s) =>
    isPlayersTurn(s) &&
    s.deal.plays.length === 35 &&
    doPlay(s, driverMove(s))!.session.status === 'playing',
);
/** The player's card is the deal's thirty-sixth, and it decides the match. */
const DECIDING = findPosition(
  (s) =>
    isPlayersTurn(s) &&
    s.deal.plays.length === 35 &&
    doPlay(s, driverMove(s))!.session.status !== 'playing',
);
/** The same, and the thirty-sixth card leaves cards on the table for the last taker. */
const LAST_CARD_SWEPT = findPosition((s) => {
  if (!isPlayersTurn(s) || s.deal.plays.length !== 35) return false;
  const outcome = doPlay(s, driverMove(s))!;
  return outcome.session.status === 'playing' && (outcome.dealResult?.sweep?.cards.length ?? 0) > 0;
});
/** A deal settled and waiting for its tap. */
const SETTLED = findPosition((s) => canDealNextDeal(s));

const cardOfShape = (s: ScopaSession, shape: (o: ReturnType<typeof captureOptions>) => boolean) =>
  s.deal.hands[YOU].find((card) => shape(captureOptions(s.deal.table, card)))!;

// ---------- mounting ----------

const tutorialDone = {
  [SC_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const saved = (session: ScopaSession) => ({
  ...tutorialDone,
  [SC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
});

function renderGame(initial: Record<string, string> = {}, reducedMotion = false) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  let settings!: SettingsContextValue;
  /** Hands the test the settings, to change them mid-match as the player can. */
  function Settings() {
    settings = useSettings();
    return null;
  }
  render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), reducedMotion }}>
      <Settings />
      <ScopaRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv, settings: () => settings };
}

function renderShortcut(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ScopaRoot onExit={onExit} entry="shortcut" kv={createMemoryKV(initial)} />
    </SettingsProvider>,
  );
  return { onExit };
}

/** Launches against the device store, the way a player's phone does. */
function launch(entry?: 'shortcut') {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ScopaRoot onExit={vi.fn()} entry={entry} />
    </SettingsProvider>,
  );
}

/** Lets the local reads and the saves they trigger resolve (promises, not timers). */
const settle = () => act(async () => undefined);

async function resume(user: ReturnType<typeof userEvent.setup>, session: ScopaSession) {
  const mounted = renderGame(saved(session));
  await user.click(await screen.findByRole('button', { name: /Resume/ }));
  return mounted;
}

const hand = () => screen.getByRole('group', { name: 'Your hand' });
const table = () => screen.getByRole('group', { name: 'Table' });
const handCard = (card: Card) => hand().querySelector<HTMLButtonElement>(`[data-card="${card}"]`)!;
const tableCard = (card: Card) =>
  table().querySelector<HTMLButtonElement>(`[data-card="${card}"]`)!;
const placeSlot = () => screen.getByRole('button', { name: 'Place here' });
const spoken = () => screen.getByRole('status').textContent ?? '';
const visibleLine = () => document.querySelector('.sc-line-text')?.textContent ?? '';
/** Every button on the table, the "place here" slot included. */
const tableButtons = () => within(table()).getAllByRole('button');

function storedSave(): SavedMatch | null {
  const raw = deviceStore.get(SC_STORAGE_KEYS.game);
  return raw === undefined ? null : (JSON.parse(raw) as SavedMatch);
}

function storedStats(): Stats | null {
  const raw = deviceStore.get(SC_STORAGE_KEYS.stats);
  return raw === undefined ? null : (JSON.parse(raw) as Stats);
}

/** Plays a move through the screen, the way a player would. */
async function playViaUi(user: ReturnType<typeof userEvent.setup>, s: ScopaSession, move: Move) {
  const options = captureOptions(s.deal.table, move.card);
  await user.click(handCard(move.card));
  if (options.length === 0) await user.click(placeSlot());
  else if (options.length === 1) await user.click(handCard(move.card));
  else if (options[0]!.length === 1) await user.click(tableCard(move.captured[0]!));
  else for (const card of move.captured) await user.click(tableCard(card));
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  if (state === 'visible') Reflect.deleteProperty(document, 'visibilityState');
}

/** The app goes to background and stays there until told otherwise. */
const background = () => setVisibility('hidden');

afterEach(async () => {
  cleanup();
  Reflect.deleteProperty(document, 'visibilityState');
  // Unmounting saves (docs/GAME_LIFECYCLE.md「アンマウントで計上する」), and
  // saves are fire-and-forget. Let them land before wiping the store.
  await act(async () => undefined);
  deviceStore.clear();
});

// ---------- the first launch ----------

describe('first run', () => {
  it('shows three Quick Rules steps and deals a match right after', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Take')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Place, or sweep')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Eleven to win')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(hand()).toBeInTheDocument();
    expect(within(hand()).getAllByRole('button')).toHaveLength(3);
    // No clock, no undo, no hint anywhere on the table.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    await settle();
    expect(storedStats()?.played).toBe(1);
    expect(storedSave()).not.toBeNull();
  });

  it('resumes a suspended match on Start Playing, rather than replace it unasked', async () => {
    const user = userEvent.setup();
    renderGame({ [SC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(ONE_WAY, 1)) });
    await user.click(await screen.findByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    for (const card of ONE_WAY.deal.hands[YOU]) expect(handCard(card)).toBeInTheDocument();
    await settle();
    expect(storedStats()).toBeNull();
  });
});

// ---------- the lift-and-take machine ----------

describe('taking (§2.5)', () => {
  it('lifts a card, marks what it can take, and takes it on the second tap', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    const [target] = captureOptions(ONE_WAY.deal.table, card)[0]!;

    expect(handCard(card)).toHaveAccessibleName(/, can take$/);
    expect(tableCard(target!)).toBeDisabled();
    await user.click(handCard(card));
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'true');
    expect(tableCard(target!)).toBeEnabled();
    expect(tableCard(target!)).toHaveAccessibleName(/, can be taken$/);
    // Only the card it can take is offered; the rest are not pressable.
    for (const other of ONE_WAY.deal.table.filter((c) => c !== target)) {
      expect(tableCard(other)).toBeDisabled();
    }
    expect(placeSlot()).toBeDisabled();
    expect(visibleLine()).toBe('Tap again to take');

    await user.click(handCard(card));
    expect(hand().querySelector(`[data-card="${card}"]`)).toBeNull();
    expect(table().querySelector(`[data-card="${target}"]`)).toBeNull();
    await settle();
    expect(storedSave()?.moveCount).toBe(ONE_WAY.moveCount + 1);
  });

  it('also takes it from a tap on the marked table card', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    const [target] = captureOptions(ONE_WAY.deal.table, card)[0]!;

    await user.click(handCard(card));
    await user.click(tableCard(target!));
    expect(table().querySelector(`[data-card="${target}"]`)).toBeNull();
  });

  it('chooses between same-value cards on the table, and a second tap on the hand lowers', async () => {
    const user = userEvent.setup();
    await resume(user, TWO_SAME);
    const card = cardOfShape(TWO_SAME, (o) => o.length >= 2 && o[0]!.length === 1);
    const choices = captureOptions(TWO_SAME.deal.table, card).map((o) => o[0]!);

    await user.click(handCard(card));
    expect(visibleLine()).toBe('Choose which card to take');
    for (const choice of choices) expect(tableCard(choice)).toBeEnabled();
    // Several ways to take: the second tap does not guess, it lowers.
    await user.click(handCard(card));
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'false');
    for (const choice of choices) expect(tableCard(choice)).toBeDisabled();

    await user.click(handCard(card));
    await user.click(tableCard(choices[1]!));
    expect(table().querySelector(`[data-card="${choices[1]}"]`)).toBeNull();
    expect(tableCard(choices[0]!)).toBeInTheDocument();
  });

  it('builds a sum card by card, lets a card back out, and takes it when the sum is reached', async () => {
    const user = userEvent.setup();
    await resume(user, TWO_SUMS);
    const card = cardOfShape(TWO_SUMS, (o) => o.length >= 2 && o[0]!.length >= 2);
    const options = captureOptions(TWO_SUMS.deal.table, card);
    const chosen = options[options.length - 1]!;

    await user.click(handCard(card));
    expect(visibleLine()).toMatch(/^Pick cards that add up to \d+ \(0 so far\)$/);
    await user.click(tableCard(chosen[0]!));
    expect(tableCard(chosen[0]!)).toHaveAccessibleName(/, in your group$/);
    expect(tableCard(chosen[0]!)).toHaveAttribute('aria-pressed', 'true');
    // Every card still offered completes some capture with the group so far.
    for (const other of TWO_SUMS.deal.table) {
      const fits = options.some((o) => o.includes(chosen[0]!) && o.includes(other));
      expect(tableCard(other).disabled, `card ${other}`).toBe(!fits);
    }
    // Out again, and back in.
    await user.click(tableCard(chosen[0]!));
    expect(tableCard(chosen[0]!)).toHaveAttribute('aria-pressed', 'false');
    for (const part of chosen) await user.click(tableCard(part));

    for (const part of chosen) expect(table().querySelector(`[data-card="${part}"]`)).toBeNull();
    await settle();
    const plays = storedSave()!.deal.split('/')[2]!.split('.');
    const last = plays[plays.length - 1]!;
    const encoded = [card, ...chosen].map((c) => c.toString(36).padStart(2, '0')).join('');
    expect(last).toBe(encoded);
  });

  it('places only through the slot: a second tap on a card that takes nothing lowers it', async () => {
    const user = userEvent.setup();
    await resume(user, PLACE);
    const card = cardOfShape(PLACE, (o) => o.length === 0);
    const taker = cardOfShape(PLACE, (o) => o.length > 0);

    expect(handCard(card)).toHaveAccessibleName(/, cannot take now$/);
    expect(handCard(card)).toBeEnabled();
    // While a card that can take is lifted, the slot is not offered (§2.2 rule 4).
    await user.click(handCard(taker));
    expect(placeSlot()).toBeDisabled();

    await user.click(handCard(card));
    expect(placeSlot()).toBeEnabled();
    expect(visibleLine()).toBe('It takes nothing: place it, or pick another card');
    await user.click(handCard(card));
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'false');
    expect(table().querySelector(`[data-card="${card}"]`)).toBeNull();

    await user.click(handCard(card));
    await user.click(placeSlot());
    expect(tableCard(card)).toBeInTheDocument();
    expect(hand().querySelector(`[data-card="${card}"]`)).toBeNull();
  });

  it('plays by keyboard alone: Tab, Enter, Space and Escape', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    const [target] = captureOptions(ONE_WAY.deal.table, card)[0]!;

    const tabTo = async (element: HTMLElement) => {
      for (let i = 0; i < 40 && document.activeElement !== element; i++) await user.tab();
      expect(document.activeElement).toBe(element);
    };
    await tabTo(handCard(card));
    await user.keyboard('{Enter}');
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'false');
    expect(tableCard(target!)).toBeDisabled();

    await user.keyboard(' ');
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'true');
    await tabTo(tableCard(target!));
    await user.keyboard(' ');
    expect(table().querySelector(`[data-card="${target}"]`)).toBeNull();

    // The played card took its button with it. When the turn comes back,
    // focus is on the first playable hand card — no tabbing from the top.
    await waitFor(() => expect(spoken()).toMatch(/^CPU (played|placed) /));
    const first = within(hand()).getAllByRole('button')[0]!;
    await waitFor(() => expect(document.activeElement).toBe(first));
    expect(first).toBeEnabled();
  });

  it('leaves focus where the player put it while the CPU answered', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    handCard(card).focus();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');
    expect(hand().querySelector(`[data-card="${card}"]`)).toBeNull();

    const newGame = screen.getByRole('button', { name: 'New Game' });
    newGame.focus();
    await waitFor(() => expect(spoken()).toMatch(/^CPU (played|placed) /));
    await settle();
    expect(document.activeElement).toBe(newGame);
  });

  it('comes back from the home with nothing lifted and nothing on the table offered', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    await user.click(handCard(card));
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: /Resume/ }));
    for (const button of within(hand()).getAllByRole('button')) {
      expect(button).toHaveAttribute('aria-pressed', 'false');
    }
    for (const button of tableButtons()) expect(button).toBeDisabled();
    expect(visibleLine()).toBe('Your turn: play a card');
  });
});

describe('the band (§7, §11.2)', () => {
  it('reads each row as one sentence from the catalog, and counts without plurals', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const row =
      /^(You|CPU): score \d+; this deal: cards \d+, Diamonds \d+, scopas \d+(, has the 7♦)?(, dealer)?$/;
    const rows = screen.getAllByRole('group', { name: /: score / });
    expect(rows).toHaveLength(2);
    for (const each of rows) expect(each.getAttribute('aria-label')).toMatch(row);
    const dealer = ONE_WAY.deal.dealer === YOU ? 'You' : 'CPU';
    expect(
      screen.getByRole('group', { name: new RegExp(`^${dealer}: .*, dealer$`) }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: `Cards in the CPU’s hand: ${ONE_WAY.deal.hands[CPU].length}`,
      }),
    ).toBeInTheDocument();
    // The ♦ count is in the band's ink, not the card red (which is for card faces).
    for (const tally of document.querySelectorAll('.sc-tally-diamonds')) {
      expect(tally).not.toHaveClass('sc-red');
    }
  });
});

// ---------- the table's beats ----------

describe("the CPU's beat (§4.2)", () => {
  it("answers the player's card after one beat, with nothing pressable meanwhile", async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    await user.click(handCard(card));
    await user.click(handCard(card));

    // The CPU's turn: no card in the hand, no card on the table and not the
    // slot is pressable, and the line says whose turn.
    for (const button of within(hand()).getAllByRole('button')) expect(button).toBeDisabled();
    expect(tableButtons().length).toBeGreaterThan(1);
    for (const button of tableButtons()) expect(button).toBeDisabled();
    expect(placeSlot()).toBeDisabled();
    await waitFor(() => expect(spoken()).toMatch(/^CPU (played|placed) /));
    await settle();
    expect(storedSave()?.moveCount).toBe(ONE_WAY.moveCount + 2);
  });

  it('lets a lift replace the CPU’s line at once, on screen and aloud', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    await user.click(handCard(card));
    await user.click(handCard(card));
    await waitFor(() => expect(spoken()).toMatch(/^CPU (played|placed) /));

    // Well inside the CPU line's 2.4s: the player's own guidance wins.
    const next = within(hand()).getAllByRole('button')[0]!;
    await user.click(next);
    expect(next).toHaveAttribute('aria-pressed', 'true');
    expect(visibleLine()).toMatch(
      /^(Tap again to take|Choose which card to take|Pick cards that add up to \d+ \(0 so far\)|It takes nothing: place it, or pick another card)$/,
    );
    expect(spoken()).toBe(visibleLine());
    expect(document.querySelectorAll('.sc-line .sc-mini')).toHaveLength(0);
  });

  it('picks up a match saved on the CPU’s turn with no path of its own', async () => {
    const user = userEvent.setup();
    await resume(user, CPU_TO_PLAY);
    await waitFor(() => expect(spoken()).toMatch(/^CPU (played|placed) /));
    await settle();
    expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount + 1);
  });

  it('deals three cards each as a beat of its own', async () => {
    const user = userEvent.setup();
    await resume(user, REFILL);
    expect(visibleLine()).toBe('Dealing three cards each');
    expect(within(hand()).queryAllByRole('button')).toHaveLength(0);
    await waitFor(() => expect(within(hand()).getAllByRole('button')).toHaveLength(3));
  });

  it('stops in the background and re-arms the full beat on return — never a backlog', async () => {
    deviceStore.set(SC_STORAGE_KEYS.flags, tutorialDone[SC_STORAGE_KEYS.flags]!);
    deviceStore.set(SC_STORAGE_KEYS.game, JSON.stringify(toPersisted(CPU_TO_PLAY, 1)));
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
      background();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CPU_DELAY_MS * 4);
      });
      await settle();
      expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount);

      setVisibility('visible');
      await act(async () => {
        await vi.advanceTimersByTimeAsync(CPU_DELAY_MS - 1);
      });
      await settle();
      expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });
      await settle();
      expect(storedSave()?.moveCount).toBe(CPU_TO_PLAY.moveCount + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('unmounting mid-match (docs/GAME_LIFECYCLE.md)', () => {
  it('releases the armed beat, the play clock and every listener', async () => {
    // Warm-up: module singletons register process-wide handlers on first use.
    renderGame(saved(CPU_TO_PLAY));
    fireEvent.click(await screen.findByRole('button', { name: /Resume/ }));
    cleanup();
    await settle();

    const tracker = trackResources();
    try {
      renderGame(saved(CPU_TO_PLAY));
      await settle();
      // The CPU's beat is armed and the play clock is running.
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
      expect(hand()).toBeInTheDocument();
      cleanup();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});

// ---------- the end of a deal, and of a match ----------

describe('a deal that settles', () => {
  it('lays the five categories out, saves, and waits for the next deal to be asked for', async () => {
    const user = userEvent.setup();
    await resume(user, LAST_CARD);
    await playViaUi(user, LAST_CARD, driverMove(LAST_CARD));

    const dialog = await screen.findByRole('alertdialog', { name: `Deal ${LAST_CARD.dealNumber}` });
    for (const row of ['Cards', 'Diamonds', '7♦', 'Primiera', 'Scopa', 'This deal']) {
      expect(within(dialog).getByRole('rowheader', { name: row })).toBeInTheDocument();
    }
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await settle();
    // The settled deal is saved, so a relaunch comes back to this settlement.
    expect(storedSave()!.deal.split('/')[2]!.split('.')).toHaveLength(36);

    // It does not go away by itself.
    await new Promise((resolve) => setTimeout(resolve, CPU_DELAY_MS * 2));
    expect(screen.getByRole('alertdialog', { name: /^Deal / })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Next deal' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.querySelector('.game-content')).not.toHaveAttribute('inert');
    await settle();
    const next = storedSave()!;
    expect(next.dealNumber).toBe(LAST_CARD.dealNumber + 1);
    expect(next.dealer).toBe(opponentOf(LAST_CARD.deal.dealer));
    // Dealing the next deal is not a card played.
    expect(next.moveCount).toBe(LAST_CARD.moveCount + 1);
  });

  it('comes back to the settlement when the match was left on it', async () => {
    const user = userEvent.setup();
    await resume(user, SETTLED);
    expect(
      await screen.findByRole('alertdialog', { name: `Deal ${SETTLED.dealNumber}` }),
    ).toBeInTheDocument();
  });
});

describe('a match that ends', () => {
  it('skips the settlement, states the result with the deciding deal, books it and clears the save', async () => {
    const user = userEvent.setup();
    await resume(user, DECIDING);
    const after = doPlay(DECIDING, driverMove(DECIDING))!.session;
    await playViaUi(user, DECIDING, driverMove(DECIDING));

    const title = after.status === 'won' ? 'You won the match' : 'The CPU won the match';
    const result = await screen.findByRole('alertdialog', { name: title });
    expect(screen.queryByRole('alertdialog', { name: /^Deal / })).not.toBeInTheDocument();
    expect(within(result).getByText('The last deal')).toBeInTheDocument();
    expect(within(result).getByRole('rowheader', { name: 'Primiera' })).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(within(result).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    // Facts only: no praise for a win, no scolding for a loss.
    expect(result.textContent).not.toMatch(/nice|great|well done|congrat|unlucky|try harder/i);
    expect(within(result).getAllByText(String(after.scores[YOU])).length).toBeGreaterThan(0);

    await settle();
    expect(storedSave()).toBeNull();
    const stats = storedStats()!;
    expect(after.status === 'won' ? stats.wins : stats.losses).toBe(1);

    await user.click(within(result).getByRole('button', { name: 'New Game' }));
    await settle();
    expect(storedStats()!.played).toBe(1);
    expect(storedSave()!.dealNumber).toBe(1);
  });
});

// ---------- dialogs ----------

describe('the ↻ in the top bar', () => {
  it('asks before replacing the match; Escape and Cancel keep it', async () => {
    const user = userEvent.setup();
    await resume(user, ONE_WAY);
    const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
    await user.click(handCard(card));

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Start a new game?' });
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    // Escape belongs to the dialog: it cancels, and does not reach the table.
    await user.keyboard('{Escape}');
    expect(dialog).not.toBeInTheDocument();
    expect(handCard(card)).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(handCard(card)).toBeInTheDocument();
    await settle();
    expect(storedStats()).toBeNull();

    await user.click(screen.getByRole('button', { name: 'New Game' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await settle();
    expect(storedStats()!.played).toBe(1);
    // The replaced match books its time, never a loss.
    expect(storedStats()!.losses).toBe(0);
    expect(storedSave()!.seed).not.toBe(ONE_WAY.seed);
  });
});

// ---------- motion ----------

describe('motion', () => {
  it('folds a capture away within a beat, and not at all under Reduced Motion', async () => {
    const restore = stubMatchMedia();
    try {
      const user = userEvent.setup();
      await resume(user, ONE_WAY);
      const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
      await user.click(handCard(card));
      await user.click(handCard(card));
      expect(document.querySelector('.sc-fold')).not.toBeNull();
      await waitFor(() => expect(document.querySelector('.sc-fold')).toBeNull(), {
        timeout: CPU_DELAY_MS,
      });
      cleanup();

      renderGame(saved(ONE_WAY), true);
      await user.click(await screen.findByRole('button', { name: /Resume/ }));
      await user.click(handCard(card));
      await user.click(handCard(card));
      expect(document.querySelector('.sc-fold')).toBeNull();
    } finally {
      restore();
    }
  });

  it('shows where the cards left on the table go, in the beat before the settlement', async () => {
    const restore = stubMatchMedia();
    try {
      const user = userEvent.setup();
      const move = driverMove(LAST_CARD_SWEPT);
      const sweep = doPlay(LAST_CARD_SWEPT, move)!.dealResult!.sweep!;
      const toYou = sweep.seat === YOU;
      await resume(user, LAST_CARD_SWEPT);
      await playViaUi(user, LAST_CARD_SWEPT, move);

      expect(screen.queryByRole('alertdialog', { name: /^Deal / })).not.toBeInTheDocument();
      expect(visibleLine()).toBe(`Last cards on the table: ${toYou ? 'to you' : 'to the CPU'}`);
      expect(document.querySelectorAll('.sc-line .sc-mini')).toHaveLength(sweep.cards.length);
      // Read aloud with every card named.
      expect(spoken()).toMatch(
        toYou
          ? /^You take the cards left on the table: /
          : /^The CPU takes the cards left on the table: /,
      );
      expect(spoken().match(/ of /g)).toHaveLength(sweep.cards.length);
      // The fold carries them too, towards the side that took them.
      const captured = move.captured.length > 0 ? move.captured.length + 1 : 0;
      expect(document.querySelectorAll('.sc-fold-card')).toHaveLength(
        captured + sweep.cards.length,
      );
      expect(document.querySelector(toYou ? '.sc-fold-down' : '.sc-fold-up')).not.toBeNull();

      const dialog = await screen.findByRole(
        'alertdialog',
        { name: /^Deal / },
        { timeout: RESULT_REVEAL_MS * 2 },
      );
      expect(
        within(dialog).getByText(
          `Cards left on the table, taken by ${toYou ? 'you' : 'the CPU'}: ${sweep.cards.length}`,
        ),
      ).toBeInTheDocument();
    } finally {
      restore();
    }
  });

  it('gives the last card a beat before the settlement, and none under Reduced Motion', async () => {
    const restore = stubMatchMedia();
    try {
      const user = userEvent.setup();
      await resume(user, LAST_CARD);
      await playViaUi(user, LAST_CARD, driverMove(LAST_CARD));
      expect(screen.queryByRole('alertdialog', { name: /^Deal / })).not.toBeInTheDocument();
      expect(
        await screen.findByRole(
          'alertdialog',
          { name: /^Deal / },
          { timeout: RESULT_REVEAL_MS * 2 },
        ),
      ).toBeInTheDocument();
      cleanup();

      renderGame(saved(LAST_CARD), true);
      await user.click(await screen.findByRole('button', { name: /Resume/ }));
      await playViaUi(user, LAST_CARD, driverMove(LAST_CARD));
      expect(screen.getByRole('alertdialog', { name: /^Deal / })).toBeInTheDocument();
    } finally {
      restore();
    }
  });
});

// ---------- sounds ----------

describe('sounds, once per beat (§11.2)', () => {
  const spy = () => ({
    select: vi.spyOn(sounds, 'select').mockImplementation(() => undefined),
    match: vi.spyOn(sounds, 'match').mockImplementation(() => undefined),
  });

  it('plays a settlement as it happens, and not again on a resume onto it', async () => {
    const heard = spy();
    try {
      const user = userEvent.setup();
      await resume(user, SETTLED);
      await screen.findByRole('alertdialog', { name: `Deal ${SETTLED.dealNumber}` });
      expect(heard.match).not.toHaveBeenCalled();
      cleanup();

      await resume(user, LAST_CARD);
      await playViaUi(user, LAST_CARD, driverMove(LAST_CARD));
      await screen.findByRole('alertdialog', { name: /^Deal / });
      expect(heard.select).toHaveBeenCalledTimes(1);
      expect(heard.match).toHaveBeenCalledTimes(1);
    } finally {
      heard.select.mockRestore();
      heard.match.mockRestore();
    }
  });

  it('does not play a beat a second time when Reduced Motion is switched', async () => {
    // The OS says "no preference", so the app's switch is what decides.
    const restore = stubMatchMedia();
    const heard = spy();
    try {
      const user = userEvent.setup();
      const { settings } = await resume(user, ONE_WAY);
      const card = cardOfShape(ONE_WAY, (o) => o.length === 1 && o[0]!.length === 1);
      await user.click(handCard(card));
      await user.click(handCard(card));
      expect(heard.select).toHaveBeenCalledTimes(1);

      act(() => settings().updateSettings({ reducedMotion: true }));
      act(() => settings().updateSettings({ reducedMotion: false }));
      expect(heard.select).toHaveBeenCalledTimes(1);
      expect(heard.match).not.toHaveBeenCalled();
    } finally {
      heard.select.mockRestore();
      heard.match.mockRestore();
      restore();
    }
  });
});

// ---------- home and statistics ----------

describe('home', () => {
  it('offers Resume first and asks before a new match replaces the suspended one', async () => {
    const user = userEvent.setup();
    renderGame(saved(ONE_WAY));
    await user.click(await screen.findByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    await settle();
    expect(storedStats()).toBeNull();
  });

  it('notes the record quietly once a match has ended, and not before', async () => {
    renderGame({
      ...tutorialDone,
      [SC_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 3,
        wins: 2,
        losses: 1,
        totalPlaySeconds: 60,
      }),
    });
    expect(await screen.findByText('Won 2 · Lost 1')).toBeInTheDocument();
    cleanup();
    renderGame(tutorialDone);
    expect(await screen.findByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByText(/^Won /)).not.toBeInTheDocument();
  });

  it('reports four numbers, and no draws, streak or best', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));
    for (const label of ['Games played', 'Wins', 'Losses', 'Total play time']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText(/draw|streak|best|average/i)).not.toBeInTheDocument();
  });

  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reads past an untrustworthy save to the home, deals nothing, and leaves it stored', async () => {
    const tampered = JSON.stringify({ ...toPersisted(ONE_WAY, 1), moveCount: 999 });
    const { kv } = renderGame({ ...tutorialDone, [SC_STORAGE_KEYS.game]: tampered });
    expect(await screen.findByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
    await settle();
    // Nothing dealt, counted or written over …
    expect(storedSave()).toBeNull();
    expect(storedStats()).toBeNull();
    // … and the refused record is still where it was.
    expect(await kv.get(SC_STORAGE_KEYS.game)).toBe(tampered);
  });
});

// ---------- the shortcut door ----------

describe('a home-screen shortcut (issue #113)', () => {
  it('opens the suspended match straight onto the table', async () => {
    renderShortcut(saved(ONE_WAY));
    expect(await screen.findByRole('group', { name: 'Your hand' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resume/ })).not.toBeInTheDocument();
  });

  it('leaves the table for this game’s home, not the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderShortcut(saved(ONE_WAY));
    await screen.findByRole('group', { name: 'Your hand' });
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(onExit).not.toHaveBeenCalled();
  });

  it('opens the home when there is no match, and deals nothing', async () => {
    renderShortcut(tutorialDone);
    expect(await screen.findByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Your hand' })).not.toBeInTheDocument();
    await settle();
    expect(storedSave()).toBeNull();
    expect(storedStats()).toBeNull();
  });

  it('opens the home when the save cannot be trusted', async () => {
    const tampered = { ...toPersisted(ONE_WAY, 1), moveCount: ONE_WAY.moveCount + 1 };
    renderShortcut({ ...tutorialDone, [SC_STORAGE_KEYS.game]: JSON.stringify(tampered) });
    expect(await screen.findByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Your hand' })).not.toBeInTheDocument();
  });

  it('is the only door that resumes: the collection tile still opens the home', async () => {
    renderGame(saved(ONE_WAY));
    expect(await screen.findByRole('button', { name: /Resume/ })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Your hand' })).not.toBeInTheDocument();
  });

  it('teaches the game first on a launch that has never seen Quick Rules, then resumes', async () => {
    const user = userEvent.setup();
    renderShortcut({ [SC_STORAGE_KEYS.game]: JSON.stringify(toPersisted(ONE_WAY, 1)) });
    expect(await screen.findByText('Take')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));
    for (const card of ONE_WAY.deal.hands[YOU]) expect(handCard(card)).toBeInTheDocument();
  });
});

// ---------- the play clock ----------

function storedPlaySeconds(): number {
  return storedStats()?.totalPlaySeconds ?? 0;
}

function storedElapsedSeconds(): number {
  return storedSave()?.elapsedSeconds ?? 0;
}

describe('the play clock (§8, §9.3)', () => {
  it('books play time on background, once, and never twice across a relaunch', async () => {
    deviceStore.set(SC_STORAGE_KEYS.flags, tutorialDone[SC_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);
      // A second hidden event books nothing more.
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(5);

      // The process dies here. Relaunch and resume.
      cleanup();
      Reflect.deleteProperty(document, 'visibilityState');
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: /Resume/ }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      expect(storedElapsedSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not book a shortcut-resumed match’s seconds a second time', async () => {
    deviceStore.set(SC_STORAGE_KEYS.flags, tutorialDone[SC_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
      background();
      await settle();
      cleanup();
      Reflect.deleteProperty(document, 'visibilityState');

      launch('shortcut');
      await settle();
      expect(screen.getByRole('group', { name: 'Your hand' })).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000);
      });
      background();
      await settle();
      expect(storedPlaySeconds()).toBe(8);
      expect(storedElapsedSeconds()).toBe(8);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a suspended match's clock when backgrounded from the game's home (#109)", async () => {
    deviceStore.set(SC_STORAGE_KEYS.flags, tutorialDone[SC_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9_000);
      });
      background();
      await settle();
      expect(storedElapsedSeconds()).toBe(9);
      cleanup();
      Reflect.deleteProperty(document, 'visibilityState');

      launch();
      await settle();
      expect(screen.getByRole('button', { name: 'Statistics' })).toBeInTheDocument();
      background();
      await settle();
      expect(storedElapsedSeconds()).toBe(9);
    } finally {
      vi.useRealTimers();
    }
  });

  it('books N seconds played and then unmounted, once, and not again on remount', async () => {
    deviceStore.set(SC_STORAGE_KEYS.flags, tutorialDone[SC_STORAGE_KEYS.flags]!);
    vi.useFakeTimers();
    try {
      launch();
      await settle();
      fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4_000);
      });
      // The browser's Back: the root is simply unmounted.
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(4);
      expect(storedElapsedSeconds()).toBe(4);

      launch();
      await settle();
      cleanup();
      await settle();
      expect(storedPlaySeconds()).toBe(4);
      expect(storedElapsedSeconds()).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
