import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { trackResources } from '@/test/lifecycle';
import { createSession, act as play } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { FleetSearchRoot } from './FleetSearchRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve();
  });
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  vi.restoreAllMocks();
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
        <FleetSearchRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <FleetSearchRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('FleetSearch UI', () => {
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
    session = play(session, { type: 'start' })!;
    session = play(session, { type: 'shot', cell: 0 })!;
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
it('keeps enemy ships hidden, requires a selected target and supports arrow navigation', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(play(createSession('normal', 18), { type: 'start' })!, kv);
  launch(kv, 'shortcut');
  await settle();
  const sea = screen.getByRole('group', { name: 'Enemy waters' });
  expect(within(sea).getAllByRole('button', { name: /Unexplored/ })).toHaveLength(64);
  const first = within(sea).getByRole('button', { name: 'A1 · Unexplored' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(within(sea).getByRole('button', { name: 'B1 · Unexplored' })).toHaveFocus();
  fireEvent.click(first);
  expect((await loadSavedGame(kv))?.shots[0]).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Fire at A1' }));
  await settle();
  expect((await loadSavedGame(kv))?.shots[0]).toEqual([0]);
  expect(screen.getByRole('button', { name: 'CPU is thinking…' })).toBeDisabled();
});
