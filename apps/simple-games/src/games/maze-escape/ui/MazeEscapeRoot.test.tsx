import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { createSession, move, solution } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { MazeEscapeRoot } from './MazeEscapeRoot';
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
        <MazeEscapeRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <MazeEscapeRoot onExit={vi.fn()} entry={entry} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}

describe('MazeEscape playable screens', () => {
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
    let session = createSession(5, 123);
    const path = solution(session);
    for (const action of path.slice(0, -1)) session = move(session, action)!;
    const lastAction = path.at(-1)!;
    await saveGame(session, kv);
    launch(kv, 'shortcut');
    await settle();
    const finish = () => {
      const difference = lastAction - session.position;
      const key =
        difference === 1
          ? 'ArrowRight'
          : difference === -1
            ? 'ArrowLeft'
            : difference > 0
              ? 'ArrowDown'
              : 'ArrowUp';
      fireEvent.keyDown(window, { key });
    };
    finish();
    await settle();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    const first = await loadRecord(statsSchema, kv);
    expect(first.boards[5].completed).toBe(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(kv))?.cleared).toBe(true);
    finish();
    await settle();
    expect((await loadRecord(statsSchema, kv)).boards[5].completed).toBe(1);
  });
  it('keeps restored time when mounting on Home and saves on unmount', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame({ ...createSession(5, 33), elapsedSeconds: 18 }, kv);
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
  await saveGame(createSession(5, 33), kv);
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
  const session = createSession(5, 81);
  await saveGame(session, kv);
  launch(kv);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: '7 × 7' }));
  expect(document.querySelector('.me-home-content')).toHaveAttribute('inert');
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.closest('[inert]')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(await loadSavedGame(kv)).toEqual(session);
});

it('marks a next-step hint without playing, preserves focus, and uses the visible directional controls', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(5, 33);
  await saveGame(session, kv);
  launch(kv, 'shortcut');
  await settle();
  const hint = screen.getByRole('button', { name: 'Hint' });
  hint.focus();
  fireEvent.click(hint);
  const next = solution(session)[0]!;
  expect(screen.getByRole('status')).toHaveTextContent(
    `Next step: row ${Math.floor(next / 5) + 1}, column ${(next % 5) + 1}.`,
  );
  expect(hint).toHaveFocus();
  expect(document.querySelector('.me-hint')).not.toBeNull();
  expect((await loadSavedGame(kv))?.history).toHaveLength(0);
  const direction = next === 1 ? 'right' : 'down';
  const button = screen.getByRole('button', { name: `Move ${direction}` });
  button.focus();
  fireEvent.click(button);
  await settle();
  expect(button).toHaveFocus();
  expect((await loadSavedGame(kv))?.position).toBe(next);
  expect(document.querySelector('.me-hint')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await settle();
  expect((await loadSavedGame(kv))?.position).toBe(0);
});

it('cancels a captured swipe without moving, then accepts a new swipe and adjacent tap', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(5, 31);
  await saveGame(session, kv);
  launch(kv, 'shortcut');
  await settle();
  const board = screen.getByRole('group', { name: 'Maze' });
  Object.defineProperty(board, 'setPointerCapture', { configurable: true, value: vi.fn() });
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 530,
    bottom: 530,
    width: 530,
    height: 530,
    toJSON: () => ({}),
  });
  const first = solution(session)[0]!;
  const end = first === 1 ? { clientX: 150, clientY: 50 } : { clientX: 50, clientY: 150 };
  fireEvent.pointerDown(board, {
    pointerId: 8,
    isPrimary: true,
    button: 0,
    clientX: 50,
    clientY: 50,
  });
  fireEvent.pointerCancel(board, { pointerId: 8 });
  fireEvent.pointerUp(board, { pointerId: 8, ...end });
  await settle();
  expect((await loadSavedGame(kv))?.position).toBe(0);
  fireEvent.pointerDown(board, {
    pointerId: 9,
    isPrimary: true,
    button: 0,
    clientX: 50,
    clientY: 50,
  });
  fireEvent.pointerUp(board, { pointerId: 9, ...end });
  await settle();
  expect((await loadSavedGame(kv))?.position).toBe(first);
  // Tap the adjacent start cell to step back through the same passage.
  fireEvent.pointerDown(board, {
    pointerId: 10,
    isPrimary: true,
    button: 0,
    clientX: 65,
    clientY: 65,
  });
  fireEvent.pointerUp(board, { pointerId: 10, clientX: 65, clientY: 65 });
  await settle();
  expect((await loadSavedGame(kv))?.position).toBe(0);
  expect((await loadSavedGame(kv))?.history).toHaveLength(2);
});

it('ignores a secondary finger release without losing the captured primary swipe', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(5, 31);
  await saveGame(session, kv);
  launch(kv, 'shortcut');
  await settle();
  const board = screen.getByRole('group', { name: 'Maze' });
  const capture = vi.fn();
  Object.defineProperty(board, 'setPointerCapture', { configurable: true, value: capture });
  const first = solution(session)[0]!;
  const end = first === 1 ? { clientX: 150, clientY: 50 } : { clientX: 50, clientY: 150 };
  fireEvent.pointerDown(board, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 50,
    clientY: 50,
  });
  fireEvent.pointerDown(board, {
    pointerId: 2,
    isPrimary: false,
    button: 0,
    clientX: 50,
    clientY: 50,
  });
  fireEvent.pointerUp(board, { pointerId: 2, isPrimary: false, ...end });
  await settle();
  expect(capture.mock.calls).toEqual([[1]]);
  expect((await loadSavedGame(kv))?.history).toHaveLength(0);
  fireEvent.pointerUp(board, { pointerId: 1, isPrimary: true, ...end });
  await settle();
  expect((await loadSavedGame(kv))?.position).toBe(first);
  expect((await loadSavedGame(kv))?.history).toEqual([first]);
});

it('stops its only play clock while a restart dialog is open and resumes after Cancel', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  await saveGame(createSession(5, 19), kv);
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
