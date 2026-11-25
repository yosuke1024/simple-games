/**
 * What the clear card hands the Club House (docs/COLOR_FLOOD_RULES.md, Club
 * House): the moves the card shows, in the board size's ranking table, with no
 * daily and no board digest. Only the clear the statistics count is sent — a
 * clear reached again after Undo on the card is not a second row — while
 * Retry and New Game start a new game and their clears are sent.
 */
// The first cases render the card without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { saveRecord } from '@/storage/repo';
import { settingsSchema } from '@/storage/schemas';
import { availableColours, createSession, move, type Session } from '../../game';
import { loadSavedGame, saveGame } from '../../storage/gamePersistence';
import { flagsSchema } from '../../storage/schemas';
import { ColorFloodRoot } from '../ColorFloodRoot';
import { ResultOverlay } from './ResultOverlay';

const club = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  mounts: 0,
}));
vi.mock('@/ui/components/ClubResultAction', async () => {
  const { useEffect } = await import('react');
  return {
    ClubResultAction: (props: Record<string, unknown>) => {
      club.current = props;
      useEffect(() => {
        club.mounts += 1;
      }, []);
      return null;
    },
  };
});

const settings = {
  ...settingsSchema.defaultValue(),
  language: 'en' as const,
  sound: false,
  vibration: false,
};

const settle = () =>
  act(async () => {
    for (let i = 0; i < 25; i++) await Promise.resolve();
  });

/** Plays the first colour on offer until the board is one colour; returns the cleared session. */
function solve(start: Session): Session {
  let session = start;
  while (session.status === 'playing')
    session = move(session, availableColours(session.board, session.size)[0]!)!;
  return session;
}

function renderCleared(session: Session, firstClear: boolean) {
  club.current = null;
  render(
    <SettingsProvider initialSettings={settings}>
      <ResultOverlay
        session={session}
        best={null}
        firstClear={firstClear}
        onUndo={vi.fn()}
        onRetry={vi.fn()}
        onNewBoard={vi.fn()}
        onHome={vi.fn()}
      />
    </SettingsProvider>,
  );
}

afterEach(async () => {
  cleanup();
  await settle();
  club.current = null;
  club.mounts = 0;
});

describe('Color Flood result card → Club', () => {
  it('sends the moves the card shows to its size’s table: no daily, no digest', () => {
    const cleared = solve(createSession(10, 2026));
    renderCleared(cleared, true);
    expect(club.current).toMatchObject({
      gameId: 'color-flood',
      outcome: 'completed',
      facts: { moves: cleared.history.length },
      seed: String(cleared.seed),
      params: { size: 10 },
      boardDigest: null,
    });
    expect(club.current!.daily).toBeUndefined();
    // The figure sent is the figure on the card and in the share's details.
    const details = club.current!.details as { label: string; value: string }[];
    expect(details[0]).toEqual({ label: 'Moves', value: String(cleared.history.length) });
    const card = screen.getByRole('alertdialog');
    expect(within(card).getByText('Moves').nextElementSibling).toHaveTextContent(
      String(cleared.history.length),
    );
    expect(String(club.current!.seed).length).toBeLessThanOrEqual(80);
  });

  it('names every size’s table by the size alone', () => {
    for (const size of [6, 14] as const) {
      renderCleared(solve(createSession(size, 77)), true);
      expect(club.current).toMatchObject({ params: { size } });
      cleanup();
    }
  });

  it('sends nothing for a clear reached again after Undo on the card', () => {
    renderCleared(solve(createSession(6, 5)), false);
    expect(club.current).toBeNull();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('through the game: the first clear is sent, a re-clear after Undo is not, Retry’s and New Game’s are', async () => {
    const kv = createMemoryKV();
    await saveRecord(flagsSchema, { schemaVersion: 1, tutorialCompleted: true }, kv);
    const opening = createSession(6, 123);
    await saveGame(opening, kv);
    render(
      <SettingsProvider initialSettings={settings}>
        <ColorFloodRoot onExit={vi.fn()} entry="shortcut" kv={kv} />
      </SettingsProvider>,
    );
    await settle();
    /** Plays the palette to the clear, mirroring each colour on a local copy. */
    const playToClear = async (start: Session) => {
      let session = start;
      while (session.status === 'playing') {
        const colour = availableColours(session.board, session.size)[0]!;
        fireEvent.keyDown(window, { key: String(colour + 1) });
        session = move(session, colour)!;
      }
      await settle();
      return session;
    };

    const first = await playToClear(opening);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(club.mounts).toBe(1);
    expect(club.current).toMatchObject({
      facts: { moves: first.history.length },
      seed: String(opening.seed),
      params: { size: 6 },
    });

    // Undo on the card, then the same clear again: the statistics do not count it, nor does the Club.
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Undo' }));
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.keyDown(window, { key: String(first.history[first.history.length - 1]! + 1) });
    await settle();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(club.mounts).toBe(1);

    // Retry is a new game: its clear is sent as its own row.
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Retry same board' }),
    );
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await playToClear(opening);
    expect(club.mounts).toBe(2);

    // New Game is a new board: its clear is sent too.
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'New Game' }),
    );
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const fresh = await loadSavedGame(kv);
    expect(fresh).not.toBeNull();
    expect(fresh!.seed).not.toBe(opening.seed);
    await playToClear(fresh!);
    expect(club.mounts).toBe(3);
    expect(club.current).toMatchObject({ seed: String(fresh!.seed), params: { size: 6 } });
  });
});
