import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { trackResources } from '@/test/lifecycle';
import { IV_STORAGE_KEYS } from '../storage/keys';
import { InvadersRoot } from './InvadersRoot';
afterEach(cleanup);
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
async function play() {
  const kv = createMemoryKV({
    [IV_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
  });
  const view = render(
    <SettingsProvider
      initialSettings={{ ...settingsSchema.defaultValue(), language: 'en', sound: false }}
    >
      <InvadersRoot onExit={() => undefined} kv={kv} />
    </SettingsProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: 'New Game' }));
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  await wait(120);
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  expect(document.querySelector('.iv-enemy')?.getAttribute('transform')).not.toBe(
    'translate(60 55)',
  );
  return view;
}
it('releases real animation frames, keyboard and background listeners during a running unmount', async () => {
  const warm = await play();
  warm.unmount();
  await wait(0);
  const tracker = trackResources();
  try {
    const view = await play();
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
it('runs no frames while paused and releases every listener on exit', async () => {
  const warm = await play();
  warm.unmount();
  await wait(0);
  const tracker = trackResources();
  try {
    const view = await play();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const position = document.querySelector('.iv-enemy')?.getAttribute('transform');
    await wait(120);
    expect(document.querySelector('.iv-enemy')).toHaveAttribute('transform', position);
    view.unmount();
    tracker.assertReleased();
  } finally {
    tracker.restore();
  }
});
