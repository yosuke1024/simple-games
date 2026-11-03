import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { trackResources } from '@/test/lifecycle';
import { createSession } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { MarbleWeaveRoot } from './MarbleWeaveRoot';
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
        <MarbleWeaveRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <MarbleWeaveRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('MarbleWeave UI', () => {
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
    const session = createSession('easy', 22);
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

it('selects reachable cells, persists a whole move and restores it with keyboard undo', async () => {
  const { findPath } = await import('../game');
  const kv = createMemoryKV();
  await taught(kv);
  const initial = createSession('easy', 7);
  await saveGame(initial, kv);
  launch(kv, 'shortcut');
  await settle();
  const from = initial.board.findIndex(Boolean),
    to = initial.board.findIndex((c, i) => !c && findPath(initial.board, from, i, 7));
  fireEvent.click(document.querySelectorAll('.mw-cell')[from]!);
  expect(document.querySelectorAll('.mw-reachable-dot').length).toBeGreaterThan(0);
  fireEvent.click(document.querySelectorAll('.mw-cell')[to]!);
  await settle();
  expect((await loadSavedGame(kv))?.actions).toEqual([{ from, to }]);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  await settle();
  expect(await loadSavedGame(kv)).toEqual(initial);
  fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  expect(document.querySelector('.game-content')).toHaveAttribute('inert');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(await loadSavedGame(kv)).toEqual(initial);
});
