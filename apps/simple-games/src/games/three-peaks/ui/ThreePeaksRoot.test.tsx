import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV, type KVStore } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession } from '../game';
import { WINNING_ACTIONS, winningPrefix } from '../game/fixtures';
import { loadSavedGame, toPersisted } from '../storage/gamePersistence';
import { TP_STORAGE_KEYS } from '../storage/keys';
import { ThreePeaksRoot } from './ThreePeaksRoot';
const settle = () =>
  act(async () => {
    for (let n = 0; n < 30; n++) await Promise.resolve();
  });
function launch(kv: KVStore, shortcut = false) {
  const onExit = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      {shortcut ? (
        <ThreePeaksRoot onExit={onExit} kv={kv} entry="shortcut" />
      ) : (
        <ThreePeaksRoot onExit={onExit} kv={kv} />
      )}
    </SettingsProvider>,
  );
  return { ...view, onExit };
}
const flags = JSON.stringify({ schemaVersion: 1, tutorialCompleted: true });
afterEach(async () => {
  cleanup();
  await settle();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe('Three Peaks player lifecycle', () => {
  it('shows three tutorial steps then starts and persists an actual deal', async () => {
    const kv = createMemoryKV();
    launch(kv);
    await settle();
    expect(screen.getByRole('heading', { name: 'How to Play' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing' }));
    await settle();
    const tableau = screen.getByRole('group', { name: 'Three peaks tableau' });
    expect(tableau).toBeInTheDocument();
    const covered = tableau.querySelectorAll('.tp-covered');
    expect(covered).toHaveLength(18);
    for (const card of covered) {
      expect(card.querySelector('.tp-card-back')).toBeInTheDocument();
      expect(card.querySelector('.tp-card-art')).toBeNull();
      expect(card).not.toHaveClass('tp-red');
    }
    expect(await loadSavedGame(kv)).not.toBeNull();
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.flags))!).tutorialCompleted).toBe(true);
  });
  it('resumes only via a shortcut, retains the saved clock, and cleans up its timer', async () => {
    vi.useFakeTimers();
    const kv = createMemoryKV({
      [TP_STORAGE_KEYS.flags]: flags,
      [TP_STORAGE_KEYS.game]: JSON.stringify(
        toPersisted({ ...createSession(6), elapsedSeconds: 41 }, 1),
      ),
    });
    const first = launch(kv);
    await settle();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    first.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(41);
    const second = launch(kv, true);
    await settle();
    expect(screen.getByRole('group', { name: 'Three peaks tableau' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(3000));
    second.unmount();
    await settle();
    expect((await loadSavedGame(kv))?.elapsedSeconds).toBe(44);
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.stats))!).totalPlaySeconds).toBe(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('draws once per key press, blocks keys behind confirmation, and undoes after resume', async () => {
    const kv = createMemoryKV({
      [TP_STORAGE_KEYS.flags]: flags,
      [TP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(createSession(6), 1)),
    });
    const view = launch(kv, true);
    await settle();
    fireEvent.keyDown(window, { key: 'd' });
    fireEvent.keyDown(window, { key: 'd', repeat: true });
    await settle();
    expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    fireEvent.keyDown(window, { key: 'd' });
    await settle();
    expect((await loadSavedGame(kv))?.actions).toHaveLength(1);
    expect(
      screen
        .getByRole('group', { name: 'Three peaks tableau', hidden: true })
        .closest('.game-content'),
    ).toHaveAttribute('inert');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    view.unmount();
    await settle();
    launch(kv, true);
    await settle();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await settle();
    expect((await loadSavedGame(kv))?.actions).toHaveLength(0);
  });
  it('records a win once despite undo, resume and another completion, then starts fresh', async () => {
    const session = winningPrefix(WINNING_ACTIONS.length - 1);
    const kv = createMemoryKV({
      [TP_STORAGE_KEYS.flags]: flags,
      [TP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
    });
    const view = launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Card 3:/ }));
    await settle();
    expect(screen.getByRole('alertdialog', { name: 'All peaks cleared!' })).toBeInTheDocument();
    expect(await loadSavedGame(kv)).toBeNull();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Undo' }));
    await settle();
    expect((await loadSavedGame(kv))?.countedWin).toBe(true);
    view.unmount();
    await settle();
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: /Card 3:/ }));
    await settle();
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.stats))!).wins).toBe(1);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New Game' }),
    );
    await settle();
    expect((await loadSavedGame(kv))?.actions).toHaveLength(0);
    expect((await loadSavedGame(kv))?.countedWin).toBe(false);
  });
  it('falls back safely on a corrupt save and asks before replacing a live game', async () => {
    const kv = createMemoryKV({
      [TP_STORAGE_KEYS.flags]: flags,
      [TP_STORAGE_KEYS.game]: '{broken',
    });
    launch(kv, true);
    await settle();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByRole('alertdialog', { name: 'Start a new game?' })).toBeInTheDocument();
    expect(document.querySelector('.tp-home-content')).toHaveAttribute('inert');
  });
  it('retries the exact deal from both the header and result as a new counted attempt', async () => {
    const session = {
      ...winningPrefix(WINNING_ACTIONS.length - 1),
      countedWin: true,
      elapsedSeconds: 59,
    };
    const kv = createMemoryKV({
      [TP_STORAGE_KEYS.flags]: flags,
      [TP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(session, 1)),
      [TP_STORAGE_KEYS.stats]: JSON.stringify({
        schemaVersion: 1,
        played: 1,
        wins: 1,
        bestRemaining: 0,
        totalPlaySeconds: 59,
      }),
    });
    launch(kv, true);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Retry same board' }));
    const restart = within(screen.getByRole('alertdialog'));
    expect(restart.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    fireEvent.click(restart.getByRole('button', { name: 'Retry same board' }));
    await settle();
    expect(await loadSavedGame(kv)).toEqual(createSession(6));
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.stats))!).played).toBe(2);
    for (const action of WINNING_ACTIONS) {
      fireEvent.click(
        screen.getByRole('button', {
          name: action.kind === 'draw' ? /^Draw a card;/ : new RegExp(`^Card ${action.index + 1}:`),
        }),
      );
    }
    await settle();
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.stats))!).wins).toBe(2);
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();
    expect(await loadSavedGame(kv)).toEqual(createSession(6));
    expect(JSON.parse((await kv.get(TP_STORAGE_KEYS.stats))!).played).toBe(3);
  });
});
