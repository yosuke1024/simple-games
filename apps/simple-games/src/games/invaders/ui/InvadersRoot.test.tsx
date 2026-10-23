import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { loadRecord, saveRecord } from '@/storage/repo';
import { createSession, start, type Session } from '../game';
import { loadSavedGame, saveGame } from '../storage/gamePersistence';
import { flagsSchema, statsSchema } from '../storage/schemas';
import { InvadersRoot } from './InvadersRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 25; i += 1) await Promise.resolve();
  });
afterEach(async () => {
  cleanup();
  await settle();
  vi.restoreAllMocks();
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
        <InvadersRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      ) : (
        <InvadersRoot onExit={vi.fn()} kv={kv} />
      )}
    </SettingsProvider>,
  );
}
async function taught(kv: KVStore) {
  await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
}
function frames() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((fn) => {
    pending.set(++id, fn);
    return id;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => {
    pending.delete(handle);
  });
  return {
    pending,
    tick(time: number) {
      act(() => {
        const callbacks = [...pending.values()];
        pending.clear();
        callbacks.forEach((fn) => fn(time));
      });
    },
  };
}
describe('Invaders playable flow', () => {
  it('teaches in three steps, starts explicitly, pauses on blur and never resumes itself', async () => {
    const animation = frames();
    const kv = createMemoryKV();
    launch(kv);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    expect(animation.pending.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    animation.tick(0);
    animation.tick(100);
    expect(animation.pending.size).toBe(1);
    fireEvent.blur(window);
    await settle();
    expect(animation.pending.size).toBe(0);
    expect((await loadSavedGame(kv))?.status).toBe('paused');
    fireEvent.focus(window);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(animation.pending.size).toBe(0);
    expect((await loadRecord(statsSchema, kv)).played).toBe(1);
  });
  it('restores a shortcut paused, books seconds on unmount once, and releases the RAF', async () => {
    const animation = frames();
    const kv = createMemoryKV();
    await taught(kv);
    await saveRecord(
      statsSchema,
      { ...statsSchema.defaultValue(), played: 1, totalPlaySeconds: 2 },
      kv,
    );
    await saveGame({ ...start(createSession()), ticks: 60, elapsedSeconds: 2 }, kv);
    const view = launch(kv, true);
    await settle();
    expect(animation.pending.size).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    animation.tick(0);
    for (let i = 1; i <= 32; i += 1) animation.tick(i * 34);
    view.unmount();
    await settle();
    expect(animation.pending.size).toBe(0);
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(3);
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(3);
    expect((await loadRecord(statsSchema, kv)).played).toBe(1);
    launch(kv);
    await settle();
    cleanup();
    await settle();
    expect((await loadRecord(statsSchema, kv)).totalPlaySeconds).toBe(3);
  });
  it('isolates Home replacement confirmation and preserves the suspended run when cancelled', async () => {
    frames();
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame(start(createSession()), kv);
    launch(kv);
    await settle();
    const before = await loadSavedGame(kv);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(document.querySelector('.iv-home-content')).toHaveAttribute('inert');
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.closest('[inert]')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(before);
  });
  it('wins, shares only final facts, clears the save, and never double-books a clear', async () => {
    const animation = frames();
    const kv = createMemoryKV();
    await taught(kv);
    await saveRecord(statsSchema, { ...statsSchema.defaultValue(), played: 1 }, kv);
    const final: Session = {
      ...start(createSession()),
      stage: 20,
      score: 13990,
      enemies: [{ id: 27, x: 180, y: 140 }],
      bullets: [{ id: 0, x: 180, y: 157, owner: 'player' }],
      nextBulletId: 1,
      fireTicks: 5,
    };
    await saveGame(final, kv);
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    animation.tick(0);
    animation.tick(40);
    await settle();
    const dialog = screen.getByRole('alertdialog', { name: 'All clear!' });
    expect(within(dialog).getAllByText('14000')).toHaveLength(2);
    expect(within(dialog).getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    expect(animation.pending.size).toBe(0);
    expect(await loadSavedGame(kv)).toBeNull();
    expect((await loadRecord(statsSchema, kv)).cleared).toBe(1);
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    animation.tick(80);
    expect((await loadRecord(statsSchema, kv)).cleared).toBe(1);
  });
  it('releases held controls on pointercancel and consumes their trailing click', async () => {
    const animation = frames();
    const kv = createMemoryKV();
    await taught(kv);
    await saveGame(createSession(), kv);
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    animation.tick(0);
    const right = screen.getByRole('button', { name: 'Move right' });
    fireEvent.pointerDown(right, { pointerId: 1, button: 0 });
    animation.tick(40);
    expect(document.querySelector('.iv-ship')).not.toHaveAttribute(
      'transform',
      'translate(180 438)',
    );
    fireEvent.pointerCancel(right, { pointerId: 1 });
    const ship = document.querySelector('.iv-ship')!;
    const position = ship.getAttribute('transform');
    fireEvent.click(right, { detail: 1 });
    animation.tick(80);
    expect(ship).toHaveAttribute('transform', position);
  });
});
