import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { createSession, move, type Session } from '../game';
import { NIM_STORAGE_KEYS, statsSchema } from '../storage/schemas';
import { loadSavedGame } from '../storage/gamePersistence';
import { NimRoot } from './NimRoot';
vi.mock('@/services/sound', () => ({
  sounds: { select: vi.fn(), undo: vi.fn() },
  setSoundEnabled: vi.fn(),
}));
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
function store(session: Session = createSession('hard', 7)) {
  const stats = statsSchema.defaultValue();
  stats[session.mode].played = 1;
  stats.totalPlaySeconds = session.elapsedSeconds;
  return createMemoryKV({
    [NIM_STORAGE_KEYS.saveGame]: JSON.stringify(session),
    [NIM_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    [NIM_STORAGE_KEYS.stats]: JSON.stringify(stats),
  });
}
function mount(kv = store(), shortcut = true) {
  const onExit = vi.fn();
  return {
    ...render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        {shortcut ? (
          <NimRoot kv={kv} onExit={onExit} entry="shortcut" />
        ) : (
          <NimRoot kv={kv} onExit={onExit} />
        )}
      </SettingsProvider>,
    ),
    kv,
    onExit,
  };
}
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});
describe('Nim UI', () => {
  it('teaches once in three steps and goes straight into play', async () => {
    mount(createMemoryKV(), false);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(screen.getByText('Your turn')).toBeInTheDocument();
  });
  it('resumes via shortcut, requires explicit row/count confirmation, and undoes the full turn', async () => {
    vi.useFakeTimers();
    const view = mount();
    await settle();
    const original = await loadSavedGame(view.kv);
    fireEvent.click(screen.getByRole('button', { name: /^Row 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Take 2' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(1);
    await advance(450);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.heaps).toEqual(original?.heaps);
  });
  it('cancels a saved pending CPU reply on hide and waits for an explicit resume', async () => {
    vi.useFakeTimers();
    const pending = move(createSession('hard', 4), { row: 0, count: 1 })!;
    const view = mount(store(pending));
    await settle();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    await advance(900);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(1);
    Reflect.deleteProperty(document, 'visibilityState');
    fireEvent(document, new Event('visibilitychange'));
    await advance(900);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await advance(450);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(2);
  });
  it('keeps the CPU stopped under new-game confirmation, and Cancel preserves the match', async () => {
    vi.useFakeTimers();
    const pending = move(createSession('hard', 4), { row: 0, count: 1 })!;
    const view = mount(store(pending));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    await advance(900);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await advance(450);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(2);
  });
  it('shows a completed result and persists terminal undo without counting it twice', async () => {
    vi.useFakeTimers();
    let session = createSession('hard', 6);
    for (let row = 0; row < 3; row++) session = move(session, { row, count: session.heaps[row]! })!;
    const view = mount(store(session));
    await settle();
    await advance(450);
    const result = screen.getByRole('alertdialog', { name: 'CPU wins' });
    fireEvent.click(within(result).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.resultRecorded).toBe(true);
    expect((await loadSavedGame(view.kv))?.moves).toHaveLength(2);
    const stats = JSON.parse((await view.kv.get(NIM_STORAGE_KEYS.stats))!);
    expect(stats.hard.losses).toBe(1);
  });
  it('seeds both play clocks on restore and books unmount exactly once', async () => {
    vi.useFakeTimers();
    const session = { ...createSession('easy', 3), elapsedSeconds: 60 };
    const kv = store(session);
    const home = mount(kv, false);
    await settle();
    home.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(60);
    const game = mount(kv);
    await settle();
    await advance(2000);
    game.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(62);
    expect(JSON.parse((await kv.get(NIM_STORAGE_KEYS.stats))!).totalPlaySeconds).toBe(62);
  });
  it('books elapsed time in the same action that saves a move', async () => {
    vi.useFakeTimers();
    const view = mount();
    await settle();
    await advance(2000);
    fireEvent.click(screen.getByRole('button', { name: /^Row 1:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Take 1' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.elapsedSeconds).toBe(2);
    expect(JSON.parse((await view.kv.get(NIM_STORAGE_KEYS.stats))!).totalPlaySeconds).toBe(2);
  });
  it('releases an active clock, pending CPU timer and all game listeners on unmount', async () => {
    const pending = move(createSession('hard', 4), { row: 0, count: 1 })!;
    const warm = mount(store(pending));
    await settle();
    warm.unmount();
    await settle();
    const tracker = trackResources();
    try {
      const view = mount(store(pending));
      await settle();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});
