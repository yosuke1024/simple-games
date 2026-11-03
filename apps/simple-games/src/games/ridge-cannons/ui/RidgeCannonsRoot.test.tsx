import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { trackResources } from '@/test/lifecycle';
import { createSession, act as play } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { RidgeCannonsRoot } from './RidgeCannonsRoot';
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
function launch(kv: KVStore, entry?: 'collection' | 'shortcut') {
  return render(
    <SettingsProvider
      initialSettings={{
        ...settingsSchema.defaultValue(),
        language: 'en',
        sound: false,
        vibration: false,
      }}
    >
      {entry === 'shortcut' ? (
        <RidgeCannonsRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <RidgeCannonsRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('RidgeCannons UI', () => {
  it('teaches in three steps, then starts with restart cancellation preserving the save', async () => {
    const kv = createMemoryKV();
    launch(kv);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
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
  it('resumes a shortcut and retains restored time across home/unmount', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame({ ...createSession('easy', 42), elapsedSeconds: 18 }, kv);
    await saveRecord(statsSchema, { ...statsSchema.defaultValue(), totalPlaySeconds: 18 }, kv);
    const view = launch(kv, 'shortcut');
    await settle();
    expect(document.querySelector('.game-content')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    expect(screen.getByText('Resume')).toBeInTheDocument();
    view.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(18);
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(18);
  });
  it('does not replace a saved match without confirmation', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    const saved = createSession('easy', 81);
    await saveGame(saved, kv);
    launch(kv);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Normal' }));
    expect(screen.getByRole('alertdialog').closest('[inert]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await loadSavedGame(kv)).toEqual(saved);
  });
  it('releases all game resources on unmount mid-game', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    let session = createSession('easy', 22);
    session = play(session, { angle: 50, power: 80 })!;
    await saveGame(session, kv);
    const warmup = launch(kv);
    await settle();
    warmup.unmount();
    await settle();
    const tracker = trackResources();
    try {
      const view = launch(kv, 'shortcut');
      await settle();
      view.unmount();
      tracker.assertReleased();
    } finally {
      tracker.restore();
    }
  });
});
it('fires once and suspends the pending CPU turn behind a modal or hidden page', async () => {
  vi.useFakeTimers();
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(createSession('easy', 22), kv);
  launch(kv, 'shortcut');
  await settle();
  fireEvent.change(screen.getByRole('slider', { name: /Angle/ }), { target: { value: '56' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
  await settle();
  expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
  await act(async () => {
    vi.advanceTimersByTime(1200);
  });
  expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => {
    vi.advanceTimersByTime(1200);
  });
  expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => {
    vi.advanceTimersByTime(850);
  });
  await settle();
  expect((await loadSavedGame(kv))?.actions).toHaveLength(2);
});

it('plays each committed shot before damage and the next turn, without saving it twice', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  const kv = createMemoryKV();
  await taught(kv);
  const initial = createSession('easy', 22);
  await saveGame(initial, kv);
  launch(kv, 'shortcut');
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
  await settle();
  expect(document.querySelector('.rc-projectile')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Fire' })).toBeDisabled();
  expect(document.querySelector('.rc-impact')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Fire' }));
  expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
  await act(async () => vi.advanceTimersByTime(1100));
  expect(document.querySelector('.rc-projectile')).toBeNull();
  expect(document.querySelector('.rc-impact')).not.toBeNull();
  expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
  await act(async () => vi.advanceTimersByTime(800));
  await settle();
  expect(document.querySelector('.rc-projectile.rc-side-1')).not.toBeNull();
  expect((await loadSavedGame(kv))?.actions).toHaveLength(2);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(document.querySelector('.rc-projectile')).toBeNull();
  await act(async () => vi.advanceTimersByTime(3000));
  expect((await loadSavedGame(kv))?.actions).toHaveLength(2);
});
