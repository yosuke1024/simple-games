/**
 * The big board (docs/NESTED_TIC_TAC_TOE_RULES.md §1, §2, §6, §10).
 *
 * Nested in the DOM as on screen: the outer group holds nine small boards,
 * each its own labelled group of nine cell buttons, in the index order of §1
 * (small board 0's cells 0–8, then small board 1's …). Tab and the screen
 * reader both walk it that way, a small board at a time.
 *
 * Only the cells the player may play are enabled: everything else — a closed
 * board, a board the move was not sent to, a filled cell, the whole board on
 * the CPU's turn — is simply not offered, so nothing has to be refused or
 * scolded (§2). The boards the player may play in wear a second, inner ring
 * in the accent (a double frame against the single border of the rest): the
 * number of lines is the cue, so it holds without colour (§10), and their
 * group label adds "play here" for the ear. Taken boards
 * carry the taker's mark across them, drawn boards are only dimmed, and the
 * winning line's three boards are outlined while the rest dim.
 *
 * Motion is CSS only: the newest mark pops in (keyed by the move, so it plays
 * once), a board's big mark fades in when it is taken, and Reduced Motion
 * turns both off (`nt-board-still`).
 */
import { memo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { useReducedMotion } from '@/ui/useReducedMotion';
import {
  BOARD_COUNT,
  boardOf,
  CELLS_PER_BOARD,
  cellOf,
  CROSS,
  DRAWN,
  EMPTY,
  OPEN,
  type BoardView,
  type Mark,
} from '../../game';
import type { LastMove } from '../../state/GameContext';
import { NestedMark } from './NestedMark';

export interface NestedBoardProps {
  view: BoardView;
  playerMark: Mark;
  /** True on the player's turn of a live match: the frames show and legal cells are enabled. */
  playersTurn: boolean;
  lastMove: LastMove | null;
  onPlay: (cell: number) => void;
}

type SmallLabel =
  | 'nestedTicTacToeSmallOpen'
  | 'nestedTicTacToeSmallPlayable'
  | 'nestedTicTacToeSmallMine'
  | 'nestedTicTacToeSmallCpu'
  | 'nestedTicTacToeSmallDrawn';

export const NestedBoard = memo(function NestedBoard({
  view,
  playerMark,
  playersTurn,
  lastMove,
  onPlay,
}: NestedBoardProps) {
  const { t } = useSettings();
  const reducedMotion = useReducedMotion();

  const legal = new Set(playersTurn ? view.legal : []);
  const playable = new Set(playersTurn ? view.playable : []);
  const winning = view.winningLine === null ? null : new Set(view.winningLine);
  const takenNow =
    lastMove !== null && lastMove.took && lastMove.placed === view.lastMove
      ? boardOf(lastMove.placed)
      : null;

  return (
    <div
      className={`nt-board ${reducedMotion ? 'nt-board-still' : ''}`}
      role="group"
      aria-label={t('nestedTicTacToeBoardLabel')}
    >
      {Array.from({ length: BOARD_COUNT }, (_, board) => {
        const state = view.smalls[board]!;
        const owner: 'mine' | 'cpu' | null =
          state === OPEN || state === DRAWN ? null : state === playerMark ? 'mine' : 'cpu';
        const isPlayable = playable.has(board);
        // A playable board says so in words too: the turn line's "framed"
        // names a ring a screen reader cannot see (§10「読み上げ」).
        const labelKey: SmallLabel =
          state === OPEN
            ? isPlayable
              ? 'nestedTicTacToeSmallPlayable'
              : 'nestedTicTacToeSmallOpen'
            : state === DRAWN
              ? 'nestedTicTacToeSmallDrawn'
              : owner === 'mine'
                ? 'nestedTicTacToeSmallMine'
                : 'nestedTicTacToeSmallCpu';
        const inLine = winning?.has(board) ?? false;
        return (
          <div
            key={board}
            className="nt-small"
            role="group"
            aria-label={t(labelKey, { board: board + 1 })}
            data-state={state === OPEN ? 'open' : state === DRAWN ? 'drawn' : owner}
            data-playable={isPlayable ? 'true' : undefined}
            data-win={inLine ? (view.smalls[board] === playerMark ? 'mine' : 'cpu') : undefined}
            data-dim={winning !== null && !inLine ? 'true' : undefined}
          >
            {Array.from({ length: CELLS_PER_BOARD }, (_, place) => {
              const cell = cellOf(board, place);
              const value = view.cells[cell]!;
              const isLegal = legal.has(cell);
              const arrived = lastMove !== null && lastMove.placed === cell;
              const names = { board: board + 1, square: place + 1 };
              const label =
                value === EMPTY
                  ? isLegal
                    ? t('nestedTicTacToeCellPlayable', names)
                    : t('nestedTicTacToeCellEmpty', names)
                  : value === playerMark
                    ? value === CROSS
                      ? t('nestedTicTacToeCellYourCross', names)
                      : t('nestedTicTacToeCellYourCircle', names)
                    : value === CROSS
                      ? t('nestedTicTacToeCellCpuCross', names)
                      : t('nestedTicTacToeCellCpuCircle', names);
              return (
                <button
                  key={cell}
                  type="button"
                  className="nt-cell"
                  data-cell={cell}
                  aria-label={label}
                  disabled={!isLegal}
                  onClick={() => onPlay(cell)}
                >
                  {value !== EMPTY ? (
                    <NestedMark
                      // Keyed by the move that put it here: the pop plays on
                      // arrival and never again.
                      key={arrived ? lastMove!.moveCount : -1}
                      mark={value}
                      className={[
                        value === playerMark ? 'nt-mark-you' : 'nt-mark-cpu',
                        arrived ? 'nt-mark-pop' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    />
                  ) : null}
                  {view.lastMove === cell ? (
                    <span
                      className={`nt-last ${value === playerMark ? 'nt-mark-you' : 'nt-mark-cpu'}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
            {owner !== null ? (
              <NestedMark
                key={takenNow === board ? lastMove!.moveCount : -1}
                mark={state as Mark}
                big
                className={[
                  'nt-big',
                  owner === 'mine' ? 'nt-mark-you' : 'nt-mark-cpu',
                  takenNow === board ? 'nt-big-fade' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
