import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { createSession, move, availableColours } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { ColorFloodRoot } from './ColorFloodRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });
afterEach(async () => {
  cleanup();
  await settle();
  vi.restoreAllMocks();
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
        <ColorFloodRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <ColorFloodRoot onExit={vi.fn()} entry={entry} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('ColorFlood playable screens', () => {
  it('teaches in three steps then starts and preserves the board across restart cancellation', async () => {
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
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(before);
    expect(document.querySelector('.game-content')).not.toHaveAttribute('inert');
  });
  it('wins, shares only facts, undoes, and never counts the same clear twice', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    let session = createSession(6, 123);
    let lastAction = 0;
    while (session.status === 'playing') {
      const action = availableColours(session.board, session.size)[0]!;
      const next = move(session, action)!;
      if (next.status === 'over') {
        lastAction = action;
        break;
      }
      session = next;
    }
    await saveGame(session, kv);
    launch(kv, 'shortcut');
    await settle();
    const finish = () => {
      fireEvent.keyDown(window, { key: String(lastAction + 1) });
    };
    finish();
    await settle();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    const first = await loadRecord(statsSchema, kv);
    expect(first.boards[6].completed).toBe(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(kv))?.cleared).toBe(true);
    finish();
    await settle();
    expect((await loadRecord(statsSchema, kv)).boards[6].completed).toBe(1);
  });
  it('keeps restored time when mounting on Home and saves on unmount', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame({ ...createSession(6, 33), elapsedSeconds: 18 }, kv);
    await saveRecord(statsSchema, { ...statsSchema.defaultValue(), totalPlaySeconds: 18 }, kv);
    const view = launch(kv);
    await settle();
    expect(screen.getByText('Resume')).toBeInTheDocument();
    view.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(18);
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(18);
  });
});

it('books visible seconds on unmount exactly once and releases its interval', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(createSession(6, 33), kv);
  let tick: (() => void) | null = null;
  const interval = vi.spyOn(window, 'setInterval').mockImplementation((handler) => {
    if (typeof handler === 'function') tick = handler as () => void;
    return 321 as unknown as ReturnType<typeof window.setInterval>;
  });
  const clear = vi.spyOn(window, 'clearInterval');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  const view = launch(kv, 'shortcut');
  await settle();
  expect(interval).toHaveBeenCalledTimes(1);
  act(() => {
    tick?.();
    tick?.();
  });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  act(() => {
    tick?.();
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await settle();
  expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
  view.unmount();
  await settle();
  expect(clear).toHaveBeenCalledWith(321);
  expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(2);
  expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
  launch(kv);
  await settle();
  cleanup();
  await settle();
  expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
  Reflect.deleteProperty(document, 'visibilityState');
});

it('isolates the Home replacement confirmation and Cancel preserves the save', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(6, 81);
  await saveGame(session, kv);
  launch(kv);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: '10 × 10' }));
  expect(document.querySelector('.cf-home-content')).toHaveAttribute('inert');
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.closest('[inert]')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(document.querySelector('.cf-home-content')).not.toHaveAttribute('inert');
  expect(await loadSavedGame(kv)).toEqual(session);
});
