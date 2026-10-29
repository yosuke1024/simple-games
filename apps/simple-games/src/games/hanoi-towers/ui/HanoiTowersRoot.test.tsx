import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { createSession, move, encodeMove } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { HanoiTowersRoot } from './HanoiTowersRoot';
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
        <HanoiTowersRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <HanoiTowersRoot onExit={vi.fn()} entry={entry} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
function actions(size: number, from = 0, to = 2, via = 1): number[] {
  return size === 0
    ? []
    : [
        ...actions(size - 1, from, via, to),
        encodeMove(from, to),
        ...actions(size - 1, via, to, from),
      ];
}
describe('HanoiTowers playable screens', () => {
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
    let session = createSession(3, 123);
    const path = actions(session.size);
    for (const action of path.slice(0, -1)) session = move(session, action)!;
    const lastAction = path.at(-1)!;
    await saveGame(session, kv);
    launch(kv, 'shortcut');
    await settle();
    const finish = () => {
      fireEvent.click(
        screen.getByRole('button', { name: new RegExp(`Peg ${Math.floor(lastAction / 3) + 1},`) }),
      );
      fireEvent.click(
        screen.getByRole('button', { name: new RegExp(`Peg ${(lastAction % 3) + 1},`) }),
      );
    };
    finish();
    await settle();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    const first = await loadRecord(statsSchema, kv);
    expect(first.boards[3].completed).toBe(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(kv))?.cleared).toBe(true);
    finish();
    await settle();
    expect((await loadRecord(statsSchema, kv)).boards[3].completed).toBe(1);
  });
  it('keeps restored time when mounting on Home and saves on unmount', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame({ ...createSession(3, 33), elapsedSeconds: 18 }, kv);
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
  await saveGame(createSession(3, 33), kv);
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
  const session = createSession(3, 81);
  await saveGame(session, kv);
  launch(kv);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Disks: 4' }));
  expect(document.querySelector('.hn-home-content')).toHaveAttribute('inert');
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.closest('[inert]')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(await loadSavedGame(kv)).toEqual(session);
});

it('shows legal destinations, rejects a larger disk, and supports peg keyboard controls and Undo', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(createSession(3, 7), kv);
  launch(kv, 'shortcut');
  await settle();
  const first = screen.getByRole('button', { name: 'Peg 1, top disk 1' });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Peg 2, empty' })).toHaveFocus();
  fireEvent.keyDown(window, { key: '1' });
  expect(document.querySelectorAll('.hn-valid')).toHaveLength(2);
  fireEvent.keyDown(window, { key: '2' });
  await settle();
  expect((await loadSavedGame(kv))?.board).toEqual([1, 0, 0]);
  fireEvent.keyDown(window, { key: '1' });
  fireEvent.keyDown(window, { key: '2' });
  expect(screen.getByRole('status')).toHaveTextContent(
    'Choose an empty peg or a peg with a larger top disk.',
  );
  expect((await loadSavedGame(kv))?.history).toHaveLength(1);
  fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
  await settle();
  expect((await loadSavedGame(kv))?.history).toHaveLength(0);
  fireEvent.keyDown(window, { key: '1', repeat: true });
  expect(document.querySelectorAll('.hn-selected')).toHaveLength(0);
});

it('stops its only play clock while a restart dialog is open and resumes after Cancel', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(createSession(3, 19), kv);
  let nextId = 0;
  const active = new Set<number>();
  vi.spyOn(window, 'setInterval').mockImplementation(() => {
    const id = ++nextId;
    active.add(id);
    return id as unknown as ReturnType<typeof window.setInterval>;
  });
  vi.spyOn(window, 'clearInterval').mockImplementation((id) => {
    active.delete(Number(id));
  });
  const view = launch(kv, 'shortcut');
  await settle();
  expect(active.size).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
  await settle();
  expect(active.size).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(active.size).toBe(1);
  view.unmount();
  await settle();
  expect(active.size).toBe(0);
});
