import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { trackResources } from '@/test/lifecycle';
import {
  createSession,
  act as move,
  chooseCpuMove,
  cpuView,
  type Session,
  type Action,
} from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { DaifugoRoot } from './DaifugoRoot';
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
        <DaifugoRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <DaifugoRoot onExit={vi.fn()} kv={kv} />
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
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
function onHuman(seed = 1) {
  let s = createSession(seed);
  for (let i = 0; s.turn !== 0 && i < 100; i++) s = move(s, chooseCpuMove(cpuView(s)))!;
  return s;
}
function clickMove(action: Action) {
  if (action.kind === 'pass') fireEvent.click(screen.getByRole('button', { name: 'Pass' }));
  else {
    for (const card of action.cards) {
      const label =
        card === 52
          ? 'Joker'
          : `${['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][card % 13]} ${['♠', '♥', '♦', '♣'][Math.floor(card / 13)]}`;
      fireEvent.click(screen.getByRole('button', { name: label }));
    }
    fireEvent.click(
      screen.getByRole('button', {
        name: action.kind === 'exchange' ? 'Exchange' : 'Play cards',
      }),
    );
  }
}
describe('Daifugo UI and lifecycle', () => {
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
    s = move(s, chooseCpuMove(cpuView(s)))!;
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
  it('releases timers and listeners when leaving during a CPU turn', async () => {
    const kv = createMemoryKV();
    await taught(kv, onHuman());
    const warm = launch(kv);
    await settle();
    warm.unmount();
    await settle();
    const tracker = trackResources();
    try {
      const view = launch(kv);
      await settle();
      clickMove(chooseCpuMove(cpuView(onHuman())));
      await settle();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
  it('finishes a real deal, records its result once and clears its resumable save', async () => {
    timers();
    let last: Session | undefined, finalAction: Action | undefined;
    for (let seed = 1; seed <= 40 && !last; seed++) {
      let s = createSession(seed);
      for (let step = 0; step < 1000 && s.status === 'playing'; step++) {
        const a = chooseCpuMove(cpuView(s)),
          next = move(s, a)!;
        if (s.turn === 0 && next.status !== 'playing') {
          last = s;
          finalAction = a;
          break;
        }
        s = next;
      }
    }
    expect(last).toBeDefined();
    const kv = createMemoryKV();
    await taught(kv, last!);
    launch(kv);
    await settle();
    clickMove(finalAction!);
    await settle();
    await act(async () => vi.advanceTimersByTime(1600));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    const stats = await loadRecord(statsSchema, kv);
    expect(stats.completed).toBe(1);
    expect(stats.placements.reduce((a, b) => a + b, 0)).toBe(1);
    await act(async () => vi.advanceTimersByTime(5000));
    expect((await loadRecord(statsSchema, kv)).completed).toBe(1);
  });
});

it('chooses the outgoing exchange before seeing received cards and preserves 53 cards', async () => {
  timers();
  const kv = createMemoryKV(),
    s = createSession(24, [0, 1, 2, 3]);
  await taught(kv, s);
  launch(kv);
  await settle();
  expect(screen.getByRole('button', { name: 'Exchange' })).toBeDisabled();
  clickMove({ kind: 'exchange', cards: s.hands[0]!.slice(0, 2) });
  await settle();
  const saved = (await loadSavedGame(kv))!;
  expect(saved.phase).toBe('play');
  expect(saved.previousOrder).toEqual([0, 1, 2, 3]);
  expect(new Set([...saved.hands.flat(), ...saved.table, ...saved.discard]).size).toBe(53);
});
