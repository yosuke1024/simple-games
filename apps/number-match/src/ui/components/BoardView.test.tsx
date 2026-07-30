import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBoard } from '../../game/test-helpers';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { BoardView, type MatchAnim } from './BoardView';

afterEach(cleanup);

function renderBoard(rows: string[], onCellTap = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BoardView
        board={makeBoard(...rows)}
        selected={null}
        hintPair={null}
        invalidPair={null}
        blocked={null}
        onCellTap={onCellTap}
      />
    </SettingsProvider>,
  );
  return onCellTap;
}

describe('BoardView', () => {
  it('renders one button per live cell and none for stones', () => {
    // '1', wild, '2' are playable; the stone is not, so it must stay out of the
    // tab order rather than being a button that does nothing.
    renderBoard(['1*S2']);
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('announces a stone instead of hiding it', () => {
    // A stone is what stands in a rejected pair's way; a hidden obstacle would
    // leave the rejection unexplained for a screen reader.
    renderBoard(['1S2']);
    expect(screen.getByRole('img', { name: /stone/i })).toBeInTheDocument();
  });

  it('marks a wild as a wild rather than reading out a number', () => {
    renderBoard(['1*']);
    expect(screen.getByRole('button', { name: /wild/i })).toBeInTheDocument();
  });

  it('reports taps on a wild like any other live cell', async () => {
    const user = userEvent.setup();
    const onCellTap = renderBoard(['1*']);
    await user.click(screen.getByRole('button', { name: /wild/i }));
    expect(onCellTap).toHaveBeenCalledWith(1);
  });
});

describe('BoardView match animation', () => {
  // jsdom has no matchMedia, which BoardView treats as "reduce motion" — the
  // animation path needs a real-looking one to run at all.
  function stubMatchMedia() {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('skips animation entirely without matchMedia (reduced-motion fallback)', () => {
    // No stub: the collapsed board must render immediately.
    const prevBoard = makeBoard('55', '12');
    const lastMatch: MatchAnim = { pair: [0, 1], prevBoard, rowsRemoved: 1 };
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BoardView
          board={makeBoard('12')}
          selected={null}
          hintPair={null}
          invalidPair={null}
          blocked={null}
          lastMatch={lastMatch}
          onCellTap={vi.fn()}
        />
      </SettingsProvider>,
    );
    expect(document.querySelectorAll('.cell-clearing')).toHaveLength(0);
    expect(document.querySelectorAll('.board-row')).toHaveLength(1);
  });

  it('acts out a row-removing match: pop, then row collapse, then the real board', () => {
    stubMatchMedia();
    vi.useFakeTimers();

    // Matching the two 5s empties row 0; the model board is just row '12'.
    const prevBoard = makeBoard('55', '12');
    const lastMatch: MatchAnim = { pair: [0, 1], prevBoard, rowsRemoved: 1 };
    render(
      <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
        <BoardView
          board={makeBoard('12')}
          selected={null}
          hintPair={null}
          invalidPair={null}
          blocked={null}
          lastMatch={lastMatch}
          onCellTap={vi.fn()}
        />
      </SettingsProvider>,
    );

    // Pop phase: the pre-match board is held, the pair plays its send-off.
    expect(document.querySelectorAll('.board-row')).toHaveLength(2);
    expect(document.querySelectorAll('.cell-clearing')).toHaveLength(2);
    expect(document.querySelectorAll('.row-collapsing')).toHaveLength(0);

    // Collapse phase (after POP_MS): the emptied row is closing.
    act(() => vi.advanceTimersByTime(260));
    expect(document.querySelectorAll('.cell-clearing')).toHaveLength(0);
    expect(document.querySelectorAll('.row-collapsing')).toHaveLength(1);

    // Settled (after COLLAPSE_MS): the real, collapsed board takes over.
    act(() => vi.advanceTimersByTime(300));
    expect(document.querySelectorAll('.board-row')).toHaveLength(1);
    expect(document.querySelectorAll('.row-collapsing')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /^1,/ })).toBeInTheDocument();
  });
});
