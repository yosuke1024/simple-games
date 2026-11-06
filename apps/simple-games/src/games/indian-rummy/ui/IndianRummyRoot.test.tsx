import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import {
  createSession,
  step as move,
  chooseCpuMove,
  cpuView,
  type Session,
  type Action,
} from '../game';
import { moveCard, sortHand } from '../game/handOrder';
import { saveGame, loadSaved, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { IndianRummyRoot } from './IndianRummyRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'visibilityState');
});
function launch(kv: KVStore, shortcut = true) {
  return render(
    <SettingsProvider
      initialSettings={{
        ...settingsSchema.defaultValue(),
        language: 'en',
        sound: false,
        vibration: false,
      }}
    >
      {shortcut ? (
        <IndianRummyRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <IndianRummyRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore, session?: Session) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
  if (session) {
    await saveGame(session, kv);
    await saveRecord(
      statsSchema,
      { ...statsSchema.defaultValue(), played: 1, totalPlaySeconds: session.elapsedSeconds },
      kv,
    );
  }
}
function timers() {
  vi.useFakeTimers();
  vi.setSystemTime(1);
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
function onHuman(seed = 1): Session {
  for (let deal = seed; deal < seed + 50; deal++) {
    let s = createSession(deal);
    for (let i = 0; s.status === 'playing' && s.turn !== 0 && i < 100; i++)
      s = move(s, chooseCpuMove(cpuView(s)))!;
    if (s.status === 'playing' && s.turn === 0) return s;
  }
  throw new Error('No human turn');
}
function chooseCard(card: number) {
  const button = document.querySelector<HTMLButtonElement>(`button[data-card="${card}"]`);
  expect(button).not.toBeNull();
  fireEvent.click(button!);
}
function clickMove(action: Action) {
  if (action.kind === 'draw')
    fireEvent.click(
      screen.getByRole('button', {
        name: action.source === 'stock' ? 'Draw from stock' : 'Take discard',
      }),
    );
  else {
    chooseCard(action.card);
    fireEvent.click(
      screen.getByRole('button', {
        name: action.kind === 'discard' ? 'Discard selected' : 'Discard & declare',
      }),
    );
  }
}
describe('IndianRummy UI and lifecycle', () => {
  it('teaches three steps, starts, and cancels restart without replacing the deal', async () => {
    timers();
    const kv = createMemoryKV();
    launch(kv);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    const before = await loadSavedGame(kv);
    expect(before).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(before);
  });
  it('keeps restored time and books only new foreground seconds on home and unmount', async () => {
    timers();
    const kv = createMemoryKV();
    await taught(kv, { ...onHuman(), elapsedSeconds: 18 });
    const view = launch(kv);
    await settle();
    await act(async () => vi.advanceTimersByTime(2100));
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByText('Resume')).toBeInTheDocument();
    view.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(20);
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(20);
  });
  it('requires confirmation to replace an unfinished game', async () => {
    timers();
    const kv = createMemoryKV();
    await taught(kv, onHuman());
    launch(kv, false);
    await settle();
    const saved = await loadSavedGame(kv);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog').closest('[inert]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(saved);
  });
  it('pauses CPU moves in a dialog and when hidden, then continues on return', async () => {
    timers();
    const kv = createMemoryKV();
    let s = onHuman();
    for (let i = 0; s.turn === 0 && s.status === 'playing' && i < 100; i++)
      s = move(s, chooseCpuMove(cpuView(s)))!;
    expect(s.status).toBe('playing');
    expect(s.turn).not.toBe(0);
    await taught(kv, s);
    launch(kv);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    await act(async () => vi.advanceTimersByTime(3000));
    expect((await loadSavedGame(kv))?.moves).toBe(s.moves);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTime(3000));
    expect((await loadSavedGame(kv))?.moves).toBe(s.moves);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => vi.advanceTimersByTime(600));
    await settle();
    expect((await loadSavedGame(kv))!.moves).toBeGreaterThan(s.moves);
  });
  it('submits a legal human action through the table and persists the resulting move', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    const root = launch(kv);
    await settle();
    const action = chooseCpuMove(cpuView(s)),
      expected = move(s, action)!;
    clickMove(action);
    await settle();
    const saved = await loadSavedGame(kv);
    if (expected.status === 'playing') expect(saved?.moves).toBe(expected.moves);
    else expect(saved).toBeNull();
    root.unmount();
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('settles a full game once and removes the resumable save', async () => {
    timers();
    let s = createSession(17),
      last = s,
      action: Action | undefined;
    for (let i = 0; s.status === 'playing' && i < 20000; i++) {
      last = s;
      action = chooseCpuMove(cpuView(s));
      const next = move(s, action);
      expect(next).not.toBeNull();
      s = next!;
    }
    expect(s.status).not.toBe('playing');
    expect(last.status).toBe('playing');
    const kv = createMemoryKV();
    await taught(kv, last);
    launch(kv);
    await settle();
    if (last.turn === 0) clickMove(action!);
    else await act(async () => vi.advanceTimersByTime(600));
    await settle();
    await act(async () => vi.advanceTimersByTime(1600));
    await settle();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(document.activeElement).toBe(document.querySelector('.dialog-title'));
    expect(await loadSavedGame(kv)).toBeNull();
    expect((await loadRecord(statsSchema, kv)).completed).toBe(1);
    await act(async () => vi.advanceTimersByTime(3000));
    await settle();
    expect((await loadRecord(statsSchema, kv)).completed).toBe(1);
  });
});

/**
 * jsdom lays nothing out, so the hand is given one: seven places a row, each
 * card read at the place it is shown in (its CSS `order` mid-drag, else its
 * position in the DOM), and `data-shift` px to the right of it while a test
 * has it on its way under an animation. Everything else about the gesture is real.
 */
const COL = 50,
  ROW = 85,
  CARD_W = 46,
  CARD_H = 64;
const rect = (x: number, y: number, w: number, h: number) =>
  ({
    x,
    y,
    left: x,
    top: y,
    width: w,
    height: h,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({}),
  }) as DOMRect;
function giveHandALayout() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const el = this as HTMLElement;
    if (el.classList.contains('is-arrangeable')) return rect(0, 0, COL * 7, ROW * 2);
    if (el.dataset.card !== undefined && el.parentElement?.classList.contains('is-arrangeable')) {
      const siblings = Array.from(el.parentElement.querySelectorAll('[data-card]'));
      const i = el.style.order !== '' ? Number(el.style.order) : siblings.indexOf(el),
        shift = Number(el.dataset.shift ?? 0);
      return rect((i % 7) * COL + shift, Math.floor(i / 7) * ROW, CARD_W, CARD_H);
    }
    return rect(0, 0, 0, 0);
  });
}
const place = (i: number) => ({
  clientX: (i % 7) * COL + CARD_W / 2,
  clientY: Math.floor(i / 7) * ROW + CARD_H / 2,
});
const handButtons = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('.ir-hand.is-arrangeable [data-card]'));
const shownOrder = () => handButtons().map((b) => Number(b.dataset.card));
const cardButton = (card: number) =>
  document.querySelector<HTMLButtonElement>(`.ir-hand.is-arrangeable [data-card="${card}"]`)!;
