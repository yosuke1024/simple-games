/**
 * What the result card hands the Club House (docs/CHAIN_TERRITORY_RULES.md
 * 「Club House」): a won game goes to its CPU strength's table with the moves
 * the card shows; a loss is `played`, which the Club sends nowhere. There is
 * no daily, so there is never a date or a board digest.
 */
// Rendered without the game's Root, so the catalog the Root registers is registered here.
import '../../i18n';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { CHAIN_TERRITORY_CHALLENGE } from '../../challenge/contract';
import { act, createSession, resultValue, type Mode, type Session } from '../../game';
import { ResultOverlay } from './ResultOverlay';

const clubProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock('@/ui/components/ClubResultAction', () => ({
  ClubResultAction: (props: Record<string, unknown>) => {
    clubProps.current = props;
    return null;
  },
}));

function playOut(mode: Mode, seed: number, cells: readonly number[]): Session {
  let s = createSession(mode, seed);
  for (const cell of cells) s = act(s, cell)!;
  return s;
}

function show(session: Session) {
  clubProps.current = null;
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <ResultOverlay session={session} onRetry={vi.fn()} onNewBoard={vi.fn()} onHome={vi.fn()} />
    </SettingsProvider>,
  );
}

afterEach(cleanup);

describe('Chain Territory ResultOverlay → Club', () => {
  it('sends a win to its strength’s table with the moves the card shows', () => {
    // Player 0, CPU 1, player 0 again: the corner splits and takes the CPU's only cell.
    const won = playOut('hard', 0xffff_fff0, [0, 1, 0]);
    expect(won.status).toBe('won');
    show(won);
    const moves = resultValue(won);
    expect(clubProps.current).toMatchObject({
      gameId: 'chain-territory',
      outcome: 'completed',
      facts: { moves },
      seed: String(0xffff_fff0),
      params: { difficulty: 'hard' },
      boardDigest: null,
    });
    expect(clubProps.current!.daily).toBeUndefined();
    // The facts repeat the card: the same number is on screen and in the share details.
    const details = clubProps.current!.details as readonly { label: string; value: string }[];
    expect(details[0]!.value).toBe(String(moves));
    expect(screen.getByRole('alertdialog').textContent).toContain(String(moves));
    // The contract takes what the card sends as it is: a refusal would drop it silently.
    expect(CHAIN_TERRITORY_CHALLENGE.validateParams(clubProps.current!.params)).toEqual({
      difficulty: 'hard',
    });
    expect(CHAIN_TERRITORY_CHALLENGE.validateFacts(clubProps.current!.facts)).toEqual({ moves });
  });

  it('marks a loss as played, so it is never ranked', () => {
    // Player 1, CPU 0, player 1, CPU 0: the CPU's corner splits into 1 and the chain takes it all.
    const lost = playOut('easy', 7, [1, 0, 1, 0]);
    expect(lost.status).toBe('lost');
    show(lost);
    expect(clubProps.current).toMatchObject({
      gameId: 'chain-territory',
      outcome: 'played',
      facts: { moves: resultValue(lost) },
      params: { difficulty: 'easy' },
      boardDigest: null,
    });
  });
});
