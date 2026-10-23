import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { act as playAction, createSession, start } from '../game';
import { loadSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { FallingBlocksRoot } from './FallingBlocksRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });
afterEach(async () => {
  cleanup();
  await settle();
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});
function launch(kv: KVStore, shortcut = false) {
  return render(
    <SettingsProvider
      initialSettings={{
        ...settingsSchema.defaultValue(),
        language: 'en',
        sound: false,
        vibration: false,
        reducedMotion: true,
      }}
    >
      {shortcut ? (
        <FallingBlocksRoot onExit={vi.fn()} kv={kv} entry="shortcut" />
      ) : (
        <FallingBlocksRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
describe('Falling Blocks playable UI', () => {
  it('teaches three rules, shows a ready board, and accepts touch and keyboard input', async () => {
    const kv = createMemoryKV();
    launch(kv);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Move left' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    const first = screen.getByRole('img', { name: /Board:/ }).getAttribute('aria-label');
    fireEvent.click(screen.getByRole('button', { name: 'Move left' }));
    expect(screen.getByRole('img', { name: /Board:/ }).getAttribute('aria-label')).not.toBe(first);
    fireEvent.keyDown(window, { key: ' ' });
    await settle();
    expect((await loadSavedGame(kv))?.pieceIndex).toBe(1);
    expect((await loadRecord(statsSchema, kv)).played).toBe(1);
  });
  it('pauses under restart, cancels without advancing, and resumes only explicitly', async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame(createSession(8), kv);
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    await settle();
    const before = await loadSavedGame(kv);
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    fireEvent.keyDown(window, { key: ' ' });
    act(() => vi.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(before);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('books running seconds on hidden and unmount exactly once, then restores paused', async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame(createSession(12), kv);
    const view = launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    act(() => vi.advanceTimersByTime(2200));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await settle();
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
    view.unmount();
    await settle();
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
    Reflect.deleteProperty(document, 'visibilityState');
    launch(kv, true);
    await settle();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(2);
  });
  it('preserves a saved run when the tutorial flag is absent', async () => {
    const kv = createMemoryKV();
    const run = { ...playAction(start(createSession(9)), 'hardDrop'), elapsedSeconds: 18 };
    await saveGame(run, kv);
    launch(kv);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect((await loadSavedGame(kv))?.seed).toBe(9);
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(18);
  });
  it('finishes, shares only the result facts and offers unlimited same-seed retry', async () => {
    const kv = createMemoryKV();
    await taught(kv);
    let run = start(createSession(17));
    for (let i = 0; i < 30; i++) {
      const next = playAction(run, 'hardDrop');
      if (next.status === 'over') break;
      run = next;
    }
    await saveGame(run, kv);
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    fireEvent.keyDown(window, { key: ' ' });
    await settle();
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retry same board' }));
    await settle();
    const retried = await loadSavedGame(kv);
    expect(retried?.seed).toBe(17);
    expect(retried?.pieceIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Start Playing' })).toHaveFocus();
  });
  it('releases a held touch control and gravity when unmounted', async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame(createSession(12), kv);
    const view = launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Move down' }), {
      pointerId: 1,
      button: 0,
    });
    view.unmount();
    await settle();
    expect(vi.getTimerCount()).toBe(0);
  });
});
