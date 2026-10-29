import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { createSession, serve } from '../game';
import { PR_STORAGE_KEYS } from '../storage/keys';
import { loadSavedGame } from '../storage/gamePersistence';
import { PaddleRallyRoot } from './PaddleRallyRoot';
const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
function store() {
  return createMemoryKV({
    [PR_STORAGE_KEYS.saveGame]: JSON.stringify({
      ...serve(createSession('normal')),
      elapsedSeconds: 11,
    }),
    [PR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  });
}
function mount(kv = store(), shortcut = true) {
  return {
    kv,
    ...render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        {shortcut ? (
          <PaddleRallyRoot kv={kv} entry="shortcut" onExit={vi.fn()} />
        ) : (
          <PaddleRallyRoot kv={kv} onExit={vi.fn()} />
        )}
      </SettingsProvider>,
    ),
  };
}
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});
it('teaches three steps then opens the playable court', async () => {
  mount(createMemoryKV(), false);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
  await settle();
  expect(screen.getByRole('button', { name: 'Serve' })).toBeInTheDocument();
});
it('restores a paused snapshot through a shortcut and pauses on hide without advancing', async () => {
  vi.useFakeTimers();
  const view = mount();
  await settle();
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
  await advance(1000);
  expect((await loadSavedGame(view.kv))?.elapsedSeconds).toBe(11);
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  await advance(500);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  await settle();
  const saved = await loadSavedGame(view.kv);
  await advance(2000);
  expect(await loadSavedGame(view.kv)).toEqual(saved);
  expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
});
it('stops behind confirmation, books elapsed time once and releases resources', async () => {
  vi.useFakeTimers();
  const tracker = trackResources();
  try {
    const view = mount();
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await advance(1100);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await settle();
    const before = await loadSavedGame(view.kv);
    await advance(2000);
    expect(await loadSavedGame(view.kv)).toEqual(before);
    expect(document.querySelector('.game-content')).toHaveAttribute('inert');
    view.unmount();
    await settle();
    expect((await loadSavedGame(view.kv))?.elapsedSeconds).toBe(12);
    const stats = JSON.parse((await view.kv.get(PR_STORAGE_KEYS.stats))!);
    expect(stats.totalPlaySeconds).toBe(1);
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
it('releases held movement on pointercancel and spends its trailing click', async () => {
  vi.useFakeTimers();
  mount();
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  const right = screen.getByRole('button', { name: 'Move right' });
  Object.defineProperty(right, 'setPointerCapture', { value: vi.fn(), configurable: true });
  fireEvent.pointerDown(right, { pointerId: 1 });
  fireEvent.pointerCancel(right, { pointerId: 1 });
  const x = document.querySelector('.pr-player')!.getAttribute('x');
  fireEvent.click(right, { detail: 1 });
  await advance(100);
  expect(document.querySelector('.pr-player')!.getAttribute('x')).toBe(x);
});

it('does not count serve-waiting time and allows keyboard aiming before serving', async () => {
  vi.useFakeTimers();
  const kv = createMemoryKV({
    [PR_STORAGE_KEYS.saveGame]: JSON.stringify(createSession('normal')),
    [PR_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  });
  const view = mount(kv);
  await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
  const before = document.querySelector('.pr-player')!.getAttribute('x');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  fireEvent.keyUp(window, { key: 'ArrowRight' });
  expect(document.querySelector('.pr-player')!.getAttribute('x')).not.toBe(before);
  await advance(5000);
  view.unmount();
  await settle();
  expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(0);
  const stats = await kv.get(PR_STORAGE_KEYS.stats);
  expect(stats === null ? 0 : JSON.parse(stats).totalPlaySeconds).toBe(0);
});

it('draws the keys with shell icons and the ball as a lit object at an unchanged radius', async () => {
  mount();
  await settle();
  for (const name of ['Move left', 'Move right']) {
    const key = screen.getByRole('button', { name });
    // Text arrows differ per OS webview; the key carries an svg and no glyph.
    expect(key.querySelector('svg')).not.toBeNull();
    expect(key.textContent).toBe('');
  }
  expect(screen.getByRole('button', { name: 'Move right' }).querySelector('svg')).toHaveClass(
    'pr-key-arrow-right',
  );
  expect(screen.getByRole('button', { name: 'Move left' }).querySelector('svg')).not.toHaveClass(
    'pr-key-arrow-right',
  );
  const ball = document.querySelector('.pr-ball')!;
  expect(ball.getAttribute('r')).toBe('6');
  const [, x, y] = /^translate\(([-\d.]+) ([-\d.]+)\)$/.exec(
    ball.parentElement!.getAttribute('transform') ?? '',
  )!;
  const shade = document.querySelector('.pr-ball-shade')!;
  expect(Number(shade.getAttribute('cx'))).toBeCloseTo(Number(x) + 0.7, 5);
  expect(Number(shade.getAttribute('cy'))).toBeCloseTo(Number(y) + 2, 5);
  expect(ball.parentElement!.querySelector('.pr-ball-glint')).not.toBeNull();
  // The shadow is drawn before both paddles, so a ball slipping past one goes under it.
  const order = [...document.querySelectorAll('.pr-board > *')];
  expect(order.indexOf(shade)).toBeLessThan(order.indexOf(document.querySelector('.pr-cpu')!));
  expect(order.indexOf(shade)).toBeLessThan(order.indexOf(document.querySelector('.pr-player')!));
  expect(order.indexOf(ball.parentElement!)).toBeGreaterThan(
    order.indexOf(document.querySelector('.pr-player')!),
  );
});
