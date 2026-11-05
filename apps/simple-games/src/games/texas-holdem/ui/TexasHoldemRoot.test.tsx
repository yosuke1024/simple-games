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
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { TexasHoldemRoot } from './TexasHoldemRoot';
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
        <TexasHoldemRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <TexasHoldemRoot onExit={vi.fn()} kv={kv} />
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
function clickMove(action: Action) {
  if (action.kind === 'raise') {
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: String(action.to) } });
    fireEvent.click(screen.getByRole('button', { name: 'Raise' }));
  } else
    fireEvent.click(
      screen.getByRole('button', {
        name:
          action.kind === 'fold'
            ? 'Fold'
            : action.kind === 'check'
              ? 'Check'
              : action.kind === 'call'
                ? /^Call /
                : action.kind === 'all-in'
                  ? /^All-in /
                  : 'Next hand',
      }),
    );
}
describe('TexasHoldem UI and lifecycle', () => {
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
