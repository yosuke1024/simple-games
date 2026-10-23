import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { createSession, routeFor, type Session } from '../game';
import { KT_STORAGE_KEYS, statsSchema } from '../storage/schemas';
import { loadSavedGame } from '../storage/gamePersistence';
import { KnightTourRoot } from './KnightTourRoot';
vi.mock('@/services/sound', () => ({
  sounds: { select: vi.fn(), undo: vi.fn() },
  setSoundEnabled: vi.fn(),
}));
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
function store(session: Session = createSession(5, 7)) {
  const stats = statsSchema.defaultValue();
  stats[session.mode].played = 1;
  return createMemoryKV({
    [KT_STORAGE_KEYS.saveGame]: JSON.stringify(session),
    [KT_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
    [KT_STORAGE_KEYS.stats]: JSON.stringify(stats),
  });
}
function mount(kv = store()) {
  return {
    ...render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <KnightTourRoot kv={kv} onExit={() => undefined} entry="shortcut" />
      </SettingsProvider>,
    ),
    kv,
  };
}
function cell(index: number) {
  return document.querySelectorAll<HTMLButtonElement>('.kt-cell')[index]!;
}
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});
describe('Knight’s Tour UI', () => {
  it('uses a saved shortcut, one board tab stop and arrow-key cell navigation', async () => {
    const session = createSession(5, 7);
    const view = mount(store(session));
    await settle();
    expect(document.querySelectorAll('.kt-cell[tabindex="0"]')).toHaveLength(1);
    const first = session.path[0]!,
      next = routeFor(5, 7)[1]!;
    const initialPath = (await loadSavedGame(view.kv))!.path;
    fireEvent.click(cell(first));
    await settle();
    expect((await loadSavedGame(view.kv))!.path).toEqual(initialPath);
    cell(0).focus();
    fireEvent.keyDown(cell(0), { key: 'ArrowRight' });
    expect(cell(1)).toHaveFocus();
    fireEvent.click(cell(next));
    await settle();
    expect((await loadSavedGame(view.kv))!.path).toHaveLength(2);
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await settle();
    expect((await loadSavedGame(view.kv))!.path).toEqual(initialPath);
  });
  it('completes a proven route, offers result sharing and permits unlimited terminal undo', async () => {
    const route = routeFor(5, 8),
      session = { ...createSession(5, 8), path: route.slice(0, -1) };
    const view = mount(store(session));
    await settle();
    fireEvent.click(cell(route[route.length - 1]!));
    await settle();
    const result = screen.getByRole('alertdialog', { name: 'Tour complete!' });
    expect(within(result).getByRole('button', { name: /Share/ })).toBeInTheDocument();
    fireEvent.click(within(result).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(view.kv))!.path).toHaveLength(24);
    expect((await loadSavedGame(view.kv))!.resultRecorded).toBe(true);
    fireEvent.click(cell(route[24]!));
    await settle();
    expect(JSON.parse((await view.kv.get(KT_STORAGE_KEYS.stats))!)[5].wins).toBe(1);
  });
  it('offers both retry and a fresh board in an isolated restart dialog', async () => {
    const view = mount();
    await settle();
    const before = await loadSavedGame(view.kv);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'New board' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect((await loadSavedGame(view.kv))?.path).toEqual(before?.path);
  });
  it('suspends on hide and waits for the visible Resume button', async () => {
    const view = mount();
    await settle();
    const before = await loadSavedGame(view.kv),
      route = routeFor(5, 7);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    fireEvent(document, new Event('visibilitychange'));
    Reflect.deleteProperty(document, 'visibilityState');
    fireEvent(document, new Event('visibilitychange'));
    fireEvent.click(cell(route[1]!));
    await settle();
    expect((await loadSavedGame(view.kv))?.path).toEqual(before?.path);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.click(cell(route[1]!));
    await settle();
    expect((await loadSavedGame(view.kv))?.path).toHaveLength(2);
  });
  it('books elapsed time whenever a new path is saved', async () => {
    vi.useFakeTimers();
    const view = mount();
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.click(cell(routeFor(5, 7)[1]!));
    await settle();
    expect((await loadSavedGame(view.kv))?.elapsedSeconds).toBe(2);
    expect(JSON.parse((await view.kv.get(KT_STORAGE_KEYS.stats))!).totalPlaySeconds).toBe(2);
  });
  it('releases its clock and keyboard and visibility listeners on unmount', async () => {
    const warm = mount();
    await settle();
    warm.unmount();
    await settle();
    const tracker = trackResources();
    try {
      const view = mount();
      await settle();
      view.unmount();
      await settle();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});