/** Presses the card at place `from` and carries it to place `to`, in the events a browser sends. */
function drag(from: number, to: number, end: 'up' | 'cancel' = 'up') {
  const el = handButtons()[from]!;
  fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...place(from) });
  const a = place(from),
    b = place(to);
  fireEvent.pointerMove(el, {
    pointerId: 1,
    buttons: 1,
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  });
  fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...b });
  if (end === 'up') fireEvent.pointerUp(el, { pointerId: 1, button: 0, ...b });
  else fireEvent.pointerCancel(el, { pointerId: 1, ...b });
  return el;
}
describe('IndianRummy hand arrangement', () => {
  it('drags a card to another place, saves it, and resumes in that order', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    const root = launch(kv);
    await settle();
    giveHandALayout();
    const sorted = sortHand(s.hands[0]!);
    expect(shownOrder()).toEqual(sorted);
    const carried = drag(0, 3);
    // The click a drag leaves behind is not a tap.
    fireEvent.click(carried, { detail: 1 });
    const arranged = moveCard(sorted, sorted[0]!, 3);
    expect(shownOrder()).toEqual(arranged);
    await settle();
    expect((await loadSaved(kv))!.handOrder).toEqual(arranged);
    root.unmount();
    await settle();
    launch(kv);
    await settle();
    expect(shownOrder()).toEqual(arranged);
  });
  it('puts a drawn card at the right end, and a drag never selects the discard', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    giveHandALayout();
    const drawn = move(s, { kind: 'draw', source: 'stock' })!;
    clickMove({ kind: 'draw', source: 'stock' });
    await act(async () => vi.advanceTimersByTime(400));
    await settle();
    const taken = drawn.hands[0]!.find((card) => !s.hands[0]!.includes(card))!;
    expect(shownOrder()).toEqual([...sortHand(s.hands[0]!), taken]);
    const carried = drag(13, 0);
    fireEvent.click(carried, { detail: 1 });
    expect(carried).toHaveAttribute('aria-pressed', 'false');
    expect(shownOrder()[0]).toBe(taken);
    // The next press is a tap again.
    fireEvent.pointerDown(carried, { pointerId: 2, button: 0, buttons: 1, ...place(0) });
    fireEvent.pointerUp(carried, { pointerId: 2, button: 0, ...place(0) });
    fireEvent.click(carried, { detail: 1 });
    expect(carried).toHaveAttribute('aria-pressed', 'true');
  });
  it('moves the focused card with Shift and the arrows, announces it, and sorts back', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    const sorted = sortHand(s.hands[0]!);
    const first = cardButton(sorted[0]!);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowLeft', shiftKey: true });
    expect(shownOrder()).toEqual(sorted);
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight', shiftKey: true });
    expect(shownOrder()).toEqual(moveCard(sorted, sorted[0]!, 2));
    expect(document.activeElement).toBe(cardButton(sorted[0]!));
    expect(screen.getByText(/position 3 of 13/)).toBeInTheDocument();
    await settle();
    expect((await loadSaved(kv))!.handOrder).toEqual(moveCard(sorted, sorted[0]!, 2));
    const sort = screen.getByRole('button', { name: 'Sort' });
    fireEvent.click(sort);
    expect(shownOrder()).toEqual(sorted);
    expect(sort).toBeDisabled();
  });
  it('puts a cancelled drag back, and keeps a move and an arrangement made in one task', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    giveHandALayout();
    const sorted = sortHand(s.hands[0]!);
    drag(0, 5, 'cancel');
    expect(shownOrder()).toEqual(sorted);
    const first = cardButton(sorted[0]!);
    first.focus();
    act(() => {
      fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
      fireEvent.click(screen.getByRole('button', { name: 'Draw from stock' }));
    });
    await settle();
    const drawn = move(s, { kind: 'draw', source: 'stock' })!,
      taken = drawn.hands[0]!.find((card) => !s.hands[0]!.includes(card))!;
    const saved = (await loadSaved(kv))!;
    expect(saved.session.moves).toBe(drawn.moves);
    expect(saved.handOrder).toEqual([...moveCard(sorted, sorted[0]!, 1), taken]);
  });
  it('never takes a drag that came back to its own place for a tap', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    giveHandALayout();
    clickMove({ kind: 'draw', source: 'stock' });
    await act(async () => vi.advanceTimersByTime(400));
    await settle();
    const before = shownOrder(),
      el = handButtons()[2]!;
    fireEvent.pointerDown(el, { pointerId: 1, button: 0, buttons: 1, ...place(2) });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...place(4) });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...place(6) });
    fireEvent.pointerMove(el, { pointerId: 1, buttons: 1, ...place(2) });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0, ...place(2) });
    fireEvent.click(el, { detail: 1 });
    expect(shownOrder()).toEqual(before);
    expect(el).toHaveAttribute('aria-pressed', 'false');
  });
  it('drops into the places the cards stand in, not where a slide still shows one', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    giveHandALayout();
    const sorted = shownOrder(),
      neighbour = handButtons()[3]!;
    // Still sliding back into place 3 from the right when the drag starts.
    let sliding = true;
    const done = () => {
      sliding = false;
      delete neighbour.dataset.shift;
    };
    neighbour.dataset.shift = '55';
    Object.defineProperty(neighbour, 'getAnimations', {
      configurable: true,
      value: () => (sliding ? [{ finish: done, cancel: done }] : []),
    });
    drag(0, 3);
    expect(sliding).toBe(false);
    expect(shownOrder()).toEqual(moveCard(sorted, sorted[0]!, 3));
  });
  it('deals the same board again sorted, whatever order the last attempt ended in', async () => {
    timers();
    const kv = createMemoryKV(),
      s = onHuman();
    await taught(kv, s);
    launch(kv);
    await settle();
    const sorted = sortHand(s.hands[0]!);
    const first = cardButton(sorted[0]!);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', shiftKey: true });
    expect(shownOrder()).not.toEqual(sorted);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    const retries = screen.getAllByRole('button', { name: 'Retry same board' });
    fireEvent.click(retries[retries.length - 1]!);
    await settle();
    const restarted = (await loadSaved(kv))!;
    expect(restarted.handOrder).toEqual(sortHand(restarted.session.hands[0]!));
  });
});
