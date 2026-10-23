import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { createSession, move, solution, neighbours } from '../game';
import { saveGame, loadSavedGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { LightGridRoot } from './LightGridRoot';
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
        <LightGridRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <LightGridRoot onExit={vi.fn()} entry={entry} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('LightGrid playable screens', () => {
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
    let lastAction = 0;
    while (session.status === 'playing') {
      const action = solution(session.board, session.size)![0]!;
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
      fireEvent.click(
        screen.getByRole('button', {
          name: new RegExp(
            `Row ${Math.floor(lastAction / session.size) + 1}, column ${(lastAction % session.size) + 1}:`,
          ),
        }),
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

it('explains the exact next tap, previews only its neighbours and never plays a hint automatically', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(3, 33);
  await saveGame(session, kv);
  launch(kv, 'shortcut');
  await settle();
  const first = screen.getByRole('button', { name: /Row 1, column 1:/ });
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: /Row 1, column 2:/ })).toHaveFocus();
  const hintButton = screen.getByRole('button', { name: 'Hint' });
  hintButton.focus();
  fireEvent.click(hintButton);
  const hinted = screen.getByRole('button', { name: /Row .*Hint/ });
  const target = solution(session.board, session.size)![0]!;
  expect(hinted).toHaveClass('lg-hinted');
  expect(hinted.querySelector('.lg-hint-marker')).toHaveTextContent('1');
  expect(hinted).toHaveAttribute('aria-describedby', 'lg-hint-instruction');
  expect(document.querySelector('#lg-hint-instruction')).toHaveTextContent(
    `Tap row ${Math.floor(target / session.size) + 1}, column ${(target % session.size) + 1}.`,
  );
  expect(document.querySelector('#lg-hint-instruction')).toHaveTextContent(
    'The outlined neighbours also switch.',
  );
  expect(hintButton).toHaveFocus();
  const cells = [...document.querySelectorAll('.lg-cell')];
  const preview = cells.flatMap((cell, index) =>
    cell.classList.contains('lg-affected') ? [index] : [],
  );
  expect(preview.sort((a, b) => a - b)).toEqual(
    neighbours(session.size, target).sort((a, b) => a - b),
  );
  expect((await loadSavedGame(kv))?.history).toEqual([]);
  fireEvent.click(hintButton);
  expect((await loadSavedGame(kv))?.history).toEqual([]);
  fireEvent.click(hinted);
  await settle();
  const expected = move(session, target)!;
  expect(
    cells.filter(
      (cell, index) =>
        (cell.getAttribute('aria-pressed') === 'true') !== Boolean(session.board[index]),
    ),
  ).toHaveLength(neighbours(session.size, target).length + 1);
  if (expected.status === 'playing')
    expect((await loadSavedGame(kv))?.board).toEqual(expected.board);
  expect(document.querySelector('.lg-hint-marker')).toBeNull();
  expect(document.querySelectorAll('.lg-affected')).toHaveLength(0);
});

it('isolates the Home replacement confirmation and Cancel preserves the save', async () => {
  const kv = createMemoryKV();
  await taught(kv);
  const session = createSession(3, 81);
  await saveGame(session, kv);
  launch(kv);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: '4 × 4' }));
  expect(document.querySelector('.lg-home-content')).toHaveAttribute('inert');
  const dialog = screen.getByRole('alertdialog');
  expect(dialog.closest('[inert]')).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await settle();
  expect(document.querySelector('.lg-home-content')).not.toHaveAttribute('inert');
  expect(await loadSavedGame(kv)).toEqual(session);
});
